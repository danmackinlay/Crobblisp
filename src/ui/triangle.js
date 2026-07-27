import { scoreAt } from '../model/recipe.js';
import { SCORE_DOMAIN } from '../model/score.js';

/**
 * Ternary quality surface.
 *
 * Sequential encoding — one hue, magnitude only. The dark ramp is stepped for
 * the dark surface rather than flipped: on light, near-zero recedes to pale and
 * the good regions go deep; on dark, near-zero recedes toward the dark surface
 * and the good regions come up bright. Both directions leave "bad" as the value
 * closest to the page.
 */
const RAMP_LIGHT = [
  '#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7',
  '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b',
];
const RAMP_DARK = [...RAMP_LIGHT].reverse();

const SQRT3_2 = Math.sqrt(3) / 2;

const hexToRgb = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

function rampSampler(dark) {
  const stops = (dark ? RAMP_DARK : RAMP_LIGHT).map(hexToRgb);
  const last = stops.length - 1;
  return (t) => {
    const x = Math.max(0, Math.min(1, t)) * last;
    const i = Math.min(last - 1, Math.floor(x));
    const f = x - i;
    const a = stops[i];
    const b = stops[i + 1];
    return [
      Math.round(a[0] + f * (b[0] - a[0])),
      Math.round(a[1] + f * (b[1] - a[1])),
      Math.round(a[2] + f * (b[2] - a[2])),
    ];
  };
}

export function rampCss(dark) {
  return `linear-gradient(to right, ${(dark ? RAMP_DARK : RAMP_LIGHT).join(',')})`;
}

export class TriangleChart {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {(coords) => void} onPick   fired on click/drag/keyboard
   * @param {(coords|null) => void} onHover
   */
  constructor(canvas, onPick, onHover) {
    this.canvas = canvas;
    this.onPick = onPick;
    this.onHover = onHover;
    this.selected = { crumble: 1 / 3, crisp: 1 / 3, cobbler: 1 / 3 };
    this.berry = null;
    this.dish = null;
    this.surface = null; // offscreen heat field
    this.geom = null;

    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute(
      'aria-label',
      'Ternary quality surface. Crumble at the lower left, crisp at the top, cobbler at the lower right. Arrow keys move the selected blend; a table of the same data is below the chart.',
    );

    const pick = (ev) => {
      const c = this.fromEvent(ev);
      if (c) this.select(c);
    };

    canvas.addEventListener('pointerdown', (ev) => {
      canvas.setPointerCapture(ev.pointerId);
      this.dragging = true;
      pick(ev);
    });
    canvas.addEventListener('pointermove', (ev) => {
      if (this.dragging) pick(ev);
      else this.onHover(this.fromEvent(ev));
    });
    canvas.addEventListener('pointerup', () => { this.dragging = false; });
    canvas.addEventListener('pointerleave', () => { this.dragging = false; this.onHover(null); });

    canvas.addEventListener('keydown', (ev) => {
      const step = ev.shiftKey ? 0.05 : 0.015;
      const s = { ...this.selected };
      switch (ev.key) {
        case 'ArrowUp': s.crisp += step; s.crumble -= step / 2; s.cobbler -= step / 2; break;
        case 'ArrowDown': s.crisp -= step; s.crumble += step / 2; s.cobbler += step / 2; break;
        case 'ArrowLeft': s.crumble += step; s.cobbler -= step; break;
        case 'ArrowRight': s.cobbler += step; s.crumble -= step; break;
        default: return;
      }
      ev.preventDefault();
      this.select(s);
    });

    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(canvas.parentElement);

    this.themeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.themeQuery.addEventListener('change', () => { this.surface = null; this.render(); });
  }

  isDark() {
    const stamped = document.documentElement.dataset.theme;
    if (stamped === 'dark') return true;
    if (stamped === 'light') return false;
    return this.themeQuery.matches;
  }

  setContext(berry, dish, diet) {
    this.berry = berry;
    this.dish = dish;
    this.diet = diet;
    this.surface = null; // fruit and diet both change the field, so recompute
    this.render();
  }

  select(coords) {
    const total = Math.max(0, coords.crumble) + Math.max(0, coords.crisp) + Math.max(0, coords.cobbler);
    if (total <= 0) return;
    this.selected = {
      crumble: Math.max(0, coords.crumble) / total,
      crisp: Math.max(0, coords.crisp) / total,
      cobbler: Math.max(0, coords.cobbler) / total,
    };
    this.onPick(this.selected);
    this.render();
  }

  /** Layout in CSS pixels: an equilateral triangle inset in the canvas box. */
  layout(w, h) {
    const padX = 26;
    const padTop = 22;
    const padBottom = 34;
    const side = Math.min(w - padX * 2, (h - padTop - padBottom) / SQRT3_2);
    const height = side * SQRT3_2;
    const cx = w / 2;
    const top = padTop + (h - padTop - padBottom - height) / 2;
    return {
      side,
      crisp: [cx, top],
      crumble: [cx - side / 2, top + height],
      cobbler: [cx + side / 2, top + height],
    };
  }

  toXY(coords, g) {
    return [
      coords.crumble * g.crumble[0] + coords.crisp * g.crisp[0] + coords.cobbler * g.cobbler[0],
      coords.crumble * g.crumble[1] + coords.crisp * g.crisp[1] + coords.cobbler * g.cobbler[1],
    ];
  }

  toBary(x, y, g) {
    const [x1, y1] = g.crumble;
    const [x2, y2] = g.crisp;
    const [x3, y3] = g.cobbler;
    const d = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
    const a = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / d;
    const b = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / d;
    return { crumble: a, crisp: b, cobbler: 1 - a - b };
  }

