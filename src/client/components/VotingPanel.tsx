import React, { useState, useEffect } from 'react';
import { trpc } from '../utils/trpc';

type VotingPanelProps = {
  dayNumber: number;
  onViewResults: () => void;
};

export const VotingPanel: React.FC<VotingPanelProps> = ({ dayNumber, onViewResults }) => {
  const [activeTab, setActiveTab] = useState<'theories' | 'leaderboard'>('theories');

  // Local state to track which theories the user has voted for today (backed up in localStorage)
  const [localVotes, setLocalVotes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`voted_theories_${dayNumber}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync localVotes with localStorage
  useEffect(() => {
    localStorage.setItem(`voted_theories_${dayNumber}`, JSON.stringify(localVotes));
  }, [localVotes, dayNumber]);

  // Queries
  const { data: theories = [], isLoading: theoriesLoading, refetch: refetchTheories } = 
    trpc.getTheories.useQuery({ dayNumber });

  const { data: leaderboard = [], isLoading: leaderboardLoading } = 
    trpc.getDailyLeaderboard.useQuery({ dayNumber });

  // Mutation
  const upvoteMutation = trpc.upvoteTheory.useMutation({
    onSuccess: (_data, variables) => {
      // Add to local votes so button disables
      setLocalVotes(prev => [...prev, variables.theorySId]);
      // Refetch theories list to show updated count
      refetchTheories();
    },
    onError: (err) => {
      console.error('Failed to upvote:', err);
    }
  });

  const handleUpvote = (theorySId: string) => {
    if (localVotes.includes(theorySId)) return;
    upvoteMutation.mutate({ dayNumber, theorySId });
  };

  return (
    <div className="fixed bottom-0 left-0 w-full h-[40vh] bg-[#1a1f2e] border-t-2 border-[#6366f1] z-40 flex flex-col shadow-[0_-8px_32px_rgba(99,102,241,0.15)] select-none">
      
      {/* Panel Tab Controls */}
      <div className="flex justify-between items-center bg-[#0f1419] border-b border-[#6366f1]/30 px-4 py-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('theories')}
            className={`px-4 py-1.5 rounded text-xs font-bold uppercase transition-all ${
              activeTab === 'theories'
                ? 'bg-[#6366f1] text-[#f0f4f8] shadow-md shadow-[#6366f1]/20'
                : 'text-[#cbd5e1] hover:text-[#f0f4f8] hover:bg-[#6366f1]/10'
            }`}
          >
            🗳️ Today's Theories
          </button>
          
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-1.5 rounded text-xs font-bold uppercase transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-[#6366f1] text-[#f0f4f8] shadow-md shadow-[#6366f1]/20'
                : 'text-[#cbd5e1] hover:text-[#f0f4f8] hover:bg-[#6366f1]/10'
            }`}
          >
            🏆 Leaderboard
          </button>
        </div>

        <button
          onClick={onViewResults}
          className="px-4 py-1.5 bg-[#ec4899]/10 border border-[#ec4899] text-[#ec4899] hover:bg-[#ec4899] hover:text-white rounded text-xs font-bold uppercase transition-all shadow-md hover:shadow-[#ec4899]/25"
        >
          🔎 View Solution
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#1a1f2e]">
        {activeTab === 'theories' ? (
          /* THEORIES LIST */
          theoriesLoading ? (
            <div className="h-full flex items-center justify-center text-sm text-[#cbd5e1] animate-pulse">
              FETCHING THEORIES...
            </div>
          ) : theories.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-sm text-[#cbd5e1] gap-2">
              <span className="text-2xl">📝</span>
              <p>No theories submitted yet today.</p>
              <p className="text-xs text-[#cbd5e1]/50">Be the first to submit your theory above!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {theories.map((theory, idx) => {
                const isConsensus = idx === 0 && theory.votes > 0;
                const theoryId = theory.username; // Author username
                const hasVoted = localVotes.includes(theoryId);

                return (
                  <div
                    key={theory.id}
                    className="flex items-center justify-between p-3 bg-[#0f1419] border border-[#6366f1]/20 rounded-md hover:border-[#6366f1]/50 hover:bg-[#6366f1]/5 transition-all group"
                  >
                    {/* Left: Rank, Name, and Text */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <span className={`font-black text-sm w-6 ${
                        idx === 0 ? 'text-[#fbbf24]' :
                        idx === 1 ? 'text-[#cbd5e1]' :
                        idx === 2 ? 'text-[#ec4899]' : 'text-[#cbd5e1]/40'
                      }`}>
                        #{idx + 1}
                      </span>
                      
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#f0f4f8] truncate">
                            {theory.username}
                          </span>
                          
                          {isConsensus && (
                            <span className="bg-[#fbbf24] text-[#0f1419] text-[9px] px-1.5 py-0.5 rounded font-black tracking-wide animate-pulse">
                              🏆 COMMUNITY CONSENSUS
                            </span>
                          )}
                        </div>
                        
                        {/* Theory Text (Truncated to 100 chars) */}
                        <p className="text-xs text-[#cbd5e1] mt-0.5 leading-relaxed truncate pr-4">
                          {theory.theory.length > 100 
                            ? `${theory.theory.substring(0, 100)}...` 
                            : theory.theory
                          }
                        </p>
                      </div>
                    </div>

                    {/* Right: Upvote Button */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-[#cbd5e1]/70">
                        {theory.votes} vote{theory.votes !== 1 ? 's' : ''}
                      </span>

                      <button
                        onClick={() => handleUpvote(theoryId)}
                        disabled={hasVoted || upvoteMutation.isPending}
                        className={`px-3 py-1 rounded text-xs font-bold uppercase transition-all border ${
                          hasVoted
                            ? 'bg-[#10b981]/20 border-[#10b981] text-[#10b981] cursor-not-allowed'
                            : 'bg-transparent border-[#ec4899] text-[#ec4899] hover:bg-[#ec4899] hover:text-white hover:shadow-lg hover:shadow-[#ec4899]/20'
                        }`}
                      >
                        {hasVoted ? '✓ Voted' : '▲ Upvote'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* LEADERBOARD LIST */
          leaderboardLoading ? (
            <div className="h-full flex items-center justify-center text-sm text-[#cbd5e1] animate-pulse">
              LOADING LEADERBOARD...
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-sm text-[#cbd5e1] gap-2">
              <span className="text-2xl">🏆</span>
              <p>No leaderboard entries yet today.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-w-xl mx-auto">
              {leaderboard.map((entry, idx) => (
                <div
                  key={entry.username}
                  className="flex items-center justify-between p-2.5 bg-[#0f1419] border border-[#6366f1]/20 rounded-md"
                >
                  <div className="flex items-center gap-4">
                    <span className={`font-black text-sm w-6 ${
                      idx === 0 ? 'text-[#fbbf24]' :
                      idx === 1 ? 'text-[#cbd5e1]' :
                      idx === 2 ? 'text-[#ec4899]' : 'text-[#cbd5e1]/40'
                    }`}>
                      #{idx + 1}
                    </span>
                    
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-[#f0f4f8]">
                        {entry.username}
                      </span>
                      <span className="text-[9px] text-[#cbd5e1]/60">
                        {entry.rank}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/20 px-2.5 py-0.5 rounded">
                    {entry.score} pts
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};
