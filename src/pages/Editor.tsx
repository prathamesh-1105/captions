import { useState, useRef, useEffect } from 'react';
import type { CaptionBlock, CaptionStyle, VideoMetadata } from '../types';
import VideoPlayer from '../components/VideoPlayer';
import Timeline from '../components/Timeline';
import StyleCustomizer from '../components/StyleCustomizer';
import PresetList from '../components/PresetList';

interface EditorProps {
  projectId: string | null;
  videoFile: File | null;
  metadata: VideoMetadata;
  captions: CaptionBlock[];
  setCaptions: React.Dispatch<React.SetStateAction<CaptionBlock[]>>;
  style: CaptionStyle;
  setStyle: React.Dispatch<React.SetStateAction<CaptionStyle>>;
  resolution: '720p' | '1080p' | '2k' | '4k';
  setResolution: (r: '720p' | '1080p' | '2k' | '4k') => void;
  fps: number;
  setFps: (f: number) => void;
  onExport: () => void;
}

export default function Editor({
  projectId,
  metadata,
  captions,
  setCaptions,
  style,
  setStyle,
  resolution,
  setResolution,
  fps,
  setFps,
  onExport
}: EditorProps) {
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(50); // pixels per second
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>('saved');
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

  // Debounced auto-save hook to backend projects API
  useEffect(() => {
    if (!projectId) return;

    setSaveStatus('saving');
    const delayDebounce = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: projectId,
            captions,
            style
          })
        });

        if (response.ok) {
          setSaveStatus('saved');
        } else {
          console.error('Error auto-saving to backend.');
          setSaveStatus('error');
        }
      } catch (err) {
        console.error('Auto-save network error:', err);
        setSaveStatus('error');
      }
    }, 1500); // 1.5 second debounce

    return () => clearTimeout(delayDebounce);
  }, [captions, style, projectId]);

  // History stack for Undo/Redo
  const [history, setHistory] = useState<CaptionBlock[][]>([captions]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Add caption state to history
  const updateCaptionsWithHistory = (newCaptions: CaptionBlock[]) => {
    // Trim history if we did actions after an undo
    const newHistory = history.slice(0, historyIndex + 1);
    setHistory([...newHistory, newCaptions]);
    setHistoryIndex(newHistory.length);
    setCaptions(newCaptions);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCaptions(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setCaptions(history[historyIndex + 1]);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut keys if user is typing in an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedCaptionId) {
          e.preventDefault();
          handleDeleteCaption(selectedCaptionId);
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekDelta(-0.5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekDelta(0.5);
      } else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (e.code === 'KeyY' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCaptionId, historyIndex, history]);

  const seekDelta = (seconds: number) => {
    if (videoRef.current) {
      let targetTime = videoRef.current.currentTime + seconds;
      targetTime = Math.max(0, Math.min(metadata.duration, targetTime));
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Caption Operations
  const handleUpdateCaption = (id: string, updatedFields: Partial<CaptionBlock>) => {
    const newCaptions = captions.map(c => {
      if (c.id === id) {
        return { ...c, ...updatedFields };
      }
      return c;
    });
    updateCaptionsWithHistory(newCaptions);
  };

  const handleDeleteCaption = (id: string) => {
    const newCaptions = captions.filter(c => c.id !== id);
    updateCaptionsWithHistory(newCaptions);
    setSelectedCaptionId(null);
  };

  const handleAddCaption = () => {
    const start = Number(currentTime.toFixed(2));
    const end = Number(Math.min(metadata.duration, currentTime + 2.0).toFixed(2));
    
    const newCap: CaptionBlock = {
      id: `cap-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      text: 'New Caption',
      start,
      end,
      x: 50,
      y: 85
    };

    const newCaptions = [...captions, newCap].sort((a, b) => a.start - b.start);
    updateCaptionsWithHistory(newCaptions);
    setSelectedCaptionId(newCap.id);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-black">
      {/* Workspace Area: Player & Sidebar */}
      <div className="flex-1 flex min-h-0">
        
        {/* Left Side: Video Preview Column */}
        <div className="flex-1 flex flex-col p-4 gap-4 min-w-0 bg-zinc-950/40">
          {/* Action Toolbar */}
          <div className="h-10 flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-3 text-xs text-zinc-450">
              <span className="font-semibold text-zinc-200">Timeline Editor</span>
              <span>•</span>
              <span className="truncate max-w-[200px]">{metadata.filename}</span>
              <span>•</span>
              <span>{captions.length} phrases</span>
              <span>•</span>
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1.5 text-zinc-400 font-medium select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping" />
                  Saving edits...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1.5 text-zinc-550 font-medium select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Saved to database
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-red-400 font-semibold select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Auto-save failed
                </span>
              )}
            </div>

            {/* Undo / Redo controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent"
                title="Undo (Ctrl+Z)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                </svg>
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent"
                title="Redo (Ctrl+Y)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Video Player Display Container */}
          <div className="flex-1 min-h-0 flex items-center justify-center relative bg-black/80 rounded-xl overflow-hidden border border-white/5">
            <VideoPlayer
              ref={videoRef}
              blobUrl={metadata.blobUrl}
              captions={captions}
              style={style}
              currentTime={currentTime}
              setCurrentTime={setCurrentTime}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              selectedCaptionId={selectedCaptionId}
              setSelectedCaptionId={setSelectedCaptionId}
              onUpdateCaption={handleUpdateCaption}
              onUpdateStyle={(s) => setStyle(prev => ({ ...prev, ...s }))}
            />
          </div>
        </div>

        {/* Right Side: Styling and Presets Toolbar */}
        <div className="w-80 border-l border-white/10 flex flex-col bg-zinc-950 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {/* Gallery of Presets */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Style Presets</h3>
              <PresetList currentStyle={style} onSelectPreset={setStyle} />
            </div>

            {/* Customizer properties */}
            <div className="border-t border-white/5 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Customize Style</h3>
              <StyleCustomizer style={style} onChange={setStyle} />
            </div>

            {/* Export Settings */}
            <div className="border-t border-white/5 pt-4 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Export Properties</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-zinc-500">Resolution</label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as any)}
                    className="w-full text-xs bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-violet-500"
                  >
                    <option value="720p">720p (HD)</option>
                    <option value="1080p">1080p (FHD)</option>
                    <option value="2k">2K (QHD)</option>
                    <option value="4k">4K (UHD)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-zinc-500">Frame Rate</label>
                  <select
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    className="w-full text-xs bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-violet-500"
                  >
                    <option value={30}>30 FPS</option>
                    <option value={60}>60 FPS</option>
                  </select>
                </div>
              </div>

              <button
                onClick={onExport}
                className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold rounded-lg hover:from-violet-500 hover:to-indigo-500 shadow-md hover:shadow-violet-600/25 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Export Video
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Area: Timeline Editor */}
      <div className="h-64 border-t border-white/10 bg-zinc-950 flex flex-col min-h-0">
        <Timeline
          duration={metadata.duration}
          currentTime={currentTime}
          onSeek={handleSeek}
          captions={captions}
          selectedId={selectedCaptionId}
          onSelect={setSelectedCaptionId}
          onUpdate={handleUpdateCaption}
          onDelete={handleDeleteCaption}
          onAdd={handleAddCaption}
          zoom={zoom}
          setZoom={setZoom}
          isPlaying={isPlaying}
        />
      </div>
    </div>
  );
}
