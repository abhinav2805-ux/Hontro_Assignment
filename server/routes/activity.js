const express = require('express');
const ActivityLog = require('../models/ActivityLog');
const { auth } = require('../middleware/auth');

const router = express.Router();

// All activity routes are protected
router.use(auth);

// GET /api/activity?boardId=...&page=1&limit=20
router.get('/', async (req, res) => {
  try {
    const { boardId, page = 1, limit = 20 } = req.query;
    if (!boardId) {
      return res.status(400).json({ message: 'boardId query is required.' });
    }

    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const numericLimit = Math.max(parseInt(limit, 10) || 20, 1);
    const skip = (numericPage - 1) * numericLimit;

    const filter = { boardId, userId: req.userId };
    const [items, total] = await Promise.all([
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(numericLimit),
      ActivityLog.countDocuments(filter),
    ]);

    res.json({
      data: items,
      page: numericPage,
      limit: numericLimit,
      total,
      totalPages: Math.ceil(total / numericLimit) || 1,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;

