import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface Props {
  src: string;
  poster?: string;
}

const VideoPlayer: React.FC<Props> = ({ src, poster }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        capLevelToPlayerSize: true,
        autoStartLoad: true,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    }
  }, [src]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
      <video
        ref={videoRef}
        poster={poster}
        controls
        className="w-full h-full"
        playsInline
      />
    </div>
  );
};

export default VideoPlayer;
