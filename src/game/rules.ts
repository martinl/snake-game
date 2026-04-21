import {
  Cell,
  Direction,
  GRID_H,
  GRID_W,
  GameState,
  GameStatus,
  MIN_TICK_MS,
  SPEED_UP_FACTOR,
  spawnFood,
} from './state';

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const VECTOR: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function bufferDirection(state: GameState, next: Direction): void {
  if (state.status !== 'playing') return;
  if (next === OPPOSITE[state.dir]) return;
  state.nextDir = next;
}

export function tick(state: GameState): GameStatus {
  if (state.status !== 'playing') return state.status;

  state.dir = state.nextDir;
  const v = VECTOR[state.dir];
  const head = state.snake[0];
  const newHead: Cell = { x: head.x + v.x, y: head.y + v.y };

  if (newHead.x < 0 || newHead.x >= GRID_W || newHead.y < 0 || newHead.y >= GRID_H) {
    state.status = 'gameover';
    return state.status;
  }

  const willEat = newHead.x === state.food.x && newHead.y === state.food.y;
  // Tail will move unless we eat, so exclude the last segment from self-collision in that case
  const checkLen = willEat ? state.snake.length : state.snake.length - 1;
  for (let i = 0; i < checkLen; i++) {
    if (state.snake[i].x === newHead.x && state.snake[i].y === newHead.y) {
      state.status = 'gameover';
      return state.status;
    }
  }

  state.snake.unshift(newHead);
  if (willEat) {
    state.score += 1;
    state.tickMs = Math.max(MIN_TICK_MS, state.tickMs * SPEED_UP_FACTOR);
    state.food = spawnFood(state.snake);
  } else {
    state.snake.pop();
  }
  return state.status;
}
