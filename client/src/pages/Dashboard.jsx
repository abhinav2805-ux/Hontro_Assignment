import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function Dashboard() {
  const [boards, setBoards] = useState([]);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  useEffect(() => {
    fetchBoards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBoards = async () => {
    try {
      // Backend uses JWT to know the user; no userId param needed
      const { data } = await api.get('/boards');
      setBoards(data);
    } catch (err) {
      // If token is invalid/expired, redirect to login
      if (err.response?.status === 401) {
        toast.error('Session expired, please login again.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }
      toast.error('Failed to load boards');
    }
  };

  const createBoard = async (e) => {
    e.preventDefault();
    if (!newBoardTitle.trim()) return;
    try {
      await api.post('/boards', { title: newBoardTitle.trim() });
      setNewBoardTitle('');
      await fetchBoards();
      toast.success('Board created!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create board');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-slate-900/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold tracking-tight">TaskManager</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-400/40">
              Boards
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {user && (
              <span className="text-slate-300">
                Logged in as <span className="font-semibold">{user.username || user.email}</span>
              </span>
            )}
            <button
              onClick={handleLogout}
              className="rounded-full border border-red-400/60 bg-red-500/10 px-4 py-1.5 text-xs font-medium text-red-100 hover:bg-red-500/20 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Heading + create board */}
        <section className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">My Boards</h1>
            <p className="text-slate-300 text-sm mt-1">
              Organize your projects into separate collaborative spaces.
            </p>
          </div>

          <form
            onSubmit={createBoard}
            className="w-full md:w-auto flex gap-3 items-center"
          >
            <input
              type="text"
              placeholder="New board title..."
              className="flex-1 md:w-64 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-2.5 text-sm shadow-inner shadow-black/40 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/70 focus:border-emerald-400/80"
              value={newBoardTitle}
              onChange={(e) => setNewBoardTitle(e.target.value)}
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/40 hover:bg-emerald-400 transition-colors"
            >
              <span className="text-lg leading-none">＋</span>
              <span>Create board</span>
            </button>
          </form>
        </section>

        {/* Boards Grid */}
        <section>
          {boards.length === 0 ? (
            <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-600/70 bg-slate-900/40 px-8 py-12 text-center">
              <p className="text-slate-200 font-medium mb-2">
                You don&apos;t have any boards yet.
              </p>
              <p className="text-slate-400 text-sm mb-4">
                Create your first board to start organizing tasks with your team.
              </p>
              <button
                type="button"
                onClick={() => {
                  const input = document.querySelector('#new-board-input');
                  input?.focus();
                }}
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-md hover:bg-emerald-400 transition-colors"
              >
                Create a board
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {boards.map((board) => (
                <button
                  key={board._id}
                  type="button"
                  onClick={() => navigate(`/board/${board._id}`)}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-5 text-left shadow-lg shadow-black/40 transition transform hover:-translate-y-1 hover:shadow-2xl hover:border-emerald-400/80"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-emerald-500/20 via-transparent to-cyan-500/20" />
                  <div className="relative flex h-full flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight mb-1">
                        {board.title}
                      </h3>
                      <p className="text-xs text-slate-400">
                        Click to open this board.
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                      <span>
                        Created {new Date(board.createdAt).toLocaleDateString()}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                        Open board →
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

