import React, { useEffect, useRef, useState } from 'react';
import { BoardEngine, BOARD_SIZE, NUM_GEM_TYPES } from '../game/boardEngine';
import { EffectsManager } from '../game/effectsManager';
import { GemRenderer, GEM_COLORS } from '../game/gemRenderer';
import { sound } from '../game/sound';
import { GameMode, GameState, GemType, SpecialType, Tile } from '../types';

interface GameBoardProps {
  mode: GameMode;
  isPaused: boolean;
  onStatsUpdate: (stats: GameState) => void;
  onGameOver: (stats: GameState) => void;
  onLevelUp: (level: number) => void;
  hintTrigger: number;
}

type AnimPhase = 'idle' | 'swapping' | 'swap_back' | 'matching' | 'falling' | 'game_over';

export const GameBoard: React.FC<GameBoardProps> = ({
  mode,
  isPaused,
  onStatsUpdate,
  onGameOver,
  onLevelUp,
  hintTrigger,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Core game systems
  const gemRenderer = useRef(new GemRenderer());
  const effects = useRef(new EffectsManager());

  // Board state
  const boardRef = useRef<(Tile | null)[][]>(BoardEngine.createInitialBoard());
  const selectedTileRef = useRef<{ row: number; col: number } | null>(null);
  const phaseRef = useRef<AnimPhase>('idle');
  const animTimeRef = useRef<number>(0);
  const animDurationRef = useRef<number>(0.2);

  // Active swap tracking
  const swapDataRef = useRef<{
    r1: number;
    c1: number;
    r2: number;
    c2: number;
    isReturn: boolean;
  } | null>(null);

  // Cascade and combo tracking
  const comboCascadeRef = useRef<number>(0);
  const maxComboRef = useRef<number>(1);
  const currentMatchesRef = useRef<{ row: number; col: number }[]>([]);

  // Game stats
  const scoreRef = useRef<number>(0);
  const levelRef = useRef<number>(1);
  const progressRef = useRef<number>(0);
  const maxProgressRef = useRef<number>(1000);
  const movesMadeRef = useRef<number>(0);
  const timeRemainingRef = useRef<number>(mode === 'blitz' ? 60 : 0);
  const maxTimeRef = useRef<number>(mode === 'blitz' ? 60 : 0);
  const isGameOverRef = useRef<boolean>(false);

  // Touch / pointer tracking
  const pointerStartRef = useRef<{ x: number; y: number; row: number; col: number } | null>(null);
  const isPointerDownRef = useRef<boolean>(false);

  // Hint tracking
  const hintedTilesRef = useRef<{ r1: number; c1: number; r2: number; c2: number } | null>(null);
  const hintTimeoutRef = useRef<number | null>(null);

  // Canvas size and metrics
  const [boardLayout, setBoardLayout] = useState<{
    width: number;
    height: number;
    tileSize: number;
    offsetX: number;
    offsetY: number;
  }>({
    width: 400,
    height: 400,
    tileSize: 50,
    offsetX: 0,
    offsetY: 0,
  });

  const boardLayoutRef = useRef(boardLayout);
  boardLayoutRef.current = boardLayout;

  // Broadcast stats
  const emitStats = () => {
    const levelMultiplier = 1 + (levelRef.current - 1) * 0.25;
    const currentMultiplier = Number(
      (levelMultiplier * Math.max(1, comboCascadeRef.current)).toFixed(1)
    );

    onStatsUpdate({
      score: scoreRef.current,
      level: levelRef.current,
      progress: progressRef.current,
      maxProgress: maxProgressRef.current,
      multiplier: currentMultiplier,
      cascadeCount: comboCascadeRef.current,
      maxComboMultiplier: maxComboRef.current,
      timeRemaining: timeRemainingRef.current,
      maxTime: maxTimeRef.current,
      movesMade: movesMadeRef.current,
      isPaused,
      isGameOver: isGameOverRef.current,
      mode,
    });
  };

  // Reset board when game mode changes
  useEffect(() => {
    boardRef.current = BoardEngine.createInitialBoard();
    selectedTileRef.current = null;
    phaseRef.current = 'idle';
    comboCascadeRef.current = 0;
    maxComboRef.current = 1;
    scoreRef.current = 0;
    levelRef.current = 1;
    progressRef.current = 0;
    maxProgressRef.current = 1000;
    movesMadeRef.current = 0;
    timeRemainingRef.current = mode === 'blitz' ? 60 : 0;
    maxTimeRef.current = mode === 'blitz' ? 60 : 0;
    isGameOverRef.current = false;
    effects.current.reset();
    emitStats();
  }, [mode]);

  // Handle Hint trigger from UI
  useEffect(() => {
    if (hintTrigger > 0 && phaseRef.current === 'idle') {
      const valid = BoardEngine.findValidMoves(boardRef.current);
      if (valid.length > 0) {
        const choice = valid[Math.floor(Math.random() * valid.length)];
        hintedTilesRef.current = choice;
        if (boardRef.current[choice.r1]?.[choice.c1]) {
          boardRef.current[choice.r1][choice.c1]!.isHinted = true;
        }
        if (boardRef.current[choice.r2]?.[choice.c2]) {
          boardRef.current[choice.r2][choice.c2]!.isHinted = true;
        }
        sound.playHint();

        if (hintTimeoutRef.current) window.clearTimeout(hintTimeoutRef.current);
        hintTimeoutRef.current = window.setTimeout(() => {
          if (boardRef.current[choice.r1]?.[choice.c1]) {
            boardRef.current[choice.r1][choice.c1]!.isHinted = false;
          }
          if (boardRef.current[choice.r2]?.[choice.c2]) {
            boardRef.current[choice.r2][choice.c2]!.isHinted = false;
          }
          hintedTilesRef.current = null;
        }, 3000);
      }
    }
  }, [hintTrigger]);

  // Dynamic Canvas Resizing using ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const containerWidth = rect.width;
      const containerHeight = rect.height;

      // Board must be square, fitting within the container with padding
      const availableSize = Math.min(containerWidth, containerHeight) - 16;
      const boardPixelSize = Math.max(280, Math.min(availableSize, 560));
      const tileSize = boardPixelSize / BOARD_SIZE;
      const offsetX = (containerWidth - boardPixelSize) / 2;
      const offsetY = (containerHeight - boardPixelSize) / 2;

      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

      if (canvasRef.current) {
        canvasRef.current.width = containerWidth * dpr;
        canvasRef.current.height = containerHeight * dpr;
        canvasRef.current.style.width = `${containerWidth}px`;
        canvasRef.current.style.height = `${containerHeight}px`;
      }

      setBoardLayout({
        width: containerWidth,
        height: containerHeight,
        tileSize,
        offsetX,
        offsetY,
      });
    };

    const ro = new ResizeObserver(() => updateSize());
    ro.observe(container);
    updateSize();

    return () => ro.disconnect();
  }, []);

  // Main Game Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      if (!isPaused && !isGameOverRef.current) {
        // Mode timer countdown (Blitz mode only)
        if (mode === 'blitz') {
          timeRemainingRef.current -= dt;
          if (timeRemainingRef.current <= 0) {
            timeRemainingRef.current = 0;
            isGameOverRef.current = true;
            phaseRef.current = 'game_over';
            sound.playGameOver();
            emitStats();
            onGameOver({
              score: scoreRef.current,
              level: levelRef.current,
              progress: progressRef.current,
              maxProgress: maxProgressRef.current,
              multiplier: maxComboRef.current,
              cascadeCount: comboCascadeRef.current,
              maxComboMultiplier: maxComboRef.current,
              timeRemaining: 0,
              maxTime: maxTimeRef.current,
              movesMade: movesMadeRef.current,
              isPaused: false,
              isGameOver: true,
              mode,
            });
          }
        }

        // Update active animation state
        updateGameState(dt, currentTime / 1000);
      }

      // Update effects
      effects.current.update(dt);

      // Render scene
      renderScene(currentTime / 1000);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPaused, mode]);

  // Update Game Logic and Animations
  const updateGameState = (dt: number, timeSec: number) => {
    const board = boardRef.current;

    // Subtle random idle shimmers on gems
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const t = board[r][c];
        if (!t) continue;

        t.animTimer += dt;
        if (t.animType === 'shine') {
          t.animFrame += dt * 20;
          if (t.animFrame >= 15) {
            t.animType = 'idle';
            t.animFrame = 0;
            t.animTimer = 0;
          }
        } else if (t.animType === 'spin') {
          t.animFrame += dt * 25;
          if (t.animFrame >= 15) {
            t.animType = 'idle';
            t.animFrame = 0;
          }
        } else {
          // Chance to trigger shine when idle
          if (t.animTimer > 4 + (r + c) * 0.4 && Math.random() < 0.03) {
            t.animType = 'shine';
            t.animFrame = 0;
            t.animTimer = 0;
          }
        }
      }
    }

    // State machine transitions
    if (phaseRef.current === 'swapping' || phaseRef.current === 'swap_back') {
      animTimeRef.current += dt;
      const progress = Math.min(1, animTimeRef.current / animDurationRef.current);
      // Ease in-out cubic
      const ease =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const swap = swapDataRef.current;
      if (swap) {
        const t1 = board[swap.r1][swap.c1];
        const t2 = board[swap.r2][swap.c2];

        if (phaseRef.current === 'swapping') {
          if (t1) {
            t1.visualRow = swap.r1 + (swap.r2 - swap.r1) * ease;
            t1.visualCol = swap.c1 + (swap.c2 - swap.c1) * ease;
            t1.animType = 'spin';
            t1.animFrame = ease * 14;
          }
          if (t2) {
            t2.visualRow = swap.r2 + (swap.r1 - swap.r2) * ease;
            t2.visualCol = swap.c2 + (swap.c1 - swap.c2) * ease;
            t2.animType = 'spin';
            t2.animFrame = ease * 14;
          }
        } else {
          // Reversing back
          if (t1) {
            t1.visualRow = swap.r2 + (swap.r1 - swap.r2) * ease;
            t1.visualCol = swap.c2 + (swap.c1 - swap.c2) * ease;
          }
          if (t2) {
            t2.visualRow = swap.r1 + (swap.r2 - swap.r1) * ease;
            t2.visualCol = swap.c1 + (swap.c2 - swap.c1) * ease;
          }
        }

        if (progress >= 1) {
          // Swap animation finished
          if (phaseRef.current === 'swapping') {
            // Swap tiles in 2D array
            const temp = board[swap.r1][swap.c1];
            board[swap.r1][swap.c1] = board[swap.r2][swap.c2];
            board[swap.r2][swap.c2] = temp;

            if (board[swap.r1][swap.c1]) {
              board[swap.r1][swap.c1]!.row = swap.r1;
              board[swap.r1][swap.c1]!.col = swap.c1;
              board[swap.r1][swap.c1]!.visualRow = swap.r1;
              board[swap.r1][swap.c1]!.visualCol = swap.c1;
              board[swap.r1][swap.c1]!.animType = 'idle';
            }
            if (board[swap.r2][swap.c2]) {
              board[swap.r2][swap.c2]!.row = swap.r2;
              board[swap.r2][swap.c2]!.col = swap.c2;
              board[swap.r2][swap.c2]!.visualRow = swap.r2;
              board[swap.r2][swap.c2]!.visualCol = swap.c2;
              board[swap.r2][swap.c2]!.animType = 'idle';
            }

            // Check if one was a Hypercube
            const isHyper1 = board[swap.r1][swap.c1]?.special === SpecialType.HYPERCUBE;
            const isHyper2 = board[swap.r2][swap.c2]?.special === SpecialType.HYPERCUBE;

            if (isHyper1 || isHyper2) {
              const hyperCoord = isHyper1
                ? { row: swap.r1, col: swap.c1 }
                : { row: swap.r2, col: swap.c2 };
              const targetCoord = isHyper1
                ? { row: swap.r2, col: swap.c2 }
                : { row: swap.r1, col: swap.c1 };

              const matchRes = BoardEngine.resolveHypercube(board, hyperCoord, targetCoord);
              sound.playHypercube();
              handleMatchExecution(matchRes);
            } else {
              // Standard match check
              const matches = BoardEngine.findMatches(board, {
                r1: swap.r1,
                c1: swap.c1,
                r2: swap.r2,
                c2: swap.c2,
              });

              if (matches && matches.matchedTiles.length >= 3) {
                // Valid match!
                movesMadeRef.current++;
                handleMatchExecution(matches);
              } else {
                // Invalid swap! Reverse back
                sound.playSwapBack();
                phaseRef.current = 'swap_back';
                animTimeRef.current = 0;
                animDurationRef.current = 0.2;
              }
            }
          } else {
            // Swap back finished -> re-swap in array
            const temp = board[swap.r1][swap.c1];
            board[swap.r1][swap.c1] = board[swap.r2][swap.c2];
            board[swap.r2][swap.c2] = temp;

            if (board[swap.r1][swap.c1]) {
              board[swap.r1][swap.c1]!.row = swap.r1;
              board[swap.r1][swap.c1]!.col = swap.c1;
              board[swap.r1][swap.c1]!.visualRow = swap.r1;
              board[swap.r1][swap.c1]!.visualCol = swap.c1;
            }
            if (board[swap.r2][swap.c2]) {
              board[swap.r2][swap.c2]!.row = swap.r2;
              board[swap.r2][swap.c2]!.col = swap.c2;
              board[swap.r2][swap.c2]!.visualRow = swap.r2;
              board[swap.r2][swap.c2]!.visualCol = swap.c2;
            }

            phaseRef.current = 'idle';
            swapDataRef.current = null;
            comboCascadeRef.current = 0;
            emitStats();
          }
        }
      }
    } else if (phaseRef.current === 'matching') {
      animTimeRef.current += dt;
      const progress = Math.min(1, animTimeRef.current / animDurationRef.current);

      // Scale down and fade matched tiles
      currentMatchesRef.current.forEach(({ row, col }) => {
        const t = board[row][col];
        if (t) {
          t.scale = Math.max(0, 1 - progress);
          t.alpha = Math.max(0, 1 - progress);
          t.rotAngle = progress * Math.PI;
        }
      });

      if (progress >= 1) {
        // Clear matched tiles from board & prepare cascade fall
        currentMatchesRef.current.forEach(({ row, col }) => {
          board[row][col] = null;
        });

        startFallingPhase();
      }
    } else if (phaseRef.current === 'falling') {
      animTimeRef.current += dt;
      let allSettled = true;

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const t = board[r][c];
          if (!t) continue;

          if (t.visualRow < t.row) {
            t.fallSpeed = (t.fallSpeed || 0) + 38 * dt; // gravity
            t.visualRow += t.fallSpeed * dt;

            if (t.visualRow >= t.row) {
              t.visualRow = t.row;
              t.fallSpeed = 0;
            } else {
              allSettled = false;
            }
          }
        }
      }

      if (allSettled) {
        // Check for cascade matches!
        const cascadeMatches = BoardEngine.findMatches(board);

        if (cascadeMatches && cascadeMatches.matchedTiles.length >= 3) {
          // Cascade triggered!
          comboCascadeRef.current++;
          if (comboCascadeRef.current > maxComboRef.current) {
            maxComboRef.current = comboCascadeRef.current;
          }

          sound.playCombo(comboCascadeRef.current);
          handleMatchExecution(cascadeMatches, true);
        } else {
          // Board settled, no more cascades
          phaseRef.current = 'idle';
          comboCascadeRef.current = 0;

          // Check if board has valid moves left
          const validMoves = BoardEngine.findValidMoves(board);
          if (validMoves.length === 0) {
            // Reshuffle board!
            effects.current.addFloatingText(
              'NO MOVES - RESHUFFLE!',
              boardLayoutRef.current.width / 2,
              boardLayoutRef.current.height / 2,
              '#f43f5e',
              28
            );
            sound.playSwapBack();
            boardRef.current = BoardEngine.reshuffle(board);
          }

          emitStats();
        }
      }
    }
  };

  // Handle Match Execution (scoring, visual effects, and sound)
  const handleMatchExecution = (
    result: ReturnType<typeof BoardEngine.findMatches> | ReturnType<typeof BoardEngine.resolveHypercube>,
    isCascade: boolean = false
  ) => {
    if (!result) return;
    const board = boardRef.current;
    const layout = boardLayoutRef.current;

    // Compute multiplier
    const levelMultiplier = 1 + (levelRef.current - 1) * 0.25;
    const cascadeMult = Math.max(1, comboCascadeRef.current);
    const totalMultiplier = Number((levelMultiplier * cascadeMult).toFixed(1));

    const pointsEarned = Math.round(result.basePoints * totalMultiplier);
    scoreRef.current += pointsEarned;
    progressRef.current += pointsEarned;

    // Classic / Blitz time bonus on matches
    if (mode === 'classic') {
      timeRemainingRef.current = Math.min(
        maxTimeRef.current,
        timeRemainingRef.current + Math.min(6, 1.5 + (result.clearedCoords.length - 3) * 0.8)
      );
    }

    // Play ascending audio chime
    sound.playMatch(comboCascadeRef.current);

    // Level progression
    if (progressRef.current >= maxProgressRef.current) {
      levelRef.current++;
      progressRef.current -= maxProgressRef.current;
      maxProgressRef.current = Math.round(maxProgressRef.current * 1.35);

      sound.playLevelUp();
      onLevelUp(levelRef.current);

      effects.current.addFloatingText(
        `LEVEL UP! (LVL ${levelRef.current})`,
        layout.width / 2,
        layout.offsetY - 20,
        '#fbbf24',
        32
      );
    }

    // Trigger visual explosions for cleared gems
    result.clearedCoords.forEach(({ row, col }) => {
      const tile = board[row][col];
      const cx = layout.offsetX + (col + 0.5) * layout.tileSize;
      const cy = layout.offsetY + (row + 0.5) * layout.tileSize;

      if (tile) {
        effects.current.spawnGemExplosion(
          cx,
          cy,
          tile.type,
          tile.special !== SpecialType.NONE ? 28 : 16,
          tile.special !== SpecialType.NONE ? 1.5 : 1
        );
      }
    });

    // Special Detonations effects
    result.flameDetonations?.forEach(({ row, col }) => {
      const cx = layout.offsetX + (col + 0.5) * layout.tileSize;
      const cy = layout.offsetY + (row + 0.5) * layout.tileSize;
      sound.playExplosion();
      effects.current.triggerScreenShake(8, 0.35);
      effects.current.spawnGemExplosion(cx, cy, GemType.RUBY, 32, 2.0);
    });

    result.starDetonations?.forEach(({ row, col }) => {
      const cx = layout.offsetX + (col + 0.5) * layout.tileSize;
      const cy = layout.offsetY + (row + 0.5) * layout.tileSize;
      sound.playLaser();
      effects.current.spawnLaserCross(
        cx,
        cy,
        layout.offsetX,
        layout.offsetY,
        layout.tileSize * BOARD_SIZE,
        layout.tileSize * BOARD_SIZE
      );
    });

    // Spawn floating score texts
    const firstCoord = result.clearedCoords[0] || { row: 3, col: 3 };
    const textX = layout.offsetX + (firstCoord.col + 0.5) * layout.tileSize;
    const textY = layout.offsetY + (firstCoord.row + 0.5) * layout.tileSize;

    effects.current.addFloatingText(
      `+${pointsEarned.toLocaleString()}`,
      textX,
      textY,
      cascadeMult > 1 ? '#f59e0b' : '#38bdf8',
      cascadeMult > 1 ? 26 : 22
    );

    if (cascadeMult >= 2) {
      const comboWords = ['', '', 'GOOD!', 'GREAT!', 'SUPERB!', 'EXCELLENT!', 'INCREDIBLE!'];
      const word = comboWords[Math.min(cascadeMult, comboWords.length - 1)];
      effects.current.addFloatingText(
        `x${cascadeMult} COMBO! ${word}`,
        layout.width / 2,
        layout.offsetY + layout.tileSize * 3.5,
        '#ec4899',
        28
      );
    }

    // Set matching phase
    currentMatchesRef.current = result.clearedCoords;
    phaseRef.current = 'matching';
    animTimeRef.current = 0;
    animDurationRef.current = 0.22;

    // Apply special spawns (e.g. Flame gem or Star gem at intersection)
    result.specialSpawns?.forEach((spawn) => {
      const tile = board[spawn.row][spawn.col];
      if (tile) {
        tile.special = spawn.special;
        tile.scale = 1.3;
        tile.alpha = 1;
        // Don't clear this specific tile
        currentMatchesRef.current = currentMatchesRef.current.filter(
          (c) => !(c.row === spawn.row && c.col === spawn.col)
        );
      }
    });

    emitStats();
  };

  // Start Falling & Refill Phase
  const startFallingPhase = () => {
    const board = boardRef.current;

    for (let c = 0; c < BOARD_SIZE; c++) {
      let emptyRow = BOARD_SIZE - 1;

      // Drop existing tiles
      for (let r = BOARD_SIZE - 1; r >= 0; r--) {
        if (board[r][c] !== null) {
          if (r !== emptyRow) {
            const tile = board[r][c]!;
            board[emptyRow][c] = tile;
            board[r][c] = null;
            tile.row = emptyRow;
            tile.fallSpeed = 0;
          }
          emptyRow--;
        }
      }

      // Fill remaining empty spots from the top
      let spawnOffset = 1;
      for (let r = emptyRow; r >= 0; r--) {
        const randomType = Math.floor(Math.random() * NUM_GEM_TYPES) as GemType;
        board[r][c] = {
          id: `spawn_${r}_${c}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          type: randomType,
          special: SpecialType.NONE,
          row: r,
          col: c,
          visualRow: -spawnOffset,
          visualCol: c,
          scale: 1,
          alpha: 1,
          rotAngle: 0,
          animFrame: 0,
          animTimer: 0,
          animType: 'idle',
          fallSpeed: 0,
        };
        spawnOffset++;
      }
    }

    phaseRef.current = 'falling';
    animTimeRef.current = 0;
  };

  // Render Full Board and Canvas Scene
  const renderScene = (timeSec: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const layout = boardLayoutRef.current;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, layout.width, layout.height);

    // Apply Screen Shake if active
    const shake = effects.current.getScreenShakeOffset();
    ctx.translate(shake.x, shake.y);

    // 1. Draw Board Background Frame (Outer Glow and Metallic Bezel)
    const boardSize = layout.tileSize * BOARD_SIZE;
    const bx = layout.offsetX;
    const by = layout.offsetY;

    // Ambient Board Shadow & Glow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;

    // Board Backdrop
    ctx.fillStyle = '#0c0a17';
    ctx.beginPath();
    ctx.roundRect(bx - 8, by - 8, boardSize + 16, boardSize + 16, 16);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Board Golden/Cyber Border
    const borderGrad = ctx.createLinearGradient(bx, by, bx + boardSize, by + boardSize);
    borderGrad.addColorStop(0, '#f59e0b');
    borderGrad.addColorStop(0.5, '#7c3aed');
    borderGrad.addColorStop(1, '#3b82f6');
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = borderGrad;
    ctx.stroke();

    // Checkerboard Grid Cells
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cx = bx + c * layout.tileSize;
        const cy = by + r * layout.tileSize;

        const isEven = (r + c) % 2 === 0;
        ctx.fillStyle = isEven ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.18)';
        ctx.fillRect(cx, cy, layout.tileSize, layout.tileSize);

        // Thin cell divider lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx, cy, layout.tileSize, layout.tileSize);
      }
    }

    // 2. Draw Tiles
    const board = boardRef.current;
    const selected = selectedTileRef.current;

    // Draw all non-selected tiles first
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const t = board[r][c];
        if (!t) continue;
        if (selected && selected.row === r && selected.col === c) continue;

        const tx = bx + t.visualCol * layout.tileSize;
        const ty = by + t.visualRow * layout.tileSize;
        gemRenderer.current.drawGem(ctx, t, tx, ty, layout.tileSize, timeSec);
      }
    }

    // Draw selected tile on top with selection frame
    if (selected) {
      const t = board[selected.row]?.[selected.col];
      if (t) {
        const tx = bx + t.visualCol * layout.tileSize;
        const ty = by + t.visualRow * layout.tileSize;
        gemRenderer.current.drawGem(ctx, t, tx, ty, layout.tileSize, timeSec);
        gemRenderer.current.drawSelection(ctx, tx, ty, layout.tileSize, timeSec);
      }
    }

    // 3. Render Visual Effects (Particles, Lasers, Shocks, Text)
    effects.current.render(ctx);

    ctx.restore();
  };

  // Convert client touch/mouse coordinates to board row and column
  const getCellFromCoords = (clientX: number, clientY: number): { row: number; col: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - boardLayoutRef.current.offsetX;
    const y = clientY - rect.top - boardLayoutRef.current.offsetY;

    if (
      x < 0 ||
      y < 0 ||
      x >= boardLayoutRef.current.tileSize * BOARD_SIZE ||
      y >= boardLayoutRef.current.tileSize * BOARD_SIZE
    ) {
      return null;
    }

    const col = Math.floor(x / boardLayoutRef.current.tileSize);
    const row = Math.floor(y / boardLayoutRef.current.tileSize);

    if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
      return { row, col };
    }
    return null;
  };

  // Touch & Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== 'idle' || isPaused || isGameOverRef.current) return;
    sound.init(); // Resume audio context

    const cell = getCellFromCoords(e.clientX, e.clientY);
    if (!cell) return;

    isPointerDownRef.current = true;
    pointerStartRef.current = { x: e.clientX, y: e.clientY, row: cell.row, col: cell.col };

    // Clear any hints
    if (hintedTilesRef.current) {
      const { r1, c1, r2, c2 } = hintedTilesRef.current;
      if (boardRef.current[r1]?.[c1]) boardRef.current[r1][c1]!.isHinted = false;
      if (boardRef.current[r2]?.[c2]) boardRef.current[r2][c2]!.isHinted = false;
      hintedTilesRef.current = null;
    }

    const prev = selectedTileRef.current;

    if (!prev) {
      // First selection
      selectedTileRef.current = cell;
      sound.playSwap();
    } else {
      if (prev.row === cell.row && prev.col === cell.col) {
        // Tapped same tile -> deselect
        selectedTileRef.current = null;
      } else if (BoardEngine.isAdjacent(prev.row, prev.col, cell.row, cell.col)) {
        // Tapped adjacent tile -> initiate swap!
        triggerSwap(prev.row, prev.col, cell.row, cell.col);
        selectedTileRef.current = null;
      } else {
        // Tapped distant tile -> change selection
        selectedTileRef.current = cell;
        sound.playSwap();
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current || !pointerStartRef.current || phaseRef.current !== 'idle') {
      return;
    }

    const start = pointerStartRef.current;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dragThreshold = 18; // Swipe threshold in pixels

    if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
      // Determine swipe direction
      let targetR = start.row;
      let targetC = start.col;

      if (Math.abs(dx) > Math.abs(dy)) {
        targetC += dx > 0 ? 1 : -1;
      } else {
        targetR += dy > 0 ? 1 : -1;
      }

      // If valid board neighbor, trigger swap!
      if (
        targetR >= 0 &&
        targetR < BOARD_SIZE &&
        targetC >= 0 &&
        targetC < BOARD_SIZE &&
        BoardEngine.isAdjacent(start.row, start.col, targetR, targetC)
      ) {
        triggerSwap(start.row, start.col, targetR, targetC);
        selectedTileRef.current = null;
      }

      isPointerDownRef.current = false;
      pointerStartRef.current = null;
    }
  };

  const handlePointerUp = () => {
    isPointerDownRef.current = false;
    pointerStartRef.current = null;
  };

  // Initiate a swap animation between two cells
  const triggerSwap = (r1: number, c1: number, r2: number, c2: number) => {
    if (phaseRef.current !== 'idle') return;

    sound.playSwap();
    phaseRef.current = 'swapping';
    animTimeRef.current = 0;
    animDurationRef.current = 0.22;
    swapDataRef.current = { r1, c1, r2, c2, isReturn: false };
  };

  return (
    <div
      ref={containerRef}
      id="game-board-container"
      className="relative w-full h-full flex items-center justify-center select-none touch-none overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        id="game-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="block cursor-pointer touch-none"
      />
    </div>
  );
};
