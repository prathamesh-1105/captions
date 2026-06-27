import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';
import { generateAssFile } from './utils/assGenerator';
import { supabase } from './services/supabase';

// Load environmental keys from root .env
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

// Set ffmpeg paths
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create necessary temp folders
const TEMP_DIR = path.join(__dirname, '..', 'temp_workspace');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Helper: Download file from public URL to local disk
async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download source video from Supabase Storage: ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(destPath, buffer);
}

// Endpoint 1: Export Video with burned subtitles from Supabase Database
app.post('/api/export', async (req, res) => {
  const {
    projectId,
    resolution = '1080p',
    fps = 30
  } = req.body as {
    projectId: string;
    resolution: '720p' | '1080p' | '2k' | '4k';
    fps: number;
  };

  if (!projectId) {
    return res.status(400).json({ error: 'Missing required parameter: projectId.' });
  }

  // 1. Fetch project metadata from Supabase
  const { data: project, error: dbError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (dbError || !project) {
    console.error('Error fetching project from Supabase:', dbError);
    return res.status(404).json({ error: `Project not found: ${dbError?.message || 'Invalid ID'}` });
  }

  const {
    name: videoName,
    video_url: videoUrl,
    video_filename: videoFilename,
    captions,
    style
  } = project;

  console.log(`Starting cloud export for Project: "${videoName}" (${projectId})`);

  const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const tempInputPath = path.join(TEMP_DIR, `input-${uniqueId}-${videoFilename}`);
  const assPath = path.join(TEMP_DIR, `subs-${uniqueId}.ass`);
  const tempOutputPath = path.join(TEMP_DIR, `output-${uniqueId}.mp4`);

  // Resolution heights
  const resolutionHeightMap = {
    '720p': 720,
    '1080p': 1080,
    '2k': 1440,
    '4k': 2160
  };
  const targetHeight = resolutionHeightMap[resolution] || 1080;

  try {
    // 2. Download the original video from Supabase Storage
    console.log(`Downloading source video from storage: ${videoUrl}`);
    await downloadFile(videoUrl, tempInputPath);

    // 3. Probe video properties to scale subtitle coordinates
    ffmpeg.ffprobe(tempInputPath, async (probeErr, metadata) => {
      if (probeErr) {
        cleanupTempFiles([tempInputPath]);
        return res.status(500).json({ error: 'Error probing downloaded video properties.' });
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const origWidth = videoStream?.width || 1920;
      const origHeight = videoStream?.height || 1080;
      const aspectRatio = origWidth / origHeight;
      const targetWidth = Math.round(targetHeight * aspectRatio);

      // 4. Generate and write ASS subtitles file
      const assContent = generateAssFile(captions, style, targetWidth, targetHeight);
      fs.writeFileSync(assPath, assContent, 'utf-8');

      // 5. Escape paths for FFmpeg subtitles filter on Windows
      const escapedAssPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\\\:');

      // 6. Chain scale and subtitles filter
      const videoFilters = `scale=-2:${targetHeight},subtitles=${escapedAssPath}`;

      console.log(`Running FFmpeg burn subtitles filter: ${resolution} @ ${fps}fps`);

      ffmpeg(tempInputPath)
        .videoFilters(videoFilters)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-crf 20',          // High visual quality
          '-preset medium',   // Balance speed/efficiency
          '-pix_fmt yuv420p', // Web/quicktime compatibility
          `-r ${fps}`
        ])
        .on('end', async () => {
          console.log('FFmpeg processing completed. Uploading final video to Supabase Storage...');

          try {
            // 7. Upload the compiled video back to Supabase 'exports' storage bucket
            const outputBuffer = fs.readFileSync(tempOutputPath);
            const exportFilename = `export-${uniqueId}.mp4`;

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('exports')
              .upload(exportFilename, outputBuffer, {
                contentType: 'video/mp4',
                upsert: true
              });

            if (uploadError) {
              throw new Error(`Failed to upload final export to storage bucket: ${uploadError.message}`);
            }

            // Get the public URL for download
            const { data: { publicUrl } } = supabase.storage
              .from('exports')
              .getPublicUrl(exportFilename);

            console.log(`Export uploaded successfully! Public URL: ${publicUrl}`);

            // Clean up all local temporary workspace files
            cleanupTempFiles([tempInputPath, assPath, tempOutputPath]);

            // Return success with downloadUrl pointing directly to Supabase storage
            res.json({
              success: true,
              downloadUrl: publicUrl,
              filename: exportFilename
            });
          } catch (uploadErr: any) {
            console.error('Error uploading output to Supabase Storage:', uploadErr);
            cleanupTempFiles([tempInputPath, assPath, tempOutputPath]);
            res.status(500).json({ error: uploadErr.message || 'Storage upload failed.' });
          }
        })
        .on('error', (ffmpegErr) => {
          console.error('FFmpeg processing error:', ffmpegErr);
          cleanupTempFiles([tempInputPath, assPath, tempOutputPath]);
          res.status(500).json({ error: 'FFmpeg encoding failed: ' + ffmpegErr.message });
        })
        .save(tempOutputPath);
    });
  } catch (err: any) {
    console.error('Export error: ', err);
    cleanupTempFiles([tempInputPath, assPath, tempOutputPath]);
    res.status(500).json({ error: err.message || 'Server error occurred during export processing.' });
  }
});

// Helper: Delete files synchronously if they exist
function cleanupTempFiles(filePaths: string[]) {
  filePaths.forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error(`Failed to delete temp file: ${filePath}`, err);
    }
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', time: new Date() });
});

app.listen(PORT, () => {
  console.log(`CaptionFlow AI stateless server running on http://localhost:${PORT}`);
});
