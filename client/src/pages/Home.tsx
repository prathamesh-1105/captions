import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { distributeCaptions } from '../utils/timeline';
import type { VideoMetadata, CaptionBlock } from '../types';

interface HomeProps {
  onStart: (file: File, metadata: VideoMetadata, captions: CaptionBlock[]) => void;
}

export default function Home({ onStart }: HomeProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [lyricsText, setLyricsText] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  // Dropzone callbacks
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setVideoFile(acceptedFiles[0]);
      setError('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv']
    },
    maxFiles: 1
  });

  const handleLyricsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLyricsText(e.target.value);
    if (e.target.value.trim()) {
      setError('');
    }
  };

  const handleStart = () => {
    if (!videoFile) {
      setError('Please upload a video file first.');
      return;
    }
    if (!lyricsText.trim()) {
      setError('Please paste your lyrics or script.');
      return;
    }

    setLoadingMetadata(true);
    const blobUrl = URL.createObjectURL(videoFile);
    const video = document.createElement('video');
    video.src = blobUrl;
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      setLoadingMetadata(false);
      const metadata: VideoMetadata = {
        filename: videoFile.name,
        duration: video.duration || 10,
        width: video.videoWidth || 1920,
        height: video.videoHeight || 1080,
        aspectRatio: (video.videoWidth || 1920) / (video.videoHeight || 1080),
        blobUrl
      };

      // Distribute captions evenly based on video duration
      const initialCaptions = distributeCaptions(lyricsText, metadata.duration);
      onStart(videoFile, metadata, initialCaptions);
    };

    video.onerror = () => {
      setLoadingMetadata(false);
      setError('Failed to load video metadata. Ensure it is a valid video format.');
      URL.revokeObjectURL(blobUrl);
    };
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-zinc-950 timeline-bg relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-4xl glass-panel rounded-2xl p-8 shadow-2xl border border-white/10 z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent mb-2">
            Auto-Time Your Video Captions
          </h1>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto">
            Upload your video and paste your script. CaptionFlow AI will split and align every lyric or phrase perfectly onto your timeline.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-950/50 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
            <svg className="w-4.5 h-4.5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Step 1: Upload Video */}
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-violet-600/20 text-violet-400 flex items-center justify-center text-xs font-bold">1</span>
              Upload Video
            </h2>
            
            <div
              {...getRootProps()}
              className={`flex-1 min-h-[220px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all duration-300 ${
                isDragActive
                  ? 'border-violet-500 bg-violet-950/15'
                  : videoFile
                  ? 'border-emerald-500/50 bg-emerald-950/5'
                  : 'border-white/10 hover:border-white/20 hover:bg-white/2'
              }`}
            >
              <input {...getInputProps()} />
              {videoFile ? (
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200 truncate max-w-[250px] mx-auto">{videoFile.name}</p>
                    <p className="text-xs text-zinc-500 mt-1">{(videoFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVideoFile(null);
                    }}
                    className="text-xs text-red-400 hover:text-red-300 font-medium underline"
                  >
                    Change Video
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 flex items-center justify-center mx-auto">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Drag & drop your video here</p>
                    <p className="text-xs text-zinc-500 mt-1">Supports MP4, MOV, AVI, MKV</p>
                  </div>
                  <button type="button" className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-zinc-300 hover:bg-white/10 transition-colors">
                    Browse File
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Paste Lyrics */}
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-violet-600/20 text-violet-400 flex items-center justify-center text-xs font-bold">2</span>
              Paste Lyrics / Script
            </h2>
            <div className="flex-1 flex flex-col">
              <textarea
                value={lyricsText}
                onChange={handleLyricsChange}
                placeholder={`I was running through the night
Looking for a place to hide

(Unicode supported: English, Hindi, Marathi, Mixed)
उदा: I love माझं city ❤️`}
                className="w-full flex-1 min-h-[220px] rounded-xl bg-zinc-900 border border-white/10 p-4 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 resize-none font-sans leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Submit Section */}
        <div className="mt-8 flex justify-center border-t border-white/5 pt-6">
          <button
            onClick={handleStart}
            disabled={loadingMetadata}
            className="w-full md:w-auto min-w-[200px] px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-semibold text-sm hover:from-violet-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-violet-500/20 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMetadata ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </>
            ) : (
              <>
                Create Timeline
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
