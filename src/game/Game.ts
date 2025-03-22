import { Grid } from './Grid';
import { TileType } from './TileType';
import { SoundManager } from './SoundManager';

export class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private soundManager: SoundManager;
    private lastTime: number = 0;
    private lastPlayerMoveTime: number = 0;  // Add this new property to track player movement time
    private readonly TILE_SIZE = 48;  // Increased from 32 to 48 pixels
    private readonly GRID_WIDTH = 100;  // Much larger level width
    private readonly GRID_HEIGHT = 60;  // Much larger level height
    private readonly VIEWPORT_WIDTH = 32;  // How many tiles to show horizontally
    private readonly VIEWPORT_HEIGHT = 20;  // How many tiles to show vertically
    private readonly SCORE_AREA_HEIGHT = 50; // Height of the score display area
    private readonly TIME_LIMIT = 300;  // Increased time limit for larger level
    private timeRemaining: number;  // Current time remaining
    private readonly TIME_WARNING_THRESHOLD = 60;  // Adjusted warning threshold
    private isTimeWarning: boolean = false;  // Track if we're in warning state
    private lastTimeUpdate: number = 0;  // Track last time update
    private grid: Grid;
    private playerX: number = 1;
    private playerY: number = 1;
    private playerAnimFrame: number = 0;  // Track animation frame
    private playerFacingLeft: boolean = false;  // Track player direction
    private readonly ANIM_FRAME_DURATION = 150;  // Duration of each animation frame in ms
    private lastAnimUpdate: number = 0;  // Track last animation update
    private readonly PHYSICS_UPDATE_INTERVAL = 225; // Physics update interval
    private lastPhysicsUpdate: number = 0;
    private gameOver: boolean = false;
    private score: number = 0;
    private diamondsCollected: number = 0;
    private readonly DIAMONDS_REQUIRED = 25;  // Adjusted for new grid size
    private readonly POINTS_PER_DIAMOND = 100;
    private gameWon: boolean = false;
    private explosionRadius: number = 0;
    private explosionMaxRadius: number = 3;
    private explosionFrame: number = 0;
    private readonly EXPLOSION_DURATION = 50; // Duration of each explosion frame in ms
    private lastExplosionUpdate: number = 0;
    private explosionX: number = 0;
    private explosionY: number = 0;
    private exitX: number = -1;
    private exitY: number = -1;
    private exitRevealed: boolean = false;
    private readonly EXIT_APPEAR_DELAY = 500; // Delay before exit appears (ms)
    private exitAppearTime: number = 0;
    private cameraX: number = 0;  // Camera position X
    private cameraY: number = 0;  // Camera position Y
    private targetCameraX: number = 0;  // Target camera position X
    private targetCameraY: number = 0;  // Target camera position Y
    private readonly CAMERA_LERP_SPEED = 5.0;  // How quickly the camera catches up to the target (units per second)
    private readonly CAMERA_DEADZONE = 0.01;  // Stop camera movement when very close to target

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.soundManager = new SoundManager();
        this.timeRemaining = this.TIME_LIMIT;
        
        // Calculate the logical canvas size based on viewport dimensions (not grid dimensions)
        const logicalWidth = this.VIEWPORT_WIDTH * this.TILE_SIZE;
        const logicalHeight = this.VIEWPORT_HEIGHT * this.TILE_SIZE + this.SCORE_AREA_HEIGHT;
        
        // Calculate scale to fit the window with some padding
        const padding = 20; // 20px padding on each side
        const scaleX = (window.innerWidth - padding * 2) / logicalWidth;
        const scaleY = (window.innerHeight - padding * 2) / logicalHeight;
        const scale = Math.min(scaleX, scaleY);
        
        // Set canvas size to scaled dimensions
        this.canvas.width = logicalWidth;
        this.canvas.height = logicalHeight;
        
        // Apply CSS scaling
        this.canvas.style.width = `${logicalWidth * scale}px`;
        this.canvas.style.height = `${logicalHeight * scale}px`;
        
        // Center the canvas
        this.canvas.style.position = 'fixed';
        this.canvas.style.left = '50%';
        this.canvas.style.top = '50%';
        this.canvas.style.transform = 'translate(-50%, -50%)';
        
        // Enable crisp pixels
        this.ctx.imageSmoothingEnabled = false;

        // Initialize grid with new dimensions
        this.grid = new Grid(this.GRID_WIDTH, this.GRID_HEIGHT);
        this.initializeLevel();

        // Set up event listeners
        window.addEventListener('keydown', this.handleInput.bind(this));
        
        // Add resize handler
        window.addEventListener('resize', () => {
            const newScaleX = (window.innerWidth - padding * 2) / logicalWidth;
            const newScaleY = (window.innerHeight - padding * 2) / logicalHeight;
            const newScale = Math.min(newScaleX, newScaleY);
            
            this.canvas.style.width = `${logicalWidth * newScale}px`;
            this.canvas.style.height = `${logicalHeight * newScale}px`;
        });
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

        // Set initial camera position centered on player
        this.updateCameraPosition();

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

    private updateCameraPosition(): void {
        // Set camera position directly based on player position
        this.cameraX = this.playerX - Math.floor(this.VIEWPORT_WIDTH / 2);
        this.cameraY = this.playerY - Math.floor(this.VIEWPORT_HEIGHT / 2);

        // Clamp camera position to level bounds
        this.cameraX = Math.max(0, Math.min(this.cameraX, this.GRID_WIDTH - this.VIEWPORT_WIDTH));
        this.cameraY = Math.max(0, Math.min(this.cameraY, this.GRID_HEIGHT - this.VIEWPORT_HEIGHT));
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
            } else if (targetTile === TileType.EXIT && this.exitRevealed) {
                this.gameWon = true;
                this.soundManager.stop('timeWarning');
                this.soundManager.play('victory');
                return;
            }

            // Clear the new position before moving there
            this.grid.setTile(newX, newY, TileType.EMPTY);
            
            // Update player position and animation
            this.playerX = newX;
            this.playerY = newY;
            this.playerAnimFrame = (this.playerAnimFrame + 1) % 4;
            this.lastPlayerMoveTime = performance.now();

            // Update camera position immediately after player moves
            this.updateCameraPosition();

            // Handle boulder pushing
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                this.tryPushBoulder(newX, newY, event.key === 'ArrowLeft' ? -1 : 1);
            }
        }
    }

    private collectDiamond(): void {
        this.score += this.POINTS_PER_DIAMOND;
        this.diamondsCollected++;
        
        if (this.diamondsCollected >= this.DIAMONDS_REQUIRED && !this.exitRevealed) {
            this.revealExit();
            this.soundManager.play('diamond');
        }
    }

    private revealExit(): void {
        // Find a suitable position for the exit
        do {
            this.exitX = Math.floor(Math.random() * (this.grid.getWidth() - 4)) + 2;
            this.exitY = Math.floor(Math.random() * (this.grid.getHeight() - 4)) + 2;
        } while (
            // Avoid player position and immediate surroundings
            (Math.abs(this.exitX - this.playerX) <= 2 && Math.abs(this.exitY - this.playerY) <= 2) ||
            // Avoid positions with boulders above (to prevent crushing)
            this.grid.getTile(this.exitX, this.exitY - 1) === TileType.BOULDER
        );

        this.exitRevealed = true;
        this.exitAppearTime = performance.now();
        // Clear the area around the exit
        this.grid.setTile(this.exitX, this.exitY, TileType.EXIT);
        // Play portal sound
        this.soundManager.play('portal');
    }

    private resetGame(): void {
        // Stop warning sound if it's playing
        this.soundManager.stop('timeWarning');
        
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
        this.lastPlayerMoveTime = 0;
        this.lastTime = 0;
        this.timeRemaining = this.TIME_LIMIT;
        this.isTimeWarning = false;
        this.lastTimeUpdate = 0;
        this.exitRevealed = false;
        this.exitX = -1;
        this.exitY = -1;
        this.exitAppearTime = 0;
        
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
        return tile === TileType.EMPTY || tile === TileType.DIRT || tile === TileType.DIAMOND || tile === TileType.EXIT;
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

    private updateTime(timestamp: number): void {
        if (this.gameOver || this.gameWon) {
            // Only stop warning sound once when game ends
            if (this.isTimeWarning) {
                this.soundManager.stop('timeWarning');
                this.isTimeWarning = false;
            }
            return;
        }

        // Update time every second
        if (timestamp - this.lastTimeUpdate >= 1000) {
            this.timeRemaining--;
            this.lastTimeUpdate = timestamp;

            // Check for time warning state
            if (this.timeRemaining <= this.TIME_WARNING_THRESHOLD && !this.isTimeWarning) {
                console.log('Time warning triggered:', {
                    timeRemaining: this.timeRemaining,
                    threshold: this.TIME_WARNING_THRESHOLD,
                    isTimeWarning: this.isTimeWarning
                });
                this.isTimeWarning = true;
                this.soundManager.play('timeWarning');
            }

            // Check if time has run out
            if (this.timeRemaining <= 0) {
                console.log('Time ran out, stopping warning sound');
                this.timeRemaining = 0;
                this.gameOver = true;
                this.soundManager.stop('timeWarning');
                this.isTimeWarning = false;  // Reset warning state
                this.soundManager.play('explosion');
            }
        }
    }

    private updateCamera(deltaTime: number): void {
        // Calculate target camera position (centered on player)
        this.targetCameraX = this.playerX - Math.floor(this.VIEWPORT_WIDTH / 2);
        this.targetCameraY = this.playerY - Math.floor(this.VIEWPORT_HEIGHT / 2);

        // Clamp target position to level bounds
        this.targetCameraX = Math.max(0, Math.min(this.targetCameraX, this.GRID_WIDTH - this.VIEWPORT_WIDTH));
        this.targetCameraY = Math.max(0, Math.min(this.targetCameraY, this.GRID_HEIGHT - this.VIEWPORT_HEIGHT));

        // Calculate distance to target
        const dx = this.targetCameraX - this.cameraX;
        const dy = this.targetCameraY - this.cameraY;

        // Only move camera if we're outside the deadzone
        if (Math.abs(dx) > this.CAMERA_DEADZONE || Math.abs(dy) > this.CAMERA_DEADZONE) {
            // Calculate movement this frame
            const moveSpeed = this.CAMERA_LERP_SPEED * (deltaTime / 1000);
            
            // Calculate new positions
            let newX = this.cameraX + dx * moveSpeed;
            let newY = this.cameraY + dy * moveSpeed;
            
            // Prevent overshooting by clamping to target position
            if (dx > 0) {
                newX = Math.min(newX, this.targetCameraX);
            } else {
                newX = Math.max(newX, this.targetCameraX);
            }
            
            if (dy > 0) {
                newY = Math.min(newY, this.targetCameraY);
            } else {
                newY = Math.max(newY, this.targetCameraY);
            }
            
            // Update camera position
            this.cameraX = newX;
            this.cameraY = newY;

            // Ensure camera stays within bounds
            this.cameraX = Math.max(0, Math.min(this.cameraX, this.GRID_WIDTH - this.VIEWPORT_WIDTH));
            this.cameraY = Math.max(0, Math.min(this.cameraY, this.GRID_HEIGHT - this.VIEWPORT_HEIGHT));
        }
    }

    start(): void {
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    private gameLoop(timestamp: number): void {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        // Update time
        this.updateTime(timestamp);

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
        
        // Add time remaining display
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        const timeText = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        const timeColor = this.isTimeWarning ? (Math.floor(Date.now() / 500) % 2 === 0 ? '#FF0000' : '#FFFFFF') : '#FFFFFF';
        this.ctx.fillStyle = timeColor;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(timeText, this.canvas.width / 2, this.SCORE_AREA_HEIGHT/2 + 8);
        
        // Add diamond icon and count
        this.ctx.fillStyle = '#00FFFF';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'right';
        const diamondText = `💎 ${this.diamondsCollected}/${this.DIAMONDS_REQUIRED}`;
        this.ctx.fillText(diamondText, this.canvas.width - 20, this.SCORE_AREA_HEIGHT/2 + 8);

        // Create a clipping region for the game area
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(0, this.SCORE_AREA_HEIGHT, this.canvas.width, this.canvas.height - this.SCORE_AREA_HEIGHT);
        this.ctx.clip();

        // Translate for game area only
        this.ctx.translate(
            -this.cameraX * this.TILE_SIZE,
            -this.cameraY * this.TILE_SIZE + this.SCORE_AREA_HEIGHT
        );
        
        // Render the game grid
        const startX = Math.floor(this.cameraX);
        const startY = Math.floor(this.cameraY);
        const endX = startX + this.VIEWPORT_WIDTH + 1;
        const endY = startY + this.VIEWPORT_HEIGHT + 1;

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                if (this.grid.isInBounds(x, y)) {
                    const tile = this.grid.getTile(x, y);
                    this.renderTile(x, y, tile);
                }
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
            [TileType.PLAYER]: '#FF0000',
            [TileType.EXIT]: '#00FF00'  // Green color for exit
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

        } else if (type === TileType.EXIT) {
            const centerX = (x * this.TILE_SIZE) + (this.TILE_SIZE / 2);
            const centerY = (y * this.TILE_SIZE) + (this.TILE_SIZE / 2);
            const size = this.TILE_SIZE * 0.8;

            // Calculate animation progress
            const timeSinceAppear = performance.now() - this.exitAppearTime;
            const appearProgress = Math.min(1, timeSinceAppear / this.EXIT_APPEAR_DELAY);
            
            // Create portal effect
            const portalGradient = this.ctx.createRadialGradient(
                centerX, centerY, 0,
                centerX, centerY, size * appearProgress
            );
            portalGradient.addColorStop(0, '#00FF00');  // Bright green center
            portalGradient.addColorStop(0.6, '#008000'); // Darker green
            portalGradient.addColorStop(1, '#004000');   // Even darker green

            // Draw swirling portal
            this.ctx.save();
            this.ctx.translate(centerX, centerY);
            this.ctx.rotate(performance.now() / 1000);  // Rotate based on time

            // Draw multiple arcs for swirl effect
            for (let i = 0; i < 4; i++) {
                const rotation = (Math.PI / 2) * i + (performance.now() / 1000);
                this.ctx.beginPath();
                this.ctx.arc(0, 0, size * 0.5 * appearProgress, rotation, rotation + Math.PI * 0.3);
                this.ctx.strokeStyle = `rgba(0, 255, 0, ${0.7 - i * 0.15})`;
                this.ctx.lineWidth = 3;
                this.ctx.stroke();
            }

            this.ctx.restore();

            // Draw the main portal
            this.ctx.fillStyle = portalGradient;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, size * 0.5 * appearProgress, 0, Math.PI * 2);
            this.ctx.fill();

            // Add glow effect
            const glowSize = size * (0.7 + Math.sin(performance.now() / 500) * 0.1);
            const glowGradient = this.ctx.createRadialGradient(
                centerX, centerY, 0,
                centerX, centerY, glowSize
            );
            glowGradient.addColorStop(0, 'rgba(0, 255, 0, 0.2)');
            glowGradient.addColorStop(1, 'rgba(0, 255, 0, 0)');
            this.ctx.fillStyle = glowGradient;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, glowSize, 0, Math.PI * 2);
            this.ctx.fill();

            return;
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