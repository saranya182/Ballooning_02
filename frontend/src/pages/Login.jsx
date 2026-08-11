import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, Mail } from 'lucide-react';
import api from '../services/api';

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'admin@example.com', password: 'admin123' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/login', form);
      localStorage.setItem('token', 'demo-token');
      localStorage.setItem('user', JSON.stringify(response.user));
      onLogin?.(response.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-5xl rounded-3xl overflow-hidden bg-slate-900 shadow-2xl grid md:grid-cols-2">
        <div className="p-10 bg-gradient-to-br from-slate-800 to-slate-900">
          <div className="flex items-center gap-3 text-cyan-400 mb-6">
            <ShieldCheck size={24} />
            <span className="font-semibold">Inspection Operations</span>
          </div>
          <h1 className="text-3xl font-semibold mb-3">Manufacturing Drawing Ballooning & Inspection</h1>
          <p className="text-slate-400">Secure review workflow for engineering drawings, ballooning, inspection tables, and approval routing.</p>
          <div className="mt-8 rounded-xl border border-slate-700 bg-slate-800/70 p-4 text-sm text-slate-300">
            <div className="font-semibold mb-2">Demo credentials</div>
            <div>Email: admin@example.com</div>
            <div>Password: admin123</div>
          </div>
        </div>
        <div className="p-10">
          <h2 className="text-2xl font-semibold mb-6">Login</h2>
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="text-sm text-slate-400">Email</span>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-3">
                <Mail size={16} className="text-slate-400" />
                <input className="w-full bg-transparent outline-none" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </label>
            <label className="block">
              <span className="text-sm text-slate-400">Password</span>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-3">
                <Lock size={16} className="text-slate-400" />
                <input type="password" className="w-full bg-transparent outline-none" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            </label>
            {error ? <div className="text-sm text-red-400">{error}</div> : null}
            <button type="submit" className="w-full rounded-lg bg-cyan-600 py-3 font-medium hover:bg-cyan-500 disabled:opacity-60" disabled={loading}>{loading ? 'Signing in...' : 'Login'}</button>
            <button type="button" className="w-full rounded-lg border border-slate-700 py-3 text-slate-300">Forgot Password</button>
          </form>
        </div>
      </div>
    </div>
  );
}
