export type Direction = 'up' | 'down' | 'left' | 'right';
export type Cell = { x: number; y: number };
export type GameStatus = 'idle' | 'playing' | 'gameover';

export const GRID_W = 24;
export const GRID_H = 18;
export const INITIAL_TICK_MS = 160;
export const MIN_TICK_MS = 60;
export const SPEED_UP_FACTOR = 0.96;

export type GameState = {
  snake: Cell[];
  dir: Direction;
  nextDir: Direction;
  food: Cell;
  score: number;
  status: GameStatus;
  tickMs: number;
  elapsedMs: number;
};

export function spawnFood(snake: Cell[]): Cell {
  const occupied = new Set<number>();
  for (const c of snake) occupied.add(c.x * GRID_H + c.y);
  const free: Cell[] = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (!occupied.has(x * GRID_H + y)) free.push({ x, y });
    }
  }
  return free[Math.floor(Math.random() * free.length)];
}

export function createInitialState(): GameState {
  const midY = Math.floor(GRID_H / 2);
  const snake: Cell[] = [
    { x: 6, y: midY },
    { x: 5, y: midY },
    { x: 4, y: midY },
  ];
  return {
    snake,
    dir: 'right',
    nextDir: 'right',
    food: spawnFood(snake),
    score: 0,
    status: 'idle',
    tickMs: INITIAL_TICK_MS,
    elapsedMs: 0,
  };
}
