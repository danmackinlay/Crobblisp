import { BERRIES, DISHES } from '../model/fruit.js';
import { buildRecipe, scoreAt } from '../model/recipe.js';
import { SCORE_DOMAIN } from '../model/score.js';
import { TriangleChart, rampCss } from './triangle.js';
import { renderRecipe } from './recipe-view.js';

const $ = (sel) => document.querySelector(sel);

const state = {
  coords: { crumble: 1 / 3, crisp: 1 / 3, cobbler: 1 / 3 },
  berryKey: 'mixed',
  dishKey: 'square20',
  diet: { vegan: false, glutenFree: false },
};

const PRESETS = [
  { label: 'Crumble', coords: { crumble: 1, crisp: 0, cobbler: 0 } },
  { label: 'Crisp', coords: { crumble: 0, crisp: 1, cobbler: 0 } },
  { label: 'Cobbler', coords: { crumble: 0, crisp: 0, cobbler: 1 } },
  { label: 'Sonker band', coords: { crumble: 0.6, crisp: 0.0, cobbler: 0.4 } },
  { label: 'Centre', coords: { crumble: 1 / 3, crisp: 1 / 3, cobbler: 1 / 3 } },
];

/** Named points for the accessible table view. */
const TABLE_POINTS = [
  ['Crumble', { crumble: 1, crisp: 0, cobbler: 0 }],
  ['Crisp', { crumble: 0, crisp: 1, cobbler: 0 }],
  ['Cobbler', { crumble: 0, crisp: 0, cobbler: 1 }],
  ['Crumble / crisp midpoint', { crumble: 0.5, crisp: 0.5, cobbler: 0 }],
  ['Crisp / cobbler midpoint', { crumble: 0, crisp: 0.5, cobbler: 0.5 }],
  ['Crumble / cobbler midpoint', { crumble: 0.5, crisp: 0, cobbler: 0.5 }],
  ['Sonker band (40% cobbler)', { crumble: 0.6, crisp: 0, cobbler: 0.4 }],
  ['The awkward band (62% cobbler)', { crumble: 0.38, crisp: 0, cobbler: 0.62 }],
  ['Centroid', { crumble: 1 / 3, crisp: 1 / 3, cobbler: 1 / 3 }],
];

function berry() { return BERRIES[state.berryKey]; }
function dish() { return DISHES[state.dishKey]; }
function recipe(coords) { return buildRecipe(coords, state.berryKey, state.dishKey, state.diet); }

function fmtCoords(c) {
  return `${Math.round(c.crumble * 100)} / ${Math.round(c.crisp * 100)} / ${Math.round(c.cobbler * 100)}`;
}

function renderReadout(coords, isHover) {
  const el = $('#readout');
  if (!coords) {
    const r = recipe(state.coords);
    el.innerHTML = `
      <span>Selected <b>${fmtCoords(state.coords)}</b> crumble/crisp/cobbler</span>
      <span>Quality <b>${r.score.overall.toFixed(2)}</b></span>
      <span>Hydration <b>${r.axes.hydration.toFixed(0)}%</b></span>
      <span>${r.morphology.label}</span>`;
    return;
  }
  const s = scoreAt(coords, berry(), dish(), state.diet);
  el.innerHTML = `
    <span>${isHover ? 'Hovering' : 'Selected'} <b>${fmtCoords(coords)}</b> crumble/crisp/cobbler</span>
    <span>Quality <b>${s.toFixed(2)}</b></span>`;
}

function renderTable() {
  const rows = TABLE_POINTS.map(([name, c]) => {
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

function refresh() {
  renderRecipe($('#recipe'), recipe(state.coords));
  renderReadout(null);
  renderTable();
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
    (coords) => {
      state.coords = coords;
      refresh();
    },
    (coords) => renderReadout(coords, true),
  );

  berrySel.addEventListener('change', () => {
    state.berryKey = berrySel.value;
    chart.setContext(berry(), dish(), state.diet);
    refresh();
  });

  dishSel.addEventListener('change', () => {
    state.dishKey = dishSel.value;
    chart.setContext(berry(), dish(), state.diet);
    refresh();
  });

  // Diet switches. Each one changes the chemistry, so the whole surface is
  // recomputed rather than the recipe merely being relabelled.
  for (const [id, flag] of [['vegan', 'vegan'], ['gf', 'glutenFree']]) {
    const box = document.getElementById(id);
    box.addEventListener('change', () => {
      state.diet = { ...state.diet, [flag]: box.checked };
      chart.setContext(berry(), dish(), state.diet);
      refresh();
    });
  }

  // Presets
  const presetBox = $('#presets');
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.textContent = p.label;
    b.addEventListener('click', () => chart.select(p.coords));
    presetBox.appendChild(b);
  }
  const best = document.createElement('button');
  best.textContent = 'Best for this berry';
  best.className = 'primary';
  best.addEventListener('click', () => chart.select(chart.bestPoint()));
  presetBox.appendChild(best);

  // Legend ramp, themed the same way the surface is.
  const paintLegend = () => {
    $('#ramp').style.background = rampCss(chart.isDark());
  };
  paintLegend();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintLegend);
  $('#lo').textContent = SCORE_DOMAIN[0].toFixed(2);
  $('#hi').textContent = SCORE_DOMAIN[1].toFixed(2);

  chart.setContext(berry(), dish(), state.diet);
  chart.select(state.coords);
  refresh();
}

init();
