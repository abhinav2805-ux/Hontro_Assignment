const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    listId: { type: mongoose.Schema.Types.ObjectId, ref: 'List' },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    action: { type: String, required: true }, // e.g. TASK_CREATED, TASK_MOVED, TASK_UPDATED, TASK_DELETED
    details: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);

