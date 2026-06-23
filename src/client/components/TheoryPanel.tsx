import React, { useState } from 'react';
import { trpc } from '../utils/trpc';

type TheoryPanelProps = {
    caseId: string;
    connections: { clueA_id: string; clueB_id: string }[];
    onSuccess: (data: any, theory: string) => void;
};

export const TheoryPanel: React.FC<TheoryPanelProps> = ({ caseId, connections, onSuccess }) => {
    const [theoryText, setTheoryText] = useState('');
    const submitMutation = trpc.submitTheory.useMutation({
        onSuccess: (data) => {
            onSuccess(data, theoryText);
        }
    });

    const connectionCount = connections.length;
    const isValid = theoryText.length >= 10 && connectionCount > 0;
    const isPending = submitMutation.isPending;

    const handleSubmit = () => {
        if (!isValid || isPending) return;
        submitMutation.mutate({
            caseId,
            theory: theoryText,
            connections,
            timestamp: Date.now()
        });
    };

    return (
        <div className="absolute bottom-0 left-0 w-full z-50 flex flex-col pointer-events-none">
            {/* Theory Input & Connections Section (Pointer events enabled here) */}
            <div className="w-full max-w-5xl mx-auto px-4 mb-4 flex flex-col md:flex-row justify-between items-end gap-4 pointer-events-auto">
                <div className="bg-[var(--secondary-dark)] border-2 border-[var(--accent-primary)] rounded-md px-4 py-2 shadow-lg">
                    <span className="font-bold text-[var(--accent-primary)] text-sm">CONNECTIONS: {connectionCount}</span>
                </div>
                
                <div className="flex w-full md:w-2/3 lg:w-1/2 bg-[var(--secondary-dark)] border-2 border-[var(--accent-primary)] rounded-md p-2 shadow-lg focus-within:border-[var(--accent-secondary)] focus-within:shadow-[0_0_12px_rgba(236,72,153,0.3)] transition-all">
                    <textarea 
                        value={theoryText}
                        onChange={(e) => setTheoryText(e.target.value)}
                        placeholder="What's your theory? Connect the clues..."
                        maxLength={280}
                        minLength={10}
                        className="w-full min-h-[50px] bg-transparent text-[var(--text-secondary)] text-[13px] outline-none resize-none px-2"
                    />
                    <button 
                        onClick={handleSubmit}
                        disabled={!isValid || isPending}
                        className="ml-2 bg-[var(--accent-primary)] text-[var(--text-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-50 disabled:cursor-not-allowed rounded-md px-5 py-2 font-bold text-[12px] whitespace-nowrap transition-colors"
                    >
                        {isPending ? 'SUBMITTING...' : 'SUBMIT THEORY'}
                    </button>
                </div>
            </div>

            {/* Fixed Footer Instructions */}
            <div className="w-full h-[60px] bg-[var(--secondary-dark)] border-t border-[var(--accent-primary)] flex justify-center items-center pointer-events-auto">
                <div className="text-[12px] text-[var(--text-secondary)] font-sans flex items-center gap-2">
                    <span className="text-[var(--accent-secondary)]">DRAG FROM PINK PEG TO CONNECT</span>
                    <span className="opacity-50">|</span>
                    <span>RIGHT-CLICK STRING TO DELETE</span>
                </div>
            </div>

            {submitMutation.isError && (
                <div className="absolute bottom-[70px] right-4 bg-red-500 text-white text-xs px-3 py-1 rounded-md shadow-md">
                    Error submitting theory: {submitMutation.error.message}
                </div>
            )}
        </div>
    );
};
