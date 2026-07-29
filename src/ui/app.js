import { BERRIES, DISHES } from '../model/fruit.js';
import { buildRecipe, scoreAt } from '../model/recipe.js';
import { FAMILIES, FAMILY_KEYS, getFamily } from '../model/families.js';
import { TriangleChart, rampCss } from './triangle.js';
import { renderRecipe } from './recipe-view.js';
import { renderRateForm, loadBakes } from './rate-view.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const state = {
  familyKey: 'rubbed',
  coords: { crumble: 1 / 3, crisp: 1 / 3, cobbler: 1 / 3 },
  berryKey: 'mixed',
  dishKey: 'square20',
  diet: { vegan: false, glutenFree: false },
  // The plotted recipe the current point came from, if it came from one.
  marker: null,
};

function family() { return getFamily(state.familyKey); }

/**
 * Surveyed recipes, projected onto the triangles by scripts/build-anchors.mjs.
 *
 * Fetched rather than imported so a missing or stale file degrades to "no
 * markers" instead of a blank page — the surface is the point, the markers are
 * an overlay on it.
 */
let ANCHORS = [];
async function loadAnchors() {
  try {
    const res = await fetch('data/anchors.json');
    if (!res.ok) return [];
    const json = await res.json();
    return json.anchors ?? [];
  } catch {
    return [];
  }
}

function berry() { return BERRIES[state.berryKey]; }
function dish() { return DISHES[state.dishKey]; }
function recipe(coords) {
  return buildRecipe(coords, state.berryKey, state.dishKey, state.diet, state.familyKey);
}

function fmtCoords(c) {
  return family().keys.map((k) => Math.round((c[k] ?? 0) * 100)).join(' / ');
}

/** "crumble/crisp/cobbler" — the running order of whichever family is loaded. */
function cornerRunOn() {
  const f = family();
  return f.keys.map((k) => (f.vertices[k].short ?? f.vertices[k].label).toLowerCase()).join('/');
}

/** One citation line for a plotted recipe or a saved bake. */
function citation(m, { hover = false } = {}) {
  const stars = m.rating != null
    ? `<b>${m.rating}★</b>${m.ratingCount ? `/${m.ratingCount}` : ''}`
    : '<span class="muted">unrated</span>';
  const name = m.kind === 'bake'
    ? `Your bake${m.title ? ` — ${esc(m.title)}` : ''}`
    : `${esc(m.source)} — ${esc(m.title)}`;
  const link = m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">${name}</a>` : name;
  const off = m.kind === 'anchor' && m.onPlane === false
    ? ` <span class="muted">${m.worst.field} ${m.worst.delta.toFixed(2)} ${m.worst.direction}</span>`
    : '';
  return `<span class="cite">${link} ${stars}${off}${
    hover ? ' <span class="muted">— click to go there</span>' : ''}</span>`;
}

function renderReadout(coords, isHover, marker) {
  const el = $('#readout');
  if (marker) {
    el.innerHTML = citation(marker, { hover: true });
    return;
  }
  if (!coords) {
    const r = recipe(state.coords);
    el.innerHTML = `
      <span>Selected <b>${fmtCoords(state.coords)}</b> ${cornerRunOn()}</span>
      <span>Quality <b>${r.score.overall.toFixed(2)}</b></span>
      <span>Hydration <b>${r.axes.hydration.toFixed(0)}%</b></span>
      <span>${r.morphology.label}</span>
      ${state.marker ? citation(state.marker) : ''}`;
    return;
  }
  const s = scoreAt(coords, berry(), dish(), state.diet, state.familyKey);
  el.innerHTML = `
    <span>${isHover ? 'Hovering' : 'Selected'} <b>${fmtCoords(coords)}</b> ${cornerRunOn()}</span>
    <span>Quality <b>${s.toFixed(2)}</b></span>`;
}

function renderTable() {
  const rows = family().tablePoints.map(([name, c]) => {
    const r = recipe(c);
    return `<tr>
      <td>${name}</td>
      <td class="n">${fmtCoords(r.coords)}</td>
      <td class="n">${r.axes.hydration.toFixed(0)}%</td>
      <td>${r.morphology.label}</td>
      <td class="n">${r.score.overall.toFixed(3)}</td>
    </tr>`;
  }).join('');

  $('#tablebody').innerHTML = rows;
}

function refreshMarkers(chart) {
  chart.setAnchors(ANCHORS);
  chart.setBakes(loadBakes());
  const n = ANCHORS.filter((a) => a.family === state.familyKey && a.plottable).length;
  const off = ANCHORS.filter((a) => a.family === state.familyKey && !a.plottable).length;
  $('#anchor-count').textContent = ANCHORS.length
    ? `— ${n} fit this triangle${off ? `, ${off} sit too far off it to place` : ''}`
    : '';
}

