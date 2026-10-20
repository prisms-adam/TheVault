import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Database, User, LogOut } from 'lucide-react';
import Home from './pages/Home';
import VideoView from './pages/VideoView';
import Admin from './pages/Admin';
import Login from './pages/Login';
import api from './lib/api';
import AuthorIdentity from './components/AuthorIdentity';
import type { UserIdentity } from './lib/user';

const Navbar = () => {
  const [user, setUser] = useState<UserIdentity | null>(null);

  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => setUser(null));
  }, []);

  const logout = async () => {
    await api.post('/auth/logout');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/vault/login';
  };

  return (
    <nav className="glass sticky top-0 z-50 flex items-center justify-between border-b border-white/5 px-3 py-4 sm:px-6">
      <Link to="/" className="group flex shrink-0 items-center gap-2 text-lg font-black uppercase italic tracking-tighter sm:gap-3 sm:text-2xl">
        <div className="w-4 h-4 rounded-full bg-record animate-pulse shadow-[0_0_15px_rgba(190,18,60,0.8)]" />
        <span className="transition-colors group-hover:text-record"><span className="hidden sm:inline">THE AVC </span>VAULT</span>
      </Link>
      
      <div className="flex min-w-0 items-center gap-3 text-[10px] font-black uppercase tracking-widest sm:gap-8">
        <Link to="/" className="hidden transition-colors hover:text-record sm:block">Archive</Link>
        
        {user ? (
          <div className="flex min-w-0 items-center gap-2 sm:gap-6">
            {user.isAdmin && (
              <Link to="/admin" className="glass group flex items-center gap-2 rounded-lg p-2 transition-all hover:bg-record sm:px-3">
                <Database size={16} className="group-hover:text-white" />
                <span className="hidden group-hover:text-white sm:inline">Admin</span>
              </Link>
            )}
            <div className="flex min-w-0 items-center gap-2 border-l border-white/10 pl-2 sm:gap-3 sm:pl-4">
              <AuthorIdentity author={user} compact className="max-w-24 text-slate-400 italic sm:max-w-48" />
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
    <BrowserRouter basename="/vault">
      <div className="min-h-screen selection:bg-record selection:text-white flex flex-col">
        <Navbar />
        <main className="container mx-auto px-6 py-10 flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/video/:id" element={<VideoView />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </main>
        <footer className="py-8 text-center text-[10px] font-black uppercase tracking-widest text-slate-600">
          Made with love by the PRISMS Audio/Video Club, 2026
        </footer>
      </div>
    </BrowserRouter>
  );
};

export default App;
