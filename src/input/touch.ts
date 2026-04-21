import { Direction } from '../game/state';

export type TouchHandlers = {
  onDir: (d: Direction) => void;
  onStart: () => void;
};

// Swipe distance (px) before a direction fires. ~20px per architecture doc.
const THRESHOLD = 20;

export function installTouch(target: HTMLElement | Document, handlers: TouchHandlers): void {
  const { onDir, onStart } = handlers;
  let startX = 0;
  let startY = 0;
  let active = false;

  target.addEventListener(
    'touchstart',
    (e) => {
      const ev = e as TouchEvent;
      if (ev.touches.length !== 1) return;
      const t = ev.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      active = true;
      // Any touch while idle/gameover starts the game (no-op while playing).
      onStart();
      ev.preventDefault();
    },
    { passive: false },
  );

  target.addEventListener(
    'touchmove',
    (e) => {
      const ev = e as TouchEvent;
      if (!active || ev.touches.length !== 1) return;
      const t = ev.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (Math.max(absX, absY) < THRESHOLD) return;

      if (absX > absY) {
        onDir(dx > 0 ? 'right' : 'left');
      } else {
        onDir(dy > 0 ? 'down' : 'up');
      }
      // Reset origin so the same unbroken swipe can change direction again.
      startX = t.clientX;
      startY = t.clientY;
      ev.preventDefault();
    },
    { passive: false },
  );

  target.addEventListener('touchend', () => {
    active = false;
  });

  target.addEventListener('touchcancel', () => {
    active = false;
  });
}
