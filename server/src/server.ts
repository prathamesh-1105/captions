import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';
import { generateAssFile, CaptionBlock, CaptionStyle } from './utils/assGenerator';

// Set ffmpeg paths
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create necessary folders
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const TEMP_SUBS_DIR = path.join(__dirname, '..', 'temp_subs');
const OUTPUTS_DIR = path.join(__dirname, '..', 'outputs');

[UPLOADS_DIR, TEMP_SUBS_DIR, OUTPUTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB max video size
});

// Serve outputs statically for downloading
app.use('/outputs', express.static(OUTPUTS_DIR));

// Endpoint 1: Upload Video and probe metadata
app.post('/api/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided.' });
  }

  const videoPath = req.file.path;
  const filename = req.file.filename;

  // Probe metadata
  ffmpeg.ffprobe(videoPath, (err, metadata) => {
    if (err) {
      console.error('Error probing video:', err);
      // Clean up uploaded file if probing fails
      fs.unlinkSync(videoPath);
      return res.status(500).json({ error: 'Failed to read video metadata.' });
    }

    const duration = metadata.format.duration || 0;
    const videoStream = metadata.streams.find(s => s.codec_type === 'video');
    const width = videoStream?.width || 1920;
    const height = videoStream?.height || 1080;

    res.json({
      success: true,
      filename,
      duration,
      width,
      height,
      aspectRatio: width / height
    });
  });
});

// Endpoint 2: Export Video with burned subtitles
app.post('/api/export', async (req, res) => {
  const {
    videoFilename,
    captions,
    style,
    resolution = '1080p',
    fps = 30
  } = req.body as {
    videoFilename: string;
    captions: CaptionBlock[];
    style: CaptionStyle;
    resolution: '720p' | '1080p' | '2k' | '4k';
    fps: number;
  };

  if (!videoFilename || !captions || !style) {
    return res.status(400).json({ error: 'Missing required parameters.' });
  }

  const inputVideoPath = path.join(UPLOADS_DIR, videoFilename);
  if (!fs.existsSync(inputVideoPath)) {
    return res.status(404).json({ error: 'Original video file not found.' });
  }

  const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const assFilename = `${uniqueId}.ass`;
  const assPath = path.join(TEMP_SUBS_DIR, assFilename);
  const outputFilename = `export-${uniqueId}.mp4`;
  const outputPath = path.join(OUTPUTS_DIR, outputFilename);

  // Map resolution settings to height
  const resolutionHeightMap = {
    '720p': 720,
    '1080p': 1080,
    '2k': 1440,
    '4k': 2160
  };
  const targetHeight = resolutionHeightMap[resolution] || 1080;

  try {
    // 1. Get original video resolution to generate ASS with correct proportions
    ffmpeg.ffprobe(inputVideoPath, (err, metadata) => {
      if (err) {
        return res.status(500).json({ error: 'Error reading video properties during export.' });
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const origWidth = videoStream?.width || 1920;
      const origHeight = videoStream?.height || 1080;
      const aspectRatio = origWidth / origHeight;
      const targetWidth = Math.round(targetHeight * aspectRatio);

      // 2. Generate and write ASS file
      const assContent = generateAssFile(captions, style, targetWidth, targetHeight);
      fs.writeFileSync(assPath, assContent, 'utf-8');

      // 3. Escape path for FFmpeg subtitles filter on Windows
      // Transform C:\path\to\subs.ass -> C\\:/path/to/subs.ass
      const escapedAssPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\\\:');

      // 4. Run FFmpeg
      console.log(`Starting FFmpeg export. Input: ${videoFilename}, Resolution: ${resolution}, FPS: ${fps}`);

      // We chain scale and subtitles. Scale first so subtitles match the final size
      const videoFilters = `scale=-2:${targetHeight},subtitles=${escapedAssPath}`;

      ffmpeg(inputVideoPath)
        .videoFilters(videoFilters)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-crf 20',          // High visual quality
          '-preset medium',   // Balance encoding time vs compression
          '-pix_fmt yuv420p', // Standard pixel format for web/mobile playback compatibility
          `-r ${fps}`         // Frames per second
        ])
        .on('start', (commandLine) => {
          console.log('FFmpeg command: ' + commandLine);
        })
        .on('progress', (progress) => {
          console.log(`Export processing: ${progress.percent ? Math.round(progress.percent) : 0}% done`);
        })
        .on('end', () => {
          console.log('FFmpeg processing completed successfully.');

          // Clean up the temporary ASS subtitle file
          try {
            if (fs.existsSync(assPath)) fs.unlinkSync(assPath);
          } catch (cleanupErr) {
            console.error('Error cleaning up ASS file:', cleanupErr);
          }

          res.json({
            success: true,
            downloadUrl: `/outputs/${outputFilename}`,
            filename: outputFilename
          });
        })
        .on('error', (ffmpegErr) => {
          console.error('FFmpeg encoding error:', ffmpegErr);

          // Clean up files on error
          try {
            if (fs.existsSync(assPath)) fs.unlinkSync(assPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          } catch (cleanupErr) {
            console.error('Cleanup error on FFmpeg failure:', cleanupErr);
          }

          res.status(500).json({ error: 'FFmpeg processing failed: ' + ffmpegErr.message });
        })
        .save(outputPath);
    });
  } catch (err: any) {
    console.error('Export handling error:', err);
    res.status(500).json({ error: err.message || 'Server error occurred during export.' });
  }
});

// Endpoint 3: Check export status / simple ping
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', time: new Date() });
});

// Periodic cleanup task: delete uploads and outputs older than 1 hour
setInterval(() => {
  const ONE_HOUR = 60 * 60 * 1000;
  const now = Date.now();

  [UPLOADS_DIR, OUTPUTS_DIR, TEMP_SUBS_DIR].forEach(dir => {
    fs.readdir(dir, (err, files) => {
      if (err) return;
      files.forEach(file => {
        const filePath = path.join(dir, file);
        fs.stat(filePath, (statErr, stats) => {
          if (statErr) return;
          if (now - stats.mtimeMs > ONE_HOUR) {
            fs.unlink(filePath, () => {
              console.log(`Auto-cleaned old file: ${file}`);
            });
          }
        });
      });
    });
  });
}, 10 * 60 * 1000); // Run every 10 minutes

app.listen(PORT, () => {
  console.log(`CaptionFlow AI server running on http://localhost:${PORT}`);
});
