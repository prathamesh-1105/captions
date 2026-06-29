import type { CaptionStyle } from '../types';

interface StyleCustomizerProps {
  style: CaptionStyle;
  onChange: React.Dispatch<React.SetStateAction<CaptionStyle>>;
}

export default function StyleCustomizer({ style, onChange }: StyleCustomizerProps) {
  const updateStyle = (fields: Partial<CaptionStyle>) => {
    onChange(prev => ({ ...prev, ...fields }));
  };

  const fonts = [
    'Arial',
    'Impact',
    'Georgia',
    'Courier New',
    'Times New Roman',
    'Verdana',
    'Trebuchet MS',
  ];

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-[10px] uppercase font-bold text-zinc-400">Layout Presets</span>
        <button
          onClick={() => updateStyle({
            strokeWidth: 0,
            shadowWidth: 0,
            glowWidth: 0,
            backgroundOpacity: 0
          })}
          className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold hover:underline bg-transparent border-none cursor-pointer"
        >
          Reset to Flat Text
        </button>
      </div>

      {/* Font Section */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase font-bold text-zinc-500">Font Family</label>
        <select
          value={style.fontFamily}
          onChange={(e) => updateStyle({ fontFamily: e.target.value })}
          className="w-full bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-base sm:text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
        >
          {fonts.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* Font Size slider */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-[10px] uppercase font-bold text-zinc-500">Font Size</label>
          <span className="font-mono text-zinc-400">{style.fontSize}px</span>
        </div>
        <input
          type="range"
          min="12"
          max="64"
          value={style.fontSize}
          onChange={(e) => updateStyle({ fontSize: Number(e.target.value) })}
          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
        />
      </div>

      {/* Font Weight and Casing */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div>
          <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Weight</label>
          <div className="flex bg-zinc-900 p-0.5 rounded border border-white/10">
            <button
              onClick={() => updateStyle({ fontWeight: 'normal' })}
              className={`flex-1 py-1 rounded font-semibold text-[10px] ${
                style.fontWeight === 'normal' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-350'
              }`}
            >
              Regular
            </button>
            <button
              onClick={() => updateStyle({ fontWeight: 'bold' })}
              className={`flex-1 py-1 rounded font-semibold text-[10px] ${
                style.fontWeight === 'bold' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-350'
              }`}
            >
              Bold
            </button>
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Casing</label>
          <button
            onClick={() => updateStyle({ uppercase: !style.uppercase })}
            className={`w-full py-1.5 rounded border font-semibold text-[10px] transition-colors ${
              style.uppercase
                ? 'bg-violet-600/20 border-violet-500 text-white'
                : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            UPPERCASE
          </button>
        </div>
      </div>

      {/* Colors picker */}
      <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-3">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-zinc-500">Text Color</label>
          <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 rounded px-2.5 py-1">
            <input
              type="color"
              value={style.textColor}
              onChange={(e) => updateStyle({ textColor: e.target.value })}
              className="w-5 h-5 bg-transparent border-0 rounded cursor-pointer shrink-0"
            />
            <span className="font-mono text-[10px] uppercase text-zinc-350">{style.textColor}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between">
            <label className="text-[10px] uppercase font-bold text-zinc-500">Text Opacity</label>
            <span className="font-mono text-zinc-450">{Math.round(style.textOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={style.textOpacity}
            onChange={(e) => updateStyle({ textOpacity: Number(e.target.value) })}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-600 mt-2"
          />
        </div>
      </div>

      {/* Stroke & Shadow */}
      <div className="border-t border-white/5 pt-3 space-y-3">
        {/* Stroke settings */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-zinc-500">Stroke Color</label>
            <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 rounded px-2.5 py-1">
              <input
                type="color"
                value={style.strokeColor}
                onChange={(e) => updateStyle({ strokeColor: e.target.value })}
                className="w-5 h-5 bg-transparent border-0 rounded cursor-pointer shrink-0"
              />
              <span className="font-mono text-[10px] uppercase text-zinc-350">{style.strokeColor}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-[10px] uppercase font-bold text-zinc-500">Stroke Width</label>
              <span className="font-mono text-zinc-450">{style.strokeWidth}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="6"
              step="0.5"
              value={style.strokeWidth}
              onChange={(e) => updateStyle({ strokeWidth: Number(e.target.value) })}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-600 mt-2"
            />
          </div>
        </div>

        {/* Shadow settings */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-zinc-500">Shadow Color</label>
            <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 rounded px-2.5 py-1">
              <input
                type="color"
                value={style.shadowColor}
                onChange={(e) => updateStyle({ shadowColor: e.target.value })}
                className="w-5 h-5 bg-transparent border-0 rounded cursor-pointer shrink-0"
              />
              <span className="font-mono text-[10px] uppercase text-zinc-350">{style.shadowColor}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-[10px] uppercase font-bold text-zinc-500">Shadow Size</label>
              <span className="font-mono text-zinc-450">{style.shadowWidth}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="6"
              step="0.5"
              value={style.shadowWidth}
              onChange={(e) => updateStyle({ shadowWidth: Number(e.target.value) })}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-600 mt-2"
            />
          </div>
        </div>

        {/* Glow settings */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-zinc-500">Glow Color</label>
            <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 rounded px-2.5 py-1">
              <input
                type="color"
                value={style.glowColor || '#39FF14'}
                onChange={(e) => updateStyle({ glowColor: e.target.value })}
                className="w-5 h-5 bg-transparent border-0 rounded cursor-pointer shrink-0"
              />
              <span className="font-mono text-[10px] uppercase text-zinc-350">{style.glowColor || '#39FF14'}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-[10px] uppercase font-bold text-zinc-500">Glow Width</label>
              <span className="font-mono text-zinc-450">{style.glowWidth || 0}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="12"
              step="1"
              value={style.glowWidth || 0}
              onChange={(e) => updateStyle({ glowWidth: Number(e.target.value) })}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-600 mt-2"
            />
          </div>
        </div>
      </div>

      {/* Background Box Section */}
      <div className="border-t border-white/5 pt-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-zinc-500">Box Color</label>
            <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 rounded px-2.5 py-1">
              <input
                type="color"
                value={style.backgroundColor}
                onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
                className="w-5 h-5 bg-transparent border-0 rounded cursor-pointer shrink-0"
              />
              <span className="font-mono text-[10px] uppercase text-zinc-350">{style.backgroundColor}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-[10px] uppercase font-bold text-zinc-500">Box Opacity</label>
              <span className="font-mono text-zinc-450">{Math.round(style.backgroundOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={style.backgroundOpacity}
              onChange={(e) => updateStyle({ backgroundOpacity: Number(e.target.value) })}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-600 mt-2"
            />
          </div>
        </div>
      </div>

      {/* Position and Animation */}
      <div className="border-t border-white/5 pt-3 grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-zinc-500">Placement</label>
          <select
            value={style.position}
            onChange={(e) => updateStyle({ position: e.target.value as any })}
            className="w-full bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-base sm:text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
          >
            <option value="bottom">Bottom (Default)</option>
            <option value="center">Center</option>
            <option value="top">Top</option>
            <option value="custom">Drag Custom</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-zinc-500">Animation</label>
          <select
            value={style.animation}
            onChange={(e) => updateStyle({ animation: e.target.value as any })}
            className="w-full bg-zinc-900 border border-white/10 rounded px-2.5 py-1.5 text-base sm:text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
          >
            <option value="none">None</option>
            <option value="fade">Fade In/Out</option>
            <option value="slide-up">Slide Up</option>
            <option value="pop">Pop (Bouncy)</option>
            <option value="scale">Zoom In</option>
            <option value="squeeze">Yellow Squeeze</option>
          </select>
        </div>
      </div>
    </div>
  );
}
