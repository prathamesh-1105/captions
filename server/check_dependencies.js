const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('--- CaptionFlow AI Server Dependency Check ---');

try {
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
  const ffprobePath = require('@ffprobe-installer/ffprobe').path;

  console.log(`[PASS] @ffmpeg-installer/ffmpeg path: ${ffmpegPath}`);
  console.log(`[PASS] @ffprobe-installer/ffprobe path: ${ffprobePath}`);

  // Test executing FFmpeg
  const ffmpegVersion = execSync(`"${ffmpegPath}" -version`).toString().split('\n')[0];
  console.log(`[PASS] FFmpeg Executable Check: ${ffmpegVersion}`);

  // Test executing FFprobe
  const ffprobeVersion = execSync(`"${ffprobePath}" -version`).toString().split('\n')[0];
  console.log(`[PASS] FFprobe Executable Check: ${ffprobeVersion}`);

  // Check folders relative to server root
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  const outputsDir = path.join(__dirname, '..', 'outputs');
  const tempSubsDir = path.join(__dirname, '..', 'temp_subs');

  [uploadsDir, outputsDir, tempSubsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  console.log('[PASS] Directories (uploads, outputs, temp_subs) initialized.');

  console.log('\n>>> SUCCESS: All system dependencies are ready for CaptionFlow AI! <<<');
} catch (error) {
  console.error('\n>>> ERROR: Dependency check failed! <<<');
  console.error(error.message);
  process.exit(1);
}
