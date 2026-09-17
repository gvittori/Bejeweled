import React from 'react';
import { X, Sparkles, Flame, Zap, Compass } from 'lucide-react';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      id="how-to-play-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none"
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-sky-500/20 text-sky-400">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">How to Play</h2>
              <p className="text-xs text-slate-400">Master the art of cascading gems</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="max-h-80 overflow-y-auto pr-1 py-3 space-y-3.5 text-xs text-slate-300 leading-relaxed">
          {/* Controls */}
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
            <h3 className="font-black text-sm text-amber-400 mb-1 flex items-center gap-1.5">
              <span>👆 Mobile Touch Controls</span>
            </h3>
            <p>
              Swap two adjacent gems by <strong>swiping your finger</strong> in any direction, or by{' '}
              <strong>tapping one gem then tapping an adjacent gem</strong>.
            </p>
          </div>

          {/* Special Gems */}
          <div className="space-y-2">
            <h3 className="font-black text-sm text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Special Power Gems</span>
            </h3>

            {/* Flame Gem */}
            <div className="flex gap-3 items-start bg-slate-800/40 p-2.5 rounded-2xl border border-slate-800">
              <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400 shrink-0">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <strong className="text-orange-400 block font-bold text-xs">Flame Gem (Match 4)</strong>
                <span>Matches of 4 forge a Flame Gem. When matched, it explodes in a fiery 3x3 blast radius!</span>
              </div>
            </div>

            {/* Star Gem */}
            <div className="flex gap-3 items-start bg-slate-800/40 p-2.5 rounded-2xl border border-slate-800">
              <div className="p-2 rounded-xl bg-yellow-500/20 text-yellow-400 shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <strong className="text-yellow-400 block font-bold text-xs">Star Gem (L or T Shape)</strong>
                <span>Matching 5 gems with an intersection creates a Star Gem. When cleared, it shoots cross-lasers across the entire row and column!</span>
              </div>
            </div>

            {/* Hypercube */}
            <div className="flex gap-3 items-start bg-slate-800/40 p-2.5 rounded-2xl border border-slate-800">
              <div className="p-2 rounded-xl bg-fuchsia-500/20 text-fuchsia-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <strong className="text-fuchsia-400 block font-bold text-xs">Hypercube (Match 5 in a Row)</strong>
                <span>A radiant rainbow crystal! Swapping it with any gem obliterates ALL gems of that color on the entire board!</span>
              </div>
            </div>
          </div>

          {/* Multipliers */}
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
            <h3 className="font-black text-sm text-pink-400 mb-1">
              ⚡ Score Multipliers & Cascades
            </h3>
            <p>
              Each consecutive cascade chain reaction adds <strong>+1.0x to your Combo Multiplier</strong> (x2, x3, x4, x5...). Leveling up also permanently increases your level score multiplier!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-md shadow-amber-500/25 active:scale-95 transition-all"
          >
            Got It! Let's Play
          </button>
        </div>
      </div>
    </div>
  );
};
