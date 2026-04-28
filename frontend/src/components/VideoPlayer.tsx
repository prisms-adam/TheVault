import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Settings } from 'lucide-react';

interface Props {
  src: string;
  poster?: string;
}

const VideoPlayer: React.FC<Props> = ({ src, poster }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hls, setHls] = useState<Hls | null>(null);
  const [levels, setLevels] = useState<{ id: number; name: string }[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 is auto
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hlsInstance: Hls | null = null;

    if (Hls.isSupported()) {
      hlsInstance = new Hls({
        capLevelToPlayerSize: true,
        autoStartLoad: true,
      });
      hlsInstance.loadSource(src);
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        const availableLevels = hlsInstance!.levels.map((level, index) => ({
          id: index,
          name: `${level.height}p`,
        }));
        setLevels(availableLevels);
      });

      hlsInstance.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        if (hlsInstance?.autoLevelEnabled) {
          setCurrentLevel(-1);
        } else {
          setCurrentLevel(data.level);
        }
      });

      setHls(hlsInstance);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [src]);

  const changeLevel = (levelId: number) => {
    if (hls) {
      hls.currentLevel = levelId;
      setCurrentLevel(levelId);
      setShowSettings(false);
    }
  };

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group">
      <video
        ref={videoRef}
        poster={poster}
        controls
        className="w-full h-full"
        playsInline
      />
      
      {levels.length > 0 && (
        <div className="absolute top-4 right-4 z-20">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-all border border-white/10 backdrop-blur-sm"
          >
            <Settings size={18} className={showSettings ? 'rotate-90 transition-transform' : 'transition-transform'} />
          </button>

          {showSettings && (
            <div className="absolute right-0 mt-2 w-32 bg-onyx/95 border border-white/10 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
              <div className="px-3 py-2 border-b border-white/5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                Quality
              </div>
              <button
                onClick={() => changeLevel(-1)}
                className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors ${currentLevel === -1 ? 'bg-record text-white' : 'text-slate-300 hover:bg-white/5'}`}
              >
                Auto
              </button>
              {levels.map((level) => (
                <button
                  key={level.id}
                  onClick={() => changeLevel(level.id)}
                  className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors ${currentLevel === level.id ? 'bg-record text-white' : 'text-slate-300 hover:bg-white/5'}`}
                >
                  {level.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
