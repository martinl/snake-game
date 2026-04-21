import { createEngine } from './game/engine';
import { createInitialState } from './game/state';
import { bufferDirection } from './game/rules';
import { createRenderer } from './game/renderer';
import { installKeyboard } from './input/keyboard';
import { installTouch } from './input/touch';
import { createHud, loadHi, saveHi } from './ui/hud';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvas) throw new Error('missing #game canvas');

const hud = createHud();
const render = createRenderer(canvas);

const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const startHint = hasTouch ? 'tap to start' : 'press any key';

let hi = loadHi();
hud.setHi(hi);
hud.setScore(0);
hud.showOverlay('SNAKE', startHint);

const engine = createEngine(
  createInitialState,
  (state) => {
    render(state);
    hud.setScore(state.score);
  },
  (state) => {
    if (state.score > hi) {
      hi = state.score;
      saveHi(hi);
      hud.setHi(hi);
    }
    hud.showOverlay('GAME OVER', `score ${state.score} · ${startHint}`);
  },
);

const handlers = {
  onDir: (d: Parameters<typeof bufferDirection>[1]) =>
    bufferDirection(engine.getState(), d),
  onStart: () => {
    const s = engine.getState();
    if (s.status === 'idle' || s.status === 'gameover') {
      engine.reset();
      engine.begin();
      hud.hideOverlay();
    }
  },
};

installKeyboard(handlers);
installTouch(document, handlers);

engine.start();