  fromEvent(ev) {
    if (!this.geom) return null;
    const r = this.canvas.getBoundingClientRect();
    const c = this.toBary(ev.clientX - r.left, ev.clientY - r.top, this.geom);
    const tol = -0.02;
    if (c.crumble < tol || c.crisp < tol || c.cobbler < tol) return null;
    return {
      crumble: Math.max(0, c.crumble),
      crisp: Math.max(0, c.crisp),
      cobbler: Math.max(0, c.cobbler),
    };
  }

  /**
   * The heat field, computed once per fruit/dish/theme at modest resolution and
   * then scaled up. The surface is smooth by construction — morphology is
   * piecewise-linear and continuous — so upscaling loses nothing real.
   */
  buildSurface(dark) {
    const N = 260;
    const H = Math.round(N * SQRT3_2);
    const off = document.createElement('canvas');
    off.width = N;
    off.height = H;
    const ctx = off.getContext('2d');
    const img = ctx.createImageData(N, H);
    const data = img.data;
    const ramp = rampSampler(dark);
    const [lo, hi] = SCORE_DOMAIN;

    const g = { crumble: [0, H], crisp: [N / 2, 0], cobbler: [N, H] };

    for (let py = 0; py < H; py++) {
      for (let px = 0; px < N; px++) {
        const c = this.toBary(px + 0.5, py + 0.5, g);
        const i = (py * N + px) * 4;
        if (c.crumble < 0 || c.crisp < 0 || c.cobbler < 0) {
          data[i + 3] = 0;
          continue;
        }
        const s = scoreAt(c, this.berry, this.dish, this.diet);
        const [r, gg, b] = ramp((s - lo) / (hi - lo));
        data[i] = r;
        data[i + 1] = gg;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.surface = off;
  }

  render() {
    if (!this.berry || !this.dish) return;
    const canvas = this.canvas;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(240, rect.width);
    const h = Math.max(220, rect.height);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const dark = this.isDark();
    if (!this.surface) this.buildSurface(dark);

    const g = this.layout(w, h);
    this.geom = g;

    const style = getComputedStyle(document.documentElement);
    const ink = style.getPropertyValue('--text-primary').trim() || '#0b0b0b';
    const muted = style.getPropertyValue('--text-muted').trim() || '#898781';
    const surface = style.getPropertyValue('--surface-1').trim() || '#fcfcfb';

    // Heat field, clipped to the triangle so the upscaled edges stay crisp.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(...g.crisp);
    ctx.lineTo(...g.cobbler);
    ctx.lineTo(...g.crumble);
    ctx.closePath();
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      this.surface,
      g.crumble[0], g.crisp[1], g.side, g.side * SQRT3_2,
    );
    ctx.restore();

    // Recessive ternary gridlines every 20%, so composition is readable.
    ctx.save();
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.16)' : 'rgba(11,11,11,0.13)';
    ctx.lineWidth = 1;
    for (let k = 1; k <= 4; k++) {
      const t = k / 5;
      const lines = [
        [{ crumble: t, crisp: 1 - t, cobbler: 0 }, { crumble: t, crisp: 0, cobbler: 1 - t }],
        [{ crisp: t, crumble: 1 - t, cobbler: 0 }, { crisp: t, crumble: 0, cobbler: 1 - t }],
        [{ cobbler: t, crumble: 1 - t, crisp: 0 }, { cobbler: t, crumble: 0, crisp: 1 - t }],
      ];
      for (const [p, q] of lines) {
        const A = this.toXY({ crumble: 0, crisp: 0, cobbler: 0, ...p }, g);
        const B = this.toXY({ crumble: 0, crisp: 0, cobbler: 0, ...q }, g);
        ctx.beginPath();
        ctx.moveTo(A[0], A[1]);
        ctx.lineTo(B[0], B[1]);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Triangle edge.
    ctx.save();
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.35)' : 'rgba(11,11,11,0.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(...g.crisp);
    ctx.lineTo(...g.cobbler);
    ctx.lineTo(...g.crumble);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Corner labels in text ink, never a series colour.
    ctx.save();
    ctx.fillStyle = ink;
    ctx.font = '600 13px ' + style.getPropertyValue('--font').trim();
    ctx.textAlign = 'center';
    ctx.fillText('CRISP', g.crisp[0], g.crisp[1] - 9);
    ctx.textAlign = 'left';
    ctx.fillText('CRUMBLE', g.crumble[0] - 4, g.crumble[1] + 20);
    ctx.textAlign = 'right';
    ctx.fillText('COBBLER', g.cobbler[0] + 4, g.cobbler[1] + 20);

    ctx.fillStyle = muted;
    ctx.font = '11px ' + style.getPropertyValue('--font').trim();
    ctx.textAlign = 'center';
    ctx.fillText('hydration →', (g.crumble[0] + g.cobbler[0]) / 2, g.cobbler[1] + 21);
    ctx.restore();

    // Selected point: 2px surface ring so it reads against both ends of the ramp.
    const [sx, sy] = this.toXY(this.selected, g);
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = surface;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();
    ctx.restore();
  }

  /** Coarse argmax over the simplex, for the "best blend" control. */
  bestPoint(steps = 60) {
    let best = { v: -1, c: null };
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; i + j <= steps; j++) {
        const c = { crumble: i / steps, crisp: j / steps, cobbler: (steps - i - j) / steps };
        const v = scoreAt(c, this.berry, this.dish, this.diet);
        if (v > best.v) best = { v, c };
      }
    }
    return best.c;
  }
}
