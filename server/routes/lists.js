const express = require('express');
const List = require('../models/List');
const Board = require('../models/Board');
const Task = require('../models/Task');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// POST /lists - Create a list
router.post('/', async (req, res) => {
  try {
    const { title, boardId } = req.body;
    if (!title || !boardId) {
      return res.status(400).json({ message: 'Title and boardId are required.' });
    }
    const board = await Board.findOne({ _id: boardId, userId: req.userId });
    if (!board) {
      return res.status(404).json({ message: 'Board not found.' });
    }
    const count = await List.countDocuments({ boardId });
    const list = new List({ title, boardId, position: count });
    await list.save();
    if (req.io) {
      req.io.to(boardId).emit('listCreated', list);
    }
    res.status(201).json(list);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /lists - Get lists by boardId (query: ?boardId=...)
router.get('/', async (req, res) => {
  try {
    const { boardId } = req.query;
    if (!boardId) {
      return res.status(400).json({ message: 'boardId query is required.' });
    }
    const board = await Board.findOne({ _id: boardId, userId: req.userId });
    if (!board) {
      return res.status(404).json({ message: 'Board not found.' });
    }
    const lists = await List.find({ boardId }).sort({ position: 1 });
    res.json(lists);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /lists/:id
router.get('/:id', async (req, res) => {
  try {
    const list = await List.findById(req.params.id);
    if (!list) return res.status(404).json({ message: 'List not found.' });
    const board = await Board.findOne({ _id: list.boardId, userId: req.userId });
    if (!board) return res.status(404).json({ message: 'Board not found.' });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// PUT /lists/:id - Update list (e.g. title, position)
router.put('/:id', async (req, res) => {
  try {
    const list = await List.findById(req.params.id);
    if (!list) return res.status(404).json({ message: 'List not found.' });
    const board = await Board.findOne({ _id: list.boardId, userId: req.userId });
    if (!board) return res.status(404).json({ message: 'Board not found.' });
    Object.assign(list, req.body);
    await list.save();
    if (req.io) req.io.to(list.boardId.toString()).emit('listUpdated', list);
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// DELETE /lists/:id
router.delete('/:id', async (req, res) => {
  try {
    const list = await List.findById(req.params.id);
    if (!list) return res.status(404).json({ message: 'List not found.' });
    const board = await Board.findOne({ _id: list.boardId, userId: req.userId });
    if (!board) return res.status(404).json({ message: 'Board not found.' });
    await Task.deleteMany({ listId: list._id });
    await list.deleteOne();
    if (req.io) req.io.to(list.boardId.toString()).emit('listDeleted', { id: list._id });
    res.json({ message: 'List deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
