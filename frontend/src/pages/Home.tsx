import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

interface Video {
  id: string;
  title: string;
  thumbnailPath: string;
  technicalMetadata: string;
  createdAt: string;
  isFeatured: boolean;
  _count: { reactions: number; comments: number };
}

const Home = () => {
  const [videos, setVideos] = useState<Video[]>([]);

  useEffect(() => {
    api.get('/videos').then((res: { data: Video[] }) => {
      // Sort: featured first, then by date
      const sorted = res.data.sort((a: Video, b: Video) => {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setVideos(sorted);
    });
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      {videos.length === 0 && (
        <div className="col-span-full text-center py-20">
          <p className="text-slate-500 font-black uppercase tracking-widest italic">The Archive is currently empty.</p>
        </div>
      )}
      {videos.map(video => {
        const metadata = JSON.parse(video.technicalMetadata || '{}');
        const height = metadata.streams?.find((s: any) => s.height)?.height || '?';
        const assetBase = '/vault';
        const thumbnail = video.thumbnailPath 
          ? `${assetBase}${video.thumbnailPath}` 
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
            
            <div className="absolute top-3 right-3 flex gap-2">
              <span className="text-[10px] font-black bg-record px-2 py-0.5 rounded tracking-tighter uppercase">HLS</span>
              <span className="text-[10px] font-black bg-slate-800 px-2 py-0.5 rounded tracking-tighter uppercase">{height}P</span>
            </div>

            <div className="absolute bottom-4 left-4 right-4">
              <h3 className="font-bold text-lg truncate leading-tight">{video.title}</h3>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 uppercase font-semibold">
                <span>{video._count.reactions} Reactions</span>
                <span className="w-1 h-1 rounded-full bg-slate-600" />
                <span>{video._count.comments} Comments</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

export default Home;
