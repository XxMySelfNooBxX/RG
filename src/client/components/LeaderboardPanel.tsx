import React from 'react';
import { trpc } from '../utils/trpc';

type LeaderboardPanelProps = {
    caseId: string;
    onViewResults: () => void;
};

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({ caseId, onViewResults }) => {
    const { data: leaderboard, isLoading, isError } = trpc.getLeaderboard.useQuery({ caseId });

    return (
        <div className="fixed bottom-0 left-0 w-full h-[40vh] bg-[var(--primary-dark)]/95 border-t-2 border-[var(--accent-primary)] z-40 transform transition-transform duration-500 overflow-y-auto p-4 font-sans text-[var(--text-primary)] shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
            <div className="max-w-5xl mx-auto flex flex-col h-full gap-4">
                <div className="flex justify-between items-center border-b border-[var(--accent-primary)] pb-2">
                    <h2 className="text-xl font-bold uppercase tracking-widest text-[var(--accent-primary)]">TOP DETECTIVES</h2>
                    <button 
                        onClick={onViewResults}
                        className="bg-[var(--accent-primary)] px-4 py-2 text-sm font-bold hover:bg-[var(--accent-secondary)] transition-colors rounded-md shadow-md"
                    >
                        VIEW RESULTS
                    </button>
                </div>
                
                {isLoading && <div>LOADING RECORDS...</div>}
                {isError && <div className="text-[var(--error)]">FAILED TO LOAD RECORDS</div>}
                
                {leaderboard && leaderboard.length === 0 && (
                    <div>NO THEORIES SUBMITTED YET.</div>
                )}
                
                {leaderboard && leaderboard.length > 0 && (
                    <div className="flex-1 overflow-y-auto rounded-md border border-[var(--accent-primary)] bg-[var(--secondary-dark)]">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[var(--accent-primary)]/20 sticky top-0 text-[var(--accent-secondary)]">
                                <tr>
                                    <th className="p-3 w-16">RANK</th>
                                    <th className="p-3">DETECTIVE</th>
                                    <th className="p-3 text-right">SCORE</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.map((entry: any, idx: number) => (
                                    <tr key={idx} className="border-b border-[var(--accent-primary)]/20 hover:bg-[var(--accent-primary)]/10 transition-colors">
                                        <td className="p-3 font-bold text-[var(--accent-primary)]">{idx + 1}</td>
                                        <td className="p-3">{entry.username}</td>
                                        <td className="p-3 text-right font-bold text-[var(--gold)]">{entry.score}</td>
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
