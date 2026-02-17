const express = require('express');
const Task = require('../models/Task');
const List = require('../models/List');
const Board = require('../models/Board');
const ActivityLog = require('../models/ActivityLog');
const Activity = require('../models/Activity');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// Helper to write structured activity logs without breaking the main flow
const logActivity = async ({ userId, boardId, listId, taskId, action, details }) => {
  try {
    await ActivityLog.create({ userId, boardId, listId, taskId, action, details });
  } catch (err) {
    // Don't crash the main request for logging issues
    console.error('ActivityLog error:', err.message);
  }
};

// Helper to log human‑readable board activity + emit over sockets
const logBoardActivity = async (req, action, boardId) => {
  try {
    const doc = await Activity.create({
      userId: req.userId || null,
      username: req.user?.username || 'Someone',
      action,
      boardId,
    });

    if (req.io) {
      req.io.to(boardId.toString()).emit('activityLog', doc);
    }
  } catch (err) {
    console.error('Activity error:', err.message);
  }
};

// POST /tasks - Create a task
router.post('/', async (req, res) => {
  try {
    const { title, description, listId, boardId, priority, deadline, position } = req.body;
    if (!title || !listId || !boardId) {
      return res.status(400).json({ message: 'Title, listId and boardId are required.' });
    }
    const board = await Board.findOne({
      _id: boardId,
      $or: [{ userId: req.userId }, { collaborators: req.userId }],
    });
    if (!board) {
      return res.status(404).json({ message: 'Board not found.' });
    }
    const list = await List.findOne({ _id: listId, boardId });
    if (!list) {
      return res.status(404).json({ message: 'List not found.' });
    }
    const pos = position != null ? position : await Task.countDocuments({ listId });
    const task = new Task({
      title,
      description: description || '',
      listId,
      boardId,
      priority: priority || 'Low',
      deadline: deadline || undefined,
      position: pos,
    });
    await task.save();

    await logActivity({
      userId: req.userId,
      boardId,
      listId,
      taskId: task._id,
      action: 'TASK_CREATED',
      details: `Task created: ${title}`,
    });

    // Simple history entry
    await logBoardActivity(req, `created task "${title}"`, boardId);

    if (req.io) req.io.to(boardId).emit('taskCreated', task);
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /tasks - Get tasks by listId or boardId with optional search & pagination
// Query: ?listId=... or ?boardId=... [&q=searchText&page=1&limit=20]
router.get('/', async (req, res) => {
  try {
    const { listId, boardId, q, page = 1, limit = 20 } = req.query;
    if (!listId && !boardId) {
      return res.status(400).json({ message: 'listId or boardId query is required.' });
    }

    let resolvedBoardId = boardId;
    if (!resolvedBoardId && listId) {
      const list = await List.findById(listId);
      resolvedBoardId = list?.boardId?.toString();
    }

    const board = await Board.findOne({
      _id: resolvedBoardId,
      $or: [{ userId: req.userId }, { collaborators: req.userId }],
    });
    if (!board) {
      return res.status(404).json({ message: 'Board not found.' });
    }

    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const numericLimit = Math.max(parseInt(limit, 10) || 20, 1);
    const skip = (numericPage - 1) * numericLimit;

    const baseFilter = boardId ? { boardId } : { listId };
    const filter = { ...baseFilter };

    if (q && q.trim()) {
      // Use Mongo text search on title/description
      filter.$text = { $search: q.trim() };
    }

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .sort({ position: 1 })
        .skip(skip)
        .limit(numericLimit)
        .populate('assignees', 'username email'),
      Task.countDocuments(filter),
    ]);

    res.json({
      data: tasks,
      page: numericPage,
      limit: numericLimit,
      total,
      totalPages: Math.ceil(total / numericLimit) || 1,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /tasks/:id
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('assignees', 'username email');
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    const board = await Board.findOne({
      _id: task.boardId,
      $or: [{ userId: req.userId }, { collaborators: req.userId }],
    });
    if (!board) return res.status(404).json({ message: 'Board not found.' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// PUT /tasks/:id - Update task (including moving to another list)
router.put('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    const board = await Board.findOne({
      _id: task.boardId,
      $or: [{ userId: req.userId }, { collaborators: req.userId }],
    });
    if (!board) return res.status(404).json({ message: 'Board not found.' });

    const { listId, position, title, description, priority, deadline, assignees, assigneeName } = req.body;

    let moved = false;
    const previousListId = task.listId.toString();

    // Moving task to another list
    if (listId !== undefined && listId !== previousListId) {
      const newList = await List.findOne({ _id: listId, boardId: task.boardId });
      if (!newList) {
        return res.status(400).json({ message: 'Target list not found or not in same board.' });
      }
      task.listId = listId;
      if (position !== undefined) task.position = position;
      else task.position = await Task.countDocuments({ listId });
      moved = true;
    } else if (position !== undefined) {
      task.position = position;
    }

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority !== undefined) task.priority = priority;
    if (deadline !== undefined) task.deadline = deadline;

    // Direct assignees array update (existing behaviour)
    if (assignees !== undefined) task.assignees = assignees;

    // NEW: Assign by username (assigneeName)
    if (assigneeName) {
      const userToAssign = await User.findOne({ username: assigneeName });
      if (!userToAssign) {
        return res.status(404).json('User not found');
      }
      const alreadyAssigned = task.assignees.some(
        (id) => id.toString() === userToAssign._id.toString()
      );
      if (!alreadyAssigned) {
        task.assignees.push(userToAssign._id);
      }

      // Ensure the assigned user can also see this board in their dashboard
      await Board.updateOne(
        { _id: task.boardId },
        { $addToSet: { collaborators: userToAssign._id } }
      );
    }

    await task.save();

    const populatedTask = await Task.findById(task._id).populate('assignees', 'username email');
    await logActivity({
      userId: req.userId,
      boardId: task.boardId,
      listId: task.listId,
      taskId: task._id,
      action: moved ? 'TASK_MOVED' : 'TASK_UPDATED',
      details: moved
        ? `Task moved from list ${previousListId} to ${task.listId.toString()}`
        : `Task updated: ${task.title}`,
    });

    // Human‑readable board history
    let humanAction = '';
    if (moved) {
      humanAction = `moved task "${task.title}"`;
    } else if (priority !== undefined) {
      humanAction = `changed priority of "${task.title}" to ${task.priority}`;
    } else if (assigneeName) {
      humanAction = `assigned "${task.title}" to ${assigneeName}`;
    } else if (title || description || deadline !== undefined) {
      humanAction = `updated task "${task.title}"`;
    }
    if (humanAction) {
      await logBoardActivity(req, humanAction, task.boardId.toString());
    }

    if (req.io) {
      const room = task.boardId.toString();
      if (moved) {
        // dedicated event for drag & drop moves
        req.io.to(room).emit('task_moved', populatedTask);
      }
      // snake_case and camelCase for compatibility
      req.io.to(room).emit('task_updated', populatedTask);
      req.io.to(room).emit('taskUpdated', populatedTask);
    }
    res.json(populatedTask);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// DELETE /tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    const board = await Board.findOne({
      _id: task.boardId,
      $or: [{ userId: req.userId }, { collaborators: req.userId }],
    });
    if (!board) return res.status(404).json({ message: 'Board not found.' });
    const boardId = task.boardId.toString();
    await task.deleteOne();

    await logActivity({
      userId: req.userId,
      boardId,
      listId: task.listId,
      taskId: task._id,
      action: 'TASK_DELETED',
      details: `Task deleted: ${task.title}`,
    });

    if (req.io) {
      req.io.to(boardId).emit('taskDeleted', { id: req.params.id });
    }
    res.json({ message: 'Task deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
