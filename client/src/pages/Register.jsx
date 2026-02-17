import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/signup', { username, email, password });
      toast.success('Registration successful! Please login.');
      navigate('/login');
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data || 'Registration failed';
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-[1.2fr,1fr] gap-10 items-center">
        {/* Left: Brand / copy */}
        <div className="hidden md:flex flex-col gap-6">
          <div className="inline-flex items-center gap-3 rounded-full border border-sky-400/40 bg-slate-900/60 px-4 py-1 shadow-[0_0_15px_rgba(56,189,248,0.35)]">
            <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-xs tracking-[0.2em] uppercase text-sky-200">
              Onboard New Operator
            </span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight tracking-tight">
            Create your command profile
            <span className="block text-lg mt-2 font-normal text-slate-300">
              One account to manage every mission board.
            </span>
          </h1>
          <p className="text-sm text-slate-400 max-w-md">
            Choose a unique callsign, secure your channel with a password, and
            start collaborating with your crew in a shared sci‑fi dashboard.
          </p>
        </div>

        {/* Right: Register card */}
        <div className="relative">
          <div className="absolute -inset-0.5 bg-gradient-to-br from-sky-500 via-violet-500 to-emerald-500 opacity-40 blur-2xl rounded-3xl pointer-events-none" />
          <div className="relative w-full max-w-md mx-auto rounded-3xl border border-slate-700/80 bg-slate-950/80 shadow-2xl shadow-black/70 px-7 py-8 backdrop-blur">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">
                Registration Console
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Provision a new TaskManager identity.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  Codename
                </label>
                <input
                  type="text"
                  placeholder="e.g. NovaPilot"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/80 focus:border-sky-400/80"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  Contact Channel
                </label>
                <input
                  type="email"
                  placeholder="you@starfleet.io"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/80 focus:border-sky-400/80"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  Encryption Key
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/80 focus:border-sky-400/80"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/40 hover:brightness-110 transition-all"
              >
                <span className="h-1 w-4 rounded-full bg-slate-900/80" />
                <span>Initialize Profile</span>
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-slate-400">
              Already part of the crew?{' '}
              <Link
                to="/login"
                className="font-medium text-sky-300 hover:text-sky-200 underline-offset-4 hover:underline"
              >
                Return to login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

