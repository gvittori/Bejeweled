import { GameMode, LeaderboardEntry } from '../types';

const LEADERBOARD_KEY = 'bejeweled_leaderboard_';

const DEFAULT_SCORES: Record<GameMode, { name: string; score: number; level: number; maxMultiplier: number }[]> = {
  classic: [
    { name: 'CrystalKing', score: 45200, level: 8, maxMultiplier: 6 },
    { name: 'GemMaster', score: 32800, level: 6, maxMultiplier: 5 },
    { name: 'NovaSpark', score: 24500, level: 5, maxMultiplier: 4 },
    { name: 'DiamondDust', score: 18900, level: 4, maxMultiplier: 3 },
    { name: 'Bejeweler', score: 12400, level: 3, maxMultiplier: 2 },
  ],
  blitz: [
    { name: 'SpeedDemon', score: 28400, level: 4, maxMultiplier: 7 },
    { name: 'HyperSwapper', score: 22100, level: 3, maxMultiplier: 5 },
    { name: 'ComboCraze', score: 16800, level: 3, maxMultiplier: 4 },
    { name: 'BlitzAce', score: 11200, level: 2, maxMultiplier: 3 },
    { name: 'FlashGem', score: 7900, level: 2, maxMultiplier: 2 },
  ],
  zen: [
    { name: 'ZenSeeker', score: 68400, level: 12, maxMultiplier: 8 },
    { name: 'LotusDream', score: 51200, level: 9, maxMultiplier: 6 },
    { name: 'HarmonicGlow', score: 38900, level: 7, maxMultiplier: 5 },
    { name: 'ChillGamer', score: 27500, level: 5, maxMultiplier: 4 },
    { name: 'Serenity', score: 15300, level: 3, maxMultiplier: 3 },
  ],
};

export function getLeaderboard(mode: GameMode): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY + mode);
    if (!raw) {
      // Seed with initial high scores
      const initial: LeaderboardEntry[] = DEFAULT_SCORES[mode].map((s, idx) => ({
        id: `seed_${mode}_${idx}`,
        playerName: s.name,
        score: s.score,
        level: s.level,
        maxMultiplier: s.maxMultiplier,
        mode,
        date: new Date(Date.now() - (idx + 1) * 86400000).toLocaleDateString(),
      }));
      localStorage.setItem(LEADERBOARD_KEY + mode, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => b.score - a.score);
    }
  } catch (e) {
    console.error('Failed to load leaderboard:', e);
  }
  return [];
}

export function isHighScore(score: number, mode: GameMode): boolean {
  if (score <= 0) return false;
  const current = getLeaderboard(mode);
  if (current.length < 10) return true;
  return score > current[current.length - 1].score;
}

export function saveLeaderboardScore(
  playerName: string,
  score: number,
  level: number,
  maxMultiplier: number,
  mode: GameMode
): { rank: number; entries: LeaderboardEntry[] } {
  const current = getLeaderboard(mode);
  const newEntry: LeaderboardEntry = {
    id: 'entry_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    playerName: (playerName.trim() || 'Player 1').slice(0, 16),
    score,
    level,
    maxMultiplier: Math.max(1, maxMultiplier),
    mode,
    date: new Date().toLocaleDateString(),
  };

  const updated = [...current, newEntry].sort((a, b) => b.score - a.score).slice(0, 10);

  try {
    localStorage.setItem(LEADERBOARD_KEY + mode, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save score:', e);
  }

  const rank = updated.findIndex((e) => e.id === newEntry.id) + 1;
  return { rank, entries: updated };
}

export function clearLeaderboard(mode: GameMode): LeaderboardEntry[] {
  try {
    localStorage.removeItem(LEADERBOARD_KEY + mode);
  } catch {
    // ignore
  }
  return getLeaderboard(mode);
}
