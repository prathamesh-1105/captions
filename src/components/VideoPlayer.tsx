import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import type { CaptionBlock, CaptionStyle } from '../types';
import { formatPlayheadTime } from '../utils/timeline';

interface VideoPlayerProps {
  blobUrl: string;
  captions: CaptionBlock[];
  style: CaptionStyle;
  currentTime: number;
  setCurrentTime: (t: number) => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  selectedCaptionId: string | null;
  setSelectedCaptionId: (id: string | null) => void;
  onUpdateCaption: (id: string, fields: Partial<CaptionBlock>) => void;
}

const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(({
  blobUrl,
  captions,
  style,
  currentTime,
  setCurrentTime,
  isPlaying,
  setIsPlaying,
  selectedCaptionId,
  setSelectedCaptionId,
  onUpdateCaption
}, ref) => {
  const localRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Sync internal ref with forwarded ref
  useImperativeHandle(ref, () => localRef.current!);

  // Play/Pause sync
  useEffect(() => {
    const video = localRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  }, [isPlaying, setIsPlaying]);

  // Handle time update
  const handleTimeUpdate = () => {
    const video = localRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    setIsMuted(v === 0);
    if (localRef.current) {
      localRef.current.volume = v;
      localRef.current.muted = v === 0;
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (localRef.current) {
      localRef.current.muted = nextMuted;
      localRef.current.volume = nextMuted ? 0 : volume;
    }
  };

  // Find active caption
  const activeCaption = captions.find(
    c => currentTime >= c.start && currentTime <= c.end
  );

  // Mouse move over container to show/hide controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // Handle dragging caption block directly on video preview
  const handleCaptionDragStart = (e: React.MouseEvent) => {
    if (style.position !== 'custom' || !activeCaption) return;
    e.preventDefault();
    e.stopPropagation();

    const container = containerRef.current;
    if (!container) return;

    // Deselect other UI and highlight active caption in timeline
    setSelectedCaptionId(activeCaption.id);

    const rect = container.getBoundingClientRect();

    const handleMouseMoveDrag = (moveEvent: MouseEvent) => {
      // Calculate mouse position relative to video container
      const rawX = moveEvent.clientX - rect.left;
      const rawY = moveEvent.clientY - rect.top;

      // Convert to percentages (0 - 100)
      const xPct = Number(((rawX / rect.width) * 100).toFixed(1));
      const yPct = Number(((rawY / rect.height) * 100).toFixed(1));

      // Clamp percentages
      const clampedX = Math.max(5, Math.min(95, xPct));
      const clampedY = Math.max(5, Math.min(95, yPct));

      onUpdateCaption(activeCaption.id, { x: clampedX, y: clampedY });
    };

    const handleMouseUpDrag = () => {
      document.removeEventListener('mousemove', handleMouseMoveDrag);
      document.removeEventListener('mouseup', handleMouseUpDrag);
    };

    document.addEventListener('mousemove', handleMouseMoveDrag);
    document.addEventListener('mouseup', handleMouseUpDrag);
  };

  // Dynamic inline styling for caption overlay matching selected parameters
  const getOverlayStyle = (): React.CSSProperties => {
    const textShadows: string[] = [];

    // Simulate stroke using text-shadow or -webkit-text-stroke
    const textStroke = style.strokeWidth > 0 
      ? `${style.strokeWidth}px ${style.strokeColor}` 
      : undefined;

    // Soft drop shadow
    if (style.shadowWidth > 0) {
      textShadows.push(`${style.shadowWidth}px ${style.shadowWidth}px 0px ${style.shadowColor}`);
    }

    // Glow simulation
    if (style.glowWidth && style.glowWidth > 0 && style.glowColor) {
      textShadows.push(`0 0 ${style.glowWidth}px ${style.glowColor}`);
    }

    // Position coordinate mapping
    let posStyles: React.CSSProperties = {};
    if (style.position === 'top') {
      posStyles = { top: '12%', left: '50%', transform: 'translate(-50%, 0)' };
    } else if (style.position === 'center') {
      posStyles = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    } else if (style.position === 'bottom') {
      posStyles = { bottom: '12%', left: '50%', transform: 'translate(-50%, 0)' };
    } else if (style.position === 'custom' && activeCaption) {
      const x = activeCaption.x !== undefined ? activeCaption.x : 50;
      const y = activeCaption.y !== undefined ? activeCaption.y : 85;
      posStyles = { 
        top: `${y}%`, 
        left: `${x}%`, 
        transform: 'translate(-50%, -50%)' 
      };
    }

    return {
      fontFamily: style.fontFamily,
      fontSize: `${style.fontSize}px`,
      fontWeight: style.fontWeight,
      textTransform: style.uppercase ? 'uppercase' : 'none',
      color: style.textColor,
      opacity: style.opacity * style.textOpacity,
      WebkitTextStroke: textStroke,
      textShadow: textShadows.join(', ') || undefined,
      cursor: style.position === 'custom' ? 'move' : 'default',
      userSelect: 'none',
      ...posStyles
    };
  };

  const getBackgroundStyle = (): React.CSSProperties => {
    return {
      backgroundColor: style.backgroundColor,
      opacity: style.backgroundOpacity,
      borderRadius: '8px',
      padding: '6px 14px',
      display: 'inline-block',
      textAlign: 'center',
      lineHeight: '1.4'
    };
  };

  const duration = localRef.current?.duration || 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="relative w-full h-full flex items-center justify-center select-none"
    >
      <video
        ref={localRef}
        src={blobUrl}
        onTimeUpdate={handleTimeUpdate}
        onClick={togglePlay}
        className="max-w-full max-h-full aspect-video object-contain"
        preload="auto"
      />

      {/* Styled Caption Overlay (HTML / CSS Canvas Simulation) */}
      {activeCaption && (
        <div
          style={getOverlayStyle()}
          onMouseDown={handleCaptionDragStart}
          className={`absolute pointer-events-auto transition-shadow ${
            style.position === 'custom' && selectedCaptionId === activeCaption.id
              ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-black/50 rounded-lg p-1'
              : ''
          }`}
        >
          {style.backgroundOpacity > 0 ? (
            <span style={getBackgroundStyle()}>
              {activeCaption.text}
            </span>
          ) : (
            <span>{activeCaption.text}</span>
          )}
        </div>
      )}

      {/* Custom Safe Zone Margin Guides (visible during custom position adjustment) */}
      {style.position === 'custom' && selectedCaptionId && activeCaption && (
        <div className="absolute inset-[8%] border border-dashed border-white/20 rounded-md pointer-events-none flex items-start justify-center">
          <span className="text-[10px] text-zinc-500 bg-zinc-950/80 px-2 py-0.5 rounded border border-white/5 -mt-3.5">
            Safe Action Area (8% Margin)
          </span>
        </div>
      )}

      {/* Play/Pause Overlay indicator on click */}
      <div 
        onClick={togglePlay}
        className="absolute inset-0 flex items-center justify-center cursor-pointer z-10 bg-transparent"
      />

      {/* Player Controller Bar */}
      <div
        className={`absolute bottom-0 inset-x-0 h-14 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between px-6 transition-all duration-300 z-20 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            {isPlaying ? (
              <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4.5 h-4.5 translate-x-[1px]" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Time text indicator */}
          <div className="text-xs text-zinc-300 font-mono">
            {formatPlayheadTime(currentTime)} / {formatPlayheadTime(duration)}
          </div>
        </div>

        {/* Volume & Audio controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 group">
            <button
              onClick={toggleMute}
              className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
            >
              {isMuted ? (
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
              ) : (
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-0 group-hover:w-16 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer transition-all duration-300 accent-violet-600 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;
