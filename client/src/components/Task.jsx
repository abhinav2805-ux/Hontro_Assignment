import { useEffect, useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import toast from 'react-hot-toast';
import api from '../utils/api';

const priorityColors = {
  Low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  High: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

export default function Task({ task, index, currentUserId }) {
  const [priority, setPriority] = useState(task.priority || 'Low');
  const [showAssign, setShowAssign] = useState(false);
  const [assigneeName, setAssigneeName] = useState('');

  // Keep local state in sync with server/socket updates
  useEffect(() => {
    setPriority(task.priority || 'Low');
  }, [task.priority]);

  const cyclePriority = async () => {
    const order = ['Low', 'Medium', 'High'];
    const currentIndex = order.indexOf(priority);
    const nextPriority = order[(currentIndex + 1) % order.length];

    // Optimistic update
    setPriority(nextPriority);
    try {
      await api.put(`/tasks/${task._id}`, { priority: nextPriority });
    } catch (err) {
      toast.error('Failed to update priority');
      setPriority(priority);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assigneeName.trim()) return;

    try {
      await api.put(`/tasks/${task._id}`, { assigneeName: assigneeName.trim() });
      toast.success(`Assigned to ${assigneeName.trim()}`);
      setShowAssign(false);
      setAssigneeName('');
    } catch (err) {
      const msg = err?.response?.data || 'Failed to assign user';
      toast.error(typeof msg === 'string' ? msg : 'Failed to assign user');
    }
  };

  // Highlight tasks assigned to the current user
  const isAssignedToMe =
    currentUserId &&
    Array.isArray(task.assignees) &&
    task.assignees.some((u) => {
      const id = u?._id || u?.id || u;
      return id && id.toString() === currentUserId.toString();
    });

  return (
    <Draggable draggableId={task._id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{ ...provided.draggableProps.style }}
          className={`
            group relative p-3 mb-3 rounded-lg border 
            transition-all duration-200 ease-in-out
            ${
              snapshot.isDragging
                ? 'bg-blue-600 border-blue-500 shadow-2xl rotate-2 scale-105 z-50'
                : isAssignedToMe
                ? 'bg-emerald-700 border-emerald-400 hover:border-emerald-300 shadow-md'
                : 'bg-slate-700 border-slate-600 hover:border-slate-500 shadow-sm hover:shadow-md'
            }
          `}
        >
          {/* Drag Handle Indicator */}
          <div className="w-8 h-1 bg-slate-600 rounded-full mx-auto mb-3 opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className="flex justify-between items-start gap-2 mb-1">
            <h4
              className={`font-medium text-sm ${
                snapshot.isDragging ? 'text-white' : 'text-slate-200'
              }`}
            >
              {task.title}
            </h4>
            <button
              type="button"
              onClick={() => setShowAssign((s) => !s)}
              className="text-[10px] text-slate-500 hover:text-blue-300 opacity-0 group-hover:opacity-100 transition"
            >
              + User
            </button>
          </div>

          {task.description && (
            <p
              className={`text-xs mb-3 line-clamp-2 ${
                snapshot.isDragging ? 'text-blue-100' : 'text-slate-400'
              }`}
            >
              {task.description}
            </p>
          )}

          {/* Assignee chips */}
          {task.assignees && task.assignees.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {task.assignees.map((u, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 bg-blue-600/30 border border-blue-500/50 px-2 py-0.5 rounded-full"
                >
                  <span className="text-[10px] text-blue-100 font-medium">
                    {u.username || u}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Assign Input Popup */}
          {showAssign && (
            <form
              onSubmit={handleAssign}
              className="mt-1 mb-2 flex gap-1 animate-in fade-in slide-in-from-top-1"
            >
              <input
                className="w-full text-xs p-1.5 rounded bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 outline-none"
                placeholder="Enter username..."
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 rounded font-medium"
              >
                Add
              </button>
            </form>
          )}

          <div className="flex justify-between items-center mt-2">
            <button
              type="button"
              onClick={cyclePriority}
              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                priorityColors[priority] || priorityColors.Low
              } transition-colors hover:border-yellow-400/60 hover:text-yellow-300`}
              title="Click to change priority"
            >
              {priority}
            </button>
          </div>
        </div>
      )}
    </Draggable>
  );
}