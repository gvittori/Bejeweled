/**
 * Local Progress Persistence Manager
 * Specially optimized for mobile lifecycle (visibilitychange, pagehide, freeze)
 * to reliably preserve level, score, multiplier, progress, and board state.
 */

import { GameMode, GemType, SpecialType, Tile } from '../types';

export interface SavedTileData {
  type: GemType;
  special: SpecialType;
}

export interface SavedGameData {
  version: number;
  mode: GameMode;
  level: number;
  score: number;
  multiplier: number;
  comboCascade: number;
  maxComboMultiplier: number;
  progress: number;
  maxProgress: number;
  movesMade: number;
  timeRemaining: number;
  maxTime: number;
  board: (SavedTileData | null)[][];
  savedAt: number;
}

const SAVE_KEY_PREFIX = 'bejeweled_save_v1_';
const LAST_MODE_KEY = 'bejeweled_last_mode_v1';

// In-memory fallback if localStorage is disabled or throws QuotaExceededError
const memoryFallback = new Map<string, string>();

function safeStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? memoryFallback.get(key) ?? null;
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

function safeStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    memoryFallback.set(key, value);
    return true;
  } catch (e) {
    try {
      memoryFallback.set(key, value);
    } catch {
      // ignore
    }
    return false;
  }
}

function safeStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
  memoryFallback.delete(key);
}

export class SaveManager {
  private static saveProvider: (() => Omit<SavedGameData, 'version' | 'savedAt'> | null) | null = null;
  private static listenersAttached: boolean = false;
  private static autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Save game progress locally
   */
  public static saveProgress(data: Omit<SavedGameData, 'version' | 'savedAt'>): boolean {
    if (!data || data.score < 0 || data.level < 1) {
      return false;
    }

    const payload: SavedGameData = {
      ...data,
      version: 1,
      savedAt: Date.now(),
    };

    const key = SAVE_KEY_PREFIX + data.mode;
    const serialized = JSON.stringify(payload);
    const success = safeStorageSet(key, serialized);

    this.saveLastActiveMode(data.mode);
    return success;
  }

  /**
   * Load saved game progress for a given mode
   */
  public static loadProgress(mode: GameMode): SavedGameData | null {
    const key = SAVE_KEY_PREFIX + mode;
    const raw = safeStorageGet(key);
    if (!raw) return null;

    try {
      const data = JSON.parse(raw) as SavedGameData;
      // Validate schema integrity
      if (
        data &&
        data.version === 1 &&
        data.mode === mode &&
        typeof data.level === 'number' &&
        data.level >= 1 &&
        typeof data.score === 'number' &&
        data.score >= 0 &&
        typeof data.multiplier === 'number' &&
        Array.isArray(data.board) &&
        data.board.length === 8
      ) {
        return data;
      }
    } catch (e) {
      console.warn('Failed to parse saved game progress:', e);
    }
    return null;
  }

  /**
   * Check if a valid saved game exists for the mode
   */
  public static hasSavedProgress(mode: GameMode): boolean {
    return this.loadProgress(mode) !== null;
  }

  /**
   * Remove saved progress (e.g. after Game Over or explicit Restart)
   */
  public static clearSavedProgress(mode: GameMode): void {
    const key = SAVE_KEY_PREFIX + mode;
    safeStorageRemove(key);
  }

  /**
   * Remember the last played game mode
   */
  public static saveLastActiveMode(mode: GameMode): void {
    safeStorageSet(LAST_MODE_KEY, mode);
  }

  /**
   * Retrieve the last played game mode, defaulting to 'classic'
   */
  public static loadLastActiveMode(): GameMode {
    const stored = safeStorageGet(LAST_MODE_KEY);
    if (stored === 'classic' || stored === 'blitz' || stored === 'zen') {
      return stored;
    }
    return 'classic';
  }

  /**
   * Compact board model into serializable format
   */
  public static serializeBoard(boardModel: (Tile | null)[][]): (SavedTileData | null)[][] {
    return boardModel.map((row) =>
      row.map((cell) => {
        if (!cell) return null;
        return {
          type: cell.type,
          special: cell.special,
        };
      })
    );
  }

  /**
   * Register a state provider to trigger on mobile lifecycle events
   * (visibilitychange, pagehide, freeze, beforeunload)
   */
  public static registerLifecycleProvider(
    provider: () => Omit<SavedGameData, 'version' | 'savedAt'> | null
  ): () => void {
    this.saveProvider = provider;

    if (!this.listenersAttached && typeof window !== 'undefined') {
      this.attachLifecycleListeners();
      this.listenersAttached = true;
    }

    return () => {
      if (this.saveProvider === provider) {
        this.saveProvider = null;
      }
    };
  }

  /**
   * Immediately flush whatever state is available in the provider
   */
  public static flushImmediate(): void {
    if (!this.saveProvider) return;
    try {
      const data = this.saveProvider();
      if (data) {
        this.saveProgress(data);
      }
    } catch (e) {
      console.warn('Error during immediate flush of game progress:', e);
    }
  }

  /**
   * Debounced save to prevent excessive localStorage writes during rapid cascades
   */
  public static requestDebouncedSave(delayMs: number = 600): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveTimer = setTimeout(() => {
      this.flushImmediate();
      this.autoSaveTimer = null;
    }, delayMs);
  }

  private static attachLifecycleListeners(): void {
    // 1. Mobile Visibility State: Fires when switching browser tabs, opening another app,
    // lockscreen activation, or home screen navigation.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          SaveManager.flushImmediate();
        }
      });

      // Page Lifecycle API freeze event (supported on modern Chromium & Android)
      document.addEventListener('freeze', () => {
        SaveManager.flushImmediate();
      });
    }

    // 2. Mobile Pagehide: Standardized across iOS Mobile Safari & Chrome for tab closing or navigation
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => {
        SaveManager.flushImmediate();
      });

      // 3. Desktop/Standard BeforeUnload
      window.addEventListener('beforeunload', () => {
        SaveManager.flushImmediate();
      });
    }
  }
}
