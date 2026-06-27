import { useEffect, useState } from 'react';
import type { CaptionBlock, CaptionStyle, VideoMetadata } from '../types';

interface ExportProps {
  videoFile: File;
  metadata: VideoMetadata;
  captions: CaptionBlock[];
  style: CaptionStyle;
  resolution: '720p' | '1080p' | '2k' | '4k';
  fps: number;
  onBack: () => void;
  onRestart: () => void;
}

type ExportState = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

export default function Export({
  videoFile,
  captions,
  style,
  resolution,
  fps,
  onBack,
  onRestart
}: ExportProps) {
  const [status, setStatus] = useState<ExportState>('idle');
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string>('');

  useEffect(() => {
    // Start export process automatically on mount
    startExportProcess();
  }, []);

  const startExportProcess = () => {
    setStatus('uploading');
    setUploadPercent(0);
    setErrorMessage('');

    // 1. Upload Video File using XMLHttpRequest for native progress events
    const formData = new FormData();
    formData.append('video', videoFile);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadPercent(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.success && response.filename) {
            // Video uploaded successfully, now request FFmpeg compilation
            triggerServerRender(response.filename);
          } else {
            handleError('Failed to retrieve filename from server upload.');
          }
        } catch (err) {
          handleError('Error parsing server upload response.');
        }
      } else {
        handleError(`Upload failed with status ${xhr.status}`);
      }
    };

    xhr.onerror = () => {
      handleError('Network error occurred during video upload.');
    };

    xhr.send(formData);
  };

  const triggerServerRender = async (filename: string) => {
    setStatus('processing');
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoFilename: filename,
          captions,
          style,
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

        {/* Uploading Phase */}
        {status === 'uploading' && (
          <div className="space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-violet-500/10 text-violet-400 flex items-center justify-center mx-auto animate-pulse">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
              </svg>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-zinc-200">Uploading Video File</p>
              <p className="text-xs text-zinc-500">Do not close this page during upload</p>
            </div>
            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-300 rounded-full"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
              <div className="flex justify-end text-[10px] text-zinc-500 font-mono">
                {uploadPercent}%
              </div>
            </div>
          </div>
        )}

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
              <p className="text-xs text-zinc-500">FFmpeg is encoding and scaling subtitles. Please wait.</p>
            </div>
          </div>
        )}

        {/* Completed Phase */}
        {status === 'completed' && (
          <div className="space-y-6 py-2">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-base font-bold text-zinc-100">Export Complete!</p>
              <p className="text-xs text-zinc-550">Your high-quality MP4 video with styled captions is ready.</p>
            </div>

            <a
              href={downloadUrl}
              download
              className="block w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-sm font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/20 text-white transition-all duration-300"
            >
              Download Video
            </a>
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
              <p className="text-sm font-semibold text-red-200">Export Failed</p>
              <p className="text-xs text-zinc-500 max-w-[280px] mx-auto leading-relaxed">{errorMessage}</p>
            </div>
            <button
              onClick={startExportProcess}
              className="px-4 py-2 rounded bg-zinc-900 border border-white/10 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Retry Export
            </button>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-white/5">
          <button
            onClick={onBack}
            disabled={status === 'uploading' || status === 'processing'}
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
