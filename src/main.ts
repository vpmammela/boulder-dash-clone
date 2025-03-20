import { Game } from './game/Game';

// Get the canvas element
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;

// Create and start the game
const game = new Game(canvas);
game.start(); 