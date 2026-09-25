import Phaser from 'phaser';
import { BoardEngine, BOARD_SIZE } from '../boardEngine';
import { sound } from '../sound';
import { GameMode, GameState, GemType, SpecialType, Tile } from '../../types';
import { SaveManager, SavedGameData, SavedTileData } from '../saveManager';

export const GEM_HEX_COLORS: Record<GemType, number> = {
  [GemType.TOPAZ]: 0xeab308,
  [GemType.DIAMOND]: 0xe2e8f0,
  [GemType.SAPPHIRE]: 0x0284c7,
  [GemType.RUBY]: 0xdc2626,
  [GemType.AMETHYST]: 0xc026d3,
  [GemType.AMBER]: 0xea580c,
  [GemType.EMERALD]: 0x16a34a,
};

export class GameScene extends Phaser.Scene {
  // Mode & State
  private mode: GameMode = 'classic';
  private isPaused: boolean = false;
  private isGameOver: boolean = false;
  private isAnimating: boolean = false;
  private saveUnsubscribe: (() => void) | null = null;

  // Board Data Model & Visual Containers
  private boardModel: (Tile | null)[][] = [];
  private gemContainers: (Phaser.GameObjects.Container | null)[][] = [];

  // Board Layout & Metrics
  private tileSize: number = 52;
  private boardWidth: number = 416;
  private boardHeight: number = 416;
  private offsetX: number = 0;
  private offsetY: number = 0;

  // Visual Elements
  private boardBackground!: Phaser.GameObjects.Container;
  private selectionBracket!: Phaser.GameObjects.Image;
  private hintMarkers: Phaser.GameObjects.Image[] = [];

  // Interaction & Touch Tracking
  private selectedCoord: { row: number; col: number } | null = null;
  private pointerStart: { row: number; col: number; x: number; y: number } | null = null;
  private isPointerDown: boolean = false;
  private readonly SWIPE_THRESHOLD: number = 18;

  // Game Stats
  private score: number = 0;
  private level: number = 1;
  private progress: number = 0;
  private maxProgress: number = 1000;
  private movesMade: number = 0;
  private comboCascade: number = 0;
  private maxCombo: number = 1;
  private timeRemaining: number = 0;
  private maxTime: number = 0;

  // Blitz Timer Event
  private timerEvent: Phaser.Time.TimerEvent | null = null;

