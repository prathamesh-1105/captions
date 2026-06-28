import type { CaptionStyle, PresetType } from '../types';
import { PRESETS } from '../utils/presets';

interface PresetListProps {
  currentStyle: CaptionStyle;
  onSelectPreset: (style: CaptionStyle) => void;
}

export default function PresetList({ currentStyle, onSelectPreset }: PresetListProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(Object.keys(PRESETS) as PresetType[]).map((key) => {
        const item = PRESETS[key];
        const isSelected = 
          currentStyle.fontFamily === item.style.fontFamily &&
          currentStyle.textColor.toLowerCase() === item.style.textColor.toLowerCase();

        return (
          <button
            key={key}
            onClick={() => onSelectPreset({ ...item.style })}
            className={`p-2.5 rounded-lg border text-left transition-all duration-300 ${
              isSelected
                ? 'bg-violet-600/20 border-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.15)] text-white font-medium'
                : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-zinc-200 hover:border-white/10 hover:bg-zinc-850'
            }`}
          >
            <div className="flex items-center justify-center h-10 rounded bg-black/35 px-1.5 border border-white/5 overflow-hidden">
              <span
                style={{
                  fontFamily: item.style.fontFamily,
                  color: item.style.textColor,
                  fontWeight: item.style.fontWeight,
                  textTransform: item.style.uppercase ? 'uppercase' : 'none',
                  fontSize: '11px'
                }}
                className="truncate block w-full text-center"
              >
                {item.name}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
