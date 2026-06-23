import Phaser, { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { DailyCase, ClueType } from '../../../shared/types';

type CardNode = {
    id: string;
    title: string;
    type: ClueType;
    content: string;
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
    private currentTooltip: Phaser.GameObjects.Container | null = null;
    private currentPinTooltip: Phaser.GameObjects.Container | null = null;
    private activeCardId: string | null = null;
    private isFrozen: boolean = false;

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
            if (this.isFrozen) return;
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
            if (this.isFrozen) return;
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

                    // Tooltip follows card
                    const cardId = gameObject.getData('cardId');
                    if (this.currentTooltip && this.activeCardId === cardId) {
                        this.currentTooltip.x = container.x;
                        this.currentTooltip.y = container.y - 50;
                    }
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
        const handleCaseLoaded = (caseData: DailyCase) => {
            this.spawnCards(caseData);
        };
        EventBus.on('case-loaded', handleCaseLoaded);

        const handleRestore = (connections: Connection[]) => {
            this.restoreConnections(connections);
        };
        EventBus.on('restore-connections', handleRestore);

        const handleShowResults = ({ evidenceClueIds, connections }: { evidenceClueIds: string[], connections: Connection[] }) => {
            this.highlightEvidenceConnections(evidenceClueIds, connections);
        };
        EventBus.on('show-results', handleShowResults);

        // Clean up EventBus listeners on scene shutdown
        this.events.on('shutdown', () => {
            EventBus.off('case-loaded', handleCaseLoaded);
            EventBus.off('restore-connections', handleRestore);
            EventBus.off('show-results', handleShowResults);
        });

        // Signal to React wrapper that scene is ready to receive case data
        EventBus.emit('scene-ready');
    }

    private spawnCards(caseData: DailyCase) {
        // Clear current elements
        this.cards.forEach(card => card.destroy());
        this.cards.clear();
        this.connections = [];
        this.connectionsGraphics?.clear();

        const nodes: CardNode[] = caseData.clues.map(c => ({
            id: c.id,
            title: c.title,
            type: c.type,
            content: c.content || ''
        }));

        const N = nodes.length;
        const centerX = 400;
        const centerY = 400; // Updated Center Y
        const radius = 180; // Updated Radius

        nodes.forEach((node, index) => {
            const angle = (index * 2 * Math.PI) / N;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            this.createCard(node, x, y);
        });
    }

    private createCard(node: CardNode, x: number, y: number) {
        const width = 140;
        const height = 80; // Updated Height

        const container = this.add.container(x, y);

        // Brutalist Card Background
        const bg = this.add.rectangle(0, 0, width, height, 0x1a1f3a);
        bg.setStrokeStyle(1, 0x00ff88, 1); // Updated Border
        bg.setData('isCardBackground', true);
        bg.setData('cardNode', node);
        bg.setData('cardId', node.id);

        // Make background interactive for dragging
        bg.setInteractive({ useHandCursor: true });
        this.input.setDraggable(bg);

        // Icon Header - Top Right Corner
        let iconStr = '📝';
        if (node.type === 'image') iconStr = '📸';
        if (node.type === 'audio') iconStr = '🎙️';

        const typeLabel = this.add.text(width / 2 - 15, -height / 2 + 15, iconStr, {
            fontSize: '14px',
        }).setOrigin(0.5);

        // Content Text (JetBrains Mono)
        const contentText = this.add.text(0, 0, node.title, { // Centered Title
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '14px', // Bigger font
            fontStyle: 'bold', // Bold font
            color: '#00ff88',
            align: 'center',
            wordWrap: { width: width - 20, useAdvancedWrap: true }
        }).setOrigin(0.5);

        // Connection Pin (Visible red dot at top center)
        const pin = this.add.circle(0, -height / 2, 6, 0xff3366); // 12px circle = 6px radius
        pin.setStrokeStyle(1, 0xffffff, 0.8);
        pin.setInteractive({ useHandCursor: true });
        
        // Make the pin pulse/glow on hover
        pin.on('pointerover', () => {
            pin.setStrokeStyle(2, 0xffffff, 1);
            pin.setScale(1.3); // Scale 1.3x
            this.showPinTooltip(container.x, container.y - height / 2 - 20);
        });
        pin.on('pointerout', () => {
            pin.setStrokeStyle(1, 0xffffff, 0.8);
            pin.setScale(1); // Reset Scale
            this.hidePinTooltip();
        });

        // Hover effects on border glow
        bg.on('pointerover', () => {
            bg.setStrokeStyle(2.5, 0x00ff88, 1);
            this.showTooltip(node, container.x, container.y - height / 2 - 10);
        });

        bg.on('pointerout', () => {
            bg.setStrokeStyle(1, 0x00ff88, 1); // Return to standard border
            this.hideTooltip();
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

    private showTooltip(node: CardNode, x: number, y: number) {
        if (this.isFrozen) return; // Don't show tooltips when board is frozen to avoid clutter

        if (this.currentTooltip) {
            this.currentTooltip.destroy();
        }

        const width = 200; // Max width 200px
        const container = this.add.container(x, y - 50); // Offset above the card
        container.setDepth(100); // Render above strings and pins
        container.alpha = 0; // Start faded out

        let iconStr = '📝';
        if (node.type === 'image') iconStr = '📸';
        if (node.type === 'audio') iconStr = '🎙️';

        const contentText = this.add.text(0, 0, `${iconStr} ${node.title}\n\n${node.content}`, {
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '12px', // 12px Font
            color: '#00ff88',
            align: 'left',
            wordWrap: { width: width - 20, useAdvancedWrap: true }
        }).setOrigin(0.5, 1); // Origin bottom-center

        const bounds = contentText.getBounds();
        const bg = this.add.rectangle(0, -bounds.height / 2, bounds.width + 16, bounds.height + 16, 0x0a0e27);
        bg.setStrokeStyle(1, 0x00ff88, 1);
        
        container.add([bg, contentText]);
        this.currentTooltip = container;
        this.activeCardId = node.id;

        this.tweens.add({
            targets: container,
            alpha: 1,
            duration: 150
        });
    }

    private hideTooltip() {
        if (this.currentTooltip) {
            const tt = this.currentTooltip;
            this.currentTooltip = null;
            this.activeCardId = null;
            this.tweens.add({
                targets: tt,
                alpha: 0,
                duration: 150,
                onComplete: () => tt.destroy()
            });
        }
    }

    private showPinTooltip(x: number, y: number) {
        if (this.isFrozen) return;
        if (this.currentPinTooltip) {
            this.currentPinTooltip.destroy();
        }

        const container = this.add.container(x, y);
        container.setDepth(101);
        
        const contentText = this.add.text(0, 0, "Drag from here to connect", {
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '10px',
            color: '#0a0e27',
            backgroundColor: '#ff3366',
            padding: { x: 5, y: 3 },
            align: 'center'
        }).setOrigin(0.5, 1);

        container.add([contentText]);
        this.currentPinTooltip = container;
    }

    private hidePinTooltip() {
        if (this.currentPinTooltip) {
            this.currentPinTooltip.destroy();
            this.currentPinTooltip = null;
        }
    }

    private startDrawingString(cardId: string) {
        if (this.isFrozen) return;
        this.isDrawingString = true;
        this.sourceCardId = cardId;
    }

    private updatePreviewString(x: number, y: number) {
        if (!this.previewLine || !this.sourceCardId) return;

        const sourceCard = this.cards.get(this.sourceCardId);
        if (!sourceCard) return;

        // Line starts from card top center
        const startX = sourceCard.x;
        const startY = sourceCard.y - 40;

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
            const targetY = card.y - 40; // top center

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
                EventBus.emit('connections-changed', this.connections);
            }
        }

        this.sourceCardId = null;
        this.drawConnections();
    }

    private handleRightClickDelete(x: number, y: number) {
        if (this.isFrozen) return;
        let deleted = false;

        for (let i = this.connections.length - 1; i >= 0; i--) {
            const conn = this.connections[i]!;
            const cardA = this.cards.get(conn.clueA_id);
            const cardB = this.cards.get(conn.clueB_id);

            if (cardA && cardB) {
                const distance = getDistanceToSegment(x, y, cardA.x, cardA.y - 40, cardB.x, cardB.y - 40);

                if (distance < 10) { // 10px deletion tolerance
                    this.connections.splice(i, 1);
                    deleted = true;
                    break;
                }
            }
        }

        if (deleted) {
            this.drawConnections();
            EventBus.emit('connections-changed', this.connections);
        }
    }

    private evidenceClueIds: string[] | null = null;
    private missedEvidenceTweens: Phaser.Tweens.Tween[] = [];

    public freezeBoard() {
        this.isFrozen = true;
        this.cards.forEach(card => {
            const bg = card.list.find(obj => obj.getData && obj.getData('isCardBackground')) as Phaser.GameObjects.Rectangle;
            if (bg) {
                this.input.setDraggable(bg, false);
            }
        });
        this.uiHintText?.setText('BOARD LOCKED — REVIEW YOUR THEORY');
        this.drawConnections();
    }

    public unfreezeBoard() {
        this.isFrozen = false;
        this.evidenceClueIds = null;
        this.missedEvidenceTweens.forEach(t => t.stop());
        this.missedEvidenceTweens = [];
        this.cards.forEach(card => {
            const bg = card.list.find(obj => obj.getData && obj.getData('isCardBackground')) as Phaser.GameObjects.Rectangle;
            if (bg) {
                bg.setStrokeStyle(0.5, 0x00ff88, 0.8);
                bg.alpha = 1;
            }
        });
        // Re-enable dragging for backgrounds
        this.cards.forEach(card => {
            const bg = card.list.find(obj => obj.getData && obj.getData('isCardBackground')) as Phaser.GameObjects.Rectangle;
            if (bg) this.input.setDraggable(bg, true);
        });
        this.uiHintText?.setText('DRAG FROM RED PIN TO CONNECT | RIGHT-CLICK STRING TO DELETE');
        this.drawConnections();
    }

    public highlightEvidenceConnections(evidenceClueIds: string[], playerConnections: Connection[]) {
        this.evidenceClueIds = evidenceClueIds;
        this.connections = playerConnections;
        this.freezeBoard();

        // Pulse unconnected evidence clues
        evidenceClueIds.forEach(evId => {
            const isConnected = playerConnections.some(conn => conn.clueA_id === evId || conn.clueB_id === evId);
            if (!isConnected) {
                const card = this.cards.get(evId);
                if (card) {
                    const bg = card.list.find(obj => obj.getData && obj.getData('isCardBackground')) as Phaser.GameObjects.Rectangle;
                    if (bg) {
                        bg.setStrokeStyle(3, 0xff3366, 1);
                        const tween = this.tweens.add({
                            targets: bg,
                            alpha: 0.5,
                            yoyo: true,
                            repeat: -1,
                            duration: 800
                        });
                        this.missedEvidenceTweens.push(tween);
                    }
                }
            }
        });
    }

    public restoreConnections(savedConnections: Connection[]) {
        this.connections = savedConnections;
        this.drawConnections();
    }

    public validateConnections(evidenceClueIds: string[]): boolean {
        if (evidenceClueIds.length === 0) return false;
        
        // Build adjacency list for current connections
        const adj = new Map<string, string[]>();
        for (const conn of this.connections) {
            if (!adj.has(conn.clueA_id)) adj.set(conn.clueA_id, []);
            if (!adj.has(conn.clueB_id)) adj.set(conn.clueB_id, []);
            adj.get(conn.clueA_id)!.push(conn.clueB_id);
            adj.get(conn.clueB_id)!.push(conn.clueA_id);
        }

        // Check if all evidence clues are connected in a single component
        const startNode = evidenceClueIds[0]!;
        if (!adj.has(startNode)) return false;

        const visited = new Set<string>();
        const queue = [startNode];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (!visited.has(current)) {
                visited.add(current);
                const neighbors = adj.get(current) || [];
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor)) {
                        queue.push(neighbor);
                    }
                }
            }
        }

        // If any evidence clue was not visited, it's not in the same connected graph
        for (const id of evidenceClueIds) {
            if (!visited.has(id)) {
                return false;
            }
        }

        return true;
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
                const startY = cardA.y - 40;
                const endX = cardB.x;
                const endY = cardB.y - 40;

                const line = new Phaser.Geom.Line(startX, startY, endX, endY);
                let distance = 100; // default no hover if frozen
                if (!this.isFrozen) {
                    distance = getDistanceToSegment(pointer.worldX, pointer.worldY, startX, startY, endX, endY);
                }

                if (this.isFrozen && this.evidenceClueIds) {
                    // Post-game highlight mode
                    const isAEvidence = this.evidenceClueIds.includes(conn.clueA_id);
                    const isBEvidence = this.evidenceClueIds.includes(conn.clueB_id);
                    
                    if (isAEvidence && isBEvidence) {
                        // Correct: GOLD and glow
                        this.connectionsGraphics!.lineStyle(5, 0xffd700, 0.6);
                        this.connectionsGraphics!.strokeLineShape(line);
                        this.connectionsGraphics!.lineStyle(2, 0xffd700, 1);
                        this.connectionsGraphics!.strokeLineShape(line);
                    } else {
                        // Incorrect: RED, faded 30%
                        this.connectionsGraphics!.lineStyle(2, 0xff3366, 0.3);
                        this.connectionsGraphics!.strokeLineShape(line);
                    }
                } else {
                    // Normal game mode
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
            }
        });
    }
}
