import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Maximize, Minimize, Settings } from 'lucide-react';
import Danmaku from './Danmaku';
import type { DanmakuUser } from '../lib/danmaku';

interface Props {
  src: string;
  poster?: string;
  videoId: string;
  user: DanmakuUser | null;
}

const VideoPlayer: React.FC<Props> = ({ src, poster, videoId, user }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playerElement, setPlayerElement] = useState<HTMLDivElement | null>(null);
  const [levels, setLevels] = useState<{ id: number; name: string }[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 is auto
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerSize, setPlayerSize] = useState({ width: 0, height: 0 });
  const [fullscreenError, setFullscreenError] = useState('');

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

      hlsRef.current = hlsInstance;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
        if (hlsRef.current === hlsInstance) hlsRef.current = null;
      }
    };
  }, [src]);

  useEffect(() => {
    if (!playerElement) return;

    const updateSize = () => setPlayerSize({ width: playerElement.clientWidth, height: playerElement.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(playerElement);
    return () => observer.disconnect();
  }, [playerElement]);

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(document.fullscreenElement === playerElement);
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, [playerElement]);

  const changeLevel = (levelId: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelId;
      setCurrentLevel(levelId);
      setShowSettings(false);
    }
  };

  const toggleFullscreen = async () => {
    if (!playerElement) return;
    setFullscreenError('');
    try {
      if (document.fullscreenElement === playerElement) {
        await document.exitFullscreen();
      } else {
        await playerElement.requestFullscreen();
      }
    } catch {
      setFullscreenError('Fullscreen is unavailable in this browser.');
    }
  };

  return (
    <div>
      <div ref={setPlayerElement} data-testid="video-container" className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group">
        <video
          ref={videoRef}
          poster={poster}
          controls
          controlsList="nofullscreen"
          className="w-full h-full"
          playsInline
        />

        <div className="absolute top-4 right-4 z-30 flex items-start gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-all border border-white/10 backdrop-blur-sm"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>

          {levels.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-all border border-white/10 backdrop-blur-sm"
                aria-label="Video quality"
                aria-expanded={showSettings}
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

        {fullscreenError && <p role="alert" className="absolute bottom-14 left-1/2 z-40 -translate-x-1/2 rounded bg-black/80 px-3 py-2 text-xs text-rose-400">{fullscreenError}</p>}
      </div>

      <Danmaku
        videoId={videoId}
        user={user}
        videoRef={videoRef}
        overlayWidth={playerSize.width}
        overlayHeight={playerSize.height}
        overlayHost={playerElement}
      />
    </div>
  );
};

export default VideoPlayer;
