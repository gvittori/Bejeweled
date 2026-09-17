/**
 * Bejeweled Classic - Main Application
 */

import React, { useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { GameBoard } from './components/GameBoard';
import { GameOverModal } from './components/GameOverModal';
import { HeaderHUD } from './components/HeaderHUD';
import { HowToPlayModal } from './components/HowToPlayModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { sound } from './game/sound';
import { GameMode, GameState } from './types';
import { Sparkles, Trophy, Lightbulb, HelpCircle, Play, Pause } from 'lucide-react';

export default function App() {
  const [mode, setMode] = useState<GameMode>('classic');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => sound.getMuted());
  const [hintTrigger, setHintTrigger] = useState<number>(0);

  // Modals state
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState<boolean>(false);
  const [isGameOverModalOpen, setIsGameOverModalOpen] = useState<boolean>(false);

  // Level Up announcement toast
  const [levelUpToast, setLevelUpToast] = useState<{ level: number } | null>(null);

  // Key stats from GameBoard
  const [gameSessionId, setGameSessionId] = useState<number>(0);
  const [stats, setStats] = useState<GameState>({
    score: 0,
    level: 1,
    progress: 0,
    maxProgress: 1000,
    multiplier: 1,
    cascadeCount: 0,
    maxComboMultiplier: 1,
    timeRemaining: 0,
    maxTime: 0,
    movesMade: 0,
    isPaused: false,
    isGameOver: false,
    mode: 'classic',
  });

  const handleStatsUpdate = useCallback((newStats: GameState) => {
    setStats(newStats);
  }, []);

  const handleGameOver = useCallback((finalStats: GameState) => {
    setStats(finalStats);
    setIsGameOverModalOpen(true);
  }, []);

  const handleLevelUp = useCallback((newLevel: number) => {
    setLevelUpToast({ level: newLevel });
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.2 },
        colors: ['#f59e0b', '#ec4899', '#38bdf8', '#ffffff'],
      });
    } catch {
      // ignore
    }
    setTimeout(() => {
      setLevelUpToast(null);
    }, 2400);
  }, []);

  const handleToggleMute = () => {
    const updated = sound.toggleMute();
    setIsMuted(updated);
  };

  const handleTogglePause = () => {
    setIsPaused((prev) => !prev);
  };

  const handleTriggerHint = () => {
    setHintTrigger((prev) => prev + 1);
  };

  const restartGame = useCallback(() => {
    setIsGameOverModalOpen(false);
    setIsPaused(false);
    setGameSessionId((prev) => prev + 1);
    setStats({
      score: 0,
      level: 1,
      progress: 0,
      maxProgress: 1000,
      multiplier: 1,
      cascadeCount: 0,
      maxComboMultiplier: 1,
      timeRemaining: mode === 'blitz' ? 60 : 0,
      maxTime: mode === 'blitz' ? 60 : 0,
      movesMade: 0,
      isPaused: false,
      isGameOver: false,
      mode,
    });
  }, [mode]);

  const handleHeaderRestart = () => {
    if (window.confirm('Restart the current game?')) {
      restartGame();
    }
  };

  const handleChangeMode = (newMode: GameMode) => {
    if (newMode !== mode) {
      setMode(newMode);
      setIsPaused(false);
      setIsGameOverModalOpen(false);
      setGameSessionId((prev) => prev + 1);
      setStats((prev) => ({
        ...prev,
        score: 0,
        level: 1,
        progress: 0,
        timeRemaining: newMode === 'blitz' ? 60 : 0,
        maxTime: newMode === 'blitz' ? 60 : 0,
        isGameOver: false,
        mode: newMode,
      }));
    }
  };

  return (
    <div
      id="app-root-container"
      className="relative w-full h-full flex flex-col bg-[#07060e] text-slate-100 overflow-hidden select-none"
    >
      {/* Dynamic Cosmic Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Top Header HUD */}
      <HeaderHUD
        stats={stats}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onTogglePause={handleTogglePause}
        onTriggerHint={handleTriggerHint}
        onRestart={handleHeaderRestart}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
        onChangeMode={handleChangeMode}
      />

      {/* Level Up Banner Notification */}
      {levelUpToast && (
        <div
          id="level-up-toast"
          className="absolute top-28 left-1/2 -translate-x-1/2 z-40 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-slate-950 font-black text-lg tracking-wider uppercase shadow-2xl shadow-amber-500/50 flex items-center gap-2 animate-bounce border-2 border-yellow-200"
        >
          <Sparkles className="w-5 h-5 text-yellow-100 animate-spin" />
          <span>Level {levelUpToast.level}! Multiplier Up!</span>
          <Sparkles className="w-5 h-5 text-yellow-100 animate-spin" />
        </div>
      )}

      {/* Main Canvas Area */}
      <main id="game-main-area" className="relative flex-1 w-full min-h-0 flex items-center justify-center p-2">
        <GameBoard
          key={`${mode}-${gameSessionId}`}
          mode={mode}
          isPaused={isPaused}
          onStatsUpdate={handleStatsUpdate}
          onGameOver={handleGameOver}
          onLevelUp={handleLevelUp}
          hintTrigger={hintTrigger}
        />

        {/* Pause Overlay */}
        {isPaused && (
          <div
            id="pause-overlay"
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in"
          >
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-center max-w-xs w-full shadow-2xl">
              <div className="inline-flex p-3 rounded-2xl bg-slate-800 text-amber-400 mb-3">
                <Pause className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Game Paused</h2>
              <p className="text-xs text-slate-400 mb-5">Take a breath, gems aren't going anywhere!</p>
              <button
                id="resume-btn"
                onClick={handleTogglePause}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Resume Game</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Quick Touch Action Footer (Mobile Friendly) */}
      <footer
        id="game-quick-footer"
        className="w-full max-w-xl mx-auto px-4 py-1.5 flex items-center justify-between text-xs text-slate-400 border-t border-slate-900/80 bg-slate-950/40"
      >
        <button
          onClick={handleTriggerHint}
          className="flex items-center gap-1.5 hover:text-amber-300 transition-colors py-1 px-2.5 rounded-lg active:bg-slate-800"
        >
          <Lightbulb className="w-4 h-4 text-amber-400" />
          <span className="font-semibold">Get Hint</span>
        </button>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>Swipe or tap adjacent gems to swap</span>
        </div>

        <button
          onClick={() => setIsLeaderboardOpen(true)}
          className="flex items-center gap-1.5 hover:text-amber-300 transition-colors py-1 px-2.5 rounded-lg active:bg-slate-800"
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="font-semibold">Rankings</span>
        </button>
      </footer>

      {/* Modals */}
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        currentMode={mode}
        onClose={() => setIsLeaderboardOpen(false)}
      />

      <GameOverModal
        isOpen={isGameOverModalOpen}
        stats={stats}
        onPlayAgain={restartGame}
        onOpenLeaderboard={() => {
          setIsGameOverModalOpen(false);
          setIsLeaderboardOpen(true);
        }}
        onClose={() => setIsGameOverModalOpen(false)}
      />

      <HowToPlayModal
        isOpen={isHowToPlayOpen}
        onClose={() => setIsHowToPlayOpen(false)}
      />
    </div>
  );
}
