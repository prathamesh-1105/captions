import type { CaptionBlock } from '../types';

/**
 * Splits raw lyrics/script text by lines and distributes them evenly across the video duration.
 */
export function distributeCaptions(lyricsText: string, videoDuration: number): CaptionBlock[] {
  if (!lyricsText || videoDuration <= 0) return [];

  // Split by newline and filter out empty lines/whitespace
  const lines = lyricsText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) return [];

  const count = lines.length;
  const segmentDuration = videoDuration / count;

  return lines.map((text, index) => {
    const start = Number((index * segmentDuration).toFixed(2));
    const end = Number(((index + 1) * segmentDuration).toFixed(2));
    return {
      id: `cap-${index}-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      text,
      start,
      end,
      x: 50, // default center position (percentage)
      y: 85, // default bottom position (percentage)
    };
  });
}

/**
 * Format seconds to a readable playhead string (e.g. MM:SS.SS or HH:MM:SS)
 */
export function formatPlayheadTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);

  const mStr = m.toString().padStart(2, '0');
  const sStr = s.toString().padStart(2, '0');
  const msStr = ms.toString().padStart(2, '0');

  if (h > 0) {
    const hStr = h.toString().padStart(2, '0');
    return `${hStr}:${mStr}:${sStr}.${msStr}`;
  }

  return `${mStr}:${sStr}.${msStr}`;
}
