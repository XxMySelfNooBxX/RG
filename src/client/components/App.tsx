import React, { useEffect, useState } from 'react';
import { PhaserContainer } from './PhaserContainer';
import { EventBus } from '../game/EventBus';
import { getCaseForDate } from '../../shared/utils/date';
import { TheoryPanel } from './TheoryPanel';
import { trpc } from '../utils/trpc';

export const App: React.FC = () => {
    // We only call getCaseForDate once on mount to avoid unnecessary recalculations
    const [dailyCase] = useState(() => getCaseForDate(new Date()));
    const [connections, setConnections] = useState<{ clueA_id: string; clueB_id: string }[]>([]);
    const [backstoryOpen, setBackstoryOpen] = useState(false);
    
    // Fetch user's theory for today's case
    const { data: submissionData, isSuccess, isFetched } = trpc.getTheory.useQuery({ caseId: dailyCase.id });

    useEffect(() => {
        const handleSceneReady = () => {
            EventBus.emit('case-loaded', dailyCase);
            // Once scene is ready, if we fetched existing connections, restore them
            if (isSuccess && submissionData && submissionData.connections) {
                EventBus.emit('restore-connections', submissionData.connections);
                setConnections(submissionData.connections);
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
    }, [dailyCase, isSuccess, submissionData]);

    return (
        <div className="w-screen h-screen flex flex-col items-center p-4 bg-[#0a0e27] text-[#00ff88] font-mono relative overflow-hidden">
            {/* Header Area */}
            <div className="w-full max-w-5xl mb-4 z-10 flex flex-col gap-2">
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

            {/* Theory Panel (Fixed Overlay at bottom) */}
            {isFetched && (
                <TheoryPanel 
                    caseId={dailyCase.id} 
                    connections={connections} 
                    submissionData={submissionData || null} 
                />
            )}
        </div>
    );
};
