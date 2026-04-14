import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Loader2, ShieldCheck, UserPlus } from 'lucide-react';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setError('');

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const res = await api.post(endpoint, { username, password });
      
      if (res.data.token) {
        // Successful login/register
        navigate(res.data.user.isAdmin ? '/admin' : '/');
        window.location.reload(); // Refresh to update navbar state
      }
    } catch (err: any) {
      setStatus('error');
      setError(err.response?.data?.error || 'Authentication failed');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="glass rounded-3xl p-10 border-record/20 border shadow-2xl">
        <header className="text-center mb-10">
          <div className="w-16 h-16 bg-record/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-record/30">
            {isLogin ? <ShieldCheck className="text-record" size={32} /> : <UserPlus className="text-record" size={32} />}
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">
            {isLogin ? 'Console Access' : 'New Enrollment'}
          </h1>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-2">
            {isLogin ? 'Authorized Personnel Only' : 'Register for Studio Archive'}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Identity</label>
            <input 
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full bg-onyx/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-record transition-all outline-none"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Security Key</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-onyx/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-record transition-all outline-none"
              required
            />
          </div>

          {error && (
            <p className="text-record text-[10px] font-black uppercase tracking-widest text-center">{error}</p>
          )}

          <button 
            disabled={status === 'loading'}
            className="w-full bg-record hover:bg-record/80 disabled:bg-slate-800 text-white font-black uppercase py-4 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-record/20"
          >
            {status === 'loading' ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? 'Initialize Session' : 'Create Identity')}
          </button>

          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="w-full text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-colors"
          >
            {isLogin ? 'Need an account? Register' : 'Already registered? Login'}
          </button>
        </form>
      </div>
      
      {!isLogin && (
        <p className="mt-8 text-center text-[10px] font-black uppercase tracking-widest text-slate-600 px-6 leading-relaxed">
          Note: The first registered user will automatically be granted <span className="text-record">Master Admin</span> privileges.
        </p>
      )}
    </div>
  );
};

export default Login;
