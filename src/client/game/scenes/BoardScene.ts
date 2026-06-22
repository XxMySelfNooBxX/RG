import Phaser, { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { CaseTemplate } from '../../../shared/types';

type CardNode = {
    id: string;
    title: string;
    type: 'clue' | 'suspect';
};

type Connection = {
    clueA_id: string;
    clueB_id: string;
};

// Pure math helper to calculate distance from a point to a line segment
// This avoids any Phaser version-specific discrepancies for Line geometry
function getDistanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export class BoardScene extends Scene {
    private cards: Map<string, Phaser.GameObjects.Container> = new Map();
    private connections: Connection[] = [];
    private isDrawingString: boolean = false;
    private sourceCardId: string | null = null;
    private previewLine: Phaser.GameObjects.Graphics | null = null;
    private connectionsGraphics: Phaser.GameObjects.Graphics | null = null;
    private uiHintText: Phaser.GameObjects.Text | null = null;

    constructor() {
        super('BoardScene');
    }

    create() {
        // Disable context menu for right-click handling
        if (this.input.mouse) {
            this.input.mouse.disableContextMenu();
        }

        // Initialize graphics layers
        this.connectionsGraphics = this.add.graphics();
        this.previewLine = this.add.graphics();

        // UI Hint Overlay (Brutalist style)
        this.uiHintText = this.add.text(400, 560, 'DRAG FROM RED PIN TO CONNECT | RIGHT-CLICK STRING TO DELETE', {
            fontFamily: '"Courier Prime", monospace',
            fontSize: '12px',
            color: '#00ff88',
            backgroundColor: '#0a0e27',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5);
        this.uiHintText.setStroke('#00ff88', 0.5);

        // Clear existing state
        this.cards.forEach(card => card.destroy());
        this.cards.clear();
        this.connections = [];

        // Global pointer drag handling
        this.input.on('dragstart', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
            if (gameObject.getData('isCardBackground')) {
                const container = gameObject.parentContainer;
                if (container) {
                    container.setData('dragStartX', container.x);
                    container.setData('dragStartY', container.y);
                    container.setData('pointerStartX', pointer.worldX);
                    container.setData('pointerStartY', pointer.worldY);
                }
            }
        });

        this.input.on('drag', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
            if (gameObject.getData('isCardBackground')) {
                const container = gameObject.parentContainer;
                if (container) {
                    const startX = container.getData('dragStartX');
                    const startY = container.getData('dragStartY');
                    const pStartX = container.getData('pointerStartX');
                    const pStartY = container.getData('pointerStartY');
                    
                    container.x = startX + (pointer.worldX - pStartX);
                    container.y = startY + (pointer.worldY - pStartY);
                    this.drawConnections();
                }
            }
        });

        // Global pointermove for connection line hover calculations
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.isDrawingString && this.sourceCardId) {
                this.updatePreviewString(pointer.worldX, pointer.worldY);
            }
            this.drawConnections();
        });

        // Global pointerup to finish drawing connections
        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (this.isDrawingString) {
                this.finishDrawingString(pointer);
            }
        });

        // Right-click deletion listener
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown()) {
                this.handleRightClickDelete(pointer.worldX, pointer.worldY);
            }
        });

        // EventBus handshake listeners
        const handleCaseLoaded = (caseData: CaseTemplate) => {
            this.spawnCards(caseData);
        };
        EventBus.on('case-loaded', handleCaseLoaded);

        // Clean up EventBus listeners on scene shutdown
        this.events.on('shutdown', () => {
            EventBus.off('case-loaded', handleCaseLoaded);
        });

        // Signal to React wrapper that scene is ready to receive case data
        EventBus.emit('scene-ready');
    }

    private spawnCards(caseData: CaseTemplate) {
        // Clear current elements
        this.cards.forEach(card => card.destroy());
        this.cards.clear();
        this.connections = [];
        this.connectionsGraphics?.clear();

        const nodes: CardNode[] = [
            ...caseData.clues.map(c => ({ id: c.id, title: c.title, type: 'clue' as const })),
            ...caseData.suspects.map(s => ({ id: s.id, title: s.name, type: 'suspect' as const }))
        ];

        const N = nodes.length;
        const centerX = 400;
        const centerY = 270;
        const radius = 170;

        nodes.forEach((node, index) => {
            const angle = (index * 2 * Math.PI) / N;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            this.createCard(node, x, y);
        });
    }

    private createCard(node: CardNode, x: number, y: number) {
        const width = 140;
        const height = 90;

        const container = this.add.container(x, y);

        // Brutalist Card Background
        const bg = this.add.rectangle(0, 0, width, height, 0x1a1f3a);
        bg.setStrokeStyle(0.5, 0x00ff88, 0.8);
        bg.setData('isCardBackground', true);

        // Make background interactive for dragging
        bg.setInteractive({ useHandCursor: true });
        this.input.setDraggable(bg);

        // Header Title (Courier Prime)
        const typeLabel = this.add.text(0, -32, node.type.toUpperCase(), {
            fontFamily: '"Courier Prime", monospace',
            fontSize: '10px',
            color: node.type === 'clue' ? '#00ff88' : '#ff3366',
        }).setOrigin(0.5);

        // Content Text (JetBrains Mono)
        const contentText = this.add.text(0, 5, node.title, {
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '11px',
            color: '#00ff88',
            align: 'center',
            wordWrap: { width: width - 20, useAdvancedWrap: true }
        }).setOrigin(0.5);

        // Connection Pin (Visible red dot at top center)
        const pin = this.add.circle(0, -height / 2, 6, 0xff3366);
        pin.setStrokeStyle(1, 0xffffff, 0.8);
        pin.setInteractive({ useHandCursor: true });
        
        // Make the pin pulse/glow on hover
        pin.on('pointerover', () => {
            pin.setStrokeStyle(2, 0xffffff, 1);
            pin.setRadius(8);
        });
        pin.on('pointerout', () => {
            pin.setStrokeStyle(1, 0xffffff, 0.8);
            pin.setRadius(6);
        });

        // Hover effects on border glow
        bg.on('pointerover', () => {
            bg.setStrokeStyle(2.5, 0x00ff88, 1);
        });

        bg.on('pointerout', () => {
            bg.setStrokeStyle(0.5, 0x00ff88, 0.8);
        });

        // String drawing start handlers
        pin.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.leftButtonDown()) {
                this.startDrawingString(node.id);
            }
        });

        container.add([bg, typeLabel, contentText, pin]);
        this.cards.set(node.id, container);
    }

    private startDrawingString(cardId: string) {
        this.isDrawingString = true;
        this.sourceCardId = cardId;
    }

    private updatePreviewString(x: number, y: number) {
        if (!this.previewLine || !this.sourceCardId) return;

        const sourceCard = this.cards.get(this.sourceCardId);
        if (!sourceCard) return;

        // Line starts from card top center
        const startX = sourceCard.x;
        const startY = sourceCard.y - 45;

        this.previewLine.clear();
        this.previewLine.lineStyle(2, 0xff3366, 0.8);
        this.previewLine.strokeLineShape(new Phaser.Geom.Line(startX, startY, x, y));
    }

    private finishDrawingString(pointer: Phaser.Input.Pointer) {
        this.isDrawingString = false;
        this.previewLine?.clear();

        if (!this.sourceCardId) return;

        // Detect if pointer was released near any other card's snap point or over its body
        let targetCardId: string | null = null;

        for (const [cardId, card] of this.cards.entries()) {
            if (cardId === this.sourceCardId) continue;

            const targetX = card.x;
            const targetY = card.y - 45; // top center

            const distance = Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, targetX, targetY);

            // Find the card background rectangle inside the container to check for pointer overlap
            const bg = card.list.find(obj => obj.getData && obj.getData('isCardBackground')) as Phaser.GameObjects.Rectangle | undefined;
            const isOverCardBody = bg ? bg.getBounds().contains(pointer.worldX, pointer.worldY) : false;

            if (distance < 45 || isOverCardBody) { // Snapping threshold or card body overlap
                targetCardId = cardId;
                break;
            }
        }

        if (targetCardId) {
            // Check if connection already exists
            const duplicate = this.connections.some(conn => 
                (conn.clueA_id === this.sourceCardId && conn.clueB_id === targetCardId) ||
                (conn.clueA_id === targetCardId && conn.clueB_id === this.sourceCardId)
            );

            if (!duplicate) {
                this.connections.push({
                    clueA_id: this.sourceCardId,
                    clueB_id: targetCardId
                });
                EventBus.emit('connections-ready', this.connections);
            }
        }

        this.sourceCardId = null;
        this.drawConnections();
    }

    private handleRightClickDelete(x: number, y: number) {
        let deleted = false;

        for (let i = this.connections.length - 1; i >= 0; i--) {
            const conn = this.connections[i]!;
            const cardA = this.cards.get(conn.clueA_id);
            const cardB = this.cards.get(conn.clueB_id);

            if (cardA && cardB) {
                const distance = getDistanceToSegment(x, y, cardA.x, cardA.y - 45, cardB.x, cardB.y - 45);

                if (distance < 10) { // 10px deletion tolerance
                    this.connections.splice(i, 1);
                    deleted = true;
                    break;
                }
            }
        }

        if (deleted) {
            this.drawConnections();
            EventBus.emit('connections-ready', this.connections);
        }
    }

    private drawConnections() {
        if (!this.connectionsGraphics) return;

        this.connectionsGraphics.clear();

        const pointer = this.input.activePointer;

        this.connections.forEach(conn => {
            const cardA = this.cards.get(conn.clueA_id);
            const cardB = this.cards.get(conn.clueB_id);

            if (cardA && cardB) {
                const startX = cardA.x;
                const startY = cardA.y - 45;
                const endX = cardB.x;
                const endY = cardB.y - 45;

                const line = new Phaser.Geom.Line(startX, startY, endX, endY);
                const distance = getDistanceToSegment(pointer.worldX, pointer.worldY, startX, startY, endX, endY);

                if (distance < 10) {
                    // Glow connection string on hover
                    this.connectionsGraphics!.lineStyle(5, 0x00ff88, 0.4);
                    this.connectionsGraphics!.strokeLineShape(line);
                    this.connectionsGraphics!.lineStyle(2, 0x00ff88, 1);
                    this.connectionsGraphics!.strokeLineShape(line);
                } else {
                    // Normal red detective string
                    this.connectionsGraphics!.lineStyle(2, 0xff3366, 0.85);
                    this.connectionsGraphics!.strokeLineShape(line);
                }
            }
        });
    }
}
