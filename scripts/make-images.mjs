#!/usr/bin/env node
/**
 * Favicon and social-preview generator.
 *
 * The images are not drawn by hand — they are the real chart. The script serves
 * the repo, loads src/ui/triangle.js in a browser, renders the same
 * TriangleChart the page uses (same score field, same ramp, same corner labels,
 * same surveyed markers) and composites the result. So the icon can never drift
 * from the model: change a vertex value and re-run, and the picture changes.
 *
 *   node scripts/make-images.mjs        # writes assets/*.png
 *
 * Needs a Chromium and playwright-core, neither of which is a project
 * dependency — this is a build-time tool, not part of the site:
 *
 *   npm i -D playwright-core && npx playwright install chromium
 *   node scripts/make-images.mjs
 *
 * Set CHROMIUM_PATH to point at a browser binary you already have.
 */

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'assets');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function serve() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

/** Playwright ships no browser here, so find one that is already installed. */
function chromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const guesses = [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const g of guesses) if (existsSync(g)) return g;
  return null; // let playwright try its own bundled download
}

/**
 * Everything below runs inside the page. It builds throwaway charts at exact
 * pixel sizes, then composites them with the wordmark.
 */
async function draw(page) {
  return page.evaluate(async () => {
    const { TriangleChart } = await import('/src/ui/triangle.js');
    const { BERRIES, DISHES } = await import('/src/model/fruit.js');
    const { getFamily } = await import('/src/model/families.js');

    const DIET = { vegan: false, glutenFree: false };
    const anchors = await fetch('/data/anchors.json')
      .then((r) => (r.ok ? r.json() : { anchors: [] }))
      .then((j) => j.anchors ?? [])
      .catch(() => []);

    /** A chart rendered off-screen at a known CSS size. Backing store is 2×. */
    function chart(familyKey, w, h, { markers = false, best = false } = {}) {
      const stage = document.createElement('div');
      stage.style.cssText =
        `position:fixed;left:-4000px;top:0;width:${w}px;height:${h}px`;
      const canvas = document.createElement('canvas');
      stage.appendChild(canvas);
      document.body.appendChild(stage);

      const c = new TriangleChart(canvas, () => {}, () => {}, getFamily(familyKey));
      if (markers) c.setAnchors(anchors);
      else c.setShowAnchors(false);
      c.setContext(BERRIES.mixed, DISHES.square20, DIET);
      if (best) c.select(c.bestPoint(48));
      c.render();
      return c;
    }

    const toPng = (cv) => cv.toDataURL('image/png');

    // ---- social preview -------------------------------------------------
    // Drawn at 2× and downsampled, so the type edges survive.
    const W = 1280;
    const H = 640;
    const S = 2;
    const big = chart('rubbed', 430, 400, { markers: true, best: true });
    const small = chart('poured', 320, 300, { markers: true });

    const hi = document.createElement('canvas');
    hi.width = W * S;
    hi.height = H * S;
    const g = hi.getContext('2d');
    g.scale(S, S);
    g.imageSmoothingQuality = 'high';

    const css = getComputedStyle(document.documentElement);
    const v = (n, f) => css.getPropertyValue(n).trim() || f;
    const font = v('--font', 'system-ui, sans-serif');

    g.fillStyle = v('--page', '#f9f9f7');
    g.fillRect(0, 0, W, H);

    // A hairline rule down the middle keeps the card from reading as one blob
    // at thumbnail size.
    g.strokeStyle = v('--gridline', '#e1e0d9');
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(492, 84);
    g.lineTo(492, H - 84);
    g.stroke();

    g.textAlign = 'left';
    g.fillStyle = v('--text-primary', '#0b0b0b');
    g.font = `700 92px ${font}`;
    g.fillText('Crobble', 76, 250);

    g.fillStyle = v('--text-secondary', '#52514e');
    g.font = `27px ${font}`;
    g.fillText('Crisp, crumble and cobbler are three', 78, 316);
    g.fillText('corners of one composition space.', 78, 354);
    g.fillText('Pick a point — the recipe follows.', 78, 392);

    g.fillStyle = v('--text-muted', '#898781');
    g.font = `600 19px ${font}`;
    g.fillText('TWO SIMPLEXES OF FRUIT-DESSERT TOPPINGS', 78, 164);
    g.font = `18px ${font}`;
    g.fillText('github.com/danmackinlay/Crobblisp', 78, 520);

    // The charts, drawn at their CSS size from a 2× backing store.
    g.drawImage(big.canvas, 566, 92, 430, 400);
    g.drawImage(small.canvas, 972, 196, 320, 300);

    g.fillStyle = v('--text-muted', '#898781');
    g.font = `600 17px ${font}`;
    g.textAlign = 'center';
    g.fillText('RUBBED', 781, 528);
    g.fillText('POURED', 1120, 528);

    const flat = document.createElement('canvas');
    flat.width = W;
    flat.height = H;
    const fg = flat.getContext('2d');
    fg.imageSmoothingQuality = 'high';
    fg.drawImage(hi, 0, 0, W, H);

    // ---- icon -----------------------------------------------------------
    // The icon is the heat field alone. `chart.surface` is the offscreen buffer
    // the page upscales into the triangle — same score field, but with no
    // gridlines, no corner labels and no selection ring, none of which survive
    // 16 px anyway. Everything outside the simplex is already transparent
    // there, so the icon is a triangle-shaped glyph rather than a square.
    const icon = chart('rubbed', 320, 320, { markers: false });
    const field = icon.surface;

    const sizes = [512, 180, 32, 16];
    const icons = {};
    for (const n of sizes) {
      const cv = document.createElement('canvas');
      cv.width = n;
      cv.height = n;
      const c2 = cv.getContext('2d');
      c2.imageSmoothingEnabled = true;
      c2.imageSmoothingQuality = 'high';
      // An equilateral triangle is 0.866 as tall as it is wide, so fit the
      // width and centre the height; a square icon has slack top and bottom.
      const inset = Math.max(1, Math.round(n * 0.03));
      const w2 = n - inset * 2;
      const h2 = w2 * (field.height / field.width);
      const top = (n - h2) / 2;
      c2.drawImage(field, inset, top, w2, h2);

      // A hairline edge, so the glyph keeps its shape against a pale tab bar.
      c2.beginPath();
      c2.moveTo(n / 2, top);
      c2.lineTo(n - inset, top + h2);
      c2.lineTo(inset, top + h2);
      c2.closePath();
      c2.lineWidth = Math.max(1, n / 90);
      c2.strokeStyle = 'rgba(11,11,11,0.42)';
      c2.stroke();

      icons[n] = toPng(cv);
    }

    return { social: toPng(flat), icons };
  });
}

