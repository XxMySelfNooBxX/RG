import React from 'react';
import { trpc } from '../utils/trpc';

type LeaderboardPanelProps = {
    caseId: string;
    onViewResults: () => void;
};

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({ caseId, onViewResults }) => {
    const { data: leaderboard, isLoading, isError } = trpc.getLeaderboard.useQuery({ caseId });

    return (
        <div className="fixed bottom-0 left-0 w-full h-[40vh] bg-[#0a0e27]/95 border-t border-[#00ff88] z-40 transform transition-transform duration-500 overflow-y-auto p-4 font-mono text-[#00ff88]">
            <div className="max-w-5xl mx-auto flex flex-col h-full gap-4">
                <div className="flex justify-between items-center border-b border-[#00ff88] pb-2">
                    <h2 className="font-display text-xl uppercase tracking-widest">TOP DETECTIVES</h2>
                    <button 
                        onClick={onViewResults}
                        className="border border-[#00ff88] px-4 py-1 text-sm font-bold hover:bg-[#00ff88] hover:text-[#0a0e27] transition-colors"
                    >
                        VIEW RESULTS
                    </button>
                </div>
                
                {isLoading && <div>LOADING RECORDS...</div>}
                {isError && <div className="text-red-500">FAILED TO LOAD RECORDS</div>}
                
                {leaderboard && leaderboard.length === 0 && (
                    <div>NO THEORIES SUBMITTED YET.</div>
                )}
                
                {leaderboard && leaderboard.length > 0 && (
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#00ff88]/10 sticky top-0">
                                <tr>
                                    <th className="p-2 w-16">RANK</th>
                                    <th className="p-2">DETECTIVE</th>
                                    <th className="p-2 text-right">SCORE</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.map((entry: any, idx: number) => (
                                    <tr key={idx} className="border-b border-[#00ff88]/30 hover:bg-[#00ff88]/5">
                                        <td className="p-2 font-bold">{idx + 1}</td>
                                        <td className="p-2">{entry.username}</td>
                                        <td className="p-2 text-right font-bold">{entry.score}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
