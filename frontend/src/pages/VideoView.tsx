import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import VideoPlayer from '../components/VideoPlayer';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageSquare, Pin, Trash2, Send, Smile, Plus, ThumbsUp, ThumbsDown, Eye, Hash } from 'lucide-react';

interface Video {
  id: string;
  title: string;
  description: string;
  hlsPath: string;
  thumbnailPath: string;
  tags: string;
  views: number;
  likes: number;
  comments: any[];
  reactions: { id: string, emoji: string, userId: string }[];
  votes: { userId: string, value: number }[];
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

  const addVote = async (value: number) => {
    if (!user) return alert('Please login to vote');
    await api.post(`/votes/${id}`, { value });
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

  const reactionGroups = video.reactions.reduce((acc: any, r: any) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, me: false };
    acc[r.emoji].count += 1;
    if (user && r.userId === user.id) acc[r.emoji].me = true;
    return acc;
  }, {});

  const myVote = video.votes?.find(v => v.userId === user?.id)?.value;

  // Sort comments: newest first
  const sortedComments = [...video.comments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
      <div className="w-full">
        <VideoPlayer 
          src={`/vault${video.hlsPath}`} 
          poster={`/vault${video.thumbnailPath}`} 
        />
        
        {/* Engagement Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button 
                onClick={() => user ? setShowPicker(!showPicker) : alert('Please login to react')}
                className="p-2 glass rounded-full hover:bg-white/10 transition-all text-slate-400 hover:text-white flex items-center gap-1 group"
              >
                <Smile size={20} className="group-hover:scale-110 transition-transform" />
                <Plus size={12} />
              </button>
              
              {showPicker && user && (
                <div className="absolute top-full left-0 mt-2 z-50">
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
                onClick={() => user ? addReaction(emoji) : alert('Please login to react')}
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

          <div className="flex items-center gap-2 glass p-1 rounded-full border border-white/5">
            <button 
              onClick={() => addVote(1)}
              className={`p-2.5 rounded-full transition-all flex items-center gap-2 ${myVote === 1 ? 'bg-record text-white shadow-lg' : 'hover:bg-white/5 text-slate-400'}`}
            >
              <ThumbsUp size={18} />
              <span className="text-xs font-black">{video.likes}</span>
            </button>
            <div className="w-px h-4 bg-white/10" />
            <button 
              onClick={() => addVote(-1)}
              className={`p-2.5 rounded-full transition-all ${myVote === -1 ? 'bg-record text-white shadow-lg' : 'hover:bg-white/5 text-slate-400'}`}
            >
              <ThumbsDown size={18} />
            </button>
          </div>
        </div>

        <div className="mt-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
            <div>
              <h1 className="text-4xl font-black uppercase tracking-tighter italic">{video.title}</h1>
              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-2">
                <span className="flex items-center gap-1.5 text-record"><Eye size={12} /> {video.views} Views</span>
                {video.tags && video.tags.split(',').map(tag => (
                  <span key={tag} className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded text-slate-400">
                    <Hash size={10} /> {tag.trim()}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="text-slate-400 text-lg leading-relaxed glass p-6 rounded-2xl prose prose-invert max-w-none">
            {video.description ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {video.description}
              </ReactMarkdown>
            ) : (
              "No session metadata provided."
            )}
          </div>
        </div>
      </div>

      {/* Comments Feed */}
      <div className="glass rounded-2xl p-6 flex flex-col">
        <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
          <MessageSquare size={12} /> COMMENTS
        </h3>
        
        <div className="space-y-4 mb-6">
          {sortedComments.map((c: any) => (
            <div key={c.id} className={`p-4 rounded-xl border ${c.isPinned ? 'bg-record/10 border-record/30' : 'bg-white/5 border-white/5'}`}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {c.user.username} {c.isPinned && <Pin size={10} className="inline ml-1 text-record" />}
                </span>
                <div className="flex gap-2">
                  {user?.isAdmin && (
                    <>
                      <button onClick={() => pinComment(c.id)} className="text-slate-600 hover:text-record"><Pin size={12} /></button>
                      <button onClick={() => deleteComment(c.id)} className="text-slate-600 hover:text-record"><Trash2 size={12} /></button>
                    </>
                  )}
                </div>
              </div>
              <p className="text-sm text-slate-200">{c.text}</p>
            </div>
          ))}
        </div>

        <form onSubmit={addComment} className="relative">
          <input 
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            disabled={!user}
            placeholder={user ? "Submit comment..." : "Login to comment..."}
            className="w-full bg-onyx/50 border border-white/10 rounded-xl px-4 py-4 text-sm outline-none focus:border-record transition-all pr-12 disabled:opacity-50"
          />
          <button type="submit" disabled={!user} className="absolute right-3 top-1/2 -translate-y-1/2 text-record hover:text-white transition-colors disabled:opacity-50">
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default VideoView;
