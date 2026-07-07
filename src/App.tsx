import { useState } from 'react';
import Home from './pages/Home';
import Editor from './pages/Editor';
import Export from './pages/Export';
import type { CaptionBlock, CaptionStyle, VideoMetadata } from './types';
import { PRESETS } from './utils/presets';

type Page = 'home' | 'editor' | 'export';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [captions, setCaptions] = useState<CaptionBlock[]>([]);
  
  // Default to clean style preset
  const [style, setStyle] = useState<CaptionStyle>({ ...PRESETS['default'].style });

  // Export options
  const [resolution, setResolution] = useState<'720p' | '1080p' | '2k' | '4k'>('1080p');
  const [fps, setFps] = useState<number>(30);

  // Transition back to upload home
  const handleReset = () => {
    if (videoMetadata?.blobUrl && videoFile) {
      URL.revokeObjectURL(videoMetadata.blobUrl);
    }
    setProjectId(null);
    setVideoFile(null);
    setVideoMetadata(null);
    setCaptions([]);
    setStyle({ ...PRESETS['default'].style });
    setCurrentPage('home');
  };

  const startEditing = (file: File | null, metadata: VideoMetadata, initialCaptions: CaptionBlock[], id?: string) => {
    setProjectId(id || null);
    setVideoFile(file);
    setVideoMetadata(metadata);
    setCaptions(initialCaptions);
    setCurrentPage('editor');
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col antialiased">
      {/* Header */}
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-4 sm:px-6 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={handleReset}>
          <img src="/logo.jpg" className="w-8 h-8 rounded-lg object-cover border border-white/10 shadow-lg shadow-violet-500/10" alt="capme AI Logo" />
          <span className="font-bold tracking-tight text-base sm:text-lg bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            capme <span className="text-violet-500 font-extrabold">AI</span>
          </span>
        </div>

        {currentPage !== 'home' && (
          <button
            onClick={handleReset}
            className="px-2.5 py-1.5 rounded-lg border border-white/10 text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
            </svg>
            <span className="hidden sm:inline">Start Over</span>
          </button>
        )}
      </header>

      {/* Main Pages */}
      <main className="flex-1 flex flex-col">
        {currentPage === 'home' && (
          <Home onStart={startEditing} />
        )}
        {currentPage === 'editor' && videoMetadata && (
          <Editor
            projectId={projectId}
            videoFile={videoFile}
            metadata={videoMetadata}
            captions={captions}
            setCaptions={setCaptions}
            style={style}
            setStyle={setStyle}
            resolution={resolution}
            setResolution={setResolution}
            fps={fps}
            setFps={setFps}
            onExport={() => setCurrentPage('export')}
          />
        )}
        {currentPage === 'export' && videoMetadata && (
          <Export
            projectId={projectId}
            metadata={videoMetadata}
            videoFile={videoFile}
            captions={captions}
            style={style}
            resolution={resolution}
            fps={fps}
            onBack={() => setCurrentPage('editor')}
            onRestart={handleReset}
          />
        )}
      </main>
    </div>
  );
}
