import { GRID_H, GRID_W, GameState } from './state';

const BG = '#9ebd8a';
const PX = '#0e240e';
const DOT = '#8faa7b';

export function createRenderer(canvas: HTMLCanvasElement): (state: GameState) => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  const cellW = canvas.width / GRID_W;
  const cellH = canvas.height / GRID_H;
  const pad = Math.max(1, Math.floor(Math.min(cellW, cellH) * 0.12));

  return function render(state: GameState): void {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // LCD dot-matrix hint
    ctx.fillStyle = DOT;
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        ctx.fillRect(
          Math.floor(x * cellW + cellW / 2),
          Math.floor(y * cellH + cellH / 2),
          1,
          1,
        );
      }
    }

    // Food: hollow square (ring of pixels)
    ctx.fillStyle = PX;
    const fx = state.food.x * cellW + pad;
    const fy = state.food.y * cellH + pad;
    const fw = cellW - pad * 2;
    const fh = cellH - pad * 2;
    ctx.fillRect(fx, fy, fw, fh);
    ctx.fillStyle = BG;
    const inner = Math.max(1, Math.floor(Math.min(fw, fh) / 4));
    ctx.fillRect(fx + inner, fy + inner, fw - inner * 2, fh - inner * 2);

    // Snake
    ctx.fillStyle = PX;
    for (const seg of state.snake) {
      ctx.fillRect(seg.x * cellW + pad, seg.y * cellH + pad, cellW - pad * 2, cellH - pad * 2);
    }
  };
}
