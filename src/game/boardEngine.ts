import { GemType, MatchResult, SpecialType, Tile } from '../types';

export const BOARD_SIZE = 8;
export const NUM_GEM_TYPES = 7;

export class BoardEngine {
  public static createEmptyBoard(): (Tile | null)[][] {
    const board: (Tile | null)[][] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      board[r] = [];
      for (let c = 0; c < BOARD_SIZE; c++) {
        board[r][c] = null;
      }
    }
    return board;
  }

  /**
   * Create a fresh random board with no initial matches and guaranteed valid moves
   */
  public static createInitialBoard(): Tile[][] {
    let board: Tile[][];
    let attempts = 0;

    do {
      board = [];
      for (let r = 0; r < BOARD_SIZE; r++) {
        board[r] = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
          const forbidden: Set<GemType> = new Set();
          // Avoid 3-in-a-row horizontally
          if (c >= 2 && board[r][c - 1].type === board[r][c - 2].type) {
            forbidden.add(board[r][c - 1].type);
          }
          // Avoid 3-in-a-row vertically
          if (r >= 2 && board[r - 1][c].type === board[r - 2][c].type) {
            forbidden.add(board[r - 1][c].type);
          }

          const allowed: GemType[] = [];
          for (let g = 0; g < NUM_GEM_TYPES; g++) {
            if (!forbidden.has(g as GemType)) {
              allowed.push(g as GemType);
            }
          }

          const chosenType = allowed[Math.floor(Math.random() * allowed.length)];
          board[r][c] = {
            id: `tile_${r}_${c}_${Math.random().toString(36).substring(2, 8)}`,
            type: chosenType,
            special: SpecialType.NONE,
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
        }
      }
      attempts++;
    } while (this.findValidMoves(board).length === 0 && attempts < 100);

    return board;
  }

  /**
   * Check if two tiles are orthogonally adjacent
   */
  public static isAdjacent(r1: number, c1: number, r2: number, c2: number): boolean {
    const dr = Math.abs(r1 - r2);
    const dc = Math.abs(c1 - c2);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
  }

  /**
   * Find all matches on the board and resolve special creations & detonations
   */
  public static findMatches(
    board: (Tile | null)[][],
    swappedCoords?: { r1: number; c1: number; r2: number; c2: number }
  ): MatchResult | null {
    const horizontalRuns: { row: number; startCol: number; endCol: number; type: GemType }[] = [];
    const verticalRuns: { col: number; startRow: number; endRow: number; type: GemType }[] = [];

    // Horizontal matches
    for (let r = 0; r < BOARD_SIZE; r++) {
      let matchLen = 1;
      for (let c = 0; c < BOARD_SIZE; c++) {
        const curr = board[r][c];
        const next = c < BOARD_SIZE - 1 ? board[r][c + 1] : null;

        if (
          curr &&
          next &&
          curr.special !== SpecialType.HYPERCUBE &&
          next.special !== SpecialType.HYPERCUBE &&
          curr.type === next.type
        ) {
          matchLen++;
        } else {
          if (matchLen >= 3 && curr) {
            horizontalRuns.push({
              row: r,
              startCol: c - matchLen + 1,
              endCol: c,
              type: curr.type,
            });
          }
          matchLen = 1;
        }
      }
    }

    // Vertical matches
    for (let c = 0; c < BOARD_SIZE; c++) {
      let matchLen = 1;
      for (let r = 0; r < BOARD_SIZE; r++) {
        const curr = board[r][c];
        const next = r < BOARD_SIZE - 1 ? board[r + 1][c] : null;

        if (
          curr &&
          next &&
          curr.special !== SpecialType.HYPERCUBE &&
          next.special !== SpecialType.HYPERCUBE &&
          curr.type === next.type
        ) {
          matchLen++;
        } else {
          if (matchLen >= 3 && curr) {
            verticalRuns.push({
              col: c,
              startRow: r - matchLen + 1,
              endRow: r,
              type: curr.type,
            });
          }
          matchLen = 1;
        }
      }
    }

    if (horizontalRuns.length === 0 && verticalRuns.length === 0) {
      return null;
    }

    // Set of matched tile coordinates (row, col)
    const matchedCoords = new Map<string, { row: number; col: number; tile: Tile }>();
    const specialSpawns: { row: number; col: number; type: GemType; special: SpecialType }[] = [];
    let basePoints = 0;

    // Helper to add coords
    const addCoord = (r: number, c: number) => {
      const tile = board[r][c];
      if (tile) {
        matchedCoords.set(`${r},${c}`, { row: r, col: c, tile });
      }
    };

    // Helper to determine where special gem should spawn
    const pickSpawnCoord = (
      coords: { r: number; c: number }[]
    ): { row: number; col: number } => {
      if (swappedCoords) {
        const matchSwapped = coords.find(
          (pt) =>
            (pt.r === swappedCoords.r1 && pt.c === swappedCoords.c1) ||
            (pt.r === swappedCoords.r2 && pt.c === swappedCoords.c2)
        );
        if (matchSwapped) return { row: matchSwapped.r, col: matchSwapped.c };
      }
      // Otherwise pick center
      const mid = Math.floor(coords.length / 2);
      return { row: coords[mid].r, col: coords[mid].c };
    };

    // Check for intersections (T / L shapes -> Star Gem)
    const processedH = new Set<number>();
    const processedV = new Set<number>();

    for (let hIdx = 0; hIdx < horizontalRuns.length; hIdx++) {
      const h = horizontalRuns[hIdx];
      for (let vIdx = 0; vIdx < verticalRuns.length; vIdx++) {
        const v = verticalRuns[vIdx];
        if (
          h.type === v.type &&
          h.row >= v.startRow &&
          h.row <= v.endRow &&
          v.col >= h.startCol &&
          v.col <= h.endCol
        ) {
          // Intersection point!
          const interR = h.row;
          const interC = v.col;
          specialSpawns.push({
            row: interR,
            col: interC,
            type: h.type,
            special: SpecialType.STAR,
          });
          basePoints += 500;
          processedH.add(hIdx);
          processedV.add(vIdx);

          for (let c = h.startCol; c <= h.endCol; c++) addCoord(h.row, c);
          for (let r = v.startRow; r <= v.endRow; r++) addCoord(r, v.col);
        }
      }
    }

    // Process remaining horizontal runs
    horizontalRuns.forEach((h, idx) => {
      if (processedH.has(idx)) return;
      const len = h.endCol - h.startCol + 1;
      const coords: { r: number; c: number }[] = [];
      for (let c = h.startCol; c <= h.endCol; c++) {
        addCoord(h.row, c);
        coords.push({ r: h.row, c });
      }

      if (len >= 5) {
        const spawn = pickSpawnCoord(coords);
        specialSpawns.push({
          row: spawn.row,
          col: spawn.col,
          type: h.type,
          special: SpecialType.HYPERCUBE,
        });
        basePoints += 600;
      } else if (len === 4) {
        const spawn = pickSpawnCoord(coords);
        specialSpawns.push({
          row: spawn.row,
          col: spawn.col,
          type: h.type,
          special: SpecialType.FLAME,
        });
        basePoints += 250;
      } else {
        basePoints += 100;
      }
    });

    // Process remaining vertical runs
    verticalRuns.forEach((v, idx) => {
      if (processedV.has(idx)) return;
      const len = v.endRow - v.startRow + 1;
      const coords: { r: number; c: number }[] = [];
      for (let r = v.startRow; r <= v.endRow; r++) {
        addCoord(r, v.col);
        coords.push({ r, c: v.col });
      }

      if (len >= 5) {
        const spawn = pickSpawnCoord(coords);
        specialSpawns.push({
          row: spawn.row,
          col: spawn.col,
          type: v.type,
          special: SpecialType.HYPERCUBE,
        });
        basePoints += 600;
      } else if (len === 4) {
        const spawn = pickSpawnCoord(coords);
        specialSpawns.push({
          row: spawn.row,
          col: spawn.col,
          type: v.type,
          special: SpecialType.FLAME,
        });
        basePoints += 250;
      } else {
        basePoints += 100;
      }
    });

    // Trigger any special gem detonations present in the matched tiles
    const cleared = new Set<string>();
    const flameDetonations: { row: number; col: number }[] = [];
    const starDetonations: { row: number; col: number }[] = [];

    const queue: { row: number; col: number; tile: Tile }[] = Array.from(matchedCoords.values());

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const key = `${curr.row},${curr.col}`;
      if (cleared.has(key)) continue;
      cleared.add(key);

      // Check for Flame detonation: 3x3 blast
      if (curr.tile.special === SpecialType.FLAME) {
        flameDetonations.push({ row: curr.row, col: curr.col });
        basePoints += 150;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = curr.row + dr;
            const nc = curr.col + dc;
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
              const adjTile = board[nr][nc];
              if (adjTile && !cleared.has(`${nr},${nc}`)) {
                queue.push({ row: nr, col: nc, tile: adjTile });
                basePoints += 40;
              }
            }
          }
        }
      }

      // Check for Star detonation: row & col laser
      if (curr.tile.special === SpecialType.STAR) {
        starDetonations.push({ row: curr.row, col: curr.col });
        basePoints += 250;
        // Clears entire row
        for (let c = 0; c < BOARD_SIZE; c++) {
          const t = board[curr.row][c];
          if (t && !cleared.has(`${curr.row},${c}`)) {
            queue.push({ row: curr.row, col: c, tile: t });
            basePoints += 30;
          }
        }
        // Clears entire col
        for (let r = 0; r < BOARD_SIZE; r++) {
          const t = board[r][curr.col];
          if (t && !cleared.has(`${r},${curr.col}`)) {
            queue.push({ row: r, col: curr.col, tile: t });
            basePoints += 30;
          }
        }
      }
    }

    const matchedTilesList: Tile[] = [];
    const clearedCoordsList: { row: number; col: number }[] = [];

    cleared.forEach((key) => {
      const [r, c] = key.split(',').map(Number);
      const t = board[r][c];
      if (t) {
        matchedTilesList.push(t);
        clearedCoordsList.push({ row: r, col: c });
      }
    });

    return {
      matchedTiles: matchedTilesList,
      specialSpawns,
      clearedCoords: clearedCoordsList,
      basePoints,
      flameDetonations,
      starDetonations,
    };
  }

  /**
   * Handle Hypercube match activation when swapped with target tile
   */
  public static resolveHypercube(
    board: (Tile | null)[][],
    hypercubeCoord: { row: number; col: number },
    targetCoord: { row: number; col: number }
  ): MatchResult {
    const targetTile = board[targetCoord.row][targetCoord.col];
    const clearedCoords: { row: number; col: number }[] = [{ ...hypercubeCoord }];
    const matchedTiles: Tile[] = [];

    const hypercubeTile = board[hypercubeCoord.row][hypercubeCoord.col];
    if (hypercubeTile) matchedTiles.push(hypercubeTile);

    let basePoints = 1000;

    if (!targetTile) {
      return {
        matchedTiles,
        specialSpawns: [],
        clearedCoords,
        basePoints,
        flameDetonations: [],
        starDetonations: [],
      };
    }

    // If swapped with another Hypercube -> clear entire board!
    if (targetTile.special === SpecialType.HYPERCUBE) {
      basePoints += 5000;
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const t = board[r][c];
          if (t) {
            clearedCoords.push({ row: r, col: c });
            matchedTiles.push(t);
          }
        }
      }
    } else {
      // Clear all tiles of targetTile.type
      const targetColor = targetTile.type;
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const t = board[r][c];
          if (t && t.type === targetColor) {
            clearedCoords.push({ row: r, col: c });
            matchedTiles.push(t);
            basePoints += 150;
          }
        }
      }
    }

    return {
      matchedTiles,
      specialSpawns: [],
      clearedCoords,
      basePoints,
      flameDetonations: [],
      starDetonations: [],
      hypercubeColor: targetTile.type,
    };
  }

  /**
   * Check all possible moves on the board
   */
  public static findValidMoves(
    board: (Tile | null)[][]
  ): { r1: number; c1: number; r2: number; c2: number }[] {
    const validMoves: { r1: number; c1: number; r2: number; c2: number }[] = [];

    // Clone board state
    const cloneBoard = (b: (Tile | null)[][]): (Tile | null)[][] => {
      const copy: (Tile | null)[][] = [];
      for (let r = 0; r < BOARD_SIZE; r++) {
        copy[r] = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
          copy[r][c] = b[r][c] ? { ...b[r][c]! } : null;
        }
      }
      return copy;
    };

    // Check horizontal swaps
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE - 1; c++) {
        const t1 = board[r][c];
        const t2 = board[r][c + 1];
        if (!t1 || !t2) continue;

        // Hypercube can swap with anything!
        if (t1.special === SpecialType.HYPERCUBE || t2.special === SpecialType.HYPERCUBE) {
          validMoves.push({ r1: r, c1: c, r2: r, c2: c + 1 });
          continue;
        }

        // Test swap
        const testBoard = cloneBoard(board);
        testBoard[r][c] = { ...t2, row: r, col: c };
        testBoard[r][c + 1] = { ...t1, row: r, col: c + 1 };

        const matches = this.findMatches(testBoard);
        if (matches && matches.matchedTiles.length >= 3) {
          validMoves.push({ r1: r, c1: c, r2: r, c2: c + 1 });
        }
      }
    }

    // Check vertical swaps
    for (let r = 0; r < BOARD_SIZE - 1; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const t1 = board[r][c];
        const t2 = board[r + 1][c];
        if (!t1 || !t2) continue;

        if (t1.special === SpecialType.HYPERCUBE || t2.special === SpecialType.HYPERCUBE) {
          validMoves.push({ r1: r, c1: c, r2: r + 1, c2: c });
          continue;
        }

        const testBoard = cloneBoard(board);
        testBoard[r][c] = { ...t2, row: r, col: c };
        testBoard[r + 1][c] = { ...t1, row: r + 1, col: c };

        const matches = this.findMatches(testBoard);
        if (matches && matches.matchedTiles.length >= 3) {
          validMoves.push({ r1: r, c1: c, r2: r + 1, c2: c });
        }
      }
    }

    return validMoves;
  }

  /**
   * Reshuffle existing tiles without changing types if no moves exist
   */
  public static reshuffle(board: (Tile | null)[][]): Tile[][] {
    // Extract all tiles
    const allTiles: { type: GemType; special: SpecialType }[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const t = board[r][c];
        if (t) {
          allTiles.push({ type: t.type, special: t.special });
        } else {
          allTiles.push({
            type: Math.floor(Math.random() * NUM_GEM_TYPES) as GemType,
            special: SpecialType.NONE,
          });
        }
      }
    }

    // Try shuffling until a valid configuration with no initial matches is found
    for (let attempt = 0; attempt < 200; attempt++) {
      // Fisher-Yates shuffle
      for (let i = allTiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allTiles[i], allTiles[j]] = [allTiles[j], allTiles[i]];
      }

      const newBoard: Tile[][] = [];
      let idx = 0;
      for (let r = 0; r < BOARD_SIZE; r++) {
        newBoard[r] = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
          const item = allTiles[idx++];
          newBoard[r][c] = {
            id: `tile_shuffle_${r}_${c}_${Math.random().toString(36).substring(2, 6)}`,
            type: item.type,
            special: item.special,
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
        }
      }

      // Check if this shuffle has zero immediate matches and at least 1 valid move
      const immediateMatches = this.findMatches(newBoard);
      if (!immediateMatches && this.findValidMoves(newBoard).length > 0) {
        return newBoard;
      }
    }

    // Fallback: create fresh board
    return this.createInitialBoard();
  }
}