function refresh(chart) {
  const r = recipe(state.coords);
  renderRecipe($('#recipe'), r);
  renderRateForm($('#rate'), r, family(), (_bakes, goTo) => {
    // Re-render rather than patching the list in place: a saved bake changes the
    // markers, the "your bakes" list and (if you jumped to it) the whole recipe,
    // and selecting the point already routes back through here.
    if (goTo && chart) { chart.select(goTo.coords); return; }
    if (chart) refreshMarkers(chart);
    refresh(chart);
  });
  renderReadout(null);
  renderTable();
  const [lo, hi] = family().scoreDomain;
  $('#lo').textContent = lo.toFixed(2);
  $('#hi').textContent = hi.toFixed(2);
  $('#corner-head').textContent = family().keys
    .map((k) => family().vertices[k].short ?? family().vertices[k].label)
    .join(' / ');

  // The visible seam on the poured surface is a real branch, not an artefact.
  // Saying so is cheaper than having it read as a rendering bug.
  if (chart) refreshMarkers(chart);
  $('#surface-note').innerHTML =
    state.familyKey === 'poured'
      ? ' The seam is real, not a rendering fault: past half a sonker the fruit is pre-baked and'
        + ' the batter goes on top, which forecloses the inversion.'
      : '';
}

/**
 * Rebuild the presets for the current family. They are the fastest way to reach
 * a named dish, and they are the only control whose labels change wholesale when
 * the family switches.
 */
function renderPresets(chart) {
  const presetBox = $('#presets');
  presetBox.innerHTML = '';
  for (const p of family().presets) {
    const b = document.createElement('button');
    b.textContent = p.label;
    b.addEventListener('click', () => chart.select(p.coords));
    presetBox.appendChild(b);
  }
  const best = document.createElement('button');
  best.textContent = 'Best for this fruit';
  best.className = 'primary';
  best.addEventListener('click', () => chart.select(chart.bestPoint()));
  presetBox.appendChild(best);
}

function init() {
  // Selects
  const berrySel = $('#berry');
  berrySel.innerHTML = Object.values(BERRIES)
    .map((b) => `<option value="${b.key}">${b.label}</option>`)
    .join('');
  berrySel.value = state.berryKey;

  const dishSel = $('#dish');
  dishSel.innerHTML = Object.values(DISHES)
    .map((d) => `<option value="${d.key}">${d.label}</option>`)
    .join('');
  dishSel.value = state.dishKey;

  const chart = new TriangleChart(
    $('#triangle'),
    (coords, marker) => {
      state.coords = coords;
      state.marker = marker ?? null;
      refresh(chart);
    },
    (coords, marker) => renderReadout(coords, true, marker),
    family(),
  );

  // FAMILY SWITCH. Not a filter or a relabelling — it swaps the vertices, the
  // ingredient fields, the morphology model, the quality model and the colour
  // domain together. The two surfaces are produced by different models and are
  // deliberately not comparable; see poured/score.js.
  const famBox = $('#family');
  famBox.innerHTML = FAMILY_KEYS.map(
    (k) => `<option value="${k}">${FAMILIES[k].label}</option>`,
  ).join('');
  famBox.value = state.familyKey;
  famBox.addEventListener('change', () => {
    state.familyKey = famBox.value;
    const f = family();
    $('#family-blurb').textContent = f.blurb;
    chart.setFamily(f, false);
    chart.setContext(berry(), dish(), state.diet);
    renderPresets(chart);
    // Land on the centroid of the new triangle rather than carrying coordinates
    // across — the corner names do not correspond between families.
    const centre = {};
    for (const k of f.keys) centre[k] = 1 / 3;
    chart.select(centre);
  });
  $('#family-blurb').textContent = family().blurb;

  berrySel.addEventListener('change', () => {
    state.berryKey = berrySel.value;
    chart.setContext(berry(), dish(), state.diet);
    refresh(chart);
  });

  dishSel.addEventListener('change', () => {
    state.dishKey = dishSel.value;
    chart.setContext(berry(), dish(), state.diet);
    refresh(chart);
  });

  // Diet switches. Each one changes the chemistry, so the whole surface is
  // recomputed rather than the recipe merely being relabelled.
  for (const [id, flag] of [['vegan', 'vegan'], ['gf', 'glutenFree']]) {
    const box = document.getElementById(id);
    box.addEventListener('change', () => {
      state.diet = { ...state.diet, [flag]: box.checked };
      chart.setContext(berry(), dish(), state.diet);
      refresh(chart);
    });
  }

  const anchorBox = $('#show-anchors');
  anchorBox.addEventListener('change', () => chart.setShowAnchors(anchorBox.checked));

  renderPresets(chart);

  // Legend ramp, themed the same way the surface is.
  const paintLegend = () => {
    $('#ramp').style.background = rampCss(chart.isDark());
  };
  paintLegend();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintLegend);

  chart.setContext(berry(), dish(), state.diet);
  chart.select(state.coords);
  refresh(chart);

  // Markers arrive when the file does; the surface never waits on them.
  loadAnchors().then((a) => {
    ANCHORS = a;
    refreshMarkers(chart);
  });
}

init();
