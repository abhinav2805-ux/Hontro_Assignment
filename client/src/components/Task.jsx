import { Draggable } from '@hello-pangea/dnd';

const priorityColors = {
  Low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  High: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

export default function Task({ task, index }) {
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
            ${snapshot.isDragging 
              ? 'bg-blue-600 border-blue-500 shadow-2xl rotate-2 scale-105 z-50' 
              : 'bg-slate-700 border-slate-600 hover:border-slate-500 shadow-sm hover:shadow-md'
            }
          `}
        >
          {/* Drag Handle Indicator */}
          <div className="w-8 h-1 bg-slate-600 rounded-full mx-auto mb-3 opacity-0 group-hover:opacity-100 transition-opacity" />

          <h4 className={`font-medium text-sm mb-1 ${snapshot.isDragging ? 'text-white' : 'text-slate-200'}`}>
            {task.title}
          </h4>
          
          {task.description && (
            <p className={`text-xs mb-3 line-clamp-2 ${snapshot.isDragging ? 'text-blue-100' : 'text-slate-400'}`}>
              {task.description}
            </p>
          )}

          <div className="flex justify-between items-center mt-2">
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${priorityColors[task.priority] || priorityColors.Low}`}>
              {task.priority}
            </span>
            
            {/* Avatars (Placeholder) */}
            {task.assignees && task.assignees.length > 0 && (
               <div className="flex -space-x-2">
                 {task.assignees.map((u, i) => (
                   <div key={i} className="w-5 h-5 rounded-full bg-blue-500 border border-slate-800 text-[8px] flex items-center justify-center text-white">
                     {u.username?.[0] || 'U'}
                   </div>
                 ))}
               </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}