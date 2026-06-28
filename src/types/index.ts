export interface CaptionBlock {
  id: string;
  text: string;
  start: number; // in seconds
  end: number;   // in seconds
  x?: number;    // percentage 0-100 (optional, default 50%)
  y?: number;    // percentage 0-100 (optional, default 85%)
  rotation?: number; // tilt in degrees (optional, default 0)
}

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  uppercase: boolean;
  textColor: string;      // #RRGGBB
  textOpacity: number;    // 0-1
  backgroundColor: string; // #RRGGBB
  backgroundOpacity: number; // 0-1
  strokeColor: string;    // #RRGGBB
  strokeWidth: number;    // 0-10
  shadowColor: string;    // #RRGGBB
  shadowWidth: number;    // 0-10
  glowColor?: string;     // #RRGGBB
  glowWidth?: number;     // 0-10
  opacity: number;        // 0-1
  animation: 'none' | 'fade' | 'slide-up' | 'pop' | 'scale';
  position: 'top' | 'center' | 'bottom' | 'custom';
}

export type PresetType =
  | 'modern-white'
  | 'bold-tiktok'
  | 'minimal'
  | 'netflix'
  | 'cinematic'
  | 'soft-shadow'
  | 'neon'
  | 'luxury'
  | 'apple'
  | 'floating'
  | 'yellow-pop'
  | 'insta-gradient'
  | 'cyberpunk'
  | 'aesthetic-vlog';

export interface VideoMetadata {
  filename: string;
  duration: number;
  width: number;
  height: number;
  aspectRatio: number;
  blobUrl: string; // Used for local preview
}
