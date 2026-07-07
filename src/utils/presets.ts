import type { CaptionStyle, PresetType } from '../types';

export const PRESETS: Record<PresetType, { name: string; style: CaptionStyle }> = {
  'default': {
    name: 'Default',
    style: {
      fontFamily: 'Outfit',
      fontSize: 24,
      fontWeight: 'bold',
      uppercase: false,
      textColor: '#FFFFFF',
      textOpacity: 1,
      backgroundColor: '#000000',
      backgroundOpacity: 0,
      strokeColor: '#000000',
      strokeWidth: 1.5,
      shadowColor: '#000000',
      shadowWidth: 0,
      opacity: 1,
      animation: 'pop',
      position: 'bottom',
    },
  },
};
