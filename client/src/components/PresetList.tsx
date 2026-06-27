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
          currentStyle.textColor === item.style.textColor &&
          currentStyle.backgroundColor === item.style.backgroundColor &&
          currentStyle.backgroundOpacity === item.style.backgroundOpacity &&
          currentStyle.strokeWidth === item.style.strokeWidth &&
          currentStyle.position === item.style.position;

        return (
          <button
            key={key}
            onClick={() => onSelectPreset({ ...item.style })}
            className={`p-3 rounded-lg border text-left transition-all duration-300 ${
              isSelected
                ? 'bg-violet-600/20 border-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.15)] text-white'
                : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-zinc-200 hover:border-white/10 hover:bg-zinc-850'
            }`}
          >
            <p className="text-[11px] font-bold truncate">{item.name}</p>
            <div className="mt-2 flex items-center justify-center h-8 rounded bg-black/40 text-[10px] font-semibold border border-white/5">
              <span
                style={{
                  fontFamily: item.style.fontFamily,
                  color: item.style.textColor,
                  fontWeight: item.style.fontWeight,
                  textTransform: item.style.uppercase ? 'uppercase' : 'none',
                  textShadow: item.style.shadowWidth > 0 
                    ? `${item.style.shadowWidth}px ${item.style.shadowWidth}px 0px ${item.style.shadowColor}` 
                    : undefined,
                  WebkitTextStroke: item.style.strokeWidth > 0 
                    ? `${item.style.strokeWidth}px ${item.style.strokeColor}` 
                    : undefined
                }}
              >
                Abc
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
