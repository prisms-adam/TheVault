import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Database, User, LogOut } from 'lucide-react';
import Home from './pages/Home';
import VideoView from './pages/VideoView';
import Admin from './pages/Admin';
import Login from './pages/Login';
import api from './lib/api';

const Navbar = () => {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => setUser(null));
  }, []);

  const logout = async () => {
    await api.post('/auth/logout');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <nav className="glass sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b border-white/5">
      <Link to="/" className="flex items-center gap-3 text-2xl font-black tracking-tighter uppercase italic group">
        <div className="w-4 h-4 rounded-full bg-record animate-pulse shadow-[0_0_15px_rgba(190,18,60,0.8)]" />
        <span className="group-hover:text-record transition-colors">The Vault</span>
      </Link>
      
      <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-widest">
        <Link to="/" className="hover:text-record transition-colors">Archive</Link>
        
        {user ? (
          <div className="flex items-center gap-6">
            {user.isAdmin && (
              <Link to="/admin" className="px-3 py-2 glass rounded-lg hover:bg-record transition-all group flex items-center gap-2">
                <Database size={16} className="group-hover:text-white" />
                <span className="group-hover:text-white">Admin</span>
              </Link>
            )}
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <span className="text-slate-400 italic">{user.username}</span>
              <button onClick={logout} className="p-2 glass rounded-lg hover:text-record transition-all">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        ) : (
          <Link to="/login" className="px-4 py-2 glass rounded-lg hover:bg-white/10 transition-all flex items-center gap-2">
            <User size={14} /> Access
          </Link>
        )}
      </div>
    </nav>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen selection:bg-record selection:text-white">
        <Navbar />
        <main className="container mx-auto px-6 py-10">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/video/:id" element={<VideoView />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
