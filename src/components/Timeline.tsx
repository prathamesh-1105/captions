import React, { useRef, useEffect, useState } from 'react';
import type { CaptionBlock } from '../types';

interface TimelineProps {
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  captions: CaptionBlock[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, fields: Partial<CaptionBlock>) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  zoom: number; // pixels per second
  setZoom: (z: number) => void;
  isPlaying: boolean;
}

export default function Timeline({
  duration,
  currentTime,
  onSeek,
  captions,
  selectedId,
  onSelect,
  onUpdate,
  onDelete,
  onAdd,
  zoom,
  setZoom,
  isPlaying
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempText, setTempText] = useState<string>('');

  // Auto-scroll timeline to follow playhead if video is playing
  useEffect(() => {
    if (isPlaying && containerRef.current) {
      const container = containerRef.current;
      const playheadX = currentTime * zoom;
      const scrollLeft = container.scrollLeft;
      const containerWidth = container.clientWidth;

      // If playhead goes beyond the right 60% of the screen, scroll forward
      if (playheadX > scrollLeft + containerWidth * 0.7) {
        container.scrollTo({
          left: playheadX - containerWidth * 0.3,
          behavior: 'smooth'
        });
      }
      // If playhead goes behind the scroll area, scroll back
      else if (playheadX < scrollLeft) {
        container.scrollTo({
          left: Math.max(0, playheadX - 100),
          behavior: 'smooth'
        });
      }
    }
  }, [currentTime, zoom, isPlaying]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If clicking on the ruler or track (but not on a caption block)
    if (trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const targetTime = Math.max(0, Math.min(duration, clickX / zoom));
      onSeek(targetTime);
      onSelect(null);
      setEditingId(null);
    }
  };

  // Drag block to move start and end times together
  const handleBlockDragStart = (e: React.MouseEvent, block: CaptionBlock) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(block.id);
    setEditingId(null);

    const startX = e.clientX;
    const initialStart = block.start;
    const blockDuration = block.end - block.start;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = deltaX / zoom;
      
      let newStart = Number((initialStart + deltaTime).toFixed(2));
      let newEnd = Number((newStart + blockDuration).toFixed(2));

      // Clamp so block fits inside video bounds
      if (newStart < 0) {
        newStart = 0;
        newEnd = blockDuration;
      }
      if (newEnd > duration) {
        newEnd = duration;
        newStart = Number((duration - blockDuration).toFixed(2));
      }

      onUpdate(block.id, { start: newStart, end: newEnd });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Resize Left Handle (Change start time)
  const handleResizeLeftStart = (e: React.MouseEvent, block: CaptionBlock) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(block.id);

    const startX = e.clientX;
    const initialStart = block.start;
    const currentEnd = block.end;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = deltaX / zoom;
      
      let newStart = Number((initialStart + deltaTime).toFixed(2));
      
      // Safety limits: start >= 0 and duration >= 0.2s
      if (newStart < 0) newStart = 0;
      if (currentEnd - newStart < 0.2) {
        newStart = Number((currentEnd - 0.2).toFixed(2));
      }

      onUpdate(block.id, { start: newStart });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Resize Right Handle (Change end time)
  const handleResizeRightStart = (e: React.MouseEvent, block: CaptionBlock) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(block.id);

    const startX = e.clientX;
    const initialEnd = block.end;
    const currentStart = block.start;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = deltaX / zoom;
      
      let newEnd = Number((initialEnd + deltaTime).toFixed(2));
      
      // Safety limits: end <= duration and duration >= 0.2s
      if (newEnd > duration) newEnd = duration;
      if (newEnd - currentStart < 0.2) {
        newEnd = Number((currentStart + 0.2).toFixed(2));
      }

      onUpdate(block.id, { end: newEnd });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Drag block via touch (mobile)
  const handleBlockTouchStart = (e: React.TouchEvent, block: CaptionBlock) => {
    e.stopPropagation();
    onSelect(block.id);
    setEditingId(null);

    const startX = e.touches[0].clientX;
    const initialStart = block.start;
    const blockDuration = block.end - block.start;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length === 0) return;
      const deltaX = moveEvent.touches[0].clientX - startX;
      const deltaTime = deltaX / zoom;
      
      let newStart = Number((initialStart + deltaTime).toFixed(2));
      let newEnd = Number((newStart + blockDuration).toFixed(2));

      if (newStart < 0) {
        newStart = 0;
        newEnd = blockDuration;
      }
      if (newEnd > duration) {
        newEnd = duration;
        newStart = Number((duration - blockDuration).toFixed(2));
      }

      onUpdate(block.id, { start: newStart, end: newEnd });
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
  };

  // Resize Left via touch (mobile)
  const handleResizeLeftTouchStart = (e: React.TouchEvent, block: CaptionBlock) => {
    e.stopPropagation();
    onSelect(block.id);

    const startX = e.touches[0].clientX;
    const initialStart = block.start;
    const currentEnd = block.end;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length === 0) return;
      const deltaX = moveEvent.touches[0].clientX - startX;
      const deltaTime = deltaX / zoom;
      
      let newStart = Number((initialStart + deltaTime).toFixed(2));
      
      if (newStart < 0) newStart = 0;
      if (currentEnd - newStart < 0.2) {
        newStart = Number((currentEnd - 0.2).toFixed(2));
      }

      onUpdate(block.id, { start: newStart });
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
  };

  // Resize Right via touch (mobile)
  const handleResizeRightTouchStart = (e: React.TouchEvent, block: CaptionBlock) => {
    e.stopPropagation();
    onSelect(block.id);

    const startX = e.touches[0].clientX;
    const initialEnd = block.end;
    const currentStart = block.start;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length === 0) return;
      const deltaX = moveEvent.touches[0].clientX - startX;
      const deltaTime = deltaX / zoom;
      
      let newEnd = Number((initialEnd + deltaTime).toFixed(2));
      
      if (newEnd > duration) newEnd = duration;
      if (newEnd - currentStart < 0.2) {
        newEnd = Number((currentStart + 0.2).toFixed(2));
      }

      onUpdate(block.id, { end: newEnd });
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
  };

  // Inline text edit triggers
  const handleDoubleClick = (block: CaptionBlock) => {
    setEditingId(block.id);
    setTempText(block.text);
  };

  const handleTextSubmit = (id: string) => {
    if (tempText.trim() !== '') {
      onUpdate(id, { text: tempText.trim() });
    }
    setEditingId(null);
  };

  const renderRulerTicks = () => {
    const ticks = [];
    const step = zoom < 30 ? 5 : zoom < 75 ? 2 : 1; // dynamically change markers based on zoom
    const totalTicks = Math.ceil(duration);

    for (let i = 0; i <= totalTicks; i += step) {
      ticks.push(
        <div
          key={`tick-${i}`}
          className="absolute border-l border-white/10 h-3 text-[9px] text-zinc-500 font-mono pl-1 pointer-events-none"
          style={{ left: `${i * zoom}px` }}
        >
          {i}s
        </div>
      );
    }
    return ticks;
  };

  const selectedBlock = captions.find(c => c.id === selectedId);

  // Helper to step to previous/next caption
  const handleSelectPrevious = () => {
    if (!selectedId) return;
    const currentIndex = captions.findIndex(c => c.id === selectedId);
    if (currentIndex > 0) {
      const prevBlock = captions[currentIndex - 1];
      onSelect(prevBlock.id);
      onSeek(prevBlock.start);
    }
  };

  const handleSelectNext = () => {
    if (!selectedId) return;
    const currentIndex = captions.findIndex(c => c.id === selectedId);
    if (currentIndex < captions.length - 1) {
      const nextBlock = captions[currentIndex + 1];
      onSelect(nextBlock.id);
      onSeek(nextBlock.start);
    }
  };

  // Helper to adjust block timings
  const adjustStartTime = (amount: number) => {
    if (!selectedBlock) return;
    let newStart = Number((selectedBlock.start + amount).toFixed(2));
    if (newStart < 0) newStart = 0;
    if (selectedBlock.end - newStart < 0.2) {
      newStart = Number((selectedBlock.end - 0.2).toFixed(2));
    }
    onUpdate(selectedBlock.id, { start: newStart });
  };

  const adjustEndTime = (amount: number) => {
    if (!selectedBlock) return;
    let newEnd = Number((selectedBlock.end + amount).toFixed(2));
    if (newEnd > duration) newEnd = duration;
    if (newEnd - selectedBlock.start < 0.2) {
      newEnd = Number((selectedBlock.start + 0.2).toFixed(2));
    }
    onUpdate(selectedBlock.id, { end: newEnd });
  };

  const trackWidth = duration * zoom;

  return (
    <div className="flex-1 flex flex-col min-h-0 select-none">
      {/* Timeline Controls Header */}
      <div className="border-b border-white/10 bg-zinc-950/80 shrink-0">
        {/* Mobile-only active editor (renders when block is selected on mobile) */}
        {selectedBlock ? (
          <div className="flex flex-col gap-2.5 p-2 sm:hidden bg-zinc-900/60">
            {/* Row 1: Prev, Text, Next, Delete */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectPrevious}
                disabled={captions.findIndex(c => c.id === selectedId) === 0}
                className="w-8 h-8 rounded bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none active:scale-90 transition-transform shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
              </button>
              
              <input
                type="text"
                value={selectedBlock.text}
                onChange={(e) => onUpdate(selectedBlock.id, { text: e.target.value })}
                className="flex-1 bg-zinc-950 border border-white/10 rounded px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
                placeholder="Edit caption text..."
              />
              
              <button
                onClick={handleSelectNext}
                disabled={captions.findIndex(c => c.id === selectedId) === captions.length - 1}
                className="w-8 h-8 rounded bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none active:scale-90 transition-transform shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>

              <button
                onClick={() => onDelete(selectedBlock.id)}
                className="w-8 h-8 rounded bg-red-950/40 border border-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-950/60 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 9m-4.72 0-.34-9m9.96-3-1.88 12.75a2.25 2.25 0 0 1-2.24 2.15H8.403a2.25 2.25 0 0 1-2.24-2.15L4.07 7.5m16.79 0c.553 0 1 .006 1.543.018m-1.543-.018-1.782-12.75a1.5 1.5 0 0 0-1.51-1.366H7.938a1.5 1.5 0 0 0-1.51 1.366L4.646 7.5m9.03 0v-2.25M9.375 7.5v-2.25M9.375 7.5h5.25" />
                </svg>
              </button>
            </div>

            {/* Row 2: Start time adjustment, End time adjustment */}
            <div className="flex items-center justify-between gap-4 text-xs px-1">
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500 font-medium">Start:</span>
                <button
                  onClick={() => adjustStartTime(-0.1)}
                  className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold flex items-center justify-center active:scale-90 transition-transform text-sm"
                >
                  -
                </button>
                <span className="font-mono text-zinc-200 bg-black/40 px-2.5 py-0.5 rounded border border-white/5 min-w-[50px] text-center text-xs">
                  {selectedBlock.start.toFixed(1)}s
                </span>
                <button
                  onClick={() => adjustStartTime(0.1)}
                  className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold flex items-center justify-center active:scale-90 transition-transform text-sm"
                >
                  +
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500 font-medium">End:</span>
                <button
                  onClick={() => adjustEndTime(-0.1)}
                  className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold flex items-center justify-center active:scale-90 transition-transform text-sm"
                >
                  -
                </button>
                <span className="font-mono text-zinc-200 bg-black/40 px-2.5 py-0.5 rounded border border-white/5 min-w-[50px] text-center text-xs">
                  {selectedBlock.end.toFixed(1)}s
                </span>
                <button
                  onClick={() => adjustEndTime(0.1)}
                  className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold flex items-center justify-center active:scale-90 transition-transform text-sm"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Standard desktop controls header (hidden on mobile when a block is selected) */}
        <div className={`h-12 flex items-center justify-between px-4 bg-zinc-900/40 select-none overflow-x-auto scrollbar-none gap-4 ${selectedBlock ? 'hidden sm:flex' : 'flex'}`}>
          {/* Left Controls */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onAdd}
              className="px-3 py-1.5 rounded bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1 shadow transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Phrase
            </button>

            {selectedId && (
              <button
                onClick={() => onDelete(selectedId)}
                className="px-2.5 py-1.5 rounded bg-red-950/30 text-red-400 border border-red-500/10 hover:bg-red-950/50 hover:text-red-300 text-xs font-medium flex items-center gap-1 shrink-0 transition-colors"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 9m-4.72 0-.34-9m9.96-3-1.88 12.75a2.25 2.25 0 0 1-2.24 2.15H8.403a2.25 2.25 0 0 1-2.24-2.15L4.07 7.5m16.79 0c.553 0 1 .006 1.543.018m-1.543-.018-1.782-12.75a1.5 1.5 0 0 0-1.51-1.366H7.938a1.5 1.5 0 0 0-1.51 1.366L4.646 7.5m9.03 0v-2.25M9.375 7.5v-2.25M9.375 7.5h5.25" />
                </svg>
                Delete
              </button>
            )}

            {/* Quick text input box */}
            {selectedBlock && (
              <div className="flex items-center gap-1.5 border-l border-white/10 pl-3 shrink-0">
                <span className="text-[10px] text-zinc-450 font-bold uppercase hidden sm:inline">Text:</span>
                <input
                  type="text"
                  value={selectedBlock.text}
                  onChange={(e) => onUpdate(selectedBlock.id, { text: e.target.value })}
                  className="bg-black/55 border border-white/10 rounded px-2.5 py-1 text-base sm:text-xs text-white placeholder-zinc-550 focus:outline-none focus:border-violet-500 w-36 sm:w-48 md:w-64"
                  placeholder="Edit caption..."
                />
              </div>
            )}
          </div>

          {/* Zoom Controller */}
          <div className="flex items-center gap-3 shrink-0">
            <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637ZM10.5 7.5v6m3-3h-6" />
            </svg>
            <input
              type="range"
              min="15"
              max="150"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-24 sm:w-28 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-600 shrink-0"
            />
            <span className="text-[10px] text-zinc-500 font-mono w-8 shrink-0">{zoom}px/s</span>
          </div>
        </div>
      </div>

      {/* Timeline Ruler & Track Scroll Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden bg-zinc-950/70 relative min-h-0"
      >
        <div
          ref={trackRef}
          onClick={handleTimelineClick}
          className="h-full relative timeline-bg"
          style={{ width: `${trackWidth}px` }}
        >
          {/* Ruler Ticks */}
          <div className="h-6 border-b border-white/5 relative bg-zinc-900/30">
            {renderRulerTicks()}
          </div>

          {/* Subtitle Track */}
          <div className="absolute inset-x-0 top-6 bottom-0 py-4">
            {captions.map((block) => {
              const left = block.start * zoom;
              const width = (block.end - block.start) * zoom;
              const isSelected = selectedId === block.id;
              const isEditing = editingId === block.id;

              return (
                <div
                  key={block.id}
                  onMouseDown={(e) => handleBlockDragStart(e, block)}
                  onTouchStart={(e) => handleBlockTouchStart(e, block)}
                  onDoubleClick={() => handleDoubleClick(block)}
                  style={{
                    left: `${left}px`,
                    width: `${width}px`
                  }}
                  className={`absolute h-20 rounded-lg flex flex-col justify-between p-2 text-xs border transition-colors ${
                    isSelected
                      ? 'bg-violet-600/35 border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.15)] z-20'
                      : 'bg-zinc-900 border-white/10 hover:bg-zinc-800/80 z-10'
                  }`}
                >
                  {/* Left Resize Handle */}
                  <div
                    onMouseDown={(e) => handleResizeLeftStart(e, block)}
                    onTouchStart={(e) => handleResizeLeftTouchStart(e, block)}
                    className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-violet-500/50 rounded-l-lg"
                    title="Resize start"
                  />

                  {/* Text Container / Input */}
                  <div className="flex-1 px-1.5 overflow-hidden flex items-center justify-center">
                    {isEditing ? (
                      <input
                        type="text"
                        value={tempText}
                        onChange={(e) => setTempText(e.target.value)}
                        onBlur={() => handleTextSubmit(block.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleTextSubmit(block.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        className="w-full text-center bg-black border border-violet-500 rounded px-1 text-white text-xs focus:outline-none"
                      />
                    ) : (
                      <p className="text-center font-medium truncate select-none text-[11px] text-zinc-100">
                        {block.text}
                      </p>
                    )}
                  </div>

                  {/* Timing indicator */}
                  <div className="text-[9px] text-zinc-500 font-mono text-center select-none">
                    {block.start.toFixed(1)}s - {block.end.toFixed(1)}s
                  </div>

                  {/* Right Resize Handle */}
                  <div
                    onMouseDown={(e) => handleResizeRightStart(e, block)}
                    onTouchStart={(e) => handleResizeRightTouchStart(e, block)}
                    className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-violet-500/50 rounded-r-lg"
                    title="Resize end"
                  />
                </div>
              );
            })}
          </div>

          {/* Timeline Playhead Track Line */}
          <div
            className="absolute top-0 bottom-0 border-l-2 border-red-500 z-30 pointer-events-none"
            style={{ left: `${currentTime * zoom}px` }}
          >
            <div className="w-3 h-3 rounded-full bg-red-500 -ml-[5px] shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
