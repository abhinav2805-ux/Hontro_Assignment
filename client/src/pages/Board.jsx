import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Task from '../components/Task';

// Initialize socket outside component to prevent multiple connections.
// Uses env so deployment only needs .env change.
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, '')
    : 'http://localhost:5000');

const socket = io(SOCKET_URL);

export default function Board() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [tasksByList, setTasksByList] = useState({});
  const [newListTitle, setNewListTitle] = useState('');
  const [newTaskTitles, setNewTaskTitles] = useState({});
  const [newTaskPriorities, setNewTaskPriorities] = useState({});
  const [isDragging, setIsDragging] = useState(false); // Track dragging state
  const [activities, setActivities] = useState([]); // Activity history
  const [searchQuery, setSearchQuery] = useState(''); // Search text
  const [showHistory, setShowHistory] = useState(false); // Toggle sidebar
  const [page, setPage] = useState(1); // Pagination page
  const [totalPages, setTotalPages] = useState(1); // Total pages from backend

  const TASKS_PER_PAGE = 10;

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  })();

  // --- API Helpers ---
  const fetchLists = async () => {
    try {
      const { data } = await api.get(`/lists?boardId=${id}`);
      setLists(data);
    } catch (err) { console.error(err); }
  };

  const fetchTasks = async () => {
    try {
      const response = await api.get(
        `/tasks?boardId=${id}&q=${encodeURIComponent(
          searchQuery || ''
        )}&page=${page}&limit=${TASKS_PER_PAGE}`
      );
      const payload = response.data || {};
      const tasks = payload.data || payload.tasks || payload;

      if (payload.totalPages) {
        setTotalPages(payload.totalPages);
      }

      groupTasks(tasks);
    } catch (err) { console.error(err); }
  };

  const fetchHistory = async () => {
    try {
      const { data } = await api.get(`/activities/${id}`);
      setActivities(data);
    } catch (err) {
      console.error(err);
    }
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

  // --- Socket Handlers (Real‑time updates) ---

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
        newCtx[listId] = newCtx[listId].filter(t => t._id !== (taskId.id || taskId));
      });
      return newCtx;
    });
  };

  const handleActivityLog = (activity) => {
    setActivities((prev) => [activity, ...prev].slice(0, 50));
  };

  // Initial Data Fetch + socket wiring
  useEffect(() => {
    fetchLists();
    fetchTasks();
    fetchHistory();
    socket.emit('joinBoard', id);

    // Socket Listeners (support multiple event name variants)
    // For creation, refetch to keep pagination counts correct
    socket.on('taskCreated', () => fetchTasks());
    socket.on('taskUpdated', handleTaskUpdated); // camelCase
    socket.on('task_updated', handleTaskUpdated); // snake_case
    socket.on('task_moved', handleTaskUpdated);
    socket.on('taskDeleted', handleTaskDeleted);
    socket.on('listCreated', fetchLists);
    socket.on('activityLog', handleActivityLog);

    return () => {
      socket.off('taskCreated');
      socket.off('taskUpdated');
      socket.off('task_updated');
      socket.off('task_moved');
      socket.off('taskDeleted');
      socket.off('listCreated');
      socket.off('activityLog');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Refetch tasks whenever search changes
  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, page]);

  // --- Drag & Drop Logic ---
  const onDragStart = () => setIsDragging(true);

  const onDragEnd = async (result) => {
    setIsDragging(false);
    // Moving while filtered can create confusing ordering, so require clear search
    if (searchQuery) {
      toast.error('Clear search to move tasks');
      return;
    }
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
    const priority = newTaskPriorities[listId] || 'Low';
    try {
      await api.post('/tasks', {
        title,
        listId,
        boardId: id,
        priority,
      });
      setNewTaskTitles({ ...newTaskTitles, [listId]: '' });
      setNewTaskPriorities({ ...newTaskPriorities, [listId]: 'Low' });
    } catch (err) { toast.error('Failed to create task'); }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white overflow-hidden font-sans">
      {/* Header with search + history toggle */}
      <header className="px-6 py-4 bg-slate-800/50 backdrop-blur-md border-b border-slate-700 flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">
            TM
          </div>
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-lg tracking-wide text-slate-100">
              Project Board
            </h1>
            <div className="relative">
              <input
                type="text"
                placeholder="Search tasks..."
                className="bg-slate-900/70 border border-slate-600 rounded-full px-4 py-1.5 text-xs md:text-sm text-slate-200 focus:border-blue-500 outline-none w-56 md:w-64 transition-all focus:w-72 md:focus:w-80"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1); // reset to first page on new search
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setPage(1);
                  }}
                  className="absolute right-3 top-1.5 text-[10px] md:text-xs text-slate-500 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Pagination controls */}
        <div className="hidden sm:flex items-center gap-3 bg-slate-800/80 rounded-lg px-3 py-1 border border-slate-700/70">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="text-xs md:text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            &lt; Prev
          </button>
          <span className="text-xs md:text-sm font-mono text-blue-400">
            Page {page} of {totalPages || 1}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-xs md:text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next &gt;
          </button>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-xs text-slate-400 hidden sm:inline">
              Logged in as <span className="font-semibold">{user.username}</span>
            </span>
          )}
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="text-xs md:text-sm bg-slate-700 px-3 py-1 rounded hover:bg-slate-600 transition"
          >
            {showHistory ? 'Close History' : 'Activity Log'}
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-slate-400 hover:text-white transition"
          >
            Exit Board
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Board Canvas */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 flex items-start gap-6">
          <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
            {/* Render Lists */}
            {lists.map((list) => (
              <div
                key={list._id}
                className="w-80 flex-shrink-0 bg-slate-800/80 rounded-xl border border-slate-700/50 shadow-xl flex flex-col max-h-full transition-colors hover:border-slate-600"
              >
                {/* List Header */}
                <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">
                    {list.title}
                  </h3>
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
                        <Task
                          key={task._id}
                          task={task}
                          index={index}
                          currentUserId={user?.id || user?._id}
                        />
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                {/* Add Task Footer */}
                <form
                  onSubmit={(e) => createTask(e, list._id)}
                  className="p-3 pt-0 space-y-2"
                >
                  <input
                    type="text"
                    placeholder="+ Add Task"
                    className="w-full bg-slate-900/50 text-sm text-slate-300 p-2 rounded-lg border border-transparent hover:border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600"
                    value={newTaskTitles[list._id] || ''}
                    onChange={(e) =>
                      setNewTaskTitles({
                        ...newTaskTitles,
                        [list._id]: e.target.value,
                      })
                    }
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] uppercase tracking-wide text-slate-500">
                      Priority
                    </label>
                    <select
                      className="flex-1 bg-slate-900/60 text-xs text-slate-200 px-2 py-1 rounded-lg border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                      value={newTaskPriorities[list._id] || 'Low'}
                      onChange={(e) =>
                        setNewTaskPriorities({
                          ...newTaskPriorities,
                          [list._id]: e.target.value,
                        })
                      }
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </form>
              </div>
            ))}

            {/* New List Button */}
            <div className="w-80 flex-shrink-0">
              <form
                onSubmit={createList}
                className="bg-slate-800/40 p-3 rounded-xl border border-dashed border-slate-700 hover:border-blue-500/50 hover:bg-slate-800 transition-all cursor-pointer"
              >
                <input
                  type="text"
                  placeholder="+ Add another list"
                  className="w-full bg-transparent text-slate-300 p-2 outline-none placeholder:text-slate-500"
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                />
              </form>
            </div>
          </DragDropContext>
        </div>

        {/* Activity History Sidebar */}
        {showHistory && (
          <div className="w-80 bg-slate-800 border-l border-slate-700 p-4 overflow-y-auto shadow-2xl z-20 transition-all">
            <h3 className="font-bold text-lg mb-4 border-b border-slate-600 pb-2">
              Activity History
            </h3>
            <div className="space-y-3 text-sm">
              {activities.map((act) => (
                <div
                  key={act._id || `${act.username}-${act.action}-${act.createdAt}`}
                  className="text-slate-200"
                >
                  <span className="font-semibold text-blue-400">
                    {act.username || 'Someone'}
                  </span>
                  <span className="text-slate-400"> {act.action}</span>
                  {act.createdAt && (
                    <div className="text-xs text-slate-500 mt-1">
                      {new Date(act.createdAt).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
              {activities.length === 0 && (
                <p className="text-slate-500 text-sm">No recent activity.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}