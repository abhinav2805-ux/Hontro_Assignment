import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Task from '../components/Task';

// Initialize socket outside component to prevent multiple connections
const socket = io('http://localhost:5000');

export default function Board() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [tasksByList, setTasksByList] = useState({});
  const [newListTitle, setNewListTitle] = useState('');
  const [newTaskTitles, setNewTaskTitles] = useState({});
  const [isDragging, setIsDragging] = useState(false); // New: Track dragging state

  // Initial Data Fetch
  useEffect(() => {
    fetchLists();
    fetchTasks();
    socket.emit('joinBoard', id);

    // Socket Listeners
    socket.on('taskCreated', handleTaskCreated);
    socket.on('taskUpdated', handleTaskUpdated); // Handle single update without reload
    socket.on('taskDeleted', handleTaskDeleted);
    socket.on('listCreated', fetchLists);

    return () => {
      socket.off('taskCreated');
      socket.off('taskUpdated');
      socket.off('taskDeleted');
      socket.off('listCreated');
    };
  }, [id]);

  // --- API Helpers ---
  const fetchLists = async () => {
    try {
      const { data } = await api.get(`/lists?boardId=${id}`);
      setLists(data);
    } catch (err) { console.error(err); }
  };

  const fetchTasks = async () => {
    try {
      const response = await api.get(`/tasks?boardId=${id}`);
      const tasks = response.data.data || response.data;
      groupTasks(tasks);
    } catch (err) { console.error(err); }
  };

  // Helper to group tasks by listId
  const groupTasks = (tasksArray) => {
    const grouped = {};
    tasksArray.forEach((task) => {
      if (!grouped[task.listId]) grouped[task.listId] = [];
      grouped[task.listId].push(task);
    });
    // Sort by position
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => a.position - b.position);
    });
    setTasksByList(grouped);
  };

  // --- Socket Handlers (The Fix for "Reloading") ---
  
  // 1. Only add the new task, don't refetch everything
  const handleTaskCreated = (newTask) => {
    setTasksByList((prev) => {
      const listTasks = prev[newTask.listId] || [];
      // Prevent duplicates
      if (listTasks.find(t => t._id === newTask._id)) return prev;
      return { ...prev, [newTask.listId]: [...listTasks, newTask] };
    });
  };

  // 2. Only update the specific task details
  const handleTaskUpdated = (updatedTask) => {
    // If we are currently dragging, ignore server updates to prevent jumps
    if (isDragging) return; 

    setTasksByList((prev) => {
      const newCtx = { ...prev };
      
      // Remove from old list (if list changed)
      Object.keys(newCtx).forEach(listId => {
        newCtx[listId] = newCtx[listId].filter(t => t._id !== updatedTask._id);
      });

      // Add to new list
      const destList = newCtx[updatedTask.listId] || [];
      destList.push(updatedTask);
      destList.sort((a, b) => a.position - b.position); // Ensure order
      newCtx[updatedTask.listId] = destList;

      return newCtx;
    });
  };

  // 3. Remove task locally
  const handleTaskDeleted = (taskId) => {
    setTasksByList((prev) => {
      const newCtx = { ...prev };
      Object.keys(newCtx).forEach(listId => {
        newCtx[listId] = newCtx[listId].filter(t => t._id !== taskId);
      });
      return newCtx;
    });
  };

  // --- Drag & Drop Logic ---
  const onDragStart = () => setIsDragging(true);

  const onDragEnd = async (result) => {
    setIsDragging(false);
    const { source, destination, draggableId } = result;

    // No valid drop target
    if (!destination) return;

    // Dropped back to original spot
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    // --- 1. Build the new in-memory board state (Notion-like, optimistic) ---
    const current = tasksByList;

    const sourceTasks = [...(current[source.droppableId] || [])];
    const destTasks =
      source.droppableId === destination.droppableId
        ? sourceTasks
        : [...(current[destination.droppableId] || [])];

    const [movedTask] = sourceTasks.splice(source.index, 1);
    const updatedMovedTask = { ...movedTask, listId: destination.droppableId };
    destTasks.splice(destination.index, 0, updatedMovedTask);

    const updatedTasksByList = {
      ...current,
      [source.droppableId]: sourceTasks,
      [destination.droppableId]: destTasks,
    };

    // Recompute positions for all tasks in the affected lists so that
    // what you see on screen is exactly what gets persisted.
    const updates = [];

    updatedTasksByList[source.droppableId].forEach((task, index) => {
      if (task.position !== index || task.listId !== source.droppableId) {
        updates.push({
          id: task._id,
          listId: source.droppableId,
          position: index,
        });
        // keep local state in sync immediately
        task.position = index;
        task.listId = source.droppableId;
      }
    });

    if (source.droppableId !== destination.droppableId) {
      updatedTasksByList[destination.droppableId].forEach((task, index) => {
        if (task.position !== index || task.listId !== destination.droppableId) {
          updates.push({
            id: task._id,
            listId: destination.droppableId,
            position: index,
          });
          task.position = index;
          task.listId = destination.droppableId;
        }
      });
    }

    // Optimistic UI update
    setTasksByList(updatedTasksByList);

    // --- 2. Persist the new ordering to the server for ALL affected tasks ---
    try {
      await Promise.all(
        updates.map((u) =>
          api.put(`/tasks/${u.id}`, {
            listId: u.listId,
            position: u.position,
          })
        )
      );
      // Socket events will sync other clients, while our isDragging flag
      // prevents mid-drag jumps on this client.
    } catch (err) {
      toast.error('Move failed');
      // As a safety net, reload from server
      fetchTasks();
    }
  };

  // --- Creation Logic ---
  const createList = async (e) => {
    e.preventDefault();
    if (!newListTitle) return;
    try {
      await api.post('/lists', { title: newListTitle, boardId: id });
      setNewListTitle('');
    } catch (err) { toast.error('Failed to create list'); }
  };

  const createTask = async (e, listId) => {
    e.preventDefault();
    const title = newTaskTitles[listId];
    if (!title) return;
    try {
      await api.post('/tasks', { title, listId, boardId: id });
      setNewTaskTitles({ ...newTaskTitles, [listId]: '' });
    } catch (err) { toast.error('Failed to create task'); }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white overflow-hidden font-sans">
      {/* Modern Header */}
      <header className="px-6 py-4 bg-slate-800/50 backdrop-blur-md border-b border-slate-700 flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">TM</div>
          <h1 className="font-bold text-lg tracking-wide text-slate-100">Project Board</h1>
        </div>
        <div className="flex gap-4">
          <button onClick={() => navigate('/dashboard')} className="text-sm text-slate-400 hover:text-white transition">
            Exit Board
          </button>
        </div>
      </header>

      {/* Board Canvas */}
      <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 flex items-start gap-6">
          
          {/* Render Lists */}
          {lists.map(list => (
            <div key={list._id} className="w-80 flex-shrink-0 bg-slate-800/80 rounded-xl border border-slate-700/50 shadow-xl flex flex-col max-h-full transition-colors hover:border-slate-600">
              
              {/* List Header */}
              <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
                <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">{list.title}</h3>
                <span className="text-xs text-slate-500 font-mono bg-slate-900 px-2 py-0.5 rounded-full">
                  {(tasksByList[list._id] || []).length}
                </span>
              </div>

              {/* Tasks Area */}
              <Droppable droppableId={list._id}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`p-3 flex-1 overflow-y-auto min-h-[100px] transition-colors ${
                      snapshot.isDraggingOver ? 'bg-slate-700/30' : ''
                    }`}
                  >
                    {(tasksByList[list._id] || []).map((task, index) => (
                      <Task key={task._id} task={task} index={index} />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              {/* Add Task Footer */}
              <form onSubmit={(e) => createTask(e, list._id)} className="p-3 pt-0">
                <input
                  type="text"
                  placeholder="+ Add Task"
                  className="w-full bg-slate-900/50 text-sm text-slate-300 p-2 rounded-lg border border-transparent hover:border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600"
                  value={newTaskTitles[list._id] || ''}
                  onChange={(e) => setNewTaskTitles({ ...newTaskTitles, [list._id]: e.target.value })}
                />
              </form>
            </div>
          ))}

          {/* New List Button */}
          <div className="w-80 flex-shrink-0">
            <form onSubmit={createList} className="bg-slate-800/40 p-3 rounded-xl border border-dashed border-slate-700 hover:border-blue-500/50 hover:bg-slate-800 transition-all cursor-pointer">
              <input
                type="text"
                placeholder="+ Add another list"
                className="w-full bg-transparent text-slate-300 p-2 outline-none placeholder:text-slate-500"
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
              />
            </form>
          </div>

        </div>
      </DragDropContext>
    </div>
  );
}