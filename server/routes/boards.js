const express = require('express');
const Board = require('../models/Board');
const List = require('../models/List');
const Task = require('../models/Task');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// POST /boards - Create a board
router.post('/', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'Title is required.' });
    }
    const board = new Board({ title, userId: req.userId });
    await board.save();
    res.status(201).json(board);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /boards - Get all boards for the current user
router.get('/', async (req, res) => {
  try {
    const boards = await Board.find({
      $or: [{ userId: req.userId }, { collaborators: req.userId }],
    }).sort({ createdAt: -1 });
    res.json(boards);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /boards/:id - Get single board with lists and tasks
router.get('/:id', async (req, res) => {
  try {
    const board = await Board.findOne({
      _id: req.params.id,
      $or: [{ userId: req.userId }, { collaborators: req.userId }],
    });
    if (!board) {
      return res.status(404).json({ message: 'Board not found.' });
    }
    const lists = await List.find({ boardId: board._id }).sort({ position: 1 });
    const tasks = await Task.find({ boardId: board._id }).sort({ position: 1 });
    const listsWithTasks = lists.map((list) => ({
      ...list.toObject(),
      tasks: tasks.filter((t) => t.listId.toString() === list._id.toString()),
    }));
    res.json({ ...board.toObject(), lists: listsWithTasks });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// PUT /boards/:id - Update board
router.put('/:id', async (req, res) => {
  try {
    const board = await Board.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: req.body },
      { new: true }
    );
    if (!board) {
      return res.status(404).json({ message: 'Board not found.' });
    }
    res.json(board);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// DELETE /boards/:id
router.delete('/:id', async (req, res) => {
  try {
    const board = await Board.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!board) {
      return res.status(404).json({ message: 'Board not found.' });
    }
    await List.deleteMany({ boardId: board._id });
    await Task.deleteMany({ boardId: board._id });
    res.json({ message: 'Board deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
