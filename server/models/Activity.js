const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String }, // Cache username for speed
    action: { type: String, required: true }, // e.g., "moved task 'Bug Fix' to Done"
    boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Activity', ActivitySchema);

