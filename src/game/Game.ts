import { Grid } from './Grid';
import { TileType } from './TileType';
import { SoundManager } from './SoundManager';

export class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private soundManager: SoundManager;
    private lastTime: number = 0;
    private lastPlayerMoveTime: number = 0;  // Add this new property to track player movement time
    private readonly TILE_SIZE = 32;
    private readonly GRID_WIDTH = 40;  // Increased from 25
    private readonly GRID_HEIGHT = 30;  // Increased from 19
    private readonly SCORE_AREA_HEIGHT = 50; // Height of the score display area
    private grid: Grid;
    private playerX: number = 1;
    private playerY: number = 1;
    private playerAnimFrame: number = 0;  // Track animation frame
    private playerFacingLeft: boolean = false;  // Track player direction
    private readonly ANIM_FRAME_DURATION = 150;  // Duration of each animation frame in ms
    private lastAnimUpdate: number = 0;  // Track last animation update
    private readonly PHYSICS_UPDATE_INTERVAL = 225; // Increased from 150ms to 300ms to slow down boulder movement
    private lastPhysicsUpdate: number = 0;
    private gameOver: boolean = false;
    private score: number = 0;
    private diamondsCollected: number = 0;
    private readonly DIAMONDS_REQUIRED = 20;  // Increased from 10 to match the larger level
    private readonly POINTS_PER_DIAMOND = 100;
    private gameWon: boolean = false;
    private explosionRadius: number = 0;
    private explosionMaxRadius: number = 3;
    private explosionFrame: number = 0;
    private readonly EXPLOSION_DURATION = 50; // Duration of each explosion frame in ms
    private lastExplosionUpdate: number = 0;
    private explosionX: number = 0;
    private explosionY: number = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.soundManager = new SoundManager();
        
        // Set canvas size based on grid dimensions plus score area
        this.canvas.width = this.GRID_WIDTH * this.TILE_SIZE;  // 40 * 32 = 1280px
        this.canvas.height = this.GRID_HEIGHT * this.TILE_SIZE + this.SCORE_AREA_HEIGHT;  // 30 * 32 + 50 = 1010px

        // Initialize grid with new dimensions
        this.grid = new Grid(this.GRID_WIDTH, this.GRID_HEIGHT);
        this.initializeLevel();

        // Set up event listeners
        window.addEventListener('keydown', this.handleInput.bind(this));
    }

    private initializeLevel(): void {
        // Create walls around the level
        for (let x = 0; x < this.grid.getWidth(); x++) {
            this.grid.setTile(x, 0, TileType.WALL);
            this.grid.setTile(x, this.grid.getHeight() - 1, TileType.WALL);
        }
        for (let y = 0; y < this.grid.getHeight(); y++) {
            this.grid.setTile(0, y, TileType.WALL);
            this.grid.setTile(this.grid.getWidth() - 1, y, TileType.WALL);
        }

        // Find a random starting position for the player
        do {
            this.playerX = Math.floor(Math.random() * (this.grid.getWidth() - 4)) + 2;
            this.playerY = Math.floor(Math.random() * (this.grid.getHeight() - 4)) + 2;
        } while (false); // We'll always accept the first position since we clear the area around it

        // Add some dirt and boulders, but avoid the player's starting area
        for (let y = 1; y < this.grid.getHeight() - 1; y++) {
            for (let x = 1; x < this.grid.getWidth() - 1; x++) {
                // Skip the area around the player's starting position
                if (Math.abs(x - this.playerX) <= 1 && Math.abs(y - this.playerY) <= 1) {
                    continue;
                }
                
                if (Math.random() < 0.7) {
                    this.grid.setTile(x, y, TileType.DIRT);
                } else if (Math.random() < 0.3) {
                    this.grid.setTile(x, y, TileType.BOULDER);
                }
            }
        }

        // Add diamonds
        for (let i = 0; i < this.DIAMONDS_REQUIRED * 1.5; i++) {
            let x, y;
            do {
                x = Math.floor(Math.random() * (this.grid.getWidth() - 2)) + 1;
                y = Math.floor(Math.random() * (this.grid.getHeight() - 2)) + 1;
            } while (Math.abs(x - this.playerX) <= 1 && Math.abs(y - this.playerY) <= 1);
            this.grid.setTile(x, y, TileType.DIAMOND);
        }

        // Clear player starting position and area around it
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                this.grid.setTile(this.playerX + dx, this.playerY + dy, TileType.EMPTY);
            }
        }
    }

    private handleInput(event: KeyboardEvent): void {
        // Handle mute toggle
        if (event.key.toLowerCase() === 'm') {
            this.soundManager.toggleMute();
            return;
        }

        // Handle reset key press regardless of game state
        if (event.key.toLowerCase() === 'r') {
            this.resetGame();
            return;
        }

        // Don't handle movement if game is over or won
        if (this.gameOver || this.gameWon) return;

        let newX = this.playerX;
        let newY = this.playerY;

        switch (event.key) {
            case 'ArrowLeft':
                newX--;
                this.playerFacingLeft = true;
                break;
            case 'ArrowRight':
                newX++;
                this.playerFacingLeft = false;
                break;
            case 'ArrowUp':
                newY--;
                break;
            case 'ArrowDown':
                newY++;
                break;
        }

        if (this.canMoveTo(newX, newY)) {
            const targetTile = this.grid.getTile(newX, newY);
            
            // Handle diamond collection
            if (targetTile === TileType.DIAMOND) {
                this.collectDiamond();
                this.soundManager.play('diamond');
            } else if (targetTile === TileType.DIRT) {
                this.soundManager.play('walk');
            }

            // Clear the new position before moving there
            this.grid.setTile(newX, newY, TileType.EMPTY);
            
            // Update player position and animation
            this.playerX = newX;
            this.playerY = newY;
            this.playerAnimFrame = (this.playerAnimFrame + 1) % 4;  // Cycle through 4 frames
            this.lastPlayerMoveTime = performance.now();  // Update the last move time

            // Handle boulder pushing
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                this.tryPushBoulder(newX, newY, event.key === 'ArrowLeft' ? -1 : 1);
            }
        }
    }

    private collectDiamond(): void {
        this.score += this.POINTS_PER_DIAMOND;
        this.diamondsCollected++;
        
        if (this.diamondsCollected >= this.DIAMONDS_REQUIRED) {
            this.gameWon = true;
            this.soundManager.play('victory');
        }
    }

    private resetGame(): void {
        // Clear the current player position before resetting
        this.grid.setTile(this.playerX, this.playerY, TileType.EMPTY);
        
        // Reset game state
        this.score = 0;
        this.diamondsCollected = 0;
        this.gameOver = false;
        this.gameWon = false;
        this.playerX = 1;
        this.playerY = 1;
        this.playerAnimFrame = 0;
        this.playerFacingLeft = false;
        this.lastAnimUpdate = 0;
        this.lastPhysicsUpdate = 0;
        this.lastPlayerMoveTime = 0;  // Reset the last move time
        this.lastTime = 0;
        
        // Create a new level
        this.initializeLevel();
    }

    private tryPushBoulder(x: number, y: number, direction: number): void {
        const nextX = x + direction;
        if (this.grid.getTile(x, y) === TileType.BOULDER && 
            this.grid.getTile(nextX, y) === TileType.EMPTY) {
            this.grid.setTile(x, y, TileType.EMPTY);
            this.grid.setTile(nextX, y, TileType.BOULDER);
            this.soundManager.play('boulder');
        }
    }

    private canMoveTo(x: number, y: number): boolean {
        const tile = this.grid.getTile(x, y);
        return tile === TileType.EMPTY || tile === TileType.DIRT || tile === TileType.DIAMOND;
    }

    private updatePhysics(): void {
        let somethingMoved = false;

        // Update from bottom to top, right to left
        for (let y = this.grid.getHeight() - 2; y >= 0; y--) {
            for (let x = this.grid.getWidth() - 2; x >= 0; x--) {
                const currentTile = this.grid.getTile(x, y);
                
                // Handle falling objects (boulders and diamonds)
                if (currentTile === TileType.BOULDER || currentTile === TileType.DIAMOND) {
                    // Check if object can fall straight down
                    if (this.grid.getTile(x, y + 1) === TileType.EMPTY && 
                        !(x === this.playerX && y + 1 === this.playerY)) { // Don't fall if player is below
                        this.grid.setTile(x, y, TileType.EMPTY);
                        this.grid.setTile(x, y + 1, currentTile);
                        somethingMoved = true;

                        // Play boulder sound only when it lands
                        if (currentTile === TileType.BOULDER && this.grid.getTile(x, y + 2) !== TileType.EMPTY) {
                            this.soundManager.play('boulder');
                        }

                        // Check if object crushed the player, but give a small grace period when moving down
                        if (this.playerX === x && this.playerY === y + 2) {
                            // Only kill player if they've been under the boulder for more than one physics update
                            const timeSinceLastMove = performance.now() - this.lastPlayerMoveTime;
                            if (timeSinceLastMove >= this.PHYSICS_UPDATE_INTERVAL) {
                                this.startExplosion();
                            }
                        }
                    }
                    // Handle boulder-specific rolling behavior
                    else if (currentTile === TileType.BOULDER) {
                        // Check if boulder can roll to the left
                        if (this.grid.getTile(x, y + 1) !== TileType.EMPTY &&
                            this.grid.getTile(x - 1, y) === TileType.EMPTY &&
                            this.grid.getTile(x - 1, y + 1) === TileType.EMPTY &&
                            !(x - 1 === this.playerX && y === this.playerY) && // Don't roll if player is in the way
                            !(x - 1 === this.playerX && y + 1 === this.playerY)) {
                            this.grid.setTile(x, y, TileType.EMPTY);
                            this.grid.setTile(x - 1, y + 1, TileType.BOULDER);
                            somethingMoved = true;
                        }
                        // Check if boulder can roll to the right
                        else if (this.grid.getTile(x, y + 1) !== TileType.EMPTY &&
                                this.grid.getTile(x + 1, y) === TileType.EMPTY &&
                                this.grid.getTile(x + 1, y + 1) === TileType.EMPTY &&
                                !(x + 1 === this.playerX && y === this.playerY) && // Don't roll if player is in the way
                                !(x + 1 === this.playerX && y + 1 === this.playerY)) {
                            this.grid.setTile(x, y, TileType.EMPTY);
                            this.grid.setTile(x + 1, y + 1, TileType.BOULDER);
                            somethingMoved = true;
                        }
                    }
                }
            }
        }

        // Check if player was crushed by a boulder or diamond
        const tileAtPlayer = this.grid.getTile(this.playerX, this.playerY);
        if (tileAtPlayer === TileType.BOULDER || tileAtPlayer === TileType.DIAMOND) {
            // Only kill player if they've been under/in the same tile as a boulder for more than one physics update
            const timeSinceLastMove = performance.now() - this.lastPlayerMoveTime;
            if (timeSinceLastMove >= this.PHYSICS_UPDATE_INTERVAL) {
                this.startExplosion();
            }
        }
    }

    private startExplosion(): void {
        if (!this.gameOver) {
            this.gameOver = true;
            this.explosionRadius = 0;
            this.explosionFrame = 0;
            this.explosionX = this.playerX;
            this.explosionY = this.playerY;
            this.lastExplosionUpdate = performance.now();
            this.soundManager.play('explosion');
        }
    }

    private updateExplosion(timestamp: number): void {
        if (!this.gameOver || this.explosionRadius >= this.explosionMaxRadius) return;

        if (timestamp - this.lastExplosionUpdate >= this.EXPLOSION_DURATION) {
            this.explosionFrame++;
            this.explosionRadius = Math.floor(this.explosionFrame / 2);
            this.lastExplosionUpdate = timestamp;

            // Clear tiles in expanding radius
            if (this.explosionRadius < this.explosionMaxRadius) {
                for (let y = -this.explosionRadius; y <= this.explosionRadius; y++) {
                    for (let x = -this.explosionRadius; x <= this.explosionRadius; x++) {
                        const distance = Math.sqrt(x * x + y * y);
                        if (distance <= this.explosionRadius) {
                            const tileX = this.explosionX + x;
                            const tileY = this.explosionY + y;
                            if (this.grid.isInBounds(tileX, tileY) && 
                                this.grid.getTile(tileX, tileY) !== TileType.WALL) {
                                this.grid.setTile(tileX, tileY, TileType.EMPTY);
                            }
                        }
                    }
                }
            }
        }
    }

    start(): void {
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    private gameLoop(timestamp: number): void {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        // Update explosion if active
        this.updateExplosion(timestamp);

        // Update animation frame at fixed intervals
        if (timestamp - this.lastAnimUpdate >= this.ANIM_FRAME_DURATION) {
            // Only update animation when moving
            if (this.playerAnimFrame > 0) {
                this.playerAnimFrame = (this.playerAnimFrame + 1) % 4;
            }
            this.lastAnimUpdate = timestamp;
        }

        // Update physics at fixed intervals
        if (timestamp - this.lastPhysicsUpdate >= this.PHYSICS_UPDATE_INTERVAL) {
            this.updatePhysics();
            this.lastPhysicsUpdate = timestamp;
        }

        this.render();

        requestAnimationFrame(this.gameLoop.bind(this));
    }

    private render(): void {
        // Clear the canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw score area background
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(0, 0, this.canvas.width, this.SCORE_AREA_HEIGHT);

        // Render score and diamond count in the score area
        this.ctx.fillStyle = 'white';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 20, this.SCORE_AREA_HEIGHT/2 + 8);
        
        // Add diamond icon and count
        this.ctx.fillStyle = '#00FFFF';
        this.ctx.font = '24px Arial';
        const diamondText = `💎 ${this.diamondsCollected}/${this.DIAMONDS_REQUIRED}`;
        const diamondTextWidth = this.ctx.measureText(diamondText).width;
        this.ctx.fillText(diamondText, this.canvas.width - diamondTextWidth - 20, this.SCORE_AREA_HEIGHT/2 + 8);

        // Render the grid with offset for score area
        this.ctx.save();
        this.ctx.translate(0, this.SCORE_AREA_HEIGHT);
        
        for (let y = 0; y < this.grid.getHeight(); y++) {
            for (let x = 0; x < this.grid.getWidth(); x++) {
                const tile = this.grid.getTile(x, y);
                this.renderTile(x, y, tile);
            }
        }

        // Render the player if game is active
        if (!this.gameOver && !this.gameWon) {
            this.renderTile(this.playerX, this.playerY, TileType.PLAYER);
        }

        this.ctx.restore();

        if (this.gameOver || this.gameWon) {
            // Add semi-transparent overlay
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, this.SCORE_AREA_HEIGHT, this.canvas.width, this.canvas.height - this.SCORE_AREA_HEIGHT);

            // Center the messages in the play area
            const centerX = this.canvas.width / 2;
            const centerY = (this.canvas.height - this.SCORE_AREA_HEIGHT) / 2 + this.SCORE_AREA_HEIGHT;

            if (this.gameOver) {
                this.ctx.fillStyle = 'white';
                this.ctx.font = '48px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('GAME OVER', centerX, centerY);
                this.ctx.font = '24px Arial';
                this.ctx.fillText('Press R to restart', centerX, centerY + 40);
            }

            if (this.gameWon) {
                this.ctx.fillStyle = 'gold';
                this.ctx.font = '48px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('LEVEL COMPLETE!', centerX, centerY);
                this.ctx.font = '24px Arial';
                this.ctx.fillText(`Final Score: ${this.score}`, centerX, centerY + 40);
                this.ctx.fillText('Press R to play again', centerX, centerY + 80);
            }
        }
    }

    private renderTile(x: number, y: number, type: TileType): void {
        const colors = {
            [TileType.EMPTY]: '#000',
            [TileType.DIRT]: '#8B4513',
            [TileType.BOULDER]: '#808080',
            [TileType.DIAMOND]: '#00FFFF',
            [TileType.WALL]: '#696969',
            [TileType.PLAYER]: '#FF0000'
        };

        // Draw explosion effect if active
        if (this.gameOver && this.explosionRadius < this.explosionMaxRadius) {
            const distance = Math.sqrt(
                Math.pow(x - this.explosionX, 2) + 
                Math.pow(y - this.explosionY, 2)
            );
            
            if (distance <= this.explosionRadius + 1) {
                // Draw base tile first
                this.ctx.fillStyle = colors[type];
                this.ctx.fillRect(
                    x * this.TILE_SIZE,
                    y * this.TILE_SIZE,
                    this.TILE_SIZE,
                    this.TILE_SIZE
                );

                // Create multiple explosion layers
                const centerX = (x + 0.5) * this.TILE_SIZE;
                const centerY = (y + 0.5) * this.TILE_SIZE;

                // Inner bright explosion
                const innerGradient = this.ctx.createRadialGradient(
                    centerX, centerY, 0,
                    centerX, centerY, this.TILE_SIZE * 0.8
                );
                innerGradient.addColorStop(0, 'rgba(255, 255, 200, 0.9)'); // Bright yellow core
                innerGradient.addColorStop(0.2, 'rgba(255, 150, 50, 0.8)'); // Orange
                innerGradient.addColorStop(0.5, 'rgba(255, 50, 50, 0.6)');  // Red
                innerGradient.addColorStop(1, 'rgba(100, 0, 0, 0)');        // Dark red fade

                // Outer fire effect
                const outerGradient = this.ctx.createRadialGradient(
                    centerX, centerY, 0,
                    centerX, centerY, this.TILE_SIZE
                );
                outerGradient.addColorStop(0, 'rgba(255, 100, 0, 0.4)');    // Orange core
                outerGradient.addColorStop(0.6, 'rgba(255, 50, 0, 0.2)');   // Red
                outerGradient.addColorStop(1, 'rgba(50, 0, 0, 0)');         // Dark fade

                // Draw particle effects
                const particleCount = 5;
                const angleStep = (Math.PI * 2) / particleCount;
                const explosionProgress = this.explosionFrame / (this.explosionMaxRadius * 2);
                
                this.ctx.save();
                for (let i = 0; i < particleCount; i++) {
                    const angle = i * angleStep + (explosionProgress * Math.PI);
                    const radius = this.TILE_SIZE * 0.7 * explosionProgress;
                    const particleX = centerX + Math.cos(angle) * radius;
                    const particleY = centerY + Math.sin(angle) * radius;
                    
                    const particleGradient = this.ctx.createRadialGradient(
                        particleX, particleY, 0,
                        particleX, particleY, this.TILE_SIZE * 0.3
                    );
                    particleGradient.addColorStop(0, 'rgba(255, 200, 0, 0.8)');
                    particleGradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.4)');
                    particleGradient.addColorStop(1, 'rgba(200, 0, 0, 0)');
                    
                    this.ctx.fillStyle = particleGradient;
                    this.ctx.beginPath();
                    this.ctx.arc(particleX, particleY, this.TILE_SIZE * 0.3, 0, Math.PI * 2);
                    this.ctx.fill();
                }
                this.ctx.restore();

                // Draw main explosion gradients
                this.ctx.fillStyle = innerGradient;
                this.ctx.fillRect(
                    x * this.TILE_SIZE,
                    y * this.TILE_SIZE,
                    this.TILE_SIZE,
                    this.TILE_SIZE
                );

                this.ctx.fillStyle = outerGradient;
                this.ctx.fillRect(
                    x * this.TILE_SIZE,
                    y * this.TILE_SIZE,
                    this.TILE_SIZE,
                    this.TILE_SIZE
                );

                return;
            }
        }

        // Regular tile rendering
        if (type === TileType.PLAYER) {
            // Calculate center position of the tile
            const centerX = (x * this.TILE_SIZE) + (this.TILE_SIZE / 2);
            const centerY = (y * this.TILE_SIZE) + (this.TILE_SIZE / 2);
            const size = this.TILE_SIZE * 0.8; // Slightly smaller than tile

            this.ctx.save();  // Save current context state
            
            // If facing left, flip the drawing
            if (this.playerFacingLeft) {
                this.ctx.translate(centerX * 2, 0);
                this.ctx.scale(-1, 1);
            }

            // Draw the miner character
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 2;
            this.ctx.fillStyle = '#FFB6C1';  // Light pink for skin tone

            // Head
            const headRadius = size * 0.2;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY - (size * 0.25), headRadius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            // Hard hat
            this.ctx.fillStyle = '#FFD700';  // Gold color for hat
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY - (size * 0.25) - (headRadius * 0.2), headRadius * 1.1, Math.PI, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.stroke();

            // Body
            this.ctx.fillStyle = '#4169E1';  // Royal blue for clothes
            this.ctx.beginPath();
            this.ctx.moveTo(centerX - (size * 0.2), centerY - (size * 0.1));
            this.ctx.lineTo(centerX + (size * 0.2), centerY - (size * 0.1));
            this.ctx.lineTo(centerX + (size * 0.15), centerY + (size * 0.3));
            this.ctx.lineTo(centerX - (size * 0.15), centerY + (size * 0.3));
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();

            // Arms with animation
            const armAngle = Math.sin((this.playerAnimFrame / 4) * Math.PI * 2) * 0.2;
            
            // Left arm
            this.ctx.beginPath();
            this.ctx.moveTo(centerX - (size * 0.2), centerY);
            this.ctx.lineTo(centerX - (size * 0.35), centerY + (size * 0.15) + (armAngle * size));
            this.ctx.lineTo(centerX - (size * 0.3), centerY + (size * 0.15) + (armAngle * size));
            this.ctx.lineTo(centerX - (size * 0.15), centerY);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Right arm
            this.ctx.beginPath();
            this.ctx.moveTo(centerX + (size * 0.2), centerY);
            this.ctx.lineTo(centerX + (size * 0.35), centerY + (size * 0.15) - (armAngle * size));
            this.ctx.lineTo(centerX + (size * 0.3), centerY + (size * 0.15) - (armAngle * size));
            this.ctx.lineTo(centerX + (size * 0.15), centerY);
            this.ctx.closePath();
            this.ctx.fill();

            // Legs with animation
            const legOffset = Math.sin((this.playerAnimFrame / 4) * Math.PI * 2) * 0.1;
            this.ctx.fillStyle = '#4169E1';  // Royal blue for clothes (matching body)
            
            // Left leg
            this.ctx.beginPath();
            this.ctx.moveTo(centerX - (size * 0.15), centerY + (size * 0.3));
            this.ctx.lineTo(centerX - (size * 0.2), centerY + (size * 0.45) + (legOffset * size));
            this.ctx.lineTo(centerX - (size * 0.15), centerY + (size * 0.45) + (legOffset * size));
            this.ctx.lineTo(centerX - (size * 0.1), centerY + (size * 0.3));
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            // Right leg
            this.ctx.beginPath();
            this.ctx.moveTo(centerX + (size * 0.15), centerY + (size * 0.3));
            this.ctx.lineTo(centerX + (size * 0.2), centerY + (size * 0.45) - (legOffset * size));
            this.ctx.lineTo(centerX + (size * 0.15), centerY + (size * 0.45) - (legOffset * size));
            this.ctx.lineTo(centerX + (size * 0.1), centerY + (size * 0.3));
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();

            this.ctx.restore();  // Restore context state
        } else if (type === TileType.BOULDER) {
            // Calculate center and size for the boulder
            const centerX = (x * this.TILE_SIZE) + (this.TILE_SIZE / 2);
            const centerY = (y * this.TILE_SIZE) + (this.TILE_SIZE / 2);
            const radius = this.TILE_SIZE * 0.49;

            // Draw boulder shadow
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            this.ctx.beginPath();
            this.ctx.ellipse(
                centerX + 2,
                centerY + 4,
                radius * 0.9,
                radius * 0.4,
                0,
                0,
                Math.PI * 2
            );
            this.ctx.fill();

            // Create gradient for 3D effect
            const gradient = this.ctx.createRadialGradient(
                centerX - radius * 0.3, centerY - radius * 0.3, 0,
                centerX, centerY, radius * 1.2
            );
            gradient.addColorStop(0, '#A0A0A0');  // Light gray
            gradient.addColorStop(0.5, '#808080'); // Medium gray
            gradient.addColorStop(1, '#505050');   // Dark gray

            // Draw main boulder circle
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Add highlights
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(centerX - radius * 0.2, centerY - radius * 0.2, radius * 0.8, Math.PI * 1.2, Math.PI * 1.6);
            this.ctx.stroke();

            // Add some texture/cracks
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(centerX - radius * 0.5, centerY - radius * 0.3);
            this.ctx.lineTo(centerX + radius * 0.2, centerY + radius * 0.3);
            this.ctx.moveTo(centerX + radius * 0.4, centerY - radius * 0.4);
            this.ctx.lineTo(centerX - radius * 0.1, centerY + radius * 0.5);
            this.ctx.stroke();

        } else if (type === TileType.DIAMOND) {
            const centerX = (x * this.TILE_SIZE) + (this.TILE_SIZE / 2);
            const centerY = (y * this.TILE_SIZE) + (this.TILE_SIZE / 2);
            const size = this.TILE_SIZE * 0.45;

            // Add outer glow first (behind the diamond)
            const glowGradient = this.ctx.createRadialGradient(
                centerX, centerY, 0,
                centerX, centerY, size * 2
            );
            glowGradient.addColorStop(0, 'rgba(0, 255, 255, 0.5)');
            glowGradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.2)');
            glowGradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
            this.ctx.fillStyle = glowGradient;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, size * 2, 0, Math.PI * 2);
            this.ctx.fill();

            // Create gradient for diamond
            const gradient = this.ctx.createLinearGradient(
                centerX - size, centerY - size,
                centerX + size, centerY + size
            );
            gradient.addColorStop(0, '#80FFFF');   // Lighter cyan
            gradient.addColorStop(0.3, '#40FFFF'); // Light cyan
            gradient.addColorStop(0.6, '#00FFFF'); // Cyan
            gradient.addColorStop(1, '#00C0C0');   // Darker cyan

            // Draw diamond shape
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.moveTo(centerX, centerY - size);        // Top point
            this.ctx.lineTo(centerX + size, centerY);        // Right point
            this.ctx.lineTo(centerX, centerY + size);        // Bottom point
            this.ctx.lineTo(centerX - size, centerY);        // Left point
            this.ctx.closePath();
            this.ctx.fill();

            // Add sparkle effect
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(centerX - size * 0.3, centerY - size * 0.3);
            this.ctx.lineTo(centerX + size * 0.3, centerY + size * 0.3);
            this.ctx.moveTo(centerX + size * 0.3, centerY - size * 0.3);
            this.ctx.lineTo(centerX - size * 0.3, centerY + size * 0.3);
            this.ctx.stroke();

            // Add highlight
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(centerX - size * 0.2, centerY - size * 0.2, size * 0.3, 0, Math.PI * 2);
            this.ctx.stroke();

        } else {
            // Only draw non-empty tiles
            if (type !== TileType.EMPTY) {
                this.ctx.fillStyle = colors[type];
                this.ctx.fillRect(
                    x * this.TILE_SIZE,
                    y * this.TILE_SIZE,
                    this.TILE_SIZE,
                    this.TILE_SIZE
                );

                // Only add borders to walls and dirt
                if (type === TileType.WALL || type === TileType.DIRT) {
                    this.ctx.strokeStyle = '#333';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(
                        x * this.TILE_SIZE,
                        y * this.TILE_SIZE,
                        this.TILE_SIZE,
                        this.TILE_SIZE
                    );
                }
            }
        }
    }

    public getSoundManager(): SoundManager {
        return this.soundManager;
    }
} 