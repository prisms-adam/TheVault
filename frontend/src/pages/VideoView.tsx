import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import VideoPlayer from '../components/VideoPlayer';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { MessageSquare, Pin, Trash2, Send, Smile, Plus } from 'lucide-react';

interface Video {
  id: string;
  title: string;
  description: string;
  hlsPath: string;
  thumbnailPath: string;
  comments: any[];
  reactions: { id: string, emoji: string, userId: string }[];
}

const VideoView = () => {
  const { id } = useParams();
  const [video, setVideo] = useState<Video | null>(null);
  const [commentText, setCommentText] = useState('');
  const [user, setUser] = useState<any>(null);
  const [showPicker, setShowPicker] = useState(false);

  const fetchVideo = async () => {
    const res = await api.get(`/videos/${id}`);
    setVideo(res.data);
  };

  useEffect(() => {
    fetchVideo();
    api.get('/auth/me').then((res: { data: { user: any } }) => setUser(res.data.user)).catch(() => {});
  }, [id]);

  const addReaction = async (emoji: string) => {
    await api.post(`/reactions/${id}`, { emoji });
    setShowPicker(false);
    fetchVideo();
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    await api.post(`/comments/${id}`, { text: commentText });
    setCommentText('');
    fetchVideo();
  };

  const deleteComment = async (commentId: string) => {
    await api.delete(`/comments/${commentId}`);
    fetchVideo();
  };

  const pinComment = async (commentId: string) => {
    await api.patch(`/comments/${commentId}/pin`);
    fetchVideo();
  };

  if (!video) return <div className="animate-pulse flex items-center justify-center h-[50vh] text-record font-black tracking-widest uppercase">Initializing...</div>;

  // Group reactions: { emoji: { count: number, me: boolean } }
  const reactionGroups = video.reactions.reduce((acc: any, r: any) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, me: false };
    acc[r.emoji].count += 1;
    if (user && r.userId === user.id) acc[r.emoji].me = true;
    return acc;
  }, {});

  // Sort comments: pinned first
  const sortedComments = [...video.comments].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

  const assetBase = `${window.location.protocol}//${window.location.hostname}:3000`;

  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto">
      <div className="w-full lg:w-4/5">
        <VideoPlayer 
          src={`${assetBase}${video.hlsPath}`} 
          poster={`${assetBase}${video.thumbnailPath}`} 
        />
        
        {/* Reaction Bar */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <button 
              onClick={() => setShowPicker(!showPicker)}
              className="p-2 glass rounded-full hover:bg-white/10 transition-all text-slate-400 hover:text-white flex items-center gap-1 group"
            >
              <Smile size={20} className="group-hover:scale-110 transition-transform" />
              <Plus size={12} />
            </button>
            
            {showPicker && (
              <div className="absolute bottom-full left-0 mb-4 z-50">
                <div className="fixed inset-0" onClick={() => setShowPicker(false)} />
                <div className="relative shadow-2xl border border-white/10 rounded-2xl overflow-hidden">
                  <EmojiPicker 
                    theme={Theme.DARK}
                    onEmojiClick={(emojiData) => addReaction(emojiData.emoji)}
                    lazyLoadEmojis={true}
                  />
                </div>
              </div>
            )}
          </div>

          {Object.entries(reactionGroups).map(([emoji, data]: [string, any]) => (
            <button
              key={emoji}
              onClick={() => addReaction(emoji)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                data.me 
                  ? 'bg-record/20 border-record/40 text-record shadow-[0_0_10px_rgba(190,18,60,0.2)]' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
              }`}
            >
              <span className="text-lg">{emoji}</span>
              <span className="text-xs font-black">{data.count}</span>
            </button>
          ))}
        </div>

        <div className="mt-8">
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-4 italic">{video.title}</h1>
          <p className="text-slate-400 text-lg leading-relaxed glass p-6 rounded-2xl">{video.description || "No session metadata provided."}</p>
        </div>
      </div>

      <div className="w-full lg:w-1/5 space-y-6">
        {/* Comments Feed */}
        <div className="glass rounded-2xl p-6 flex flex-col h-[600px]">
          <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
            <MessageSquare size={12} /> Feed Analysis
          </h3>
          
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {sortedComments.map((c: any) => (
              <div key={c.id} className={`p-3 rounded-xl border ${c.isPinned ? 'bg-record/10 border-record/30' : 'bg-white/5 border-white/5'}`}>
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {c.user.username} {c.isPinned && <Pin size={10} className="inline ml-1 text-record" />}
                  </span>
                  <div className="flex gap-1">
                    {user?.isAdmin && (
                      <>
                        <button onClick={() => pinComment(c.id)} className="text-slate-600 hover:text-record"><Pin size={10} /></button>
                        <button onClick={() => deleteComment(c.id)} className="text-slate-600 hover:text-record"><Trash2 size={10} /></button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-200">{c.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={addComment} className="mt-6 relative">
            <input 
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Log feedback..."
              className="w-full bg-onyx/50 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-record transition-all pr-10"
            />
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-record hover:text-white transition-colors">
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VideoView;
