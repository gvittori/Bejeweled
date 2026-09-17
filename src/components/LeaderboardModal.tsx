import React, { useState } from 'react';
import { Trophy, Medal, X, RotateCcw } from 'lucide-react';
import { clearLeaderboard, getLeaderboard } from '../game/leaderboard';
import { GameMode, LeaderboardEntry } from '../types';

interface LeaderboardModalProps {
  isOpen: boolean;
  currentMode: GameMode;
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  currentMode,
  onClose,
}) => {
  const [selectedTab, setSelectedTab] = useState<GameMode>(currentMode);
  const [entries, setEntries] = useState<LeaderboardEntry[]>(() => getLeaderboard(currentMode));

  if (!isOpen) return null;

  const handleTabChange = (mode: GameMode) => {
    setSelectedTab(mode);
    setEntries(getLeaderboard(mode));
  };

  const handleClear = () => {
    if (window.confirm(`Reset the local ${selectedTab.toUpperCase()} leaderboard?`)) {
      const reset = clearLeaderboard(selectedTab);
      setEntries(reset);
    }
  };

  return (
    <div
      id="leaderboard-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl overflow-hidden text-slate-200">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-amber-500/20 text-amber-400">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Hall of Fame</h2>
              <p className="text-xs text-slate-400">Local high scores on this device</p>
            </div>
          </div>
          <button
            id="close-leaderboard-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center justify-center gap-1.5 my-4 bg-slate-950 p-1.5 rounded-2xl border border-slate-800/80">
          {(['classic', 'blitz', 'zen'] as GameMode[]).map((mode) => (
            <button
              key={mode}
              id={`tab-btn-${mode}`}
              onClick={() => handleTabChange(mode)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                selectedTab === mode
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-amber-500/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Leaderboard Table List */}
        <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
          {entries.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">No scores recorded yet. Play a game!</div>
          ) : (
            entries.map((entry, index) => {
              const isTop3 = index < 3;
              const medalColor =
                index === 0
                  ? 'text-amber-400 bg-amber-400/20 border-amber-400/40'
                  : index === 1
                  ? 'text-slate-300 bg-slate-300/20 border-slate-300/40'
                  : 'text-amber-600 bg-amber-600/20 border-amber-600/40';

              return (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                    index === 0
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-slate-800/50 border-slate-800/80 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs border ${
                        isTop3 ? medalColor : 'text-slate-500 bg-slate-800 border-slate-700'
                      }`}
                    >
                      {isTop3 ? <Medal className="w-4 h-4" /> : index + 1}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-100 leading-tight">
                        {entry.playerName}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        <span>Lvl {entry.level}</span>
                        <span>•</span>
                        <span>x{entry.maxMultiplier} Multi</span>
                        <span>•</span>
                        <span>{entry.date}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-black text-base text-amber-400 tracking-tight">
                      {entry.score.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-800">
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-400 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset {selectedTab}</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-xs tracking-wider uppercase hover:opacity-95 active:scale-95 transition-all shadow-md shadow-amber-500/25"
          >
            Back to Game
          </button>
        </div>
      </div>
    </div>
  );
};
