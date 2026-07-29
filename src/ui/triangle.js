import { scoreAt } from '../model/recipe.js';
import { DEFAULT_FAMILY } from '../model/families.js';

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
  constructor(canvas, onPick, onHover, family = DEFAULT_FAMILY) {
    this.canvas = canvas;
    this.onPick = onPick;
    this.onHover = onHover;
    this.berry = null;
    this.dish = null;
    this.surface = null; // offscreen heat field
    this.geom = null;
    this.anchors = [];      // surveyed recipes, projected
    this.bakes = [];        // the viewer's own rated bakes
    this.showAnchors = true;
    this.setFamily(family, false);

    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');

    const pick = (ev) => {
      // Clicking a marker snaps to it exactly, and REMEMBERS it. Without that
      // the citation vanished the moment you clicked: selecting fires a re-render
      // that redraws the readout from coordinates alone, so the one thing you
      // clicked to find out — which recipe this is — was the thing that got lost.
      const m = this.markerAt(ev);
      if (m) { this.select(m.coords, m); return; }
      const c = this.fromEvent(ev);
      if (c) this.select(c);
    };

    canvas.addEventListener('pointerdown', (ev) => {
      canvas.setPointerCapture(ev.pointerId);
      this.dragging = true;
      pick(ev);
    });
    canvas.addEventListener('pointermove', (ev) => {
      if (this.dragging) { pick(ev); return; }
      const m = this.markerAt(ev);
      this.hovered = m;
      this.onHover(this.fromEvent(ev), m);
      if (m) this.render();
    });
    canvas.addEventListener('pointerup', () => { this.dragging = false; });
    canvas.addEventListener('pointerleave', () => { this.dragging = false; this.onHover(null); });

    canvas.addEventListener('keydown', (ev) => {
      const step = ev.shiftKey ? 0.05 : 0.015;
      const s = { ...this.selected };
      const [L, T, R] = this.keys;
      switch (ev.key) {
        case 'ArrowUp': s[T] += step; s[L] -= step / 2; s[R] -= step / 2; break;
        case 'ArrowDown': s[T] -= step; s[L] += step / 2; s[R] += step / 2; break;
        case 'ArrowLeft': s[L] += step; s[R] -= step; break;
        case 'ArrowRight': s[R] += step; s[L] -= step; break;
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

  /**
   * Surveyed recipes, projected onto this family. Only plottable ones are drawn
   * — see project.js on why an off-plane recipe must not be given a position.
   */
  setAnchors(anchors) {
    this.anchors = anchors ?? [];
    this.render();
  }

  /** The viewer's own rated bakes, so a point they liked can be found again. */
  setBakes(bakes) {
    this.bakes = bakes ?? [];
    this.render();
  }

  setShowAnchors(on) {
    this.showAnchors = !!on;
    this.render();
  }

  /** Every marker currently drawn, in one list, so hit-testing sees all of them. */
  markers() {
    const out = [];
    if (this.showAnchors) {
      for (const a of this.anchors) {
        if (a.family !== this.family.key || !a.plottable) continue;
        out.push({ kind: 'anchor', ...a });
      }
    }
    for (const b of this.bakes) {
      if (b.point?.family !== this.family.key) continue;
      out.push({
        kind: 'bake',
        id: b.id,
        coords: b.point.coords,
        rating: b.outcome?.rating ?? null,
        title: b.naming || 'Your bake',
        source: b.bakedOn ? `baked ${b.bakedOn}` : 'your bake',
      });
    }
    return out;
  }

  markerAt(ev) {
    if (!this.geom) return null;
    const r = this.canvas.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    let best = null;
    let bestD = 11; // px
    for (const m of this.markers()) {
      const [mx, my] = this.toXY(m.coords, this.geom);
      const d = Math.hypot(mx - x, my - y);
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  }

  /**
   * Point the chart at a family. The corner KEYS, the labels, the axis caption
   * and the colour domain all come from it — nothing about the triangle is
   * specific to crumble/crisp/cobbler any more.
   */
  setFamily(family, rerender = true) {
    this.family = family;
    this.keys = family.keys; // [left, top, right]
    const even = {};
    for (const k of this.keys) even[k] = 1 / 3;
    this.selected = even;
    this.surface = null;

    const [L, T, R] = this.keys;
    const name = (k) => family.vertices[k].label;
    this.canvas.setAttribute(
      'aria-label',
      `Ternary quality surface for the ${family.label.toLowerCase()} family. ` +
        `${name(L)} at the lower left, ${name(T)} at the top, ${name(R)} at the lower right. ` +
        'Arrow keys move the selected blend; a table of the same data is below the chart.',
    );
    if (rerender) this.render();
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

  select(coords, marker = null) {
    let total = 0;
    for (const k of this.keys) total += Math.max(0, coords[k] ?? 0);
    if (total <= 0) return;
    const out = {};
    for (const k of this.keys) out[k] = Math.max(0, coords[k] ?? 0) / total;
    this.selected = out;
    // Cleared when you pick anywhere else, so the citation never outlives the
    // point it describes.
    this.selectedMarker = marker;
    this.onPick(this.selected, marker);
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
    // L / T / R rather than dish names: the geometry is the same triangle
    // whichever family is loaded into it.
    return {
      side,
      T: [cx, top],
      L: [cx - side / 2, top + height],
      R: [cx + side / 2, top + height],
    };
  }

  toXY(coords, g) {
    const [L, T, R] = this.keys;
    const a = coords[L] ?? 0, b = coords[T] ?? 0, c = coords[R] ?? 0;
    return [
      a * g.L[0] + b * g.T[0] + c * g.R[0],
      a * g.L[1] + b * g.T[1] + c * g.R[1],
    ];
  }

  toBary(x, y, g) {
    const [x1, y1] = g.L;
    const [x2, y2] = g.T;
    const [x3, y3] = g.R;
    const d = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
    const a = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / d;
    const b = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / d;
    const [KL, KT, KR] = this.keys;
    return { [KL]: a, [KT]: b, [KR]: 1 - a - b };
  }

  fromEvent(ev) {
    if (!this.geom) return null;
    const r = this.canvas.getBoundingClientRect();
    const c = this.toBary(ev.clientX - r.left, ev.clientY - r.top, this.geom);
    const tol = -0.02;
    if (this.keys.some((k) => c[k] < tol)) return null;
    const out = {};
    for (const k of this.keys) out[k] = Math.max(0, c[k]);
    return out;
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
    const [lo, hi] = this.family.scoreDomain;

    const g = { L: [0, H], T: [N / 2, 0], R: [N, H] };

    for (let py = 0; py < H; py++) {
      for (let px = 0; px < N; px++) {
        const c = this.toBary(px + 0.5, py + 0.5, g);
        const i = (py * N + px) * 4;
        if (this.keys.some((k) => c[k] < 0)) {
          data[i + 3] = 0;
          continue;
        }
        const s = scoreAt(c, this.berry, this.dish, this.diet, this.family);
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
    ctx.moveTo(...g.T);
    ctx.lineTo(...g.R);
    ctx.lineTo(...g.L);
    ctx.closePath();
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      this.surface,
      g.L[0], g.T[1], g.side, g.side * SQRT3_2,
    );
    ctx.restore();

    // Recessive ternary gridlines every 20%, so composition is readable.
    ctx.save();
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.16)' : 'rgba(11,11,11,0.13)';
    ctx.lineWidth = 1;
    for (let k = 1; k <= 4; k++) {
      const t = k / 5;
      const [KL, KT, KR] = this.keys;
      const lines = [
        [{ [KL]: t, [KT]: 1 - t, [KR]: 0 }, { [KL]: t, [KT]: 0, [KR]: 1 - t }],
        [{ [KT]: t, [KL]: 1 - t, [KR]: 0 }, { [KT]: t, [KL]: 0, [KR]: 1 - t }],
        [{ [KR]: t, [KL]: 1 - t, [KT]: 0 }, { [KR]: t, [KL]: 0, [KT]: 1 - t }],
      ];
      for (const [p, q] of lines) {
        const A = this.toXY(p, g);
        const B = this.toXY(q, g);
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
    ctx.moveTo(...g.T);
    ctx.lineTo(...g.R);
    ctx.lineTo(...g.L);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Corner labels in text ink, never a series colour.
    ctx.save();
    ctx.fillStyle = ink;
    ctx.font = '600 13px ' + style.getPropertyValue('--font').trim();
    ctx.textAlign = 'center';
    const [KL, KT, KR] = this.keys;
    const label = (k) => (this.family.vertices[k].short ?? this.family.vertices[k].label).toUpperCase();
    ctx.fillText(label(KT), g.T[0], g.T[1] - 9);
    ctx.textAlign = 'left';
    ctx.fillText(label(KL), g.L[0] - 4, g.L[1] + 20);
    ctx.textAlign = 'right';
    ctx.fillText(label(KR), g.R[0] + 4, g.R[1] + 20);

    ctx.fillStyle = muted;
    ctx.font = '11px ' + style.getPropertyValue('--font').trim();
    ctx.textAlign = 'center';
    ctx.fillText(this.family.axisLabel, (g.L[0] + g.R[0]) / 2, g.R[1] + 21);
    ctx.restore();

    this.drawMarkers(ctx, g, ink, surface);

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

  /**
   * Recipe markers.
   *
   * Drawn in text ink with a surface-coloured halo, never in a ramp colour. The
   * surface already uses the full blue ramp to encode quality, so a marker in
   * any of those colours would read as a value on that scale. The halo is what
   * keeps a dot legible at both ends of the ramp.
   *
   * Rating is encoded by FILL, not by hue: a well-rated recipe is solid, an
   * unrated one is hollow. There is a lot of unrated data here — every poured
   * source, for one — and a hollow ring says "no outcome recorded" without
   * inventing a colour for a number that does not exist.
   */
  drawMarkers(ctx, g, ink, surface) {
    const markers = this.markers();
    if (!markers.length) return;

    ctx.save();
    for (const m of markers) {
      const [x, y] = this.toXY(m.coords, g);
      const hovered = (this.hovered && this.hovered.id === m.id)
        || (this.selectedMarker && this.selectedMarker.id === m.id);
      const rated = m.rating != null;
      const strong = rated && m.rating >= 4.5;
      const r = (m.kind === 'bake' ? 5 : 3.6) + (hovered ? 2 : 0);

      ctx.beginPath();
      if (m.kind === 'bake') {
        // A diamond, so your own bakes are distinguishable from the survey at a
        // glance and without relying on colour.
        ctx.moveTo(x, y - r); ctx.lineTo(x + r, y);
        ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
        ctx.closePath();
      } else {
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }

      ctx.lineWidth = 3;
      ctx.strokeStyle = surface;
      ctx.stroke();
      ctx.lineWidth = m.kind === 'bake' ? 1.8 : 1.4;
      ctx.strokeStyle = ink;
      ctx.stroke();
      if (strong || m.kind === 'bake') {
        ctx.fillStyle = ink;
        ctx.fill();
      } else if (rated) {
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = ink;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  /** Coarse argmax over the simplex, for the "best blend" control. */
  bestPoint(steps = 60) {
    let best = { v: -1, c: null };
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; i + j <= steps; j++) {
        const [KL, KT, KR] = this.keys;
        const c = { [KL]: i / steps, [KT]: j / steps, [KR]: (steps - i - j) / steps };
        const v = scoreAt(c, this.berry, this.dish, this.diet, this.family);
        if (v > best.v) best = { v, c };
      }
    }
    return best.c;
  }
}
