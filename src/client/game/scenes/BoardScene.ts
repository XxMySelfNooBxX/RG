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

        // UI Hint Overlay
        this.uiHintText = this.add.text(400, 560, 'DRAG FROM PINK PEG TO CONNECT | RIGHT-CLICK STRING TO DELETE', {
            fontFamily: '"Inter", sans-serif',
            fontSize: '12px',
            color: '#cbd5e1',
            backgroundColor: '#1a1f2e',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5);
        this.uiHintText.setStroke('#6366f1', 0.5);

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
                    
                    // Card drag effects
                    const bg = container.list.find(obj => obj.getData && obj.getData('isCardBackground')) as Phaser.GameObjects.Graphics;
                    if (bg) {
                        bg.lineStyle(2, 0xfbbf24, 1);
                        bg.strokeRoundedRect(-80, -45, 160, 90, 6);
                    }
                    container.setScale(1.02);
                    container.setDepth(50);
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
        this.input.on('pointerup', (pointer: Phaser.Input.Pointer, _currentlyOver: Phaser.GameObjects.GameObject[]) => {
            if (this.isDrawingString) {
                this.finishDrawingString(pointer);
            }
            
            // Reset scale and depth after drag
            this.cards.forEach(card => {
                card.setScale(1);
                card.setDepth(0);
                const bg = card.list.find(obj => obj.getData && obj.getData('isCardBackground')) as Phaser.GameObjects.Graphics;
                if (bg) {
                    bg.clear();
                    bg.fillStyle(0x1a1f2e, 1);
                    bg.fillRoundedRect(-80, -45, 160, 90, 6);
                    bg.lineStyle(2, 0x6366f1, 1);
                    bg.strokeRoundedRect(-80, -45, 160, 90, 6);
                }
            });
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
        const radius = 200; // Expanded Radius

        nodes.forEach((node, index) => {
            const angle = (index * 2 * Math.PI) / N;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            this.createCard(node, x, y);
        });
    }

    private createCard(node: CardNode, x: number, y: number) {
        const width = 160;
        const height = 90;

        const container = this.add.container(x, y);

        // Card Shadow
        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.4);
        shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 4, width, height, 6);

        // Card Background
        const bg = this.add.graphics();
        bg.fillStyle(0x1a1f2e, 1);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 6);
        bg.lineStyle(2, 0x6366f1, 1);
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 6);
        
        // Use a transparent zone for interactions
        const hitZone = this.add.zone(0, 0, width, height);
        hitZone.setInteractive({ useHandCursor: true });
        hitZone.setData('isCardBackground', true);
        hitZone.setData('cardNode', node);
        hitZone.setData('cardId', node.id);
        this.input.setDraggable(hitZone);

        // Icon Header - Top Right Corner
        let iconStr = '📝';
        if (node.type === 'image') iconStr = '📸';
        if (node.type === 'audio') iconStr = '🎙️';

        const typeLabel = this.add.text(width / 2 - 15, -height / 2 + 15, iconStr, {
            fontSize: '18px',
            color: '#ec4899'
        }).setOrigin(0.5);
        typeLabel.setAlpha(0.8);

        // Content Text
        const contentText = this.add.text(0, 0, node.title, { // Centered Title
            fontFamily: '"Inter", sans-serif',
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#f0f4f8',
            align: 'center',
            wordWrap: { width: width - 20, useAdvancedWrap: true }
        }).setOrigin(0.5);

        // Connection Pin
        const pin = this.add.circle(0, -height / 2, 7, 0xec4899); // 14px circle = 7px radius
        pin.setInteractive({ useHandCursor: true });
        
        // Glow effect graphics for pin hover
        const pinGlow = this.add.graphics();
        pinGlow.setAlpha(0);
        
        pin.on('pointerover', () => {
            pin.setScale(1.2);
            pinGlow.clear();
            pinGlow.fillStyle(0xec4899, 0.4);
            pinGlow.fillCircle(0, -height / 2, 12);
            pinGlow.setAlpha(1);
            this.showPinTooltip(container.x, container.y - height / 2 - 25);
        });
        pin.on('pointerout', () => {
            pin.setScale(1);
            pinGlow.setAlpha(0);
            this.hidePinTooltip();
        });

        // Hover effects on border glow
        hitZone.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0x1a1f2e, 1);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, 6);
            bg.lineStyle(2, 0xec4899, 1); // Rose hover
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 6);
            
            shadow.clear();
            shadow.fillStyle(0x000000, 0.6);
            shadow.fillRoundedRect(-width / 2 + 6, -height / 2 + 6, width, height, 6);
            
            this.showTooltip(node, container.x, container.y - height / 2 - 15);
        });

        hitZone.on('pointerout', () => {
            if (!this.isDrawingString) { // Don't reset if we are dragging strings or cards over it
                bg.clear();
                bg.fillStyle(0x1a1f2e, 1);
                bg.fillRoundedRect(-width / 2, -height / 2, width, height, 6);
                bg.lineStyle(2, 0x6366f1, 1);
                bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 6);
                
                shadow.clear();
                shadow.fillStyle(0x000000, 0.4);
                shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 4, width, height, 6);
            }
            this.hideTooltip();
        });

        // String drawing start handlers
        pin.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.leftButtonDown()) {
                this.startDrawingString(node.id);
            }
        });

        container.add([shadow, bg, typeLabel, contentText, pinGlow, pin, hitZone]);
        this.cards.set(node.id, container);
    }

    private showTooltip(node: CardNode, x: number, y: number) {
        if (this.isFrozen) return; // Don't show tooltips when board is frozen to avoid clutter

        if (this.currentTooltip) {
            this.currentTooltip.destroy();
        }

        const width = 220; // Max width 220px
        const container = this.add.container(x, y - 60); // Offset above the card
        container.setDepth(100); // Render above strings and pins
        container.alpha = 0; // Start faded out

        let iconStr = '📝';
        if (node.type === 'image') iconStr = '📸';
        if (node.type === 'audio') iconStr = '🎙️';

        const contentText = this.add.text(0, 0, `${iconStr} ${node.title}\n\n${node.content}`, {
            fontFamily: '"Inter", sans-serif',
            fontSize: '12px',
            color: '#cbd5e1',
            align: 'left',
            wordWrap: { width: width - 20, useAdvancedWrap: true }
        }).setOrigin(0.5, 1); // Origin bottom-center

        const bounds = contentText.getBounds();
        
        // Arrow pointing down
        const arrow = this.add.triangle(0, 8, 0, -8, 8, -8, 4, 0, 0x1a1f2e);
        
        const bg = this.add.graphics();
        bg.fillStyle(0x1a1f2e, 1);
        bg.fillRoundedRect(-bounds.width / 2 - 8, -bounds.height - 16, bounds.width + 16, bounds.height + 16, 6);
        bg.lineStyle(1, 0x6366f1, 1);
        bg.strokeRoundedRect(-bounds.width / 2 - 8, -bounds.height - 16, bounds.width + 16, bounds.height + 16, 6);
        
        container.add([bg, arrow, contentText]);
        this.currentTooltip = container;

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
            fontFamily: '"Inter", sans-serif',
            fontSize: '11px',
            color: '#f0f4f8',
            backgroundColor: '#ec4899',
            padding: { x: 6, y: 4 },
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
        const startY = sourceCard.y - 45; // Adjusted for 90px height

        this.previewLine.clear();
        this.previewLine.lineStyle(2, 0x6366f1, 0.8);
        
        // Dashed approximation for preview line
        const distance = Phaser.Math.Distance.Between(startX, startY, x, y);
        const dashLength = 10;
        const dashGap = 5;
        const numDashes = Math.floor(distance / (dashLength + dashGap));
        const dx = (x - startX) / distance;
        const dy = (y - startY) / distance;
        
        this.previewLine.beginPath();
        for (let i = 0; i < numDashes; i++) {
            const startDashX = startX + dx * (i * (dashLength + dashGap));
            const startDashY = startY + dy * (i * (dashLength + dashGap));
            const endDashX = startDashX + dx * dashLength;
            const endDashY = startDashY + dy * dashLength;
            this.previewLine.moveTo(startDashX, startDashY);
            this.previewLine.lineTo(endDashX, endDashY);
        }
        this.previewLine.strokePath();
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

            // Find the card hitZone inside the container to check for pointer overlap
            const hitZone = card.list.find(obj => obj.getData && obj.getData('isCardBackground')) as Phaser.GameObjects.Zone | undefined;
            
            // To check bounds of a zone relative to world, we need to transform it
            let isOverCardBody = false;
            if (hitZone) {
                const matrix = hitZone.getWorldTransformMatrix();
                const bounds = new Phaser.Geom.Rectangle(matrix.tx - 80, matrix.ty - 45, 160, 90);
                isOverCardBody = Phaser.Geom.Rectangle.Contains(bounds, pointer.worldX, pointer.worldY);
            }

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
            EventBus.emit('connections-changed', this.connections);
        }
    }

    private evidenceClueIds: string[] | null = null;
    private missedEvidenceTweens: Phaser.Tweens.Tween[] = [];

    public freezeBoard() {
        this.isFrozen = true;
        this.cards.forEach(card => {
            const hitZone = card.list.find(obj => obj.getData && obj.getData('isCardBackground')) as Phaser.GameObjects.Zone;
            if (hitZone) {
                this.input.setDraggable(hitZone, false);
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
        // Re-enable dragging for backgrounds
        this.cards.forEach(card => {
            const hitZone = card.list.find(obj => obj.getData && obj.getData('isCardBackground')) as Phaser.GameObjects.Zone;
            if (hitZone) this.input.setDraggable(hitZone, true);
        });
        this.uiHintText?.setText('DRAG FROM PINK PEG TO CONNECT | RIGHT-CLICK STRING TO DELETE');
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
                    // Draw red stroke via graphics instead
                    const bgGraphics = card.list[1] as Phaser.GameObjects.Graphics; // Index 1 is the bg graphics
                    if (bgGraphics) {
                        bgGraphics.clear();
                        bgGraphics.fillStyle(0x1a1f2e, 1);
                        bgGraphics.fillRoundedRect(-80, -45, 160, 90, 6);
                        bgGraphics.lineStyle(3, 0xef4444, 1);
                        bgGraphics.strokeRoundedRect(-80, -45, 160, 90, 6);
                        
                        const tween = this.tweens.add({
                            targets: bgGraphics,
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
                const startY = cardA.y - 45;
                const endX = cardB.x;
                const endY = cardB.y - 45;

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
                        this.connectionsGraphics!.lineStyle(5, 0x10b981, 0.6); // Emerald glow
                        this.connectionsGraphics!.strokeLineShape(line);
                        this.connectionsGraphics!.lineStyle(2, 0x10b981, 1);
                        this.connectionsGraphics!.strokeLineShape(line);
                    } else {
                        // Incorrect: RED, faded 30%
                        this.connectionsGraphics!.lineStyle(2, 0xef4444, 0.3); // Red error
                        this.connectionsGraphics!.strokeLineShape(line);
                    }
                } else {
                    // Normal game mode
                    if (distance < 10) {
                        // Glow connection string on hover
                        this.connectionsGraphics!.lineStyle(5, 0xfbbf24, 0.4); // Gold hover
                        this.connectionsGraphics!.strokeLineShape(line);
                        this.connectionsGraphics!.lineStyle(3, 0xfbbf24, 1);
                        this.connectionsGraphics!.strokeLineShape(line);
                    } else {
                        // Normal indigo detective string
                        this.connectionsGraphics!.lineStyle(2, 0x6366f1, 0.85); // Indigo
                        this.connectionsGraphics!.strokeLineShape(line);
                    }
                }
                
                // Draw endpoint circles
                this.connectionsGraphics!.fillStyle(0x6366f1, 1);
                this.connectionsGraphics!.fillCircle(startX, startY, 3);
                this.connectionsGraphics!.fillCircle(endX, endY, 3);
            }
        });
    }
}
