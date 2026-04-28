import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Upload, Loader2, Trash2, Pin, User as UserIcon, Hash, Plus, RotateCcw, Sparkles } from 'lucide-react';

const Admin = () => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const [videos, setVideos] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [queue, setQueue] = useState<any>(null);
  const [tab, setTab] = useState<'upload' | 'videos' | 'categories' | 'users' | 'comments'>('upload');
  
  // Video editing state
  const [editingVideo, setEditingVideo] = useState<string | null>(null);
  const [editData, setEditData] = useState({ title: '', description: '', tags: '' });

  const fetchData = async () => {
    try {
      const [vRes, uRes, cRes, qRes, catRes] = await Promise.all([
        api.get('/admin/videos'),
        api.get('/admin/users'),
        api.get('/admin/comments'),
        api.get('/admin/queue'),
        api.get('/admin/categories')
      ]);
      setVideos(vRes.data);
      setUsers(uRes.data);
      setComments(cRes.data);
      setQueue(qRes.data);
      setCategories(catRes.data);
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

    setError(null);
    const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
    if (file.size > MAX_FILE_SIZE) {
      setError(`File is too large (${(file.size / (1024 * 1024 * 1024)).toFixed(2)}GB). Max limit is 5GB.`);
      return;
    }

    setStatus('uploading');
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title);
    formData.append('description', description);

    try {
      await api.post('/videos/upload', formData, {
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        },
      });
      setStatus('success');
      setUploadProgress(100);
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

  const retryVideo = async (id: string) => {
    try {
      await api.post(`/admin/videos/${id}/retry`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to retry transcoding");
    }
  };

  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [userEditData, setUserEditData] = useState({ username: '' });
  const [resetPasswordUser, setResetPasswordUser] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const startEditingUser = (user: any) => {
    setEditingUser(user.id);
    setUserEditData({ username: user.username });
  };

  const saveUserEdit = async (id: string) => {
    await api.patch(`/admin/users/${id}`, userEditData);
    setEditingUser(null);
    fetchData();
  };

  const resetPassword = async (id: string) => {
    if (!newPassword) return;
    await api.patch(`/admin/users/${id}/password`, { password: newPassword });
    setResetPasswordUser(null);
    setNewPassword('');
    alert("Password updated successfully.");
  };

  const deleteUser = async (id: string) => {
    if (window.confirm("CRITICAL: Delete this user and all their data permanently?")) {
      try {
        await api.delete(`/admin/users/${id}`);
        fetchData();
      } catch (err: any) {
        alert(err.response?.data?.error || "Failed to delete user");
      }
    }
  };

  const toggleAdmin = async (id: string, isAdmin: boolean) => {
    await api.patch(`/admin/users/${id}`, { isAdmin });
    fetchData();
  };

  // Category Management State
  const [newCat, setNewCat] = useState({ name: '', tagQuery: '', order: 0 });
  const [editingCat, setEditingCat] = useState<string | null>(null);

  const addCategory = async () => {
    if (!newCat.name || !newCat.tagQuery) return;
    await api.post('/admin/categories', newCat);
    setNewCat({ name: '', tagQuery: '', order: 0 });
    fetchData();
  };

  const deleteCategory = async (id: string) => {
    await api.delete(`/admin/categories/${id}`);
    fetchData();
  };

  const saveCatEdit = async (id: string, data: any) => {
    await api.patch(`/admin/categories/${id}`, data);
    setEditingCat(null);
    fetchData();
  };

  const startEditing = (video: any) => {
    setEditingVideo(video.id);
    setEditData({ 
      title: video.title, 
      description: video.description || '',
      tags: video.tags || ''
    });
  };

  const deleteVideo = async (id: string) => {
    if (window.confirm("CRITICAL: This will permanently purge the video asset and all associated data. Proceed?")) {
      await api.delete(`/admin/videos/${id}`);
      fetchData();
    }
  };

  const saveEdit = async (id: string) => {
    await api.patch(`/admin/videos/${id}`, editData);
    setEditingVideo(null);
    fetchData();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black uppercase tracking-tighter mb-2 italic">ADMIN CONSOLE</h1>
          <p className="text-slate-500 uppercase text-[10px] font-black tracking-[0.3em] ml-1">Master Control & Video Ingestion</p>
        </div>
        <div className="flex gap-2 glass p-1 rounded-xl">
          {[
            { id: 'upload', label: 'Queue Monitor' },
            { id: 'videos', label: 'Videos' },
            { id: 'categories', label: 'Categories' },
            { id: 'users', label: 'Users' },
            { id: 'comments', label: 'Comments' }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                tab === t.id ? 'bg-record text-white shadow-lg' : 'hover:bg-white/5 text-slate-400'
              }`}
            >
              {t.label}
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
                <input type="file" onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setError(null);
                }} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <div className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all bg-white/[0.02] ${error ? 'border-record/50 bg-record/5' : 'border-white/10 group-hover:border-record/30'}`}>
                  <Upload className={`${error ? 'text-record' : 'text-slate-600'} mb-4 group-hover:text-record transition-colors`} />
                  <span className={`text-xs font-black uppercase tracking-widest ${error ? 'text-record' : 'text-slate-400'}`}>
                    {file ? file.name : "Select High-Bitrate Master (Max 5GB)"}
                  </span>
                  {error && <span className="text-[10px] font-bold text-record mt-2 uppercase tracking-tighter">{error}</span>}
                </div>
              </div>
              <button 
                disabled={status === 'uploading' || !file} 
                className="w-full relative overflow-hidden bg-slate-800 disabled:cursor-not-allowed text-white font-black uppercase py-4 rounded-2xl transition-all flex items-center justify-center gap-3"
              >
                {status === 'uploading' && (
                  <div 
                    className="absolute inset-0 bg-record/40 transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                )}
                
                <span className="relative z-10 flex items-center gap-3">
                  {status === 'uploading' ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      INGESTING {uploadProgress}%
                    </>
                  ) : status === 'success' ? (
                    "UPLOAD COMPLETE"
                  ) : (
                    "Initialize Upload"
                  )}
                </span>
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
              <th className="p-6">Tags</th>
              <th className="p-6 text-right">Actions</th>
              </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
              {videos.map(v => (
              <tr key={v.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="p-6">
                  {editingVideo === v.id ? (
                    <div className="space-y-2">
                      <input 
                        value={editData.title}
                        onChange={(e) => setEditData({...editData, title: e.target.value})}
                        className="bg-onyx border border-record/30 rounded px-2 py-1 text-xs w-full outline-none"
                      />
                      <textarea 
                        value={editData.description}
                        onChange={(e) => setEditData({...editData, description: e.target.value})}
                        className="bg-onyx border border-record/30 rounded px-2 py-1 text-[10px] w-full h-12 outline-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(v.id)} className="text-[9px] font-black uppercase text-green-500 hover:text-white transition-colors">Save</button>
                        <button onClick={() => setEditingVideo(null)} className="text-[9px] font-black uppercase text-slate-500 hover:text-white transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="font-bold text-sm">{v.title}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">{new Date(v.createdAt).toLocaleDateString()}</div>
                    </>
                  )}
                </td>
                <td className="p-6">
                  <button 
                    onClick={() => updateVideo(v.id, { status: v.status === 'PUBLIC' ? 'HIDDEN' : 'PUBLIC' })}
                    className={`text-[10px] font-black px-2 py-1 rounded uppercase transition-all ${v.status === 'PUBLIC' ? 'bg-green-500/20 text-green-500' : 'bg-record/20 text-record'}`}
                  >
                    {v.status}
                  </button>
                </td>
                <td className="p-6">
                  {editingVideo === v.id ? (
                    <input 
                      value={editData.tags}
                      onChange={(e) => setEditData({...editData, tags: e.target.value})}
                      placeholder="tag1, tag2"
                      className="bg-onyx border border-record/30 rounded px-2 py-1 text-[10px] w-full outline-none"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {v.tags?.split(',').map((t: string) => t.trim() && (
                        <span key={t} className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400 font-black uppercase">{t}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="p-6 text-right space-x-2">
                  {(v.status === 'ERROR' || v.status === 'PROCESSING') && (
                    <button onClick={() => retryVideo(v.id)} title="Retry Transcoding" className="p-2 glass rounded-lg text-yellow-500 hover:text-white hover:bg-yellow-500/20 transition-all">
                      <RotateCcw size={14} />
                    </button>
                  )}
                  <button onClick={() => startEditing(v)} className="p-2 glass rounded-lg text-slate-400 hover:text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                  </button>
                  <button onClick={() => updateVideo(v.id, { isFeatured: !v.isFeatured })} className={`p-2 rounded-lg transition-all ${v.isFeatured ? 'bg-record text-white shadow-[0_0_10px_rgba(190,18,60,0.5)]' : 'glass text-slate-400'}`}>
                    <Pin size={14} />
                  </button>
                  <button onClick={() => updateVideo(v.id, { isNew: !v.isNew })} className={`p-2 rounded-lg transition-all ${v.isNew ? 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'glass text-slate-400'}`}>
                    <Sparkles size={14} />
                  </button>
                  <button onClick={() => deleteVideo(v.id)} className="p-2 glass rounded-lg text-slate-400 hover:bg-record hover:text-white transition-all">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
              ))}
              </tbody>

          </table>
        </div>
      )}

      {tab === 'categories' && (
        <div className="space-y-8">
          <section className="glass rounded-3xl p-8 border border-white/5">
            <h3 className="text-slate-400 font-black uppercase text-xs tracking-[0.2em] mb-8 italic flex items-center gap-2">
              <Plus size={14} /> Create New Section
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input value={newCat.name} onChange={e => setNewCat({...newCat, name: e.target.value})} placeholder="Section Name (e.g. Action News)" className="md:col-span-2 bg-onyx/50 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-record transition-all" />
              <input value={newCat.tagQuery} onChange={e => setNewCat({...newCat, tagQuery: e.target.value})} placeholder="Tag Filter (e.g. news)" className="bg-onyx/50 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-record transition-all" />
              <button onClick={addCategory} className="bg-record text-white font-black uppercase text-[10px] tracking-widest rounded-xl hover:shadow-[0_0_20px_rgba(190,18,60,0.3)] transition-all">Add Section</button>
            </div>
          </section>

          <div className="glass rounded-3xl overflow-hidden border border-white/5">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <th className="p-6">Section Name</th>
                  <th className="p-6">Tag Filter</th>
                  <th className="p-6">Display Order</th>
                  <th className="p-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {categories.map(cat => (
                  <tr key={cat.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-6">
                      {editingCat === cat.id ? (
                        <input value={cat.name} onChange={e => saveCatEdit(cat.id, { name: e.target.value })} className="bg-onyx border border-record/30 rounded px-2 py-1 text-xs outline-none" />
                      ) : (
                        <span className="font-bold">{cat.name}</span>
                      )}
                    </td>
                    <td className="p-6">
                      <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1"><Hash size={10} /> {cat.tagQuery}</span>
                    </td>
                    <td className="p-6">
                      <input type="number" value={cat.order} onChange={e => saveCatEdit(cat.id, { order: parseInt(e.target.value) })} className="bg-onyx border border-white/10 rounded px-2 py-1 text-xs w-16 outline-none" />
                    </td>
                    <td className="p-6 text-right space-x-2">
                      <button onClick={() => deleteCategory(cat.id)} className="p-2 glass rounded-lg text-slate-400 hover:bg-record hover:text-white transition-all">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="glass rounded-3xl overflow-hidden border border-white/5">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="p-6">Student Identity</th>
                <th className="p-6">Enrolled</th>
                <th className="p-6">Security</th>
                <th className="p-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0"><UserIcon size={16} /></div>
                      {editingUser === u.id ? (
                        <div className="flex gap-2">
                          <input 
                            value={userEditData.username}
                            onChange={(e) => setUserEditData({ username: e.target.value })}
                            className="bg-onyx border border-record/30 rounded px-2 py-1 text-xs outline-none"
                          />
                          <button onClick={() => saveUserEdit(u.id)} className="text-[10px] text-green-500 font-black">Save</button>
                          <button onClick={() => setEditingUser(null)} className="text-[10px] text-slate-500 font-black">Cancel</button>
                        </div>
                      ) : (
                        <span className="font-bold">{u.username}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-6 text-xs text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="p-6">
                    {resetPasswordUser === u.id ? (
                      <div className="flex gap-2">
                        <input 
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New Pwd"
                          className="bg-onyx border border-record/30 rounded px-2 py-1 text-[10px] w-24 outline-none"
                        />
                        <button onClick={() => resetPassword(u.id)} className="text-[10px] text-record font-black uppercase">Apply</button>
                        <button onClick={() => setResetPasswordUser(null)} className="text-[10px] text-slate-500 font-black uppercase">X</button>
                      </div>
                    ) : (
                      <button onClick={() => setResetPasswordUser(u.id)} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Reset Key</button>
                    )}
                  </td>
                  <td className="p-6 text-right space-x-4">
                    <button onClick={() => toggleAdmin(u.id, !u.isAdmin)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${u.isAdmin ? 'bg-record text-white' : 'glass text-slate-400 hover:text-white'}`}>
                      {u.isAdmin ? 'Admin' : 'Student'}
                    </button>
                    <button onClick={() => startEditingUser(u)} className="text-slate-500 hover:text-white transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                    </button>
                    <button onClick={() => deleteUser(u.id)} className="text-slate-500 hover:text-record transition-colors">
                      <Trash2 size={14} />
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
