import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Task from '../components/Task';

// Single shared socket connection
const socket = io('http://localhost:5000');

export default function Board() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [tasksByList, setTasksByList] = useState({}); // { listId: [tasks] }
  const [newListTitle, setNewListTitle] = useState('');
  const [newTaskTitles, setNewTaskTitles] = useState({}); // { listId: "title" }

  useEffect(() => {
    fetchLists();
    fetchTasks();

    // Join Socket.io room for this board
    socket.emit('join_board', id);

    const refreshTasks = () => {
      fetchTasks();
    };

    socket.on('taskCreated', refreshTasks);
    socket.on('task_moved', refreshTasks);
    socket.on('task_updated', refreshTasks);
    socket.on('taskUpdated', refreshTasks);
    socket.on('taskDeleted', refreshTasks);
    socket.on('listCreated', fetchLists);
    socket.on('listUpdated', fetchLists);
    socket.on('listDeleted', fetchLists);

    return () => {
      socket.off('taskCreated', refreshTasks);
      socket.off('task_moved', refreshTasks);
      socket.off('task_updated', refreshTasks);
      socket.off('taskUpdated', refreshTasks);
      socket.off('taskDeleted', refreshTasks);
      socket.off('listCreated', fetchLists);
      socket.off('listUpdated', fetchLists);
      socket.off('listDeleted', fetchLists);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchLists = async () => {
    try {
      const { data } = await api.get('/lists', { params: { boardId: id } });
      setLists(data);
    } catch (err) {
      toast.error('Failed to load lists');
    }
  };

  const fetchTasks = async () => {
    try {
      const { data } = await api.get('/tasks', {
        params: { boardId: id, page: 1, limit: 500 },
      });
      const tasksArray = Array.isArray(data) ? data : data.data || [];
      const grouped = {};
      tasksArray.forEach((task) => {
        const key = task.listId;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(task);
      });
      setTasksByList(grouped);
    } catch (err) {
      toast.error('Failed to load tasks');
    }
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const sourceList = tasksByList[source.droppableId] || [];
    const destList = tasksByList[destination.droppableId] || [];
    const movedTask = sourceList[source.index];
    if (!movedTask) return;

    const newSourceList = Array.from(sourceList);
    newSourceList.splice(source.index, 1);

    const newDestList = Array.from(destList);
    newDestList.splice(destination.index, 0, movedTask);

    setTasksByList({
      ...tasksByList,
      [source.droppableId]: newSourceList,
      [destination.droppableId]: newDestList,
    });

    try {
      await api.put(`/tasks/${draggableId}`, {
        listId: destination.droppableId,
        position: destination.index,
      });
    } catch (err) {
      toast.error('Failed to move task');
      fetchTasks();
    }
  };

  const createList = async (e) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    try {
      await api.post('/lists', { title: newListTitle.trim(), boardId: id });
      setNewListTitle('');
      fetchLists();
    } catch (err) {
      toast.error('Failed to create list');
    }
  };

  const createTask = async (e, listId) => {
    e.preventDefault();
    const title = (newTaskTitles[listId] || '').trim();
    if (!title) return;

    try {
      await api.post('/tasks', { title, listId, boardId: id });
      setNewTaskTitles({ ...newTaskTitles, [listId]: '' });
      fetchTasks();
    } catch (err) {
      toast.error('Failed to create task');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 overflow-hidden">
      {/* Header */}
      <header className="p-4 bg-slate-900/80 border-b border-white/10 flex justify-between items-center shadow-md">
        <div>
          <h1 className="font-semibold text-lg md:text-xl">Board</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Drag tasks between lists to reprioritize work.
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm px-3 py-1.5 rounded-full border border-slate-500 bg-slate-800 hover:bg-slate-700 transition-colors"
        >
          ← Back to Dashboard
        </button>
      </header>

      {/* Board Area */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 md:p-6 flex items-start gap-4 md:gap-6">
          {/* Render Lists */}
          {lists.map((list) => (
            <div
              key={list._id}
              className="w-72 bg-slate-900/80 rounded-2xl shadow-lg border border-white/10 flex-shrink-0 flex flex-col max-h-full"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <h3 className="font-semibold text-sm text-slate-50">{list.title}</h3>
              </div>

              {/* Droppable Area for Tasks */}
              <Droppable droppableId={list._id}>
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="p-3 flex-1 overflow-y-auto min-h-[56px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/40"
                  >
                    {(tasksByList[list._id] || []).map((task, index) => (
                      <Task key={task._id} task={task} index={index} />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              {/* Add Task Input */}
              <form
                onSubmit={(e) => createTask(e, list._id)}
                className="p-3 border-t border-white/10 bg-slate-950/60"
              >
                <input
                  type="text"
                  placeholder="+ Add a task"
                  className="w-full text-xs rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-2 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/70 focus:border-emerald-400/80 text-slate-100"
                  value={newTaskTitles[list._id] || ''}
                  onChange={(e) =>
                    setNewTaskTitles({ ...newTaskTitles, [list._id]: e.target.value })
                  }
                />
              </form>
            </div>
          ))}

          {/* Add New List Column */}
          <div className="w-72 flex-shrink-0">
            <form
              onSubmit={createList}
              className="bg-slate-900/50 border border-dashed border-slate-600/70 p-3 rounded-2xl hover:border-emerald-400/80 hover:bg-slate-900/70 transition-colors"
            >
              <input
                type="text"
                placeholder="+ Add another list"
                className="w-full text-sm rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/70 focus:border-emerald-400/80"
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

