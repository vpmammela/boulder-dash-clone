import { TileType } from './TileType';

export class Grid {
    private grid: TileType[][];
    private width: number;
    private height: number;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.grid = Array(height).fill(null).map(() => 
            Array(width).fill(TileType.EMPTY)
        );
    }

    public getTile(x: number, y: number): TileType {
        if (this.isInBounds(x, y)) {
            return this.grid[y][x];
        }
        return TileType.WALL; // Out of bounds is considered a wall
    }

    public setTile(x: number, y: number, type: TileType): void {
        if (this.isInBounds(x, y)) {
            this.grid[y][x] = type;
        }
    }

    public isInBounds(x: number, y: number): boolean {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    public getWidth(): number {
        return this.width;
    }

    public getHeight(): number {
        return this.height;
    }
} 