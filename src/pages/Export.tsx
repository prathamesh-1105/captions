import { useEffect, useState } from 'react';
import type { CaptionBlock, CaptionStyle, VideoMetadata } from '../types';
import { getApiBase } from '../utils/api';
import { generateAssFile } from '../utils/assGenerator';

interface ExportProps {
  projectId: string | null;
  metadata: VideoMetadata;
  videoFile: File | null;
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
  videoFile,
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
  const [isClientRendering, setIsClientRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

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

  const renderVideoInBrowser = async () => {
    setIsClientRendering(true);
    setStatus('processing');
    setRenderProgress(0);
    setErrorMessage('');

    let fileToRender: Blob | null = videoFile;
    
    try {
      if (!fileToRender) {
        setErrorMessage('Downloading raw video from Supabase storage...');
        const fetchUrl = metadata.blobUrl;
        const res = await fetch(fetchUrl);
        if (!res.ok) {
          throw new Error(`Failed to fetch raw video file. Status: ${res.statusText}`);
        }
        fileToRender = await res.blob();
      }

      setErrorMessage('Preparing browser video burner...');
      
      const video = document.createElement('video');
      video.src = URL.createObjectURL(fileToRender);
      video.muted = false; // Unmuted to ensure tracks are active in captureStream
      video.volume = 0.02; // Very quiet so it is not annoying to the user
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Failed to load video metadata.'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || metadata.width || 1920;
      canvas.height = video.videoHeight || metadata.height || 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not create Canvas 2D context.');
      }

      // Capture Canvas Stream at target FPS
      const canvasStream = (canvas as any).captureStream ? (canvas as any).captureStream(fps) : (canvas as any).mozCaptureStream(fps);
      const combinedStream = new MediaStream();
      canvasStream.getVideoTracks().forEach((track: any) => combinedStream.addTrack(track));

      // Audio capturing/mixing (First try direct captureStream, then fallback to Web Audio API)
      let audioContext: AudioContext | null = null;
      try {
        const videoStream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream();
        if (videoStream) {
          const audioTracks = videoStream.getAudioTracks();
          if (audioTracks && audioTracks.length > 0) {
            console.log('Successfully captured audio track directly from video element stream.');
            audioTracks.forEach((track: any) => combinedStream.addTrack(track));
          } else {
            throw new Error('No audio tracks found in captureStream');
          }
        }
      } catch (err) {
        console.warn('Direct audio track capture failed. Trying AudioContext fallback...', err);
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          audioContext = new AudioContextClass();
          const source = audioContext.createMediaElementSource(video);
          const dest = audioContext.createMediaStreamDestination();
          source.connect(dest);
          source.connect(audioContext.destination);
          const audioTracks = dest.stream.getAudioTracks();
          audioTracks.forEach((track: any) => combinedStream.addTrack(track));
        } catch (audioErr) {
          console.warn('Audio capture fallbacks failed, exporting without audio:', audioErr);
        }
      }

      // Recorder Setup (with high video bitrate for crystal clear quality)
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = ''; // Default browser fallback
      }

      const recorderChunks: Blob[] = [];
      const recorderOptions: MediaRecorderOptions = {
        mimeType: mimeType || undefined,
        videoBitsPerSecond: 8000000, // 8 Mbps for high quality video!
        audioBitsPerSecond: 192000   // 192 kbps for clear sound
      };
      
      const recorder = new MediaRecorder(combinedStream, recorderOptions);
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recorderChunks.push(e.data);
        }
      };

      recorder.start();
      await video.play();

      let animFrameId: number;
      
      const drawFrame = () => {
        if (video.paused || video.ended) return;

        // 1. Draw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // 2. Find active caption
        const currentTime = video.currentTime;
        const activeCap = captions.find(c => currentTime >= c.start && currentTime <= c.end);
        if (activeCap) {
          drawTextOnCanvas(ctx, activeCap.text, style, canvas.width, canvas.height, activeCap.x, activeCap.y);
        }

        // 3. Update progress
        const percent = Math.min(99, Math.round((currentTime / video.duration) * 100));
        setRenderProgress(percent);

        if ((video as any).requestVideoFrameCallback) {
          (video as any).requestVideoFrameCallback(drawFrame);
        } else {
          animFrameId = requestAnimationFrame(drawFrame);
        }
      };

      if ((video as any).requestVideoFrameCallback) {
        (video as any).requestVideoFrameCallback(drawFrame);
      } else {
        animFrameId = requestAnimationFrame(drawFrame);
      }

      await new Promise<void>((resolve) => {
        video.onended = () => {
          cancelAnimationFrame(animFrameId);
          recorder.stop();
          resolve();
        };
        video.onerror = () => {
          cancelAnimationFrame(animFrameId);
          recorder.stop();
          resolve();
        };
      });

      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      // Cleanup audio context if running
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }

      const finalMime = recorderChunks[0]?.type || 'video/mp4';
      const finalBlob = new Blob(recorderChunks, { type: finalMime });
      const finalUrl = URL.createObjectURL(finalBlob);

      setDownloadUrl(finalUrl);
      setRenderProgress(100);
      setStatus('completed');
      setIsClientRendering(false);

      // Auto trigger download
      const link = document.createElement('a');
      link.href = finalUrl;
      const cleanName = (metadata.filename || 'captioned-video').replace(/\.[^/.]+$/, "");
      const ext = finalMime.includes('webm') ? 'webm' : 'mp4';
      link.download = `${cleanName}-captioned.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err: any) {
      console.error('Client-side rendering failed:', err);
      setIsClientRendering(false);
      handleError(err.message || 'Client-side rendering failed.');
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
        console.warn('Server render failed. Falling back to browser-side rendering...', result.error);
        renderVideoInBrowser();
      }
    } catch (err: any) {
      console.warn('Error communicating with server. Falling back to browser-side rendering...', err.message);
      renderVideoInBrowser();
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
              <p className="text-sm font-semibold text-zinc-200">
                {isClientRendering ? 'Offline Browser Burning in Progress' : 'Burning Captions onto Video'}
              </p>
              <p className="text-xs text-zinc-550 max-w-[320px] mx-auto leading-relaxed">
                {isClientRendering 
                  ? 'Your browser is drawing styled caption presets and recording frame by frame. Do not close this tab.' 
                  : 'FFmpeg is downloading the video from Supabase, applying subtitle presets, and encoding overlays. Please wait.'
                }
              </p>
              
              {isClientRendering && (
                <div className="w-full max-w-xs mx-auto pt-2">
                  <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-white/5">
                    <div 
                      className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full transition-all duration-300"
                      style={{ width: `${renderProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-400 font-mono mt-1">{renderProgress}% completed</p>
                </div>
              )}
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

function drawFisheyeTextCharacterByCharacter(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  style: CaptionStyle,
  scale: number = 1
) {
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
        ctx.strokeStyle = hexToRgba(style.strokeColor, style.opacity);
        ctx.lineWidth = style.strokeWidth * 2 * scale;
        ctx.lineJoin = 'round';
        ctx.strokeText(char, 0, 0);
      }

      // Draw fill
      ctx.fillStyle = hexToRgba(style.textColor, style.textOpacity * style.opacity);
      ctx.fillText(char, 0, 0);

      ctx.restore();

      currentX += charWidth;
    });
  });
  ctx.restore();
}

function drawTextOnCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: CaptionStyle,
  width: number,
  height: number,
  capX?: number,
  capY?: number
) {
  ctx.save();
  const displayText = style.uppercase ? text.toUpperCase() : text;
  const weight = style.fontWeight === 'bold' ? 'bold' : 'normal';
  const scale = height / 1080;
  const fontSize = Math.round(style.fontSize * scale);

  let x = width / 2;
  let y = height * 0.9;

  if (style.position === 'top') {
    y = height * 0.15;
  } else if (style.position === 'center') {
    y = height / 2;
  } else if (style.position === 'custom' && capX !== undefined && capY !== undefined) {
    x = (capX / 100) * width;
    y = (capY / 100) * height;
  }

  if (style.animation === 'fisheye') {
    drawFisheyeTextCharacterByCharacter(ctx, displayText, x, y, style, scale);
    ctx.restore();
    return;
  }

  ctx.font = `${weight} ${fontSize}px ${style.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';



  const lines = displayText.split('\n');
  const lineHeight = fontSize * 1.25;
  const startY = y - ((lines.length - 1) * lineHeight) / 2;



  lines.forEach((line, index) => {
    const currentY = startY + index * lineHeight;

    if (style.backgroundOpacity > 0) {
      const textWidth = ctx.measureText(line).width;
      const paddingX = fontSize * 0.4;
      const paddingY = fontSize * 0.2;
      ctx.fillStyle = hexToRgba(style.backgroundColor, style.backgroundOpacity * style.opacity);
      ctx.fillRect(
        x - textWidth / 2 - paddingX,
        currentY - fontSize / 2 - paddingY,
        textWidth + paddingX * 2,
        fontSize + paddingY * 2
      );
    }

    if (style.strokeWidth > 0) {
      ctx.strokeStyle = hexToRgba(style.strokeColor, style.opacity);
      ctx.lineWidth = style.strokeWidth * 2 * scale;
      ctx.lineJoin = 'round';
      ctx.strokeText(line, x, currentY);
    }

    ctx.fillStyle = hexToRgba(style.textColor, style.textOpacity * style.opacity);
    ctx.fillText(line, x, currentY);
  });

  ctx.restore();
}

function hexToRgba(hex: string, alpha: number = 1): string {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  if (cleanHex.length !== 6) {
    cleanHex = 'FFFFFF';
  }
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
