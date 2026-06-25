import React from 'react';
import { trpc } from '../utils/trpc';
import { COSMETIC_CARDS } from '../../shared/data/cosmetics';

type PlayerProfileProps = {
  onClose: () => void;
  username: string;
};

export const PlayerProfile: React.FC<PlayerProfileProps> = ({ onClose, username }) => {
  const { data: progress, isLoading } = trpc.getPlayerProgress.useQuery();

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1419]/90 backdrop-blur-sm">
        <div className="text-[var(--accent-primary)] text-xl font-bold animate-pulse">
          LOADING DOSSIER...
        </div>
      </div>
    );
  }

  const casesSolved = progress?.casesSolved ?? 0;
  const currentRankStr = progress?.currentRank ?? '🔰 Rookie';
  const nextRank = progress?.nextRank ?? 'MAX RANK';
  const progressPercent = progress?.progressPercent ?? 100;
  const casesToNext = progress?.casesToNext ?? 0;
  const unlockedCardIds = progress?.evidenceCards ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1419]/95 backdrop-blur-md p-4 animate-fade-in">
      {/* Profile Card Container */}
      <div className="w-full max-w-2xl bg-[#1a1f2e] border-2 border-[#6366f1] rounded-lg p-6 relative flex flex-col max-h-[90vh] overflow-y-auto shadow-2xl shadow-[#6366f1]/10">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#cbd5e1] hover:text-[#ec4899] text-xl font-bold transition-colors"
        >
          ✕
        </button>

        {/* Title */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-extrabold tracking-wider text-[#f0f4f8] border-b border-[#6366f1] pb-3 inline-block">
            🕵️ DETECTIVE DOSSIER
          </h2>
        </div>

        {/* Profile Info & Badge */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-[#0f1419] p-4 rounded-md border border-[#6366f1]/30 mb-6 gap-4">
          <div className="flex flex-col items-center sm:items-start">
            <span className="text-sm text-[#cbd5e1] uppercase tracking-widest font-semibold">Active Investigator</span>
            <span className="text-xl font-bold text-[#f0f4f8]">{username}</span>
          </div>
          
          <div className="bg-[#fbbf24] text-[#0f1419] px-4 py-2 rounded-md font-bold flex items-center gap-2 shadow-lg shadow-[#fbbf24]/20">
            <span className="text-lg">{currentRankStr}</span>
          </div>
        </div>

        {/* Statistics & Rank Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm font-semibold text-[#cbd5e1] mb-2 uppercase">
            <span>Rank Progression</span>
            <span>{casesSolved} Cases Solved</span>
          </div>

          {/* Custom Progress Bar */}
          <div className="w-full bg-[#0f1419] border border-[#6366f1]/50 rounded-full h-4 overflow-hidden relative mb-2">
            <div
              className="bg-gradient-to-r from-[#6366f1] to-[#ec4899] h-full rounded-full transition-all duration-500 shadow-[0_0_8px_#6366f1]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-[#cbd5e1]">
            <span>Current Rank</span>
            {nextRank !== 'MAX RANK' ? (
              <span>{casesToNext} more case{casesToNext > 1 ? 's' : ''} to reach <strong className="text-[#ec4899]">{nextRank}</strong></span>
            ) : (
              <span className="text-[#fbbf24] font-bold">MAXIMUM RANK ACHIEVED</span>
            )}
          </div>
        </div>

        {/* Evidence Card Collection (Cosmetics Grid) */}
        <div className="flex-1 min-h-0">
          <h3 className="text-md font-extrabold tracking-wider text-[#f0f4f8] uppercase mb-4 flex items-center gap-2">
            <span>🏆 EVIDENCE COLLECTION</span>
            <span className="text-xs text-[#cbd5e1] bg-[#6366f1]/20 px-2 py-0.5 rounded-full border border-[#6366f1]/30">
              {unlockedCardIds.length} / {COSMETIC_CARDS.length}
            </span>
          </h3>

          {/* Grid of Cosmetics */}
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 p-2 bg-[#0f1419] rounded-md border border-[#6366f1]/30 overflow-y-auto max-h-[30vh]">
            {COSMETIC_CARDS.map((card) => {
              const isUnlocked = unlockedCardIds.includes(card.id);
              
              return (
                <div
                  key={card.id}
                  className={`flex flex-col items-center justify-center p-2 rounded border transition-all duration-300 relative group ${
                    isUnlocked
                      ? 'bg-[#1a1f2e] border-[#6366f1] hover:border-[#ec4899] hover:scale-105 shadow-md shadow-[#6366f1]/5'
                      : 'bg-[#1a1f2e]/20 border-dashed border-[#cbd5e1]/10 opacity-30 select-none'
                  }`}
                >
                  {/* Emoji display */}
                  <span className="text-3xl mb-1 filter drop-shadow">
                    {isUnlocked ? card.emoji : '🔒'}
                  </span>
                  
                  {/* Miniature card details */}
                  <span className="text-[9px] text-center font-semibold text-[#cbd5e1] line-clamp-1 w-full uppercase">
                    {isUnlocked ? card.name : 'Locked'}
                  </span>

                  {/* Tooltip on Hover */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none w-32">
                    <div className="bg-[#0f1419] border border-[#6366f1] text-[#f0f4f8] text-[10px] rounded p-2 shadow-xl text-center">
                      <p className="font-bold text-[#f0f4f8]">{card.name}</p>
                      <p className={`font-semibold mt-0.5 ${
                        card.rarity === 'Legendary' ? 'text-[#fbbf24]' :
                        card.rarity === 'Epic' ? 'text-[#ec4899]' :
                        card.rarity === 'Rare' ? 'text-[#6366f1]' : 'text-[#cbd5e1]'
                      }`}>
                        {card.rarity}
                      </p>
                      {!isUnlocked && <p className="text-[8px] text-[#ef4444] mt-1">Solve cases to unlock!</p>}
                    </div>
                    <div className="w-2 h-2 bg-[#0f1419] border-r border-b border-[#6366f1] rotate-45 -mt-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-[#cbd5e1] border-t border-[#6366f1]/20 pt-4">
          Evidence cards are awarded randomly for each solved daily case. Collect them all!
        </div>
      </div>
    </div>
  );
};
