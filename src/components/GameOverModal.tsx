import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Check, Flame, Sparkles, X } from 'lucide-react';
import { isHighScore, saveLeaderboardScore } from '../game/leaderboard';
import { GameState } from '../types';

interface GameOverModalProps {
  isOpen: boolean;
  stats: GameState;
  onPlayAgain: () => void;
  onOpenLeaderboard: () => void;
  onClose?: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  stats,
  onPlayAgain,
  onOpenLeaderboard,
  onClose,
}) => {
  const [playerName, setPlayerName] = useState('Player 1');
  const [isSaved, setIsSaved] = useState(false);
  const [isTopScore, setIsTopScore] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsSaved(false);
    const qualified = isHighScore(stats.score, stats.mode);
    setIsTopScore(qualified);
    if (qualified) {
      // Fire celebration confetti!
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#ffffff'],
        });
      } catch {
        // ignore
      }
    }
  }, [isOpen, stats.score, stats.mode]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaved) return;

    saveLeaderboardScore(
      playerName.trim() || 'Player 1',
      stats.score,
      stats.level,
      stats.maxComboMultiplier,
      stats.mode
    );
    setIsSaved(true);
  };

  return (
    <div
      id="game-over-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none"
    >
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden text-center text-slate-200">
        {/* Glow effect */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Title */}
        <div className="inline-flex p-3 rounded-2xl bg-amber-500/20 text-amber-400 mb-3 border border-amber-500/30">
          <Trophy className="w-8 h-8" />
        </div>

        <h2 className="text-2xl font-black text-white tracking-tight">
          {stats.mode === 'blitz' ? "Time's Up!" : 'Game Over!'}
        </h2>
        <p className="text-xs text-slate-400 capitalize mb-4">{stats.mode} Mode Completed</p>

        {/* Big Score Callout */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Final Score</span>
          <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-300 to-pink-500 tracking-tight my-1">
            {stats.score.toLocaleString()}
          </div>
          {isTopScore && (
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold mt-1">
              <Sparkles className="w-3 h-3" />
              <span>New High Score!</span>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
            <span className="text-[10px] text-slate-400 block font-semibold">Level</span>
            <span className="font-black text-lg text-white">{stats.level}</span>
          </div>
          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
            <span className="text-[10px] text-slate-400 block font-semibold">Max Combo</span>
            <span className="font-black text-lg text-pink-400">x{stats.maxComboMultiplier}</span>
          </div>
          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
            <span className="text-[10px] text-slate-400 block font-semibold">Swaps</span>
            <span className="font-black text-lg text-sky-400">{stats.movesMade}</span>
          </div>
        </div>

        {/* Save to Leaderboard form */}
        {isTopScore && !isSaved && (
          <form onSubmit={handleSave} className="mb-5 bg-slate-800/40 p-3 rounded-2xl border border-slate-700/60">
            <label className="text-xs text-slate-300 font-semibold block mb-1.5 text-left">
              Save to Local Leaderboard:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="player-name-input"
                maxLength={16}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Your Name"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-400 font-semibold"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 active:scale-95 transition-all shadow-md shadow-amber-500/20"
              >
                <Check className="w-4 h-4" />
                <span>Save</span>
              </button>
            </div>
          </form>
        )}

        {isSaved && (
          <div className="mb-5 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4" />
            <span>Score saved to leaderboard!</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            id="play-again-btn"
            onClick={onPlayAgain}
            className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 active:scale-95 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>
          <button
            id="view-scores-btn"
            onClick={onOpenLeaderboard}
            className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 active:scale-95 transition-all"
            title="Leaderboard"
          >
            <Trophy className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
