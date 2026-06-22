import React, { useEffect } from 'react';
import { PhaserContainer } from './PhaserContainer';
import { EventBus } from '../game/EventBus';
import { CASE_TEMPLATES } from '../../shared/data/cases';

export const App: React.FC = () => {
    useEffect(() => {
        const handleSceneReady = () => {
            const defaultCase = CASE_TEMPLATES[0];
            if (defaultCase) {
                EventBus.emit('case-loaded', defaultCase);
            }
        };

        EventBus.on('scene-ready', handleSceneReady);

        return () => {
            EventBus.off('scene-ready', handleSceneReady);
        };
    }, []);

    return (
        <div className="w-screen h-screen flex flex-col items-center justify-center p-4">
            <h1 className="text-accent font-display text-2xl mb-4 uppercase tracking-widest">Caseboard System</h1>
            <div className="w-full max-w-5xl aspect-video border-brutal relative bg-dark">
                <PhaserContainer />
            </div>
        </div>
    );
};
