import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/login', { email, password });

      // Backend returns: { message, token, user: { id, username, email } }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data || 'Login failed';
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-[1.2fr,1fr] gap-10 items-center">
        {/* Left: Brand / hero */}
        <div className="hidden md:flex flex-col gap-6">
          <div className="inline-flex items-center gap-3 rounded-full border border-emerald-400/40 bg-slate-900/60 px-4 py-1 shadow-[0_0_15px_rgba(16,185,129,0.35)]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs tracking-[0.2em] uppercase text-emerald-200">
              Real‑time Task Grid Online
            </span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight tracking-tight">
            TaskManager
            <span className="block text-lg mt-2 font-normal text-slate-300">
              A sci‑fi inspired collaboration console.
            </span>
          </h1>
          <p className="text-sm text-slate-400 max-w-md">
            Log in to synchronize boards, lists and tasks across your crew in
            real time. Drag, assign, and track activity like a mission control
            dashboard.
          </p>
          <div className="flex gap-3 text-[11px] text-slate-400">
            <span className="px-3 py-1 rounded-full bg-slate-900/60 border border-slate-700">
              WebSocket Link: <span className="text-emerald-300">ONLINE</span>
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-900/60 border border-slate-700">
              Security: <span className="text-emerald-300">JWT PROTECTED</span>
            </span>
          </div>
        </div>

        {/* Right: Auth card */}
        <div className="relative">
          <div className="absolute -inset-0.5 bg-gradient-to-br from-emerald-500 via-sky-500 to-purple-500 opacity-40 blur-2xl rounded-3xl pointer-events-none" />
          <div className="relative w-full max-w-md mx-auto rounded-3xl border border-slate-700/80 bg-slate-950/80 shadow-2xl shadow-black/70 px-7 py-8 backdrop-blur">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">
                Login Console
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Authenticate to access your mission boards.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  Email Identifier
                </label>
                <input
                  type="email"
                  placeholder="crew.member@ship.io"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/80 focus:border-emerald-400/80"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  Access Key
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/80 focus:border-emerald-400/80"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/40 hover:brightness-110 transition-all"
              >
                <span className="h-1 w-4 rounded-full bg-slate-900/80" />
                <span>Engage Session</span>
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-slate-400">
              New crew member?{' '}
              <Link
                to="/register"
                className="font-medium text-emerald-300 hover:text-emerald-200 underline-offset-4 hover:underline"
              >
                Request access
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

