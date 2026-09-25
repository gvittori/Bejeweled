import React, { useEffect, useRef } from 'react';
import { PhaserGameBridge } from '../game/phaser/PhaserGame';
import { GameMode, GameState } from '../types';

interface GameBoardProps {
  mode: GameMode;
  isPaused: boolean;
  onStatsUpdate: (stats: GameState) => void;
  onGameOver: (stats: GameState) => void;
  onLevelUp: (level: number) => void;
  onGameResumed?: (info: { level: number; score: number; multiplier: number }) => void;
  hintTrigger: number;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  mode,
  isPaused,
  onStatsUpdate,
  onGameOver,
  onLevelUp,
  onGameResumed,
  hintTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameBridgeRef = useRef<PhaserGameBridge | null>(null);

  // Initialize Phaser 3 Game Instance
  useEffect(() => {
    if (!containerRef.current) return;

    const bridge = new PhaserGameBridge(containerRef.current, mode, {
      onStatsUpdate,
      onGameOver,
      onLevelUp,
      onGameResumed,
    });
    gameBridgeRef.current = bridge;

    // Handle container resize safely
    let animFrameId: number | null = null;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width >= 280 && height >= 280) {
          if (animFrameId !== null) {
            cancelAnimationFrame(animFrameId);
          }
          animFrameId = requestAnimationFrame(() => {
            bridge.resize(width, height);
          });
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
      }
      resizeObserver.disconnect();
      bridge.destroy();
      gameBridgeRef.current = null;
    };
  }, [mode]);

  // Keep callback references fresh without tearing down canvas
  useEffect(() => {
    gameBridgeRef.current?.updateCallbacks({
      onStatsUpdate,
      onGameOver,
      onLevelUp,
      onGameResumed,
    });
  }, [onStatsUpdate, onGameOver, onLevelUp, onGameResumed]);

  // Handle Pause / Resume toggle
  useEffect(() => {
    gameBridgeRef.current?.setPaused(isPaused);
  }, [isPaused]);

  // Handle Hint trigger from HUD
  useEffect(() => {
    if (hintTrigger > 0) {
      gameBridgeRef.current?.triggerHint();
    }
  }, [hintTrigger]);

  return (
    <div
      ref={containerRef}
      id="phaser-game-container"
      className="relative w-full h-full flex items-center justify-center select-none touch-none overflow-hidden"
      style={{ minWidth: '280px', minHeight: '340px' }}
    />
  );
};
