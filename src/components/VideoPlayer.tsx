import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import type { CaptionBlock, CaptionStyle, PresetType } from '../types';
import { PRESETS } from '../utils/presets';
import { formatPlayheadTime } from '../utils/timeline';

const TRENDY_COLORS = [
  '#FFFFFF', '#000000', '#FFFF00', '#39FF14', '#FF2A7A', '#00FFFF', '#FD1D1D', '#FF8C00', '#833AB4'
];

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
  onUpdateStyle?: (s: Partial<CaptionStyle>) => void;
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
  onUpdateCaption,
  onUpdateStyle
}, ref) => {
  const localRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [rotationAngle, setRotationAngle] = useState<number | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const fisheyeCanvasRef = useRef<HTMLCanvasElement>(null);

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

  const cycleBackgroundStyle = () => {
    if (!onUpdateStyle) return;
    if (style.backgroundOpacity === 0) {
      // Move to Translucent Dark Box
      onUpdateStyle({
        backgroundOpacity: 0.5,
        backgroundColor: '#000000',
        textColor: style.textColor === '#000000' ? '#FFFFFF' : style.textColor
      });
    } else if (style.backgroundOpacity === 0.5 && style.backgroundColor === '#000000') {
      // Move to Solid Yellow Box
      onUpdateStyle({
        backgroundOpacity: 0.9,
        backgroundColor: '#FFFF00',
        textColor: '#000000'
      });
    } else if (style.backgroundColor === '#FFFF00') {
      // Move to Solid Neon Pink Box
      onUpdateStyle({
        backgroundOpacity: 0.9,
        backgroundColor: '#FF2A7A',
        textColor: '#FFFFFF'
      });
    } else {
      // Back to No Background
      onUpdateStyle({
        backgroundOpacity: 0,
        textColor: style.textColor === '#000000' ? '#FFFFFF' : style.textColor
      });
    }
  };

  const cycleAlignment = () => {
    if (!onUpdateStyle) return;
    const positions: ('top' | 'center' | 'bottom' | 'custom')[] = ['bottom', 'center', 'top'];
    const currentIndex = positions.indexOf(style.position);
    const nextIndex = (currentIndex + 1) % positions.length;
    onUpdateStyle({ position: positions[nextIndex] });
  };

  // Find active caption
  const activeCaption = captions.find(
    c => currentTime >= c.start && currentTime <= c.end
  );

  const drawFisheyeTextCharacterByCharacter = (
    ctx: CanvasRenderingContext2D,
    text: string,
    centerX: number,
    centerY: number,
    style: any,
    scale: number = 1
  ) => {
    const fontSize = style.fontSize * scale;
    const fontFamily = style.fontFamily;
    const weight = style.fontWeight === 'bold' ? 'bold' : 'normal';

    ctx.save();
    ctx.font = `italic ${weight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = text.split('\n');
    const lineHeight = fontSize * 1.35;
    const startY = centerY - ((lines.length - 1) * lineHeight) / 2;

    lines.forEach((line, lineIndex) => {
      const currentLineY = startY + lineIndex * lineHeight;
      const lineYOffset = currentLineY - centerY;

      const chars = line.split('');
      if (chars.length === 0) return;

      // Measure character widths
      const charWidths = chars.map(c => ctx.measureText(c).width);
      const totalLineWidth = charWidths.reduce((a, b) => a + b, 0);

      let currentX = centerX - totalLineWidth / 2;

      chars.forEach((char, charIndex) => {
        const charWidth = charWidths[charIndex];
        const charCenterX = currentX + charWidth / 2;
        const xOffsetFromCenter = charCenterX - centerX;

        const normX = xOffsetFromCenter / (totalLineWidth / 2 || 1);
        const cosFactorX = Math.cos(normX * Math.PI / 3);

        // Spherical bulge inward arching towards horizontal equator at sides
        const archFactor = -lineYOffset * 0.35;
        const archY = archFactor * (1.0 - Math.cos(normX * Math.PI / 2.5));

        // Outward radiation tilt/rotation (left tilts left, right tilts right)
        // Tilts more the further the character is from the equator and center
        const tiltAngle = (xOffsetFromCenter / 200) * (Math.abs(lineYOffset) / 100) * 0.75;

        ctx.save();
        const finalX = charCenterX;
        const finalY = currentLineY + archY;
        ctx.translate(finalX, finalY);
        ctx.rotate(tiltAngle);

        // Scale character slightly larger in the center of the line
        const scaleFactor = 1.0 + 0.25 * cosFactorX * (1.0 - Math.abs(lineYOffset) / 600);
        ctx.scale(scaleFactor, scaleFactor);

        // Draw stroke
        if (style.strokeWidth > 0) {
          ctx.strokeStyle = style.strokeColor;
          ctx.lineWidth = style.strokeWidth * scale;
          ctx.lineJoin = 'round';
          ctx.strokeText(char, 0, 0);
        }

        // Draw fill
        ctx.fillStyle = style.textColor;
        ctx.fillText(char, 0, 0);

        ctx.restore();

        currentX += charWidth;
      });
    });
    ctx.restore();
  };

  // Real-time Fish-Eye effect drawing on canvas
  useEffect(() => {
    const canvas = fisheyeCanvasRef.current;
    if (!canvas || !activeCaption || style.animation !== 'fisheye') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const text = style.uppercase ? activeCaption.text.toUpperCase() : activeCaption.text;
    const fontSize = style.fontSize;
    const fontFamily = style.fontFamily;
    const weight = style.fontWeight === 'bold' ? 'bold' : 'normal';

    // Set font to measure dimensions
    ctx.font = `italic ${weight} ${fontSize}px ${fontFamily}`;
    
    // Estimate size
    const lines = text.split('\n');
    let maxWidth = 0;
    lines.forEach(l => {
      const w = ctx.measureText(l).width;
      if (w > maxWidth) maxWidth = w;
    });

    const W = maxWidth + 120;
    const H = (fontSize * 1.45) * lines.length + 100;

    canvas.width = W;
    canvas.height = H;

    // Clear target canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = style.textOpacity * style.opacity;

    // Call our character-by-character drawing helper
    drawFisheyeTextCharacterByCharacter(ctx, text, W / 2, H / 2, style, 1);
  }, [activeCaption, style]);



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

  // Handle dragging caption block directly on video preview (standard click and drag on desktop)
  const handleCaptionDragStart = (e: React.MouseEvent) => {
    if (!activeCaption) return;

    e.preventDefault();
    e.stopPropagation();

    const container = containerRef.current;
    if (!container) return;

    // Automatically switch to custom positioning when user starts dragging
    if (style.position !== 'custom' && onUpdateStyle) {
      onUpdateStyle({ position: 'custom' });
    }

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

  // Handle rotating / tilting the caption block
  const handleCaptionRotateStart = (e: React.MouseEvent) => {
    if (!activeCaption) return;
    e.preventDefault();
    e.stopPropagation();

    const container = containerRef.current;
    const captionEl = e.currentTarget.parentElement;
    if (!container || !captionEl) return;

    const rect = captionEl.getBoundingClientRect();
    // Center of the caption element
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const handleMouseMoveRotate = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - centerX;
      const dy = moveEvent.clientY - centerY;

      // Calculate angle in radians, convert to degrees
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      
      // Offset by 90 degrees since our rotation handle is at the top
      angle = (angle + 90) % 360;

      // Normalize to -180 to 180 degrees range
      if (angle > 180) {
        angle -= 360;
      }

      const degrees = Math.round(angle);
      setRotationAngle(degrees);
      onUpdateCaption(activeCaption.id, { rotation: degrees });
    };

    const handleMouseUpRotate = () => {
      setRotationAngle(null);
      document.removeEventListener('mousemove', handleMouseMoveRotate);
      document.removeEventListener('mouseup', handleMouseUpRotate);
    };

    document.addEventListener('mousemove', handleMouseMoveRotate);
    document.addEventListener('mouseup', handleMouseUpRotate);
  };

  // Handle dragging caption block via touch (mobile - standard drag)
  const handleCaptionTouchStart = (e: React.TouchEvent) => {
    if (!activeCaption) return;
    
    // Prevent screen scroll only while starting to drag the caption element
    if (e.cancelable) {
      e.preventDefault();
    }
    e.stopPropagation();

    const container = containerRef.current;
    if (!container) return;

    if (style.position !== 'custom' && onUpdateStyle) {
      onUpdateStyle({ position: 'custom' });
    }

    setSelectedCaptionId(activeCaption.id);

    const rect = container.getBoundingClientRect();

    const handleTouchMoveDrag = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length === 0) return;
      
      // Prevent browser scroll overlay during active drag interaction
      if (moveEvent.cancelable) {
        moveEvent.preventDefault();
      }

      // Support dragging using the first touch point
      const touch = moveEvent.touches[0];
      const rawX = touch.clientX - rect.left;
      const rawY = touch.clientY - rect.top;

      const xPct = Number(((rawX / rect.width) * 100).toFixed(1));
      const yPct = Number(((rawY / rect.height) * 100).toFixed(1));

      const clampedX = Math.max(5, Math.min(95, xPct));
      const clampedY = Math.max(5, Math.min(95, yPct));

      onUpdateCaption(activeCaption.id, { x: clampedX, y: clampedY });
    };

    const handleTouchEndDrag = () => {
      document.removeEventListener('touchmove', handleTouchMoveDrag);
      document.removeEventListener('touchend', handleTouchEndDrag);
    };

    // Use passive: false to allow calling preventDefault() inside touchmove
    document.addEventListener('touchmove', handleTouchMoveDrag, { passive: false });
    document.addEventListener('touchend', handleTouchEndDrag);
  };

  // Handle rotating caption block via touch (mobile)
  const handleCaptionTouchRotateStart = (e: React.TouchEvent) => {
    if (!activeCaption) return;
    e.stopPropagation();

    const container = containerRef.current;
    const captionEl = e.currentTarget.parentElement;
    if (!container || !captionEl) return;

    const rect = captionEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const handleTouchMoveRotate = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length === 0) return;
      const touch = moveEvent.touches[0];

      const dx = touch.clientX - centerX;
      const dy = touch.clientY - centerY;

      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      angle = (angle + 90) % 360;

      if (angle > 180) {
        angle -= 360;
      }

      const degrees = Math.round(angle);
      setRotationAngle(degrees);
      onUpdateCaption(activeCaption.id, { rotation: degrees });
    };

    const handleTouchEndRotate = () => {
      setRotationAngle(null);
      document.removeEventListener('touchmove', handleTouchMoveRotate);
      document.removeEventListener('touchend', handleTouchEndRotate);
    };

    document.addEventListener('touchmove', handleTouchMoveRotate, { passive: true });
    document.addEventListener('touchend', handleTouchEndRotate);
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
    const rot = activeCaption ? (activeCaption.rotation || 0) : 0;
    
    if (style.position === 'top') {
      posStyles = { top: '12%', left: '50%', transform: `translate(-50%, 0) rotate(${rot}deg)` };
    } else if (style.position === 'center') {
      posStyles = { top: '50%', left: '50%', transform: `translate(-50%, -50%) rotate(${rot}deg)` };
    } else if (style.position === 'bottom') {
      posStyles = { bottom: '12%', left: '50%', transform: `translate(-50%, 0) rotate(${rot}deg)` };
    } else if (style.position === 'custom' && activeCaption) {
      const x = activeCaption.x !== undefined ? activeCaption.x : 50;
      const y = activeCaption.y !== undefined ? activeCaption.y : 85;
      posStyles = { 
        top: `${y}%`, 
        left: `${x}%`, 
        transform: `translate(-50%, -50%) rotate(${rot}deg)` 
      };
    }

    return {
      fontFamily: style.fontFamily,
      fontStyle: style.animation === 'fisheye' ? 'italic' : 'normal',
      fontSize: `${style.fontSize}px`,
      fontWeight: style.fontWeight,
      textTransform: style.uppercase ? 'uppercase' : 'none',
      color: style.textColor,
      opacity: style.opacity * style.textOpacity,
      WebkitTextStroke: textStroke,
      textShadow: textShadows.join(', ') || undefined,
      cursor: style.position === 'custom' ? 'move' : 'default',
      userSelect: 'none',
      touchAction: 'none', // Critical: disables page scroll while dragging text on mobile
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
        className="max-w-full max-h-full object-contain"
        preload="auto"
      />

      {/* Styled Caption Overlay (HTML / CSS Canvas Simulation) */}
      {activeCaption && (
        <div
          key={activeCaption.id}
          style={getOverlayStyle()}
          onMouseDown={handleCaptionDragStart}
          onTouchStart={handleCaptionTouchStart}
          className={`absolute pointer-events-auto transition-shadow z-30 ${
            selectedCaptionId === activeCaption.id
              ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-black/50 rounded-lg p-1'
              : ''
          }`}
        >
          {/* Rotation Handle */}
          {selectedCaptionId === activeCaption.id && (
            <div
              onMouseDown={handleCaptionRotateStart}
              onTouchStart={handleCaptionTouchRotateStart}
              className="absolute -top-7 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-violet-500 border border-white hover:scale-125 cursor-alias flex items-center justify-center shadow-lg transition-transform pointer-events-auto z-[9999]"
              title="Drag to Rotate Subtitle"
            >
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[1.5px] h-3 bg-violet-500/80 pointer-events-none" />
            </div>
          )}

          {/* Angle Display Badge */}
          {rotationAngle !== null && selectedCaptionId === activeCaption.id && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow pointer-events-none z-[9999]">
              {rotationAngle}°
            </div>
          )}

          {style.animation === 'fisheye' ? (
            <canvas
              ref={fisheyeCanvasRef}
              className="max-w-full block"
              style={{
                transform: 'translate(-12%, -8%)', // align the larger canvas center with the overlay container
              }}
            />
          ) : style.backgroundOpacity > 0 ? (
            <span 
              style={getBackgroundStyle()}
              className={style.animation !== 'none' ? `animate-${style.animation}` : ''}
            >
              {activeCaption.text}
            </span>
          ) : (
            <span className={style.animation !== 'none' ? `animate-${style.animation}` : ''}>
              {activeCaption.text}
            </span>
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

      {/* Instagram Stories Style Quick Editor Toolbar (Visible on Mobile Only) */}
      <div className="lg:hidden absolute bottom-14 inset-x-0 bg-zinc-950/90 backdrop-blur-md border-t border-white/5 p-3 flex flex-col gap-3 z-20 select-none">
        {/* Row 1: Font Presets Carousel */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(Object.keys(PRESETS) as PresetType[]).map((key) => {
            const item = PRESETS[key];
            const isSelected = style.fontFamily === item.style.fontFamily && style.textColor.toLowerCase() === item.style.textColor.toLowerCase();
            return (
              <button
                key={key}
                onClick={() => onUpdateStyle && onUpdateStyle({ ...item.style })}
                className={`px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap border transition-all ${
                  isSelected
                    ? 'bg-white text-black border-white shadow-lg'
                    : 'bg-zinc-900/60 text-zinc-300 border-white/10 hover:text-white'
                }`}
                style={{ fontFamily: item.style.fontFamily }}
              >
                {item.name}
              </button>
            );
          })}
        </div>

        {/* Row 2: Actions & Colors */}
        <div className="flex items-center justify-between gap-3">
          {/* Left Action: Toggle background box style */}
          <button
            onClick={cycleBackgroundStyle}
            className="p-2 rounded-lg bg-zinc-900/80 text-zinc-300 border border-white/10 hover:text-white flex items-center justify-center shrink-0"
            title="Toggle Text Background (Insta Style)"
          >
            <span className="text-[10px] font-extrabold px-0.5 border border-current rounded leading-none">
              A
            </span>
          </button>

          {/* Center Column: Scrollable Color Dots */}
          <div className="flex-1 flex items-center gap-2.5 overflow-x-auto py-1 scrollbar-none justify-start px-1">
            {TRENDY_COLORS.map(color => {
              const isSelected = style.textColor.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={color}
                  onClick={() => onUpdateStyle && onUpdateStyle({ textColor: color })}
                  className={`w-5 h-5 rounded-full border transition-transform flex items-center justify-center shrink-0 ${
                    isSelected ? 'scale-115 border-white' : 'border-white/15 hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {isSelected && (
                    <div className={`w-1 h-1 rounded-full ${color === '#FFFFFF' ? 'bg-black' : 'bg-white'}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Size Decrease */}
          <button
            onClick={() => onUpdateStyle && onUpdateStyle({ fontSize: Math.max(12, style.fontSize - 2) })}
            className="w-8 h-8 rounded-lg bg-zinc-900/80 text-zinc-300 border border-white/10 hover:text-white flex items-center justify-center shrink-0 active:scale-90 transition-transform font-bold text-xs"
            title="Decrease Text Size"
          >
            a-
          </button>

          {/* Size Increase */}
          <button
            onClick={() => onUpdateStyle && onUpdateStyle({ fontSize: Math.min(80, style.fontSize + 2) })}
            className="w-8 h-8 rounded-lg bg-zinc-900/80 text-zinc-300 border border-white/10 hover:text-white flex items-center justify-center shrink-0 active:scale-90 transition-transform font-bold text-sm"
            title="Increase Text Size"
          >
            A+
          </button>

          {/* Right Action: Cycle Alignment */}
          <button
            onClick={cycleAlignment}
            className="p-2 rounded-lg bg-zinc-900/80 text-zinc-300 border border-white/10 hover:text-white flex items-center justify-center shrink-0"
            title="Cycle Alignment"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;
