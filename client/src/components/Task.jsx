import { Draggable } from '@hello-pangea/dnd';

export default function Task({ task, index }) {
  return (
    <Draggable draggableId={task._id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="bg-slate-900/80 text-slate-100 p-3 mb-2 rounded-xl shadow-md border border-slate-600/60 hover:border-emerald-400/70 hover:shadow-lg transition cursor-pointer"
        >
          <h4 className="font-medium text-sm">{task.title}</h4>
          {task.description && (
            <p className="text-[11px] text-slate-300 mt-1 line-clamp-2">
              {task.description}
            </p>
          )}
          <div className="flex justify-between items-center mt-2">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide ${
                task.priority === 'High'
                  ? 'bg-red-500/15 text-red-300 border border-red-400/40'
                  : task.priority === 'Medium'
                  ? 'bg-amber-500/15 text-amber-200 border border-amber-300/40'
                  : 'bg-emerald-500/15 text-emerald-200 border border-emerald-300/40'
              }`}
            >
              {task.priority}
            </span>
          </div>
        </div>
      )}
    </Draggable>
  );
}

