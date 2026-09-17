import React from 'react';
import {
  Trophy,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Timer as TimerIcon,
  HelpCircle,
} from 'lucide-react';
import { GameMode, GameState } from '../types';

interface HeaderHUDProps {
  stats: GameState;
  isMuted: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onTriggerHint: () => void;
  onRestart: () => void;
  onOpenLeaderboard: () => void;
  onOpenHowToPlay: () => void;
  onChangeMode: (mode: GameMode) => void;
}

export const HeaderHUD: React.FC<HeaderHUDProps> = ({
  stats,
  isMuted,
  onToggleMute,
  onTogglePause,
  onTriggerHint,
  onRestart,
  onOpenLeaderboard,
  onOpenHowToPlay,
  onChangeMode,
}) => {
  const progressPercent = Math.min(100, Math.max(0, (stats.progress / stats.maxProgress) * 100));
  const timePercent =
    stats.maxTime > 0 ? Math.min(100, Math.max(0, (stats.timeRemaining / stats.maxTime) * 100)) : 100;
  const isTimeCritical = stats.mode !== 'zen' && stats.timeRemaining <= 8;

  return (
    <header id="game-header-hud" className="w-full max-w-xl mx-auto px-3 pt-2 pb-1 select-none">
      {/* Top Bar: Mode Select & Quick Controls */}
      <div className="flex items-center justify-between gap-2 mb-2">
        {/* Game Mode Pills */}
        <div className="flex items-center bg-slate-900/80 p-1 rounded-full border border-slate-800 backdrop-blur-sm">
          {(['classic', 'blitz', 'zen'] as GameMode[]).map((m) => (
            <button
              key={m}
              id={`mode-btn-${m}`}
              onClick={() => onChangeMode(m)}
              className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wider uppercase transition-all ${
                stats.mode === m
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5">
          <button
            id="hint-btn"
            onClick={onTriggerHint}
            title="Hint"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-amber-300 border border-slate-700/60 active:scale-95 transition-all"
          >
            <Lightbulb className="w-4 h-4" />
          </button>

          <button
            id="mute-btn"
            onClick={onToggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 active:scale-95 transition-all"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            id="pause-btn"
            onClick={onTogglePause}
            title={stats.isPaused ? 'Resume' : 'Pause'}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 active:scale-95 transition-all"
          >
            {stats.isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4" />}
          </button>

          <button
            id="leaderboard-btn"
            onClick={onOpenLeaderboard}
            title="Leaderboard"
            className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 active:scale-95 transition-all"
          >
            <Trophy className="w-4 h-4" />
          </button>

          <button
            id="help-btn"
            onClick={onOpenHowToPlay}
            title="How to Play"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 border border-slate-700/60 active:scale-95 transition-all"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            id="restart-btn"
            onClick={onRestart}
            title="Restart"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 border border-slate-700/60 active:scale-95 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Score & Multiplier Dashboard Card */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3 backdrop-blur-md shadow-xl">
        <div className="flex items-center justify-between gap-2">
          {/* Level Badge */}
          <div className="flex flex-col items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Level</span>
            <div className="flex items-center gap-1">
              <span className="text-xl font-black text-amber-400 leading-none">{stats.level}</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            </div>
          </div>

          {/* Current Score */}
          <div className="flex flex-col items-center flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Score</span>
            <span className="text-2xl font-black tracking-tight text-white drop-shadow-md">
              {stats.score.toLocaleString()}
            </span>
          </div>

          {/* Multiplier Badge */}
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Multiplier</span>
            <div
              className={`px-2 py-0.5 rounded-lg font-black text-sm tracking-wide shadow-sm transition-all ${
                stats.multiplier > 2.5
                  ? 'bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white shadow-fuchsia-500/50 scale-105'
                  : stats.multiplier > 1
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              x{stats.multiplier.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Level Progression Bar */}
        <div className="mt-2.5">
          <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 mb-1">
            <span>Next Level</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-pink-500 rounded-full transition-all duration-300 shadow-sm"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Time Remaining Bar (Blitz Rush only) */}
        {stats.mode === 'blitz' && (
          <div className="mt-2">
            <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 mb-1">
              <div className="flex items-center gap-1">
                <TimerIcon className={`w-3 h-3 ${isTimeCritical ? 'text-rose-500 animate-spin' : 'text-sky-400'}`} />
                <span className={isTimeCritical ? 'text-rose-400 font-bold' : ''}>
                  Blitz Rush Countdown
                </span>
              </div>
              <span className={`tabular-nums ${isTimeCritical ? 'text-rose-400 font-bold animate-pulse' : ''}`}>
                {Math.ceil(stats.timeRemaining)}s
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  isTimeCritical
                    ? 'bg-rose-500 animate-pulse'
                    : 'bg-gradient-to-r from-sky-400 to-emerald-400'
                }`}
                style={{ width: `${timePercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
