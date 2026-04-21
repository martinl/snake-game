import { GameState } from './state';
import { tick } from './rules';

export type RenderFn = (state: GameState) => void;
export type TransitionFn = (state: GameState) => void;

export type Engine = {
  start: () => void;
  stop: () => void;
  reset: () => void;
  begin: () => void;
  getState: () => GameState;
};

export function createEngine(
  initial: () => GameState,
  render: RenderFn,
  onGameOver?: TransitionFn,
): Engine {
  let state = initial();
  let last = performance.now();
  let rafId = 0;

  function loop(now: number): void {
    const dt = now - last;
    last = now;

    if (state.status === 'playing') {
      state.elapsedMs += dt;
      while (state.elapsedMs >= state.tickMs) {
        state.elapsedMs -= state.tickMs;
        const status = tick(state);
        if (status === 'gameover') {
          onGameOver?.(state);
          break;
        }
        if (status !== 'playing') break;
      }
    }

    render(state);
    rafId = requestAnimationFrame(loop);
  }

  return {
    start() {
      last = performance.now();
      rafId = requestAnimationFrame(loop);
    },
    stop() {
      cancelAnimationFrame(rafId);
    },
    reset() {
      state = initial();
    },
    begin() {
      state.status = 'playing';
      state.elapsedMs = 0;
      last = performance.now();
    },
    getState() {
      return state;
    },
  };
}
