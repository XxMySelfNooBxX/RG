import React, { useEffect, useState } from 'react';
import { DailyCase } from '../../shared/types';

type ResultPanelProps = {
  caseData: DailyCase;
  playerTheory: string;
  playerScore: number;
  evidenceConnected: number;
  totalEvidence: number;
  playerConnections: Array<{ clueA_id: string; clueB_id: string }>;
  rankData: {
      casesSolved: number;
      currentRank: string;
      nextRank: string;
      progressPercent: number;
      casesToNext: number;
  };
  onClose: () => void;
};

export const ResultPanel: React.FC<ResultPanelProps> = ({
  caseData,
  playerTheory,
  playerScore,
  evidenceConnected,
  totalEvidence,
  playerConnections,
  rankData,
  onClose
}) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    // Calculate case Release timestamp to find the next midnight UTC
    const startDate = new Date('2026-06-17T00:00:00Z');
    const startUTC = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
    const nextCaseTimestamp = startUTC + (caseData.dayNumber) * 24 * 60 * 60 * 1000;

    const timer = setInterval(() => {
      const now = Date.now();
      const diff = nextCaseTimestamp - now;
      if (diff <= 0) {
        setTimeLeft('00:00:00');
        clearInterval(timer);
        return;
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [caseData.dayNumber]);

  // Map evidence clue IDs to titles
  const getClueTitle = (id: string) => {
      const clue = caseData.clues.find((c: any) => c.id === id);
      return clue ? clue.title : id;
  };

  const getEvidenceMapping = () => {
      const evidenceList = caseData.evidenceClueIds.map((evidenceId: string) => {
          // Check if this evidence ID is part of the player's connections
          const connectedClue = playerConnections.find(conn => conn.clueA_id === evidenceId || conn.clueB_id === evidenceId);
          if (connectedClue) {
              const otherId = connectedClue.clueA_id === evidenceId ? connectedClue.clueB_id : connectedClue.clueA_id;
              return {
                  id: evidenceId,
                  title: getClueTitle(evidenceId),
                  status: 'connected',
                  connectedTo: getClueTitle(otherId)
              };
          }
          return {
              id: evidenceId,
              title: getClueTitle(evidenceId),
              status: 'missed'
          };
      });
      return evidenceList;
  };

  const evidenceMapping = getEvidenceMapping();

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0e27]/95 backdrop-blur-md overflow-y-auto flex flex-col items-center py-10 px-4 text-[#00ff88] font-mono">
        <h1 className="font-display text-4xl mb-8 uppercase tracking-widest text-[#00ff88]">CASE CLOSED</h1>
        
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 border border-[#00ff88] p-6 mb-8">
            {/* Left Column */}
            <div className="flex flex-col gap-6">
                <div>
                    <h2 className="font-bold text-xl mb-2 border-b border-[#00ff88] pb-1 uppercase">Your Theory</h2>
                    <p className="italic bg-[#00ff88]/10 p-4 border-l-4 border-[#00ff88]">{playerTheory}</p>
                </div>
                <div>
                    <h2 className="font-bold text-xl mb-2 border-b border-[#00ff88] pb-1 uppercase">Evidence Status</h2>
                    <p className="mb-2 font-bold">EVIDENCE CONNECTED: {evidenceConnected}/{totalEvidence}</p>
                    <ul className="flex flex-col gap-2">
                        {evidenceMapping.map((ev: any) => (
                            <li key={ev.id} className="text-sm">
                                {ev.status === 'connected' 
                                    ? <span className="text-green-400 font-bold">✅ {ev.title} connected to {ev.connectedTo}</span>
                                    : <span className="text-red-500 font-bold">❌ {ev.title} not connected</span>
                                }
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="mt-auto">
                    <h2 className="font-bold text-2xl text-center p-4 border border-[#00ff88] bg-[#00ff88]/5">SCORE: {playerScore}</h2>
                </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-6">
                <div>
                    <h2 className="font-bold text-xl mb-2 border-b border-[#00ff88] pb-1 uppercase">Official Solution</h2>
                    <p className="leading-relaxed">{caseData.solution}</p>
                </div>
                <div>
                    <h2 className="font-bold text-xl mb-2 border-b border-[#00ff88] pb-1 uppercase">Key Evidence</h2>
                    <ul className="list-disc list-inside">
                        {caseData.evidenceClueIds.map((id: string) => (
                            <li key={id}>{getClueTitle(id)}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>

        {/* Rank Progression */}
        <div className="w-full max-w-5xl flex flex-col gap-2 mb-8">
            <div className="flex justify-between font-bold uppercase">
                <span>DETECTIVE RANK: {rankData.currentRank}</span>
                <span>{rankData.nextRank === 'MAX RANK' ? 'MAX RANK ACHIEVED' : `NEXT: ${rankData.nextRank} (${rankData.casesToNext} cases)`}</span>
            </div>
            <div className="w-full h-4 border border-[#00ff88]">
                <div 
                    className="bg-[#00ff88] h-full transition-all duration-1000" 
                    style={{ width: `${rankData.progressPercent}%` }}
                ></div>
            </div>
        </div>

        {/* Action Button & Timer */}
        <div className="flex flex-col items-center gap-4 mt-auto">
            <button 
                onClick={onClose}
                className="border border-[#00ff88] px-8 py-3 text-lg font-bold hover:bg-[#00ff88] hover:text-[#0a0e27] transition-colors"
            >
                RETURN TO BOARD
            </button>
            <div className="text-sm font-bold opacity-80">
                NEXT CASE UNLOCKS IN: {timeLeft || '--:--:--'}
            </div>
        </div>
    </div>
  );
};
