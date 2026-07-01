import { useEffect, useState } from 'react';
import type { CaptionBlock, CaptionStyle, VideoMetadata } from '../types';
import { getApiBase } from '../utils/api';
import { generateAssFile } from '../utils/assGenerator';

interface ExportProps {
  projectId: string | null;
  metadata: VideoMetadata;
  captions: CaptionBlock[];
  style: CaptionStyle;
  resolution: '720p' | '1080p' | '2k' | '4k';
  fps: number;
  onBack: () => void;
  onRestart: () => void;
}

type ExportState = 'idle' | 'processing' | 'completed' | 'failed' | 'downloaded';

export default function Export({
  projectId,
  metadata,
  captions,
  style,
  resolution,
  fps,
  onBack,
  onRestart
}: ExportProps) {
  const API_BASE = getApiBase();
  const [status, setStatus] = useState<ExportState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string>('');

  const handleDownloadAss = () => {
    try {
      const w = metadata.width || 1920;
      const h = metadata.height || 1080;
      const assContent = generateAssFile(captions, style, w, h);
      
      const blob = new Blob([assContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Clean name
      const cleanName = (metadata.filename || 'subtitles').replace(/\.[^/.]+$/, "");
      link.download = `${cleanName}.ass`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Transition to downloaded success state
      setStatus('downloaded');
    } catch (err: any) {
      alert(`Failed to export subtitle file: ${err.message}`);
    }
  };

  useEffect(() => {
    // Start export process automatically on mount
    startExportProcess();
  }, []);

  const startExportProcess = () => {
    setErrorMessage('');
    
    if (projectId) {
      // Trigger backend compilation directly using the cloud project
      triggerServerRender(projectId);
    } else {
      handleError('No active Supabase project found to export.');
    }
  };

  const triggerServerRender = async (id: string) => {
    setStatus('processing');
    try {
      const response = await fetch(`${API_BASE}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: id,
          resolution,
          fps
        })
      });

      const result = await response.json();
      if (response.ok && result.success && result.downloadUrl) {
        setDownloadUrl(result.downloadUrl);
        setStatus('completed');
      } else {
        handleError(result.error || 'Server rendering failed.');
      }
    } catch (err: any) {
      handleError(err.message || 'Error communicating with rendering server.');
    }
  };

  const handleError = (message: string) => {
    setErrorMessage(message);
    setStatus('failed');
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-zinc-950 timeline-bg relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/3 left-1/3 w-96 h-96 rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/3 w-96 h-96 rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md glass-panel rounded-2xl p-8 shadow-2xl border border-white/10 text-center z-10 space-y-6">
        
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Export Project</h2>
          <p className="text-xs text-zinc-400 mt-1">Resolution: {resolution} • {fps} FPS</p>
        </div>

        {/* Processing Phase */}
        {status === 'processing' && (
          <div className="space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
              <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-zinc-200">Burning Captions onto Video</p>
              <p className="text-xs text-zinc-550">FFmpeg is downloading the video from Supabase, applying subtitle presets, and encoding overlays. Please wait.</p>
            </div>
          </div>
        )}

        {/* Completed Phase (Video Render Success) */}
        {status === 'completed' && (
          <div className="space-y-6 py-2">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-base font-bold text-zinc-100">Export Complete!</p>
              <p className="text-xs text-zinc-550">Your high-quality MP4 video with styled captions has been uploaded back to Supabase Storage.</p>
            </div>

            <a
              href={downloadUrl.startsWith('http') ? downloadUrl : `${API_BASE}${downloadUrl}`}
              download
              className="block w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-sm font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/20 text-white transition-all duration-300"
            >
              Download Video
            </a>
          </div>
        )}

        {/* Downloaded Phase (Subtitles Success Fallback) */}
        {status === 'downloaded' && (
          <div className="space-y-6 py-2">
            <div className="w-16 h-16 rounded-full bg-violet-500/10 text-violet-400 flex items-center justify-center mx-auto shadow-lg shadow-violet-500/10">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.03 0 1.9.693 2.166 1.638m-7.377 0A48.536 48.536 0 0 1 12 3m0 0c2.917 0 5.747.294 8.5.862m-16.5 0a48.394 48.394 0 0 1 2.502-.439m0-1.157A48.337 48.337 0 0 1 12.002 2c.007 0 .015 0 .022 0l.002.005a48.354 48.354 0 0 1 2.477.265M3 18.75V8.25A2.25 2.25 0 0 1 5.25 6h2.625M3 18.75A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            </div>
            <div className="space-y-1.5">
              <p className="text-base font-bold text-zinc-100 font-sans">Subtitles Saved!</p>
              <p className="text-xs text-zinc-400 leading-relaxed px-2">
                Your custom styled subtitles file (**`.ass`**) has been saved. 
              </p>
              <div className="text-[11px] text-zinc-500 bg-zinc-900/60 rounded-xl p-3 border border-white/5 space-y-1 text-left max-w-[300px] mx-auto leading-relaxed">
                <p className="font-semibold text-zinc-300">How to use this file:</p>
                <p>• **In CapCut/Premiere**: Import this file directly as a subtitle track to overlay your styled kinetic text.</p>
                <p>• **In VLC/MXPlayer**: Keep the subtitle file in the same folder as your video with the same name to watch it instantly.</p>
              </div>
            </div>

            <button
              onClick={handleDownloadAss}
              className="block w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold rounded-xl hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/20 text-white transition-all duration-300"
            >
              Download Subtitles Again
            </button>
          </div>
        )}

        {/* Failed Phase */}
        {status === 'failed' && (
          <div className="space-y-4 py-2">
            <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-red-200">Export Limitation / Error</p>
              {errorMessage.includes('not supported in this serverless environment') || errorMessage.includes('Failed to read video metadata') || errorMessage.includes('FFmpeg') || errorMessage.includes('FFprobe') ? (
                <p className="text-xs text-zinc-400 max-w-[290px] mx-auto leading-relaxed">
                  Video rendering is not supported on the Vercel Cloud due to execution limits. To render the final video, connect to your desktop backend, or download your custom styled subtitles (.ass) below to use in CapCut, Premiere, or VLC!
                </p>
              ) : (
                <p className="text-xs text-zinc-500 max-w-[280px] mx-auto leading-relaxed">{errorMessage}</p>
              )}
            </div>
            
            <button
              onClick={handleDownloadAss}
              className="block w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold rounded-xl hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/20 text-white transition-all duration-300"
            >
              Download Subtitles (.ass)
            </button>

            <button
              onClick={startExportProcess}
              className="w-full py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-850 transition-all duration-300"
            >
              Retry Video Render
            </button>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-white/5">
          <button
            onClick={onBack}
            disabled={status === 'processing'}
            className="flex-1 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-850 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            Back to Editor
          </button>
          <button
            onClick={onRestart}
            className="flex-1 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors"
          >
            Create New
          </button>
        </div>
      </div>
    </div>
  );
}
