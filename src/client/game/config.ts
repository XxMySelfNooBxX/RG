import { AUTO, Scale, Types } from 'phaser';
import { BoardScene } from './scenes/BoardScene';

export const gameConfig: Types.Core.GameConfig = {
    type: AUTO,
    parent: 'game-container',
    backgroundColor: '#0a0e27',
    scale: {
        mode: Scale.RESIZE,
        width: '100%',
        height: '100%',
    },
    scene: [
        BoardScene
    ]
};
