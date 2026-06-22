import React, { useEffect, useState } from 'react';
import { PhaserContainer } from './PhaserContainer';
import { EventBus } from '../game/EventBus';
import { getCaseForDate } from '../../shared/utils/date';
import { TheoryPanel } from './TheoryPanel';
import { ResultPanel } from './ResultPanel';
import { LeaderboardPanel } from './LeaderboardPanel';
import { trpc } from '../utils/trpc';

export const App: React.FC = () => {
    // We only call getCaseForDate once on mount to avoid unnecessary recalculations
    const [dailyCase] = useState(() => getCaseForDate(new Date()));
    const [connections, setConnections] = useState<{ clueA_id: string; clueB_id: string }[]>([]);
    const [backstoryOpen, setBackstoryOpen] = useState(false);
    
    // UI States
    const [showResultPanel, setShowResultPanel] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [newCaseAvailable, setNewCaseAvailable] = useState(false);
    
    // Data States
    const [postGameData, setPostGameData] = useState<any>(null);

    // Fetch user's theory for today's case
    const { data: submissionData, isSuccess: theorySuccess, isFetched: theoryFetched } = trpc.getTheory.useQuery({ caseId: dailyCase.id });
    const { data: progressData, isSuccess: progressSuccess } = trpc.getPlayerProgress.useQuery(undefined, {
        enabled: theorySuccess && !!submissionData
    });

    useEffect(() => {
        const handleSceneReady = () => {
            EventBus.emit('case-loaded', dailyCase);
            // Once scene is ready, if we fetched existing connections, restore them
            if (theorySuccess && submissionData && submissionData.connections && progressSuccess && progressData) {
                EventBus.emit('restore-connections', submissionData.connections);
                setConnections(submissionData.connections);
                
                // Set post game data
                setPostGameData({
                    score: submissionData.score,
                    evidenceConnected: submissionData.evidenceConnected,
                    totalEvidence: submissionData.totalEvidence,
                    theory: submissionData.theory,
                    rankData: progressData
                });
                
                // Freeze board and highlight
                EventBus.emit('show-results', { 
                    evidenceClueIds: dailyCase.evidenceClueIds, 
                    connections: submissionData.connections 
                });
                
                // Enter post-game state
                setShowLeaderboard(true);
            }
        };

        const handleConnectionsChanged = (newConnections: { clueA_id: string; clueB_id: string }[]) => {
            setConnections(newConnections);
        };

        EventBus.on('scene-ready', handleSceneReady);
        EventBus.on('connections-changed', handleConnectionsChanged);

        return () => {
            EventBus.off('scene-ready', handleSceneReady);
            EventBus.off('connections-changed', handleConnectionsChanged);
        };
    }, [dailyCase, theorySuccess, submissionData, progressSuccess, progressData]);

    useEffect(() => {
        // Midnight Rollover Timer
        const startDate = new Date('2026-06-17T00:00:00Z');
        const startUTC = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
        const nextCaseTimestamp = startUTC + (dailyCase.dayNumber) * 24 * 60 * 60 * 1000;

        const timer = setInterval(() => {
            if (Date.now() >= nextCaseTimestamp) {
                setNewCaseAvailable(true);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [dailyCase.dayNumber]);

    const handleSubmissionSuccess = (data: any, theory: string) => {
        setPostGameData({
            score: data.score,
            evidenceConnected: data.evidenceConnected,
            totalEvidence: data.totalEvidence,
            theory: theory,
            rankData: data.rankData
        });
        
        EventBus.emit('show-results', { 
            evidenceClueIds: dailyCase.evidenceClueIds, 
            connections 
        });

        setShowResultPanel(true);
    };

    const handleCloseResultPanel = () => {
        setShowResultPanel(false);
        setShowLeaderboard(true);
    };

    return (
        <div className="w-screen h-screen flex flex-col items-center p-4 bg-[#0a0e27] text-[#00ff88] font-mono relative overflow-hidden">
            {/* NEW CASE AVAILABLE Banner */}
            {newCaseAvailable && (
                <div className="absolute top-0 left-0 w-full z-[100] bg-[#ff3366] text-[#0a0e27] py-2 flex justify-center items-center gap-4 font-bold font-display uppercase">
                    <span>A NEW CASE HAS BEEN UNLOCKED.</span>
                    <button 
                        onClick={() => window.location.reload()}
                        className="bg-[#0a0e27] text-[#ff3366] px-4 py-1 hover:bg-white hover:text-[#0a0e27] transition-colors"
                    >
                        LOAD NEW CASE
                    </button>
                </div>
            )}

            {/* Header Area */}
            <div className={`w-full max-w-5xl mb-4 flex flex-col gap-2 ${newCaseAvailable ? 'mt-8' : ''} z-10`}>
                <h1 className="font-display text-2xl uppercase tracking-widest text-[#00ff88]">
                    CASE #{dailyCase.dayNumber}: {dailyCase.title}
                </h1>
                
                <div className="w-full border border-[#00ff88]">
                    <button 
                        className="w-full text-left p-2 font-bold uppercase hover:bg-[#00ff88] hover:text-[#0a0e27] transition-colors flex justify-between"
                        onClick={() => setBackstoryOpen(!backstoryOpen)}
                    >
                        <span>📖 BACKSTORY</span>
                        <span>{backstoryOpen ? '[-]' : '[+]'}</span>
                    </button>
                    {backstoryOpen && (
                        <div className="p-4 border-t border-[#00ff88] text-sm leading-relaxed">
                            {dailyCase.backstory}
                        </div>
                    )}
                </div>
            </div>

            {/* Game Board */}
            <div className="w-full max-w-5xl aspect-video border border-[#00ff88] relative bg-dark flex-shrink-0 z-0">
                <PhaserContainer />
            </div>

            {/* UI Overlays */}
            {theoryFetched && !postGameData && (
                <TheoryPanel 
                    caseId={dailyCase.id} 
                    connections={connections} 
                    onSuccess={handleSubmissionSuccess}
                />
            )}

            {showLeaderboard && (
                <LeaderboardPanel 
                    caseId={dailyCase.id} 
                    onViewResults={() => setShowResultPanel(true)} 
                />
            )}

            {showResultPanel && postGameData && (
                <ResultPanel
                    caseData={dailyCase}
                    playerTheory={postGameData.theory}
                    playerScore={postGameData.score}
                    evidenceConnected={postGameData.evidenceConnected}
                    totalEvidence={postGameData.totalEvidence}
                    playerConnections={connections}
                    rankData={postGameData.rankData}
                    onClose={handleCloseResultPanel}
                />
            )}
        </div>
    );
};
