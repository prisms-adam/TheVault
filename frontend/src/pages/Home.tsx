import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { ChevronDown, Clock, ThumbsUp, Eye, Type } from 'lucide-react';

interface Video {
  id: string;
  title: string;
  thumbnailPath: string;
  technicalMetadata: string;
  createdAt: string;
  isFeatured: boolean;
  isNew: boolean;
  tags: string;
  views: number;
  likes: number;
  duration: number;
  _count: { reactions: number; comments: number };
}

interface Category {
  id: string;
  name: string;
  tagQuery: string;
}

type SortOption = 'date' | 'name' | 'length' | 'likes' | 'views';

const Home = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sortOptions, setSortOptions] = useState<Record<string, SortOption>>({});

  useEffect(() => {
    Promise.all([
      api.get('/videos'),
      api.get('/categories')
    ]).then(([vRes, cRes]) => {
      setVideos(vRes.data);
      setCategories(cRes.data);
    });
  }, []);

  const getSortedVideos = (vids: Video[], categoryId: string) => {
    const sort = sortOptions[categoryId] || 'date';
    return [...vids].sort((a, b) => {
      switch (sort) {
        case 'name': return a.title.localeCompare(b.title);
        case 'length': return b.duration - a.duration;
        case 'likes': return b.likes - a.likes;
        case 'views': return b.views - a.views;
        case 'date':
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderVideoGrid = (vids: Video[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      {vids.map(video => {
        const metadata = JSON.parse(video.technicalMetadata || '{}');
        const height = metadata.streams?.find((s: any) => s.height)?.height || '?';
        const thumbnail = video.thumbnailPath 
          ? `/vault${video.thumbnailPath}` 
          : 'https://images.unsplash.com/photo-1574267432553-4b4628081c31?q=80&w=1000&auto=format&fit=crop';

        return (
          <Link 
            key={video.id} 
            to={`/video/${video.id}`}
            className="glass rounded-xl overflow-hidden aspect-video relative group border border-white/5 hover:border-record/50 transition-all"
          >
            <img 
              src={thumbnail} 
              className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1574267432553-4b4628081c31?q=80&w=1000&auto=format&fit=crop';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-onyx/90 via-onyx/20 to-transparent" />
            
            {video.isNew && (
              <div className="absolute top-2 -left-8 -rotate-45 px-10 py-1 bg-yellow-400 text-black text-[10px] font-black uppercase tracking-widest z-10 shadow-lg">
                New!
              </div>
            )}
            
            <div className="absolute top-3 right-3 flex gap-2">
              <span className="text-[10px] font-black bg-record px-2 py-0.5 rounded tracking-tighter uppercase">HLS</span>
              <span className="text-[10px] font-black bg-slate-800 px-2 py-0.5 rounded tracking-tighter uppercase">{height}P</span>
            </div>

            <div className="absolute bottom-4 left-4 right-4">
              <h3 className="font-bold text-lg truncate leading-tight">{video.title}</h3>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 uppercase font-semibold">
                <span className="flex items-center gap-1"><ThumbsUp size={10} /> {video.likes}</span>
                <span className="flex items-center gap-1"><Eye size={10} /> {video.views}</span>
                <span className="flex items-center gap-1"><Clock size={10} /> {formatDuration(video.duration)}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );

  const SortDropdown = ({ categoryId }: { categoryId: string }) => (
    <div className="relative group/sort">
      <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
        Sort By: {sortOptions[categoryId] || 'Date'} <ChevronDown size={12} />
      </button>
      <div className="absolute right-0 mt-2 w-40 glass rounded-xl border border-white/10 hidden group-hover/sort:block z-50 overflow-hidden shadow-2xl">
        {[
          { id: 'date', label: 'Upload Date', icon: Clock },
          { id: 'name', label: 'Name', icon: Type },
          { id: 'length', label: 'Length', icon: Clock },
          { id: 'likes', label: 'Likes', icon: ThumbsUp },
          { id: 'views', label: 'Views', icon: Eye },
        ].map(opt => (
          <button
            key={opt.id}
            onClick={() => setSortOptions({ ...sortOptions, [categoryId]: opt.id as SortOption })}
            className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-record hover:text-white transition-colors flex items-center gap-3"
          >
            <opt.icon size={12} /> {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  // Group videos by categories
  const uncategorized = videos.filter(v => !categories.some(c => v.tags.toLowerCase().includes(c.tagQuery.toLowerCase())));

  return (
    <div className="space-y-16 pb-20">
      {videos.length === 0 && (
        <div className="text-center py-20">
          <p className="text-slate-500 font-black uppercase tracking-widest italic">The Archive is currently empty.</p>
        </div>
      )}

      {categories.map(cat => {
        const catVids = videos.filter(v => v.tags.toLowerCase().includes(cat.tagQuery.toLowerCase()));
        if (catVids.length === 0) return null;
        return (
          <section key={cat.id} className="space-y-6">
            <header className="flex justify-between items-end border-b border-white/5 pb-4">
              <h2 className="text-3xl font-black uppercase italic tracking-tighter text-record">{cat.name}</h2>
              <SortDropdown categoryId={cat.id} />
            </header>
            {renderVideoGrid(getSortedVideos(catVids, cat.id))}
          </section>
        );
      })}

      {uncategorized.length > 0 && (
        <section className="space-y-6">
          <header className="flex justify-between items-end border-b border-white/5 pb-4">
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-400">General Archive</h2>
            <SortDropdown categoryId="general" />
          </header>
          {renderVideoGrid(getSortedVideos(uncategorized, 'general'))}
        </section>
      )}
    </div>
  );
};

export default Home;
