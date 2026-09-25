import React, { useEffect } from 'react';
import { RotateCcw, X, AlertTriangle } from 'lucide-react';
import { GameMode } from '../types';

interface RestartConfirmModalProps {
  isOpen: boolean;
  score: number;
  level: number;
  mode: GameMode;
  onConfirm: () => void;
  onCancel: () => void;
}

export const RestartConfirmModal: React.FC<RestartConfirmModalProps> = ({
  isOpen,
  score,
  level,
  mode,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      id="restart-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onCancel}
    >
      <div
        id="restart-modal-card"
        className="relative w-full max-w-sm rounded-3xl bg-slate-900/95 border border-slate-700/80 p-6 shadow-2xl shadow-rose-950/40 text-center select-none animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon Badge */}
        <div className="mx-auto w-14 h-14 mb-4 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
          <RotateCcw className="w-7 h-7 animate-pulse" />
        </div>

        <h3 className="text-2xl font-black text-white tracking-wide mb-1">
          Restart Game?
        </h3>

        <div className="inline-block px-3 py-1 mb-3 rounded-full text-[11px] font-bold tracking-wider uppercase bg-slate-800 text-amber-300 border border-slate-700">
          {mode} Mode
        </div>

        <p className="text-xs text-slate-300 mb-2 leading-relaxed">
          Are you sure you want to restart? Your saved board and score for this run will be reset to the beginning.
        </p>

        {/* Current Run Summary */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 mb-6 flex items-center justify-around text-center">
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Level</div>
            <div className="text-lg font-black text-amber-400">{level}</div>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Score</div>
            <div className="text-lg font-black text-white">{score.toLocaleString()}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            id="confirm-restart-btn"
            onClick={onConfirm}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-500 via-red-500 to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-rose-500/25 active:scale-95 hover:brightness-110 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 stroke-[2.5]" />
            <span>Yes, Restart Game</span>
          </button>

          <button
            id="cancel-restart-btn"
            onClick={onCancel}
            className="w-full py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
          >
            Keep Playing
          </button>
        </div>
      </div>
    </div>
  );
};
