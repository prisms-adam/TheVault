import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Upload, Loader2, Trash2, Pin, EyeOff, User as UserIcon } from 'lucide-react';

const Admin = () => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  
  const [videos, setVideos] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [queue, setQueue] = useState<any>(null);
  const [tab, setTab] = useState<'upload' | 'videos' | 'users' | 'comments'>('upload');

  const fetchData = async () => {
    try {
      const [vRes, uRes, cRes, qRes] = await Promise.all([
        api.get('/admin/videos'),
        api.get('/admin/users'),
        api.get('/admin/comments'),
        api.get('/admin/queue')
      ]);
      setVideos(vRes.data);
      setUsers(uRes.data);
      setComments(cRes.data);
      setQueue(qRes.data);
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setStatus('uploading');
    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title);
    formData.append('description', description);

    try {
      await api.post('/videos/upload', formData);
      setStatus('success');
      setFile(null);
      setTitle('');
      setDescription('');
      fetchData();
    } catch (err) {
      setStatus('error');
    }
  };

  const updateVideo = async (id: string, data: any) => {
    await api.patch(`/admin/videos/${id}`, data);
    fetchData();
  };

  const deleteComment = async (id: string) => {
    await api.delete(`/comments/${id}`);
    fetchData();
  };

  const toggleAdmin = async (id: string, isAdmin: boolean) => {
    await api.patch(`/admin/users/${id}`, { isAdmin });
    fetchData();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black uppercase tracking-tighter mb-2 italic">Sponsor Console</h1>
          <p className="text-slate-500 uppercase text-[10px] font-black tracking-[0.3em] ml-1">Master Control & Video Ingestion</p>
        </div>
        <div className="flex gap-2 glass p-1 rounded-xl">
          {['upload', 'videos', 'users', 'comments'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                tab === t ? 'bg-record text-white shadow-lg' : 'hover:bg-white/5 text-slate-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {tab === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <section className="glass rounded-3xl p-8 border-record/20 border">
            <h3 className="text-record font-black uppercase text-xs tracking-[0.2em] mb-8 flex items-center gap-2">
              <Upload size={14} /> Source Ingestion
            </h3>
            <form onSubmit={handleUpload} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Archive Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Studio Session #001" className="w-full bg-onyx/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-record transition-all outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Metadata / Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Session details..." className="w-full bg-onyx/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-record transition-all outline-none resize-none" />
              </div>
              <div className="relative group">
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center group-hover:border-record/30 transition-all bg-white/[0.02]">
                  <Upload className="text-slate-600 mb-4 group-hover:text-record transition-colors" />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">{file ? file.name : "Select High-Bitrate Master"}</span>
                </div>
              </div>
              <button disabled={status === 'uploading' || !file} className="w-full bg-record hover:bg-record/80 disabled:bg-slate-800 text-white font-black uppercase py-4 rounded-2xl transition-all flex items-center justify-center gap-3">
                {status === 'uploading' ? <Loader2 className="animate-spin" size={20} /> : "Initialize Upload"}
              </button>
            </form>
          </section>

          <section className="space-y-8">
            <div className="glass rounded-3xl p-8">
              <h3 className="text-slate-400 font-black uppercase text-xs tracking-[0.2em] mb-6 italic">Queue Monitor</h3>
              <div className="space-y-6">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-green-500">Active: {queue?.stats?.active || 0}</span>
                  <span className="text-slate-400">Waiting: {queue?.stats?.waiting || 0}</span>
                  <span className="text-record">Failed: {queue?.stats?.failed || 0}</span>
                </div>
                <div className="h-1.5 w-full bg-onyx rounded-full overflow-hidden">
                  <div className={`h-full bg-record ${(queue?.stats?.active > 0) ? 'animate-pulse w-full' : 'w-0'}`} />
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === 'videos' && (
        <div className="glass rounded-3xl overflow-hidden border border-white/5">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="p-6">Video Asset</th>
                <th className="p-6">Status</th>
                <th className="p-6">Engagement</th>
                <th className="p-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {videos.map(v => (
                <tr key={v.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-6">
                    <div className="font-bold text-sm">{v.title}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">{new Date(v.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td className="p-6">
                    <span className={`text-[10px] font-black px-2 py-1 rounded uppercase ${v.status === 'PUBLIC' ? 'bg-green-500/20 text-green-500' : 'bg-record/20 text-record'}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="p-6 text-xs text-slate-400 font-semibold uppercase">
                    {v._count.reactions} Reactions • {v._count.comments} Comments
                  </td>
                  <td className="p-6 text-right space-x-2">
                    <button onClick={() => updateVideo(v.id, { isFeatured: !v.isFeatured })} className={`p-2 rounded-lg transition-all ${v.isFeatured ? 'bg-record text-white' : 'glass text-slate-400'}`}>
                      <Pin size={14} />
                    </button>
                    <button onClick={() => updateVideo(v.id, { status: v.status === 'PUBLIC' ? 'HIDDEN' : 'PUBLIC' })} className="p-2 glass rounded-lg text-slate-400 hover:text-white">
                      <EyeOff size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'users' && (
        <div className="glass rounded-3xl overflow-hidden border border-white/5">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="p-6">Student Identity</th>
                <th className="p-6">Enrolled</th>
                <th className="p-6 text-right">Permissions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-6 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400"><UserIcon size={16} /></div>
                    <span className="font-bold">{u.username}</span>
                  </td>
                  <td className="p-6 text-xs text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="p-6 text-right">
                    <button onClick={() => toggleAdmin(u.id, !u.isAdmin)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${u.isAdmin ? 'bg-record text-white' : 'glass text-slate-400 hover:text-white'}`}>
                      {u.isAdmin ? 'Admin' : 'Student'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'comments' && (
        <div className="glass rounded-3xl overflow-hidden border border-white/5">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="p-6">Comment Content</th>
                <th className="p-6">Source Video</th>
                <th className="p-6 text-right">Moderation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {comments.map(c => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-6">
                    <div className="text-sm italic text-slate-300">"{c.text}"</div>
                    <div className="text-[10px] text-slate-500 uppercase font-black mt-1">— {c.user.username}</div>
                  </td>
                  <td className="p-6 text-xs text-slate-400 uppercase font-semibold">{c.video.title}</td>
                  <td className="p-6 text-right">
                    <button onClick={() => deleteComment(c.id)} className="p-2 glass rounded-lg text-record hover:bg-record hover:text-white transition-all">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Admin;
