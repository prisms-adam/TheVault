import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Database } from 'lucide-react';
import Home from './pages/Home';
import VideoView from './pages/VideoView';
import Admin from './pages/Admin';

const Navbar = () => (
  <nav className="glass sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b border-white/5">
    <Link to="/" className="flex items-center gap-3 text-2xl font-black tracking-tighter uppercase italic group">
      <div className="w-4 h-4 rounded-full bg-record animate-pulse shadow-[0_0_15px_rgba(190,18,60,0.8)]" />
      <span className="group-hover:text-record transition-colors">The Vault</span>
    </Link>
    <div className="flex items-center gap-8 text-xs font-black uppercase tracking-widest">
      <Link to="/" className="hover:text-record transition-colors">Archive</Link>
      <Link to="/admin" className="p-2 glass rounded-lg hover:bg-record transition-all group">
        <Database size={18} className="group-hover:text-white" />
      </Link>
    </div>
  </nav>
);

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
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
