const express = require('express');
const Activity = require('../models/Activity');
const Board = require('../models/Board');
const { auth } = require('../middleware/auth');

const router = express.Router();

// All activity routes are protected
router.use(auth);

// Get history for a board - GET /api/activities/:boardId
router.get('/:boardId', async (req, res) => {
  try {
    const { boardId } = req.params;

    // Ensure the board is accessible to the current user (owner or collaborator)
    const board = await Board.findOne({
      _id: boardId,
      $or: [{ userId: req.userId }, { collaborators: req.userId }],
    });
    if (!board) {
      return res.status(404).json({ message: 'Board not found.' });
    }

    const activities = await Activity.find({ boardId })
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json(activities);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;

