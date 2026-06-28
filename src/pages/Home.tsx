import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { distributeCaptions } from '../utils/timeline';
import { getApiBase } from '../utils/api';
import type { VideoMetadata, CaptionBlock } from '../types';

interface HomeProps {
  onStart: (file: File | null, metadata: VideoMetadata, captions: CaptionBlock[], id?: string) => void;
}

export default function Home({ onStart }: HomeProps) {
  const API_BASE = getApiBase();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [lyricsText, setLyricsText] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [recentProjects, setRecentProjects] = useState<any[]>([]);

  // Fetch recent projects from Backend on mount (bypasses RLS)
  useEffect(() => {
    async function fetchRecentProjects() {
      try {
        const response = await fetch(`${API_BASE}/api/projects`);
        const contentType = response.headers.get('content-type') || '';
        
        if (response.ok && contentType.includes('application/json')) {
          const data = await response.json();
          setRecentProjects(data || []);
        } else {
          console.error('Failed to retrieve recent projects from backend: Non-JSON response.');
          setError(`Connection error: Received HTML page instead of JSON data. Fetch URL was: ${API_BASE}/api/projects. (Is your local server running on port 5000?)`);
        }
      } catch (err: any) {
        console.error('Failed to connect to backend server:', err);
        setError(`Failed to connect to rendering backend: ${err.message}. Fetch URL: ${API_BASE}/api/projects`);
      }
    }
    fetchRecentProjects();
  }, []);

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

  const handleLoadProject = (project: any) => {
    const metadata: VideoMetadata = {
      filename: project.name,
      duration: Number(project.duration),
      width: project.width,
      height: project.height,
      aspectRatio: project.aspect_ratio,
      blobUrl: project.video_url // play directly from Supabase Storage
    };
    onStart(null, metadata, project.captions, project.id);
  };

  const handleStart = async () => {
    if (!videoFile) {
      setError('Please upload a video file first.');
      return;
    }
    if (!lyricsText.trim()) {
      setError('Please paste your lyrics or script.');
      return;
    }

    setLoading(true);
    setUploadProgress('Preparing video metadata...');

    const localBlobUrl = URL.createObjectURL(videoFile);
    const video = document.createElement('video');
    video.src = localBlobUrl;
    video.preload = 'metadata';

    video.onloadedmetadata = async () => {
      try {
        const metadata: VideoMetadata = {
          filename: videoFile.name,
          duration: video.duration || 10,
          width: video.videoWidth || 1920,
          height: video.videoHeight || 1080,
          aspectRatio: (video.videoWidth || 1920) / (video.videoHeight || 1080),
          blobUrl: localBlobUrl
        };

        // 1. Upload video file to backend upload proxy endpoint
        setUploadProgress('Uploading video to backend server...');
        const formData = new FormData();
        formData.append('video', videoFile);

        const uploadResponse = await fetch(`${API_BASE}/api/upload`, {
          method: 'POST',
          body: formData
        });

        if (!uploadResponse.ok) {
          const errResponse = await uploadResponse.json();
          throw new Error(errResponse.error || 'Server rejected file upload.');
        }

        const uploadResult = await uploadResponse.json();
        const { videoUrl, filename: bucketFilename } = uploadResult;

        // 2. Distribute captions evenly based on duration
        setUploadProgress('Analyzing script timelines...');
        const initialCaptions = distributeCaptions(lyricsText, metadata.duration);

        // Default style preset
        const defaultStyle = {
          fontFamily: 'Arial',
          fontSize: 24,
          fontWeight: 'bold' as const,
          uppercase: false,
          textColor: '#FFFFFF',
          textOpacity: 1,
          backgroundColor: '#000000',
          backgroundOpacity: 0,
          strokeColor: '#000000',
          strokeWidth: 0,
          shadowColor: '#000000',
          shadowWidth: 0,
          opacity: 1,
          animation: 'fade' as const,
          position: 'bottom' as const
        };

        // 3. Save project row via backend projects API
        setUploadProgress('Saving project record...');
        const saveResponse = await fetch(`${API_BASE}/api/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: videoFile.name,
            video_url: videoUrl,
            video_filename: bucketFilename,
            duration: metadata.duration,
            width: metadata.width,
            height: metadata.height,
            aspect_ratio: metadata.aspectRatio,
            captions: initialCaptions,
            style: defaultStyle,
            resolution: '1080p',
            fps: 30
          })
        });

        if (!saveResponse.ok) {
          const errResponse = await saveResponse.json();
          throw new Error(errResponse.error || 'Failed to save project schema.');
        }

        const projectRow = await saveResponse.json();

        setLoading(false);
        // Load editor
        onStart(videoFile, metadata, initialCaptions, projectRow.id);
      } catch (err: any) {
        setLoading(false);
        setError(err.message || 'An error occurred during project creation.');
        URL.revokeObjectURL(localBlobUrl);
      }
    };

    video.onerror = () => {
      setLoading(false);
      setError('Failed to load video metadata locally.');
      URL.revokeObjectURL(localBlobUrl);
    };
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-950 timeline-bg relative overflow-y-auto min-h-0">
      {/* Background decorations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-4xl space-y-8 z-10 py-6">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent mb-2">
            Auto-Time Your Video Captions
          </h1>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto">
            Stateless video editing backed by Supabase and FFmpeg. Upload once, edit from anywhere, and export up to 4K.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-950/50 border border-red-500/30 text-red-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <div className="space-y-1">
                <p className="font-semibold">Setup / Connection Error</p>
                <p>{error}</p>
              </div>
            </div>
            
            {/* LAN Custom Connection Input */}
            <div className="flex flex-col gap-1.5 shrink-0 bg-black/30 p-2.5 rounded-lg border border-white/5 w-full sm:w-auto">
              <span className="text-[10px] text-zinc-400 font-semibold">Connect to desktop backend IP:</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="http://192.168.1.15:5001"
                  className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 w-full sm:w-44"
                  id="custom-backend-input"
                  defaultValue={API_BASE}
                />
                <button
                  onClick={() => {
                    const val = (document.getElementById('custom-backend-input') as HTMLInputElement)?.value;
                    if (val) {
                      localStorage.setItem('backend_url', val.trim());
                      window.location.reload();
                    }
                  }}
                  className="px-3 py-1 bg-violet-600 hover:bg-violet-500 rounded text-xs text-white font-semibold transition-colors shrink-0"
                >
                  Connect
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left panel: Upload Video */}
          <div className="flex flex-col space-y-4">
            <div className="glass-panel rounded-2xl p-6 border border-white/10 flex-1 flex flex-col">
              <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-violet-600/20 text-violet-400 flex items-center justify-center text-xs font-bold">1</span>
                Upload Video
              </h2>
              
              <div
                {...getRootProps()}
                className={`flex-1 min-h-[180px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all duration-300 ${
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
                      <p className="text-xs text-zinc-550 mt-1">{(videoFile.size / (1024 * 1024)).toFixed(1)} MB</p>
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
                      <p className="text-xs text-zinc-550 mt-1">Supports MP4, MOV, AVI, MKV</p>
                    </div>
                    <button type="button" className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-zinc-300 hover:bg-white/10 transition-colors">
                      Browse File
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Paste Lyrics */}
            <div className="glass-panel rounded-2xl p-6 border border-white/10">
              <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-violet-600/20 text-violet-400 flex items-center justify-center text-xs font-bold">2</span>
                Paste Lyrics / Script
              </h2>
              <textarea
                value={lyricsText}
                onChange={handleLyricsChange}
                placeholder={`I was running through the night
Looking for a place to hide

(Unicode supported: English, Hindi, Marathi, Mixed)
उदा: I love माझं city ❤️`}
                className="w-full h-32 rounded-xl bg-zinc-900 border border-white/10 p-3.5 text-xs text-zinc-200 placeholder-zinc-550 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 resize-none leading-relaxed"
              />
            </div>

            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-semibold text-sm hover:from-violet-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-violet-500/20 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-xs font-mono">{uploadProgress}</span>
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

          {/* Right panel: Recent Projects list */}
          <div className="glass-panel rounded-2xl p-6 border border-white/10 flex flex-col min-h-0">
            <h2 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
              <svg className="w-4.5 h-4.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
              Recent Projects
            </h2>

            {recentProjects.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-white/5 border-dashed rounded-xl bg-zinc-900/30">
                <svg className="w-8 h-8 text-zinc-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.008 1.24l.885 1.77a2.25 2.25 0 0 0 2.007 1.24h1.98a2.25 2.25 0 0 0 2.007-1.24l.885-1.77a2.25 2.25 0 0 1 2.007-1.24h3.86m-18 0h18" />
                </svg>
                <p className="text-xs text-zinc-550 font-medium">No saved projects yet</p>
                <p className="text-[10px] text-zinc-650 mt-1">Upload a video to create a new session.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {recentProjects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => handleLoadProject(project)}
                    className="p-4 rounded-xl border border-white/5 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-white/10 transition-all duration-300 flex items-center justify-between cursor-pointer group"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-xs font-semibold text-zinc-200 truncate group-hover:text-violet-400 transition-colors">
                        {project.name}
                      </p>
                      <p className="text-[10px] text-zinc-550 mt-1">
                        Duration: {(Number(project.duration) || 0).toFixed(1)}s • {project.captions?.length || 0} subtitles
                      </p>
                    </div>

                    <button className="p-1.5 rounded bg-white/5 text-zinc-400 group-hover:bg-violet-600 group-hover:text-white transition-colors shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
