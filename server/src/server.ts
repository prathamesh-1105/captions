import express from 'express';
import cors from 'cors';
import path from 'path';
import os from 'os';
import fs from 'fs';
import dotenv from 'dotenv';
import multer from 'multer';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';
import { generateAssFile } from './utils/assGenerator';
import { supabase } from './services/supabase';

// Load environmental keys from root .env
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

// Set ffmpeg paths
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const app = express();
const PORT = process.env.PORT || 5001;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create necessary temp folders
const TEMP_DIR = path.join(__dirname, '..', 'temp_workspace');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

[TEMP_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure Multer storage for local file upload parsing
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

// Helper: Download file from public URL to local disk
async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download source video: ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(destPath, buffer);
}

// Endpoint 1: Upload Video, Upload to Supabase Storage, and Probe Metadata
app.post('/api/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided.' });
  }

  const videoPath = req.file.path;
  const filename = req.file.filename;

  try {
    console.log(`Bypassing RLS: Uploading raw file "${req.file.originalname}" to Supabase Storage...`);
    
    // Read local file buffer
    const fileBuffer = fs.readFileSync(videoPath);

    // Upload to Supabase videos bucket (Authorized via Service Role Key bypasses RLS)
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(filename, fileBuffer, {
        contentType: req.file.mimetype || 'video/mp4',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(filename);

    console.log(`Video uploaded successfully to Supabase. Public URL: ${publicUrl}`);

    // Probe metadata using FFprobe
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      // Clean up the local temp upload file immediately
      try {
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      } catch (cleanupErr) {
        console.error('Temp cleanup failed:', cleanupErr);
      }

      if (err) {
        console.error('Error probing video:', err);
        return res.status(500).json({ error: 'Failed to read video metadata.' });
      }

      const duration = metadata.format.duration || 0;
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const width = videoStream?.width || 1920;
      const height = videoStream?.height || 1080;

      res.json({
        success: true,
        filename,
        videoUrl: publicUrl,
        duration,
        width,
        height,
        aspectRatio: width / height
      });
    });
  } catch (err: any) {
    // Clean up local file on failure
    try {
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
    } catch {}
    console.error('Upload proxy endpoint failed:', err);
    res.status(500).json({ error: err.message || 'Server upload proxy failed.' });
  }
});

// Endpoint 2: Get Recent Projects from Supabase (Bypassing RLS)
// Helper: Map Supabase database row to frontend project object
const mapProjectFromDb = (p: any) => {
  let captions: any[] = [];
  let style: any = {};

  try {
    if (p.lyrics_text) {
      const parsed = JSON.parse(p.lyrics_text);
      captions = parsed.captions || [];
      style = parsed.style || {};
    }
  } catch (err) {
    console.warn(`Failed to parse lyrics_text JSON for project ${p.id}, falling back.`);
  }

  return {
    id: String(p.id),
    name: p.name || 'Untitled Project',
    video_url: p.video_path || '',
    video_filename: p.video_filename || '',
    duration: Number(p.video_duration) || 0,
    width: Number(p.video_width) || 1920,
    height: Number(p.video_height) || 1080,
    aspect_ratio: p.video_width && p.video_height ? p.video_width / p.video_height : 16 / 9,
    captions,
    style: Object.keys(style).length ? style : {
      fontFamily: 'Arial',
      fontSize: 24,
      fontWeight: 'bold',
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
      animation: 'fade',
      position: 'bottom'
    },
    resolution: '1080p',
    fps: 30
  };
};

app.get('/api/projects', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6);

    if (error) throw error;

    // Map projects database fields to frontend fields
    const mapped = (data || []).map(mapProjectFromDb);
    res.json(mapped);
  } catch (err: any) {
    console.error('Failed to get projects:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch projects.' });
  }
});

// Endpoint 3: Create / Save Project (Bypassing RLS)
app.post('/api/projects', async (req, res) => {
  try {
    const projectData = req.body;

    // Serialize captions and style into the lyrics_text column
    const serializedData = JSON.stringify({
      captions: projectData.captions || [],
      style: projectData.style || {}
    });

    // Map payload to your actual database columns
    const dbPayload: any = {
      name: projectData.name,
      video_path: projectData.video_url,
      video_filename: projectData.video_filename,
      video_duration: projectData.duration,
      video_width: projectData.width,
      video_height: projectData.height,
      lyrics_text: serializedData
    };
    
    if (projectData.id && !isNaN(Number(projectData.id))) {
      // Update existing project
      const projectIdInt = Number(projectData.id);
      console.log(`Bypassing RLS: Updating project ID: ${projectIdInt}`);
      const { data, error } = await supabase
        .from('projects')
        .update({
          ...dbPayload,
          updated_at: new Date()
        })
        .eq('id', projectIdInt)
        .select()
        .single();

      if (error) throw error;
      res.json(mapProjectFromDb(data));
    } else {
      // Insert new project
      console.log(`Bypassing RLS: Inserting new project: "${projectData.name}"`);
      const { data, error } = await supabase
        .from('projects')
        .insert(dbPayload)
        .select()
        .single();

      if (error) throw error;
      res.json(mapProjectFromDb(data));
    }
  } catch (err: any) {
    console.error('Failed to save project:', err);
    res.status(500).json({ error: err.message || 'Failed to save project.' });
  }
});

// Endpoint 4: Export Video with burned subtitles from Supabase Database
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
  const { data: rawProject, error: dbError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (dbError || !rawProject) {
    console.error('Error fetching project from Supabase:', dbError);
    return res.status(404).json({ error: `Project not found: ${dbError?.message || 'Invalid ID'}` });
  }

  // Map raw database columns to frontend schema properties
  const project = mapProjectFromDb(rawProject);

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

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    if (iface) {
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          return alias.address;
        }
      }
    }
  }
  return 'localhost';
}

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    const localIp = getLocalIpAddress();
    console.log(`\n======================================================`);
    console.log(`capme AI stateless server running locally!`);
    console.log(`- Local access:   http://localhost:${PORT}`);
    console.log(`- Network access: http://${localIp}:${PORT}`);
    console.log(`======================================================\n`);
  });
}

export default app;
