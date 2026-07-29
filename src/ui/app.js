import { BERRIES, DISHES } from '../model/fruit.js';
import { buildRecipe, scoreAt } from '../model/recipe.js';
import { FAMILIES, FAMILY_KEYS, getFamily } from '../model/families.js';
import { TriangleChart, rampCss } from './triangle.js';
import { renderRecipe } from './recipe-view.js';

const $ = (sel) => document.querySelector(sel);

const state = {
  familyKey: 'rubbed',
  coords: { crumble: 1 / 3, crisp: 1 / 3, cobbler: 1 / 3 },
  berryKey: 'mixed',
  dishKey: 'square20',
  diet: { vegan: false, glutenFree: false },
};

function family() { return getFamily(state.familyKey); }

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

function renderReadout(coords, isHover) {
  const el = $('#readout');
  if (!coords) {
    const r = recipe(state.coords);
    el.innerHTML = `
      <span>Selected <b>${fmtCoords(state.coords)}</b> ${cornerRunOn()}</span>
      <span>Quality <b>${r.score.overall.toFixed(2)}</b></span>
      <span>Hydration <b>${r.axes.hydration.toFixed(0)}%</b></span>
      <span>${r.morphology.label}</span>`;
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

function refresh() {
  renderRecipe($('#recipe'), recipe(state.coords));
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
  $('#surface-note').innerHTML =
    state.familyKey === 'poured'
      ? ' The visible seam across the poured surface is not a rendering fault: it is where the'
        + ' assembly flips. Past half a sonker the fruit is baked first and the batter goes on top,'
        + ' which forecloses the inversion. Pre-baking is an either/or, so the step is honest —'
        + ' though the model rating the sonker\u2019s own technique below inverting is an'
        + ' unresolved argument with the source, recorded rather than tuned away.'
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
  best.textContent = 'Best for this berry';
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
    (coords) => {
      state.coords = coords;
      refresh();
    },
    (coords) => renderReadout(coords, true),
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

  renderPresets(chart);

  // Legend ramp, themed the same way the surface is.
  const paintLegend = () => {
    $('#ramp').style.background = rampCss(chart.isDark());
  };
  paintLegend();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintLegend);

  chart.setContext(berry(), dish(), state.diet);
  chart.select(state.coords);
  refresh();
}

init();