  // Arcade Physics Groups
  private shardPhysicsGroup!: Phaser.Physics.Arcade.Group;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { mode?: GameMode }) {
    if (data && data.mode) {
      this.mode = data.mode;
    }
  }

  create() {
    // 1. Setup Arcade Physics
    this.physics.world.gravity.y = 0;
    this.shardPhysicsGroup = this.physics.add.group({
      allowGravity: true,
      bounceX: 0.3,
      bounceY: 0.3,
      collideWorldBounds: false,
    });

    // 2. Setup Camera and Background
    this.cameras.main.setBackgroundColor('#0b0914');

    // 3. Compute Board Layout
    this.calculateLayout();

    // 4. Create Board Background Slots
    this.createBoardBackground();

    // 5. Create Selection Bracket
    this.selectionBracket = this.add.image(-100, -100, 'gem_selection');
    this.selectionBracket.setVisible(false);
    this.selectionBracket.setDepth(20);

    // Subtle breathing pulse on selection bracket
    this.tweens.add({
      targets: this.selectionBracket,
      scale: { from: 1.0, to: 1.08 },
      alpha: { from: 0.85, to: 1.0 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 6. Initialize Game State & Board (restores local progress on mobile or starts fresh)
    this.initializeGameOrRestore();

    // 7. Setup Built-In Pointer Inputs
    this.setupPointerInputs();

    // 8. Handle Viewport Resizing
    this.scale.on('resize', this.handleResize, this);

    // 9. Initial Stats Broadcast
    this.emitStats();

    // 10. Bridge Event Listeners and Ready Announcement
    this.game.events.emit('game-scene-ready', this);
    this.game.events.on('bridge:trigger-hint', this.triggerHint, this);
    this.game.events.on('bridge:set-paused', this.setPaused, this);
    this.game.events.on('bridge:set-mode', this.setGameMode, this);
    this.game.events.on('bridge:restart', this.restartGame, this);

    // 11. Register Mobile Lifecycle Save Provider (handles visibilitychange, pagehide, tab switch)
    this.saveUnsubscribe = SaveManager.registerLifecycleProvider(() => {
      return this.buildSaveData();
    });

    this.events.once('shutdown', () => {
      this.saveUnsubscribe?.();
      this.saveCurrentState(true);
      this.game?.events?.off('bridge:trigger-hint', this.triggerHint, this);
      this.game?.events?.off('bridge:set-paused', this.setPaused, this);
      this.game?.events?.off('bridge:set-mode', this.setGameMode, this);
      this.game?.events?.off('bridge:restart', this.restartGame, this);
    });
  }

  /**
   * Calculate responsive layout based on current canvas size
   */
  private calculateLayout() {
    const { width, height } = this.scale;
    const padding = 24;
    const availableSize = Math.min(width - padding, height - padding);
    
    // Fit 8 cells cleanly, clamping between 40px and 68px
    this.tileSize = Math.floor(availableSize / BOARD_SIZE);
    this.tileSize = Math.max(38, Math.min(68, this.tileSize));

    this.boardWidth = this.tileSize * BOARD_SIZE;
    this.boardHeight = this.tileSize * BOARD_SIZE;

    this.offsetX = Math.floor((width - this.boardWidth) / 2);
    this.offsetY = Math.floor((height - this.boardHeight) / 2);
  }

  private handleResize() {
    this.calculateLayout();
    this.redrawBoardBackground();
    this.repositionAllGems();
  }

  /**
   * Draw the beveled board background slots
   */
  private createBoardBackground() {
    if (this.boardBackground) {
      this.boardBackground.destroy();
    }
    this.boardBackground = this.add.container(0, 0);
    this.boardBackground.setDepth(1);

    // Outer board border glow
    const borderGlow = this.add.graphics();
    borderGlow.lineStyle(2, 0x8b5cf6, 0.35);
    borderGlow.strokeRoundedRect(
      this.offsetX - 6,
      this.offsetY - 6,
      this.boardWidth + 12,
      this.boardHeight + 12,
      14
    );
    this.boardBackground.add(borderGlow);

    // Outer board backdrop fill
    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x0f0c22, 0.88);
    backdrop.fillRoundedRect(
      this.offsetX - 4,
      this.offsetY - 4,
      this.boardWidth + 8,
      this.boardHeight + 8,
      12
    );
    this.boardBackground.add(backdrop);

    // Grid cells
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cx = this.offsetX + c * this.tileSize + this.tileSize / 2;
        const cy = this.offsetY + r * this.tileSize + this.tileSize / 2;

        const cell = this.add.image(cx, cy, 'cell_bg');
        cell.setDisplaySize(this.tileSize - 4, this.tileSize - 4);
        cell.setAlpha(0.6);
        this.boardBackground.add(cell);
      }
    }
  }

  private redrawBoardBackground() {
    this.createBoardBackground();
  }

  /**
   * Initialize board and stats, restoring local progress if present
   */
  private initializeGameOrRestore() {
    const saved = SaveManager.loadProgress(this.mode);
    if (saved && typeof saved.score === 'number' && saved.score >= 0 && saved.level >= 1) {
      this.score = saved.score;
      this.level = saved.level;
      this.progress = saved.progress || 0;
      this.maxProgress = saved.maxProgress || 1000;
      this.comboCascade = saved.comboCascade || 0;
      this.maxCombo = saved.maxComboMultiplier || 1;
      this.movesMade = saved.movesMade || 0;
      this.timeRemaining = saved.timeRemaining !== undefined ? saved.timeRemaining : (this.mode === 'blitz' ? 60 : 0);
      this.maxTime = saved.maxTime || (this.mode === 'blitz' ? 60 : 0);
      this.isGameOver = false;
      this.isAnimating = false;
      this.selectedCoord = null;
      if (this.selectionBracket) this.selectionBracket.setVisible(false);
      this.clearHints();

      if (this.timerEvent) {
        this.timerEvent.destroy();
        this.timerEvent = null;
      }

      if (this.mode === 'blitz') {
        if (this.timeRemaining <= 0) {
          this.timeRemaining = 60;
          this.maxTime = 60;
        }
        this.timerEvent = this.time.addEvent({
          delay: 1000,
          callback: this.onTimerTick,
          callbackScope: this,
          loop: true,
        });
      }

      const boardLoaded = this.loadSavedBoard(saved.board);
      if (!boardLoaded) {
        this.initBoard();
      } else {
        this.checkValidMovesOrReshuffle();
      }

      const state = this.getGameState();
      this.emitStats();
      this.events.emit('game-resumed', { level: this.level, score: this.score, multiplier: state.multiplier });
      this.game?.events?.emit('game-resumed', { level: this.level, score: this.score, multiplier: state.multiplier });
    } else {
      this.resetGameStats();
      this.initBoard();
    }
  }

  /**
   * Reconstitute board tiles and Phaser containers from saved compact data
   */
  private loadSavedBoard(savedBoard: (SavedTileData | null)[][]): boolean {
    if (!savedBoard || savedBoard.length !== BOARD_SIZE) return false;

    // Clear any existing gem containers
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (this.gemContainers[r]) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (this.gemContainers[r][c]) {
            this.gemContainers[r][c]!.destroy();
          }
        }
      }
    }

    this.boardModel = [];
    this.gemContainers = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
      if (!savedBoard[r] || savedBoard[r].length !== BOARD_SIZE) return false;
      this.boardModel[r] = [];
      this.gemContainers[r] = [];

      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = savedBoard[r][c];
        if (!cell) return false;

        const tile: Tile = {
          id: `tile_${r}_${c}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: cell.type,
          special: cell.special || SpecialType.NONE,
          row: r,
          col: c,
          visualRow: r,
          visualCol: c,
          scale: 1,
          alpha: 1,
          rotAngle: 0,
          animFrame: Math.floor(Math.random() * 15),
          animTimer: Math.random() * 2,
          animType: 'idle',
        };

        this.boardModel[r][c] = tile;
        const container = this.createGemContainer(tile, r, c);
        this.gemContainers[r][c] = container;
      }
    }

    return true;
  }

  /**
   * Build serializable snapshot for local persistence
   */
  public buildSaveData(): Omit<SavedGameData, 'version' | 'savedAt'> | null {
    if (this.isGameOver) return null;
    const levelMultiplier = 1 + (this.level - 1) * 0.25;
    const currentMultiplier = Number(
      (levelMultiplier * Math.max(1, this.comboCascade)).toFixed(1)
    );

    return {
      mode: this.mode,
      level: this.level,
      score: this.score,
      multiplier: currentMultiplier,
      comboCascade: this.comboCascade,
      maxComboMultiplier: this.maxCombo,
      progress: this.progress,
      maxProgress: this.maxProgress,
      movesMade: this.movesMade,
      timeRemaining: this.timeRemaining,
      maxTime: this.maxTime,
      board: SaveManager.serializeBoard(this.boardModel),
    };
  }

  /**
   * Trigger local save (immediate or debounced)
   */
  public saveCurrentState(immediate: boolean = false) {
    if (this.isGameOver) return;
    const data = this.buildSaveData();
    if (!data) return;

    if (immediate) {
      SaveManager.saveProgress(data);
    } else {
      SaveManager.requestDebouncedSave(450);
    }
  }

  /**
   * Reset stats and Blitz timer
   */
  private resetGameStats() {
    this.score = 0;
    this.level = 1;
    this.progress = 0;
    this.maxProgress = 1000;
    this.movesMade = 0;
    this.comboCascade = 0;
    this.maxCombo = 1;
    this.isGameOver = false;
    this.isAnimating = false;
    this.selectedCoord = null;
    if (this.selectionBracket) this.selectionBracket.setVisible(false);
    this.clearHints();

    if (this.timerEvent) {
      this.timerEvent.destroy();
      this.timerEvent = null;
    }

    if (this.mode === 'blitz') {
      this.timeRemaining = 60;
      this.maxTime = 60;
      this.timerEvent = this.time.addEvent({
        delay: 1000,
        callback: this.onTimerTick,
        callbackScope: this,
        loop: true,
      });
    } else {
      this.timeRemaining = 0;
      this.maxTime = 0;
    }
  }

  private onTimerTick() {
    if (this.isPaused || this.isGameOver) return;
    this.timeRemaining -= 1;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.handleGameOver();
    } else if (this.timeRemaining % 5 === 0) {
      // Debounced save of Blitz timer on mobile
      this.saveCurrentState(false);
    }
    this.emitStats();
  }

  private handleGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    SaveManager.clearSavedProgress(this.mode);
    this.clearHints();
    if (this.selectionBracket) this.selectionBracket.setVisible(false);
    sound.playGameOver();

    // Broadcast Game Over
    const state = this.getGameState();
    this.emitStats();
    this.events.emit('game-over', state);
    this.game?.events?.emit('game-over', state);
  }

  /**
   * Broadcast state to React HeaderHUD and Modals
   */
  private emitStats() {
    const state = this.getGameState();
    this.events.emit('stats-update', state);
    this.game?.events?.emit('stats-update', state);
  }

  public getGameState(): GameState {
    const levelMultiplier = 1 + (this.level - 1) * 0.25;
    const currentMultiplier = Number(
      (levelMultiplier * Math.max(1, this.comboCascade)).toFixed(1)
    );

    return {
      score: this.score,
      level: this.level,
      progress: this.progress,
      maxProgress: this.maxProgress,
      multiplier: currentMultiplier,
      cascadeCount: this.comboCascade,
      maxComboMultiplier: this.maxCombo,
      timeRemaining: this.timeRemaining,
      maxTime: this.maxTime,
      movesMade: this.movesMade,
      isPaused: this.isPaused,
      isGameOver: this.isGameOver,
      mode: this.mode,
    };
  }

  /**
   * Initialize initial board models and sprites
   */
  private initBoard() {
    // Clear any existing containers
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (this.gemContainers[r]) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (this.gemContainers[r][c]) {
            this.gemContainers[r][c]!.destroy();
          }
        }
      }
    }

    this.boardModel = BoardEngine.createInitialBoard();
    this.gemContainers = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
      this.gemContainers[r] = [];
      for (let c = 0; c < BOARD_SIZE; c++) {
        const tile = this.boardModel[r][c]!;
        const container = this.createGemContainer(tile, r, c);
        this.gemContainers[r][c] = container;
      }
    }
  }

  /**
   * Creates a gem container holding the gem sprite, aura, and special effects
   */
  private createGemContainer(tile: Tile, row: number, col: number): Phaser.GameObjects.Container {
    const cx = this.getCellCenterX(col);
    const cy = this.getCellCenterY(row);

    const container = this.add.container(cx, cy);
    container.setDepth(10);
    container.setData('row', row);
    container.setData('col', col);
    container.setData('tileId', tile.id);
    container.setData('gemType', tile.type);
    container.setData('special', tile.special);

    const gemScale = (this.tileSize * 0.88) / 52;

    // Special aura behind gem
    if (tile.special === SpecialType.FLAME) {
      // Warm fiery glow aura (no circling dots)
      const aura = this.add.image(0, 0, 'gem_glow_flame');
      aura.setDisplaySize(this.tileSize * 1.35, this.tileSize * 1.35);
      aura.setName('aura');
      container.add(aura);

      this.tweens.add({
        targets: aura,
        scale: { from: (this.tileSize * 1.25) / 96, to: (this.tileSize * 1.45) / 96 },
        alpha: { from: 0.7, to: 0.95 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (tile.special === SpecialType.STAR) {
      // Radiant star burst aura
      const aura = this.add.image(0, 0, 'gem_star_aura');
      aura.setDisplaySize(this.tileSize * 1.3, this.tileSize * 1.3);
      aura.setName('aura');
      container.add(aura);

      this.tweens.add({
        targets: aura,
        angle: 360,
        duration: 3000,
        repeat: -1,
        ease: 'Linear',
      });
    }

    // Gem Sprite or Hypercube
    if (tile.special === SpecialType.HYPERCUBE) {
      const hyper = this.add.image(0, 0, 'gem_hypercube');
      hyper.setDisplaySize(this.tileSize * 0.88, this.tileSize * 0.88);
      hyper.setName('gem');
      container.add(hyper);

      this.tweens.add({
        targets: hyper,
        angle: 360,
        duration: 4000,
        repeat: -1,
        ease: 'Linear',
      });
    } else {
      const sprite = this.add.sprite(0, 0, 'gems');
      sprite.setScale(gemScale);
      sprite.setName('gem');
      container.add(sprite);

      // Play idle shine animation with random start frame
      const animKey = `gem_${tile.type}_shine`;
      if (this.anims.exists(animKey)) {
        sprite.play({
          key: animKey,
          startFrame: Math.floor(Math.random() * 15),
        });
      }
    }

    return container;
  }

  private getCellCenterX(col: number): number {
    return this.offsetX + col * this.tileSize + this.tileSize / 2;
  }

  private getCellCenterY(row: number): number {
    return this.offsetY + row * this.tileSize + this.tileSize / 2;
  }

  private repositionAllGems() {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const container = this.gemContainers[r]?.[c];
        if (container) {
          container.setPosition(this.getCellCenterX(c), this.getCellCenterY(r));
          const gemScale = (this.tileSize * 0.88) / 52;
          const gemObj = container.getByName('gem') as Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
          if (gemObj) {
            gemObj.setScale(gemScale);
          }
          const auraObj = container.getByName('aura') as Phaser.GameObjects.Image;
          if (auraObj) {
            auraObj.setDisplaySize(this.tileSize * 1.35, this.tileSize * 1.35);
          }
        }
      }
    }

    if (this.selectedCoord) {
      this.updateSelectionBracket(this.selectedCoord.row, this.selectedCoord.col);
    }
  }

  /**
   * Setup Built-In Pointer Events (unified touch and mouse controls)
   */
  private setupPointerInputs() {
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
  }

  private getGridCoord(x: number, y: number): { row: number; col: number } | null {
    if (
      x < this.offsetX ||
      x >= this.offsetX + this.boardWidth ||
      y < this.offsetY ||
      y >= this.offsetY + this.boardHeight
    ) {
      return null;
    }

    const col = Math.floor((x - this.offsetX) / this.tileSize);
    const row = Math.floor((y - this.offsetY) / this.tileSize);

    if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
      return { row, col };
    }
    return null;
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    if (this.isPaused || this.isGameOver || this.isAnimating) return;

    const coord = this.getGridCoord(pointer.x, pointer.y);
    if (!coord) {
      this.clearSelection();
      return;
    }

    this.isPointerDown = true;
    this.clearHints();

    // Check if we already had a selected tile
    if (this.selectedCoord) {
      const prev = this.selectedCoord;
      // Tapped the same tile -> Deselect
      if (prev.row === coord.row && prev.col === coord.col) {
        this.clearSelection();
        return;
      }

      // Tapped adjacent tile -> Swap!
      if (BoardEngine.isAdjacent(prev.row, prev.col, coord.row, coord.col)) {
        this.clearSelection();
        this.executeSwap(prev.row, prev.col, coord.row, coord.col);
        return;
      }
    }

    // Select the new tile
    this.selectedCoord = coord;
    this.pointerStart = { row: coord.row, col: coord.col, x: pointer.x, y: pointer.y };
    this.updateSelectionBracket(coord.row, coord.col);
    sound.playClick();
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    if (!this.isPointerDown || !this.pointerStart || this.isAnimating || this.isPaused || this.isGameOver) {
      return;
    }

    const dx = pointer.x - this.pointerStart.x;
    const dy = pointer.y - this.pointerStart.y;
    const dist = Math.hypot(dx, dy);

    if (dist >= this.SWIPE_THRESHOLD) {
      const fromR = this.pointerStart.row;
      const fromC = this.pointerStart.col;
      let toR = fromR;
      let toC = fromC;

      // Determine cardinal swipe direction
      if (Math.abs(dx) > Math.abs(dy)) {
        toC += dx > 0 ? 1 : -1;
      } else {
        toR += dy > 0 ? 1 : -1;
      }

      // End pointer drag state
      this.isPointerDown = false;
      this.pointerStart = null;
      this.clearSelection();

      // Check bounds
      if (toR >= 0 && toR < BOARD_SIZE && toC >= 0 && toC < BOARD_SIZE) {
        this.executeSwap(fromR, fromC, toR, toC);
      }
    }
  }

  private handlePointerUp() {
    this.isPointerDown = false;
    this.pointerStart = null;
  }

  private updateSelectionBracket(row: number, col: number) {
    const cx = this.getCellCenterX(col);
    const cy = this.getCellCenterY(row);
    this.selectionBracket.setPosition(cx, cy);
    this.selectionBracket.setDisplaySize(this.tileSize * 1.05, this.tileSize * 1.05);
    this.selectionBracket.setVisible(true);
  }

  private clearSelection() {
    this.selectedCoord = null;
    this.selectionBracket.setVisible(false);
  }

  /**
   * Execute tile swap animation and match resolution
   */
  private executeSwap(r1: number, c1: number, r2: number, c2: number) {
    this.isAnimating = true;
    this.clearSelection();
    sound.playSwap();

    const cont1 = this.gemContainers[r1][c1];
    const cont2 = this.gemContainers[r2][c2];

    if (!cont1 || !cont2) {
      this.isAnimating = false;
      return;
    }

    const pos1 = { x: this.getCellCenterX(c1), y: this.getCellCenterY(r1) };
    const pos2 = { x: this.getCellCenterX(c2), y: this.getCellCenterY(r2) };

    // Bring moving containers to top depth
    cont1.setDepth(15);
    cont2.setDepth(15);

    // Tweens for swapping
    this.tweens.add({
      targets: cont1,
      x: pos2.x,
      y: pos2.y,
      duration: 180,
      ease: 'Cubic.easeInOut',
    });

    this.tweens.add({
      targets: cont2,
      x: pos1.x,
      y: pos1.y,
      duration: 180,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        cont1.setDepth(10);
        cont2.setDepth(10);
        this.handleSwapComplete(r1, c1, r2, c2, cont1, cont2, pos1, pos2);
      },
    });
  }

  private handleSwapComplete(
    r1: number,
    c1: number,
    r2: number,
    c2: number,
    cont1: Phaser.GameObjects.Container,
    cont2: Phaser.GameObjects.Container,
    pos1: { x: number; y: number },
    pos2: { x: number; y: number }
  ) {
    // Check Hypercube activation
    const tile1 = this.boardModel[r1][c1];
    const tile2 = this.boardModel[r2][c2];

    const isHyper1 = tile1?.special === SpecialType.HYPERCUBE;
    const isHyper2 = tile2?.special === SpecialType.HYPERCUBE;

    if (isHyper1 || isHyper2) {
      // Apply swap to model
      this.boardModel[r1][c1] = tile2;
      this.boardModel[r2][c2] = tile1;
      this.gemContainers[r1][c1] = cont2;
      this.gemContainers[r2][c2] = cont1;

      const hyperCoord = isHyper1 ? { row: r2, col: c2 } : { row: r1, col: c1 };
      const targetCoord = isHyper1 ? { row: r1, col: c1 } : { row: r2, col: c2 };

      sound.playHypercube();
      this.movesMade++;
      this.comboCascade = 1;

      const hyperResult = BoardEngine.resolveHypercube(this.boardModel, hyperCoord, targetCoord);
      this.processMatches(hyperResult);
      return;
    }

    // Standard swap test
    // Temporarily swap in model
    this.boardModel[r1][c1] = tile2;
    this.boardModel[r2][c2] = tile1;

    const matches = BoardEngine.findMatches(this.boardModel, { r1, c1, r2, c2 });

    if (!matches || matches.matchedTiles.length === 0) {
      // Invalid Swap: Undo swap in model and tween back
      this.boardModel[r1][c1] = tile1;
      this.boardModel[r2][c2] = tile2;
      sound.playSwapBack();

      this.tweens.add({
        targets: cont1,
        x: pos1.x,
        y: pos1.y,
        duration: 160,
        ease: 'Cubic.easeInOut',
      });

      this.tweens.add({
        targets: cont2,
        x: pos2.x,
        y: pos2.y,
        duration: 160,
        ease: 'Cubic.easeInOut',
        onComplete: () => {
          this.isAnimating = false;
        },
      });
      return;
    }

    // Valid Swap!
    this.gemContainers[r1][c1] = cont2;
    this.gemContainers[r2][c2] = cont1;
    this.movesMade++;
    this.comboCascade = 1;

    this.processMatches(matches);
  }

  /**
   * Process match explosions, special detonations, score increments, and Arcade physics shards
   */
  private processMatches(matchResult: any) {
    const { clearedCoords, specialSpawns, basePoints, flameDetonations, starDetonations } = matchResult;

    // Calculate score points with combo and level scaling
    const levelMultiplier = 1 + (this.level - 1) * 0.25;
    const comboMult = Math.max(1, this.comboCascade);
    const earnedPoints = Math.round(basePoints * levelMultiplier * comboMult);

    this.score += earnedPoints;
    this.progress += earnedPoints;
    if (comboMult > this.maxCombo) {
      this.maxCombo = comboMult;
    }

    // Sound effect with pitch scaling on cascade
    sound.playMatch(this.comboCascade - 1);

    // Detonation sound effects and camera shake
    if (flameDetonations && flameDetonations.length > 0) {
      sound.playDetonate();
      this.cameras.main.shake(200, 0.009);
    }
    if (starDetonations && starDetonations.length > 0) {
      sound.playLaser();
      this.cameras.main.shake(160, 0.007);
    }

    // Floating Combo Text if combo > 1
    if (this.comboCascade > 1) {
      this.showComboBanner(this.comboCascade);
    }

    // Check level-up
    if (this.progress >= this.maxProgress) {
      this.levelUp();
    }

    this.emitStats();
    this.saveCurrentState(false);

    // Cleared set for fast lookup
    const clearedSet = new Set(clearedCoords.map((c: any) => `${c.row},${c.col}`));

    // Spawn special gems at designated coordinates
    const specialMap = new Map<string, { type: GemType; special: SpecialType }>();
    specialSpawns.forEach((s: any) => {
      specialMap.set(`${s.row},${s.col}`, { type: s.type, special: s.special });
    });

    // Arcade Physics Shards & Scale-down animation on matched gems
    const animPromises: Promise<void>[] = [];

    clearedCoords.forEach((coord: { row: number; col: number }) => {
      const container = this.gemContainers[coord.row]?.[coord.col];
      const tile = this.boardModel[coord.row]?.[coord.col];

      if (container && tile) {
        // Explode Arcade Physics Shards
        this.spawnArcadeShards(container.x, container.y, tile.type);

        // Floating points popup with Arcade physics velocity
        this.spawnScorePopup(container.x, container.y, Math.round(earnedPoints / clearedCoords.length));

        // Scale and alpha fade tween
        const p = new Promise<void>((resolve) => {
          this.tweens.add({
            targets: container,
            scale: 0.1,
            alpha: 0,
            angle: Phaser.Math.Between(-90, 90),
            duration: 220,
            ease: 'Back.easeIn',
            onComplete: () => {
              container.destroy();
              resolve();
            },
          });
        });
        animPromises.push(p);

        this.gemContainers[coord.row][coord.col] = null;
        this.boardModel[coord.row][coord.col] = null;
      }
    });

    // Special Detonation Visuals (Laser sweeps for Star, Blast waves for Flame)
    if (starDetonations) {
      starDetonations.forEach((sd: any) => {
        this.drawLaserBeams(sd.row, sd.col);
      });
    }

    // Once all matched gems have finished shrinking and exploding
    Promise.all(animPromises).then(() => {
      // Place new special gems spawned from matches
      specialMap.forEach((spec, key) => {
        const [r, c] = key.split(',').map(Number);
        const newTile: Tile = {
          id: `special_${r}_${c}_${Date.now()}`,
          type: spec.type,
          special: spec.special,
          row: r,
          col: c,
          visualRow: r,
          visualCol: c,
          scale: 1,
          alpha: 1,
          rotAngle: 0,
          animFrame: 0,
          animTimer: 0,
          animType: 'idle',
        };

        this.boardModel[r][c] = newTile;
        const cont = this.createGemContainer(newTile, r, c);
        cont.setScale(0);
        this.gemContainers[r][c] = cont;

        // Pop in special gem
        this.tweens.add({
          targets: cont,
          scale: 1,
          duration: 250,
          ease: 'Back.easeOut',
        });
      });

      // Apply Gravity and Cascade
      this.applyGravity();
    });
  }

  /**
   * Spawn Arcade Physics Shard Particles
   */
  private spawnArcadeShards(x: number, y: number, gemType: GemType) {
    const color = GEM_HEX_COLORS[gemType] ?? 0xffffff;
    const numShards = Phaser.Math.Between(6, 9);

    for (let i = 0; i < numShards; i++) {
      const shard = this.physics.add.image(x, y, 'particle_shard');
      shard.setTint(color);
      shard.setScale(Phaser.Math.FloatBetween(0.8, 1.3));
      shard.setDepth(25);

      const vx = Phaser.Math.Between(-160, 160);
      const vy = Phaser.Math.Between(-240, 40);
      const vRot = Phaser.Math.Between(-350, 350);

      shard.setVelocity(vx, vy);
      shard.setAngularVelocity(vRot);
      shard.setGravityY(550);

      this.tweens.add({
        targets: shard,
        alpha: 0,
        scale: 0.1,
        duration: Phaser.Math.Between(500, 750),
        ease: 'Quad.easeIn',
        onComplete: () => {
          shard.destroy();
        },
      });
    }

    // Soft glowing spark flash
    const spark = this.add.image(x, y, 'particle_spark');
    spark.setDepth(26);
    spark.setTint(color);
    spark.setScale(0.5);

    this.tweens.add({
      targets: spark,
      scale: 1.6,
      alpha: 0,
      duration: 350,
      ease: 'Power2',
      onComplete: () => spark.destroy(),
    });
  }

  /**
   * Spawn Arcade Physics floating score popup
   */
  private spawnScorePopup(x: number, y: number, points: number) {
    if (points <= 0) return;
    const text = this.add.text(x, y, `+${points}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#fef08a',
      stroke: '#0b0914',
      strokeThickness: 3,
    }).setOrigin(0.5);
    text.setDepth(30);

    // Apply Arcade Physics velocity
    this.physics.add.existing(text);
    const body = text.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setVelocityY(-65);
    }

    this.tweens.add({
      targets: text,
      alpha: 0,
      scale: 1.25,
      duration: 750,
      ease: 'Power1',
      onComplete: () => text.destroy(),
    });
  }

  /**
   * Floating Combo Banner
   */
  private showComboBanner(combo: number) {
    const { width } = this.scale;
    let label = `${combo}x COMBO!`;
    let color = '#fbbf24';

    if (combo >= 5) {
      label = `${combo}x UNBELIEVABLE!`;
      color = '#f43f5e';
    } else if (combo === 4) {
      label = `${combo}x INCREDIBLE!`;
      color = '#a855f7';
    } else if (combo === 3) {
      label = `${combo}x SPECTACULAR!`;
      color = '#38bdf8';
    }

    const banner = this.add.text(width / 2, this.offsetY + this.boardHeight / 2, label, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: color,
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);
    banner.setDepth(40);
    banner.setScale(0.5);

    this.tweens.add({
      targets: banner,
      scale: 1.2,
      y: banner.y - 40,
      duration: 600,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: banner,
          alpha: 0,
          scale: 1.4,
          duration: 300,
          onComplete: () => banner.destroy(),
        });
      },
    });
  }

  /**
   * Star Gem Laser Beam graphics
   */
  private drawLaserBeams(row: number, col: number) {
    const cx = this.getCellCenterX(col);
    const cy = this.getCellCenterY(row);

    const laserGraphics = this.add.graphics();
    laserGraphics.setDepth(28);

    // Draw horizontal and vertical laser
    laserGraphics.lineStyle(6, 0xffffff, 1);
    // Horizontal
    laserGraphics.lineBetween(this.offsetX, cy, this.offsetX + this.boardWidth, cy);
    // Vertical
    laserGraphics.lineBetween(cx, this.offsetY, cx, this.offsetY + this.boardHeight);

    // Outer glow
    laserGraphics.lineStyle(14, 0x38bdf8, 0.65);
    laserGraphics.lineBetween(this.offsetX, cy, this.offsetX + this.boardWidth, cy);
    laserGraphics.lineBetween(cx, this.offsetY, cx, this.offsetY + this.boardHeight);

    this.tweens.add({
      targets: laserGraphics,
      alpha: 0,
      duration: 350,
      ease: 'Power2',
      onComplete: () => laserGraphics.destroy(),
    });
  }

  /**
   * Level up progression
   */
  private levelUp() {
    this.level += 1;
    this.progress = 0;
    this.maxProgress = Math.round(this.maxProgress * 1.35);

    sound.playLevelUp();
    this.events.emit('level-up', this.level);
    this.game?.events?.emit('level-up', this.level);
    this.saveCurrentState(true);

    // Floating Level Up text
    const { width } = this.scale;
    const lvlText = this.add.text(width / 2, this.offsetY + this.boardHeight / 2, `LEVEL ${this.level}!`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#facc15',
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5);
    lvlText.setDepth(50);
    lvlText.setScale(0.2);

    this.tweens.add({
      targets: lvlText,
      scale: 1.3,
      duration: 700,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: lvlText,
          alpha: 0,
          y: lvlText.y - 50,
          duration: 500,
          onComplete: () => lvlText.destroy(),
        });
      },
    });
  }

  /**
   * Drop existing gems down into empty holes and fill new gems from top
   */
  private applyGravity() {
    const fallTweens: Promise<void>[] = [];

    for (let c = 0; c < BOARD_SIZE; c++) {
      let emptyRow = BOARD_SIZE - 1;

      // Drop existing gems down
      for (let r = BOARD_SIZE - 1; r >= 0; r--) {
        if (this.boardModel[r][c] !== null) {
          if (r !== emptyRow) {
            // Move tile to emptyRow
            const tile = this.boardModel[r][c]!;
            const container = this.gemContainers[r][c]!;

            this.boardModel[emptyRow][c] = tile;
            this.gemContainers[emptyRow][c] = container;
            this.boardModel[r][c] = null;
            this.gemContainers[r][c] = null;

            tile.row = emptyRow;
            container.setData('row', emptyRow);

            const targetY = this.getCellCenterY(emptyRow);
            const dropDist = emptyRow - r;

            const p = new Promise<void>((resolve) => {
              this.tweens.add({
                targets: container,
                y: targetY,
                duration: 120 + dropDist * 40,
                ease: 'Quad.easeIn',
                onComplete: () => resolve(),
              });
            });
            fallTweens.push(p);
          }
          emptyRow--;
        }
      }

      // Spawn new gems above the board and drop them in
      let spawnOffset = 1;
      for (let r = emptyRow; r >= 0; r--) {
        const randomType = Math.floor(Math.random() * 7) as GemType;
        const newTile: Tile = {
          id: `gem_${r}_${c}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          type: randomType,
          special: SpecialType.NONE,
          row: r,
          col: c,
          visualRow: r,
          visualCol: c,
          scale: 1,
          alpha: 1,
          rotAngle: 0,
          animFrame: 0,
          animTimer: 0,
          animType: 'idle',
        };

        this.boardModel[r][c] = newTile;
        const container = this.createGemContainer(newTile, r, c);
        this.gemContainers[r][c] = container;

        // Position above board
        const startY = this.offsetY - spawnOffset * this.tileSize;
        const targetY = this.getCellCenterY(r);
        container.setY(startY);
        spawnOffset++;

        const p = new Promise<void>((resolve) => {
          this.tweens.add({
            targets: container,
            y: targetY,
            duration: 150 + (emptyRow + 1) * 45,
            ease: 'Quad.easeIn',
            onComplete: () => resolve(),
          });
        });
        fallTweens.push(p);
      }
    }

    // Wait for all gems to land
    Promise.all(fallTweens).then(() => {
      // Check for cascade matches
      const cascadeMatches = BoardEngine.findMatches(this.boardModel);

      if (cascadeMatches && cascadeMatches.matchedTiles.length > 0) {
        this.comboCascade++;
        this.time.delayedCall(80, () => {
          this.processMatches(cascadeMatches);
        });
      } else {
        // Cascade finished! Check if valid moves remain
        this.comboCascade = 0;
        this.isAnimating = false;
        this.emitStats();
        this.checkValidMovesOrReshuffle();
        this.saveCurrentState(true);
      }
    });
  }

  /**
   * Check if any valid moves exist, otherwise trigger animated Reshuffle
   */
  private checkValidMovesOrReshuffle() {
    const validMoves = BoardEngine.findValidMoves(this.boardModel);
    if (validMoves.length === 0 && !this.isGameOver) {
      this.triggerReshuffle();
    }
  }

  private triggerReshuffle() {
    this.isAnimating = true;
    this.clearSelection();
    this.clearHints();

    const { width } = this.scale;
    const banner = this.add.text(width / 2, this.offsetY + this.boardHeight / 2, 'NO MOVES - RESHUFFLE!', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#facc15',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);
    banner.setDepth(45);
    banner.setScale(0.2);

    this.tweens.add({
      targets: banner,
      scale: 1.15,
      duration: 600,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: banner,
          alpha: 0,
          duration: 400,
          onComplete: () => banner.destroy(),
        });
      },
    });

    // Animate all gem containers shrinking and re-emerging with new board layout
    const shrinkTweens: Promise<void>[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cont = this.gemContainers[r][c];
        if (cont) {
          const p = new Promise<void>((resolve) => {
            this.tweens.add({
              targets: cont,
              scale: 0,
              alpha: 0,
              duration: 350,
              ease: 'Back.easeIn',
              onComplete: () => {
                cont.destroy();
                resolve();
              },
            });
          });
          shrinkTweens.push(p);
        }
      }
    }

    Promise.all(shrinkTweens).then(() => {
      this.boardModel = BoardEngine.reshuffle(this.boardModel);
      this.gemContainers = [];

      for (let r = 0; r < BOARD_SIZE; r++) {
        this.gemContainers[r] = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
          const tile = this.boardModel[r][c]!;
          const cont = this.createGemContainer(tile, r, c);
          cont.setScale(0);
          this.gemContainers[r][c] = cont;

          this.tweens.add({
            targets: cont,
            scale: 1,
            alpha: 1,
            duration: 350,
            delay: (r + c) * 25,
            ease: 'Back.easeOut',
          });
        }
      }

      this.time.delayedCall(600, () => {
        this.isAnimating = false;
        this.saveCurrentState(true);
      });
    });
  }

  /**
   * Hint Feature: Highlights two swappable gems with animated pulsing rings
   */
  public triggerHint() {
    if (this.isAnimating || this.isPaused || this.isGameOver) return;
    this.clearHints();

    const validMoves = BoardEngine.findValidMoves(this.boardModel);
    if (validMoves.length === 0) return;

    const move = validMoves[Math.floor(Math.random() * validMoves.length)];
    sound.playHint();

    const cx1 = this.getCellCenterX(move.c1);
    const cy1 = this.getCellCenterY(move.r1);
    const cx2 = this.getCellCenterX(move.c2);
    const cy2 = this.getCellCenterY(move.r2);

    const m1 = this.add.image(cx1, cy1, 'gem_hint_ring');
    m1.setDisplaySize(this.tileSize * 1.05, this.tileSize * 1.05);
    m1.setDepth(22);

    const m2 = this.add.image(cx2, cy2, 'gem_hint_ring');
    m2.setDisplaySize(this.tileSize * 1.05, this.tileSize * 1.05);
    m2.setDepth(22);

    this.hintMarkers = [m1, m2];

    this.tweens.add({
      targets: this.hintMarkers,
      scale: { from: 1.0, to: 1.2 },
      alpha: { from: 0.5, to: 1 },
      duration: 400,
      yoyo: true,
      repeat: 4,
      onComplete: () => {
        this.clearHints();
      },
    });
  }

  private clearHints() {
    this.hintMarkers.forEach((m) => m.destroy());
    this.hintMarkers = [];
  }

  /**
   * External Control Methods from React
   */
  public setPaused(paused: boolean) {
    this.isPaused = paused;
    this.emitStats();
    if (paused) {
      this.saveCurrentState(true);
    }
  }

  public setGameMode(newMode: GameMode) {
    if (this.mode !== newMode) {
      // Save outgoing mode progress
      this.saveCurrentState(true);
      this.mode = newMode;
      SaveManager.saveLastActiveMode(newMode);
      this.initializeGameOrRestore();
      this.emitStats();
    }
  }

  public restartGame() {
    SaveManager.clearSavedProgress(this.mode);
    this.resetGameStats();
    this.initBoard();
    this.emitStats();
  }
}
