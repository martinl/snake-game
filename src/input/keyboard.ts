import { Direction } from '../game/state';

export type KeyboardHandlers = {
  onDir: (d: Direction) => void;
  onStart: () => void;
};

const DIR_KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up', W: 'up',
  s: 'down', S: 'down',
  a: 'left', A: 'left',
  d: 'right', D: 'right',
};

export function installKeyboard({ onDir, onStart }: KeyboardHandlers): void {
  window.addEventListener('keydown', (e) => {
    const dir = DIR_KEYS[e.key];
    if (dir) {
      e.preventDefault();
      onStart();
      onDir(dir);
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onStart();
    }
  });
}
