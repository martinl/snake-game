import { createEngine } from './game/engine';
import { createInitialState } from './game/state';
import { bufferDirection } from './game/rules';
import { createRenderer } from './game/renderer';
import { installKeyboard } from './input/keyboard';
import { createHud, loadHi, saveHi } from './ui/hud';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvas) throw new Error('missing #game canvas');

const hud = createHud();
const render = createRenderer(canvas);

let hi = loadHi();
hud.setHi(hi);
hud.setScore(0);
hud.showOverlay('SNAKE', 'press any key');

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
    hud.showOverlay('GAME OVER', `score ${state.score} · press any key`);
  },
);

installKeyboard({
  onDir: (d) => bufferDirection(engine.getState(), d),
  onStart: () => {
    const s = engine.getState();
    if (s.status === 'idle' || s.status === 'gameover') {
      engine.reset();
      engine.begin();
      hud.hideOverlay();
    }
  },
});

engine.start();
