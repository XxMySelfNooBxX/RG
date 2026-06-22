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
        <div className="fixed bottom-0 left-0 w-full p-4 bg-[#0a0e27]/95 border-t border-[#00ff88] z-50 backdrop-blur-sm">
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-4 font-mono text-[#00ff88] uppercase tracking-wider text-sm">
                <div className="flex flex-col justify-between w-full md:w-1/4 min-w-[200px]">
                    <span className="mb-2 block font-bold">CONNECTIONS: {connectionCount}</span>
                    <button 
                        onClick={handleSubmit}
                        disabled={!isValid || isPending}
                        className="w-full border border-[#00ff88] px-4 py-2 hover:bg-[#00ff88] hover:text-[#0a0e27] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#00ff88] transition-colors rounded-none font-bold"
                    >
                        {isPending ? 'SUBMITTING...' : 'SUBMIT THEORY'}
                    </button>
                </div>
                <div className="w-full flex-1">
                    <textarea 
                        value={theoryText}
                        onChange={(e) => setTheoryText(e.target.value)}
                        placeholder="What's your theory? Connect the clues..."
                        maxLength={280}
                        minLength={10}
                        className="w-full h-full min-h-[80px] bg-transparent border border-[#00ff88] text-[#00ff88] p-2 focus:outline-none focus:ring-1 focus:ring-[#00ff88] resize-none"
                    />
                </div>
            </div>
            {submitMutation.isError && (
                <div className="max-w-5xl mx-auto mt-2 text-red-500 font-mono text-xs uppercase">
                    Error submitting theory: {submitMutation.error.message}
                </div>
            )}
        </div>
    );
};