const b64 = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');

/**
 * A PNG-payload .ico, packed by hand — the format is a 6-byte header, a 16-byte
 * directory entry per image, then the payloads. Worth the twenty lines: browsers
 * and crawlers still ask for /favicon.ico whatever the <link> tags say.
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const dir = [];
  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);  // palette size — 0 for truecolour
    e.writeUInt8(0, 3);  // reserved
    e.writeUInt16LE(1, 4);  // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    dir.push(e);
  }
  return Buffer.concat([header, ...dir, ...images.map((i) => i.png)]);
}

async function main() {
  const { chromium: launcher } = await import('playwright-core');
  const server = await serve();
  const port = server.address().port;
  const exe = chromium();

  const browser = await launcher.launch({
    executablePath: exe ?? undefined,
    args: ['--no-sandbox', '--font-render-hinting=none'],
  });
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  });
  page.on('pageerror', (e) => console.error('page error:', e.message));

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle' });
  // The page's own chart must have painted once before we clone it: that is what
  // proves the module graph is healthy.
  await page.waitForFunction(() => document.querySelector('#triangle')?.width > 0);

  const { social, icons } = await draw(page);

  await mkdir(OUT, { recursive: true });
  const written = [];
  const write = async (name, dataUrl) => {
    const buf = b64(dataUrl);
    await writeFile(join(OUT, name), buf);
    written.push(`${name.padEnd(24)} ${(buf.length / 1024).toFixed(1)} kB`);
  };

  await write('social-preview.png', social);
  await write('icon-512.png', icons[512]);
  await write('apple-touch-icon.png', icons[180]);
  await write('favicon-32.png', icons[32]);
  await write('favicon-16.png', icons[16]);

  const bundle = ico([
    { size: 16, png: b64(icons[16]) },
    { size: 32, png: b64(icons[32]) },
  ]);
  await writeFile(join(ROOT, 'favicon.ico'), bundle);
  written.push(`${'favicon.ico'.padEnd(24)} ${(bundle.length / 1024).toFixed(1)} kB (repo root)`);

  await browser.close();
  server.close();
  console.log(written.join('\n'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
