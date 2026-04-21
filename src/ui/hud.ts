const HI_KEY = 'snake.hiscore.v1';

export function loadHi(): number {
  const raw = localStorage.getItem(HI_KEY);
  if (raw === null) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function saveHi(n: number): void {
  localStorage.setItem(HI_KEY, String(n));
}

export type Hud = {
  setScore: (n: number) => void;
  setHi: (n: number) => void;
  showOverlay: (title: string, sub: string) => void;
  hideOverlay: () => void;
};

function required<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
}

export function createHud(): Hud {
  const scoreEl = required<HTMLElement>('score');
  const hiEl = required<HTMLElement>('hi');
  const overlay = required<HTMLElement>('overlay');
  const titleEl = required<HTMLElement>('overlay-title');
  const subEl = required<HTMLElement>('overlay-sub');

  return {
    setScore: (n) => { scoreEl.textContent = String(n); },
    setHi: (n) => { hiEl.textContent = String(n); },
    showOverlay: (title, sub) => {
      titleEl.textContent = title;
      subEl.textContent = sub;
      overlay.classList.remove('hidden');
    },
    hideOverlay: () => { overlay.classList.add('hidden'); },
  };
}
