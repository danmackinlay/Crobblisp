import { REGIMES } from '../model/morphology.js';

const g = (v) => {
  if (v < 0.05) return '—';
  if (v < 10) return `${v.toFixed(1)} g`;
  if (v < 100) return `${Math.round(v)} g`;
  return `${Math.round(v / 5) * 5} g`;
};

const tsp = (v) => {
  if (v < 0.06) return '';
  const eighths = Math.round(v * 8);
  const whole = Math.floor(eighths / 8);
  const rem = eighths % 8;
  const frac = { 1: '⅛', 2: '¼', 3: '⅜', 4: '½', 5: '⅝', 6: '¾', 7: '⅞' }[rem] ?? '';
  const label = [whole || '', frac].filter(Boolean).join(whole && frac ? ' ' : '');
  return label ? `≈ ${label} tsp` : '';
};

const pct = (v) => `${Math.round(v * 100)}%`;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function row(name, qty, alt = '') {
  if (qty === '—') return '';
  return `<tr><td>${esc(name)}</td><td class="qty">${qty}</td><td class="alt">${esc(alt)}</td></tr>`;
}

function componentBars(score) {
  const order = ['surfaceCrisp', 'depth', 'stratification', 'cooked', 'height', 'underside', 'cohesion'];
  return order
    .map((key) => {
      const c = score.components[key];
      if (!c) return '';
      const dormant = (c.risk ?? 0) < 1e-9 && c.kind === 'defect';
      return `
        <div class="comp ${dormant ? 'dormant' : ''}" title="${esc(c.detail)}">
          <span class="name">${esc(c.label)}</span>
          <span class="track"><span class="fill" style="width:${(c.value * 100).toFixed(1)}%"></span></span>
          <span class="val">${c.value.toFixed(2)}</span>
        </div>`;
    })
    .join('');
}

export function renderRecipe(el, r) {
  const { topping: t, filling: f, morphology: m, bake, score, context, naming, axes } = r;
  const L = r.labels;
  const hasOats = t.oatsG > 0.5;
  const hasLiquid = t.buttermilkG > 0.5;
  const hasLeaven = t.bakingPowderG > 0.05 || t.bakingSodaG > 0.05;
  const hasXanthan = t.xanthanG > 0.02;
  const dietTag = [r.diet.vegan && 'vegan', r.diet.glutenFree && 'gluten-free']
    .filter(Boolean)
    .join(' · ');

  const regimeIdx = REGIMES.findIndex((x) => x.key === m.regime);

  el.innerHTML = `
    <div class="recipe-head">
      <h2>${esc(naming.name)}</h2>
      <div class="sub">
        ${esc(m.label)} · ${esc(context.berry.label.toLowerCase())} ·
        ${esc(context.dish.label)}, serves ${context.dish.serves}${
          dietTag ? ` · <strong>${esc(dietTag)}</strong>` : ''
        }
      </div>
      <div class="mix-chips">
        <span class="chip">${pct(r.coords.crumble)} crumble</span>
        <span class="chip">${pct(r.coords.crisp)} crisp</span>
        <span class="chip">${pct(r.coords.cobbler)} cobbler</span>
        <span class="chip">hydration ${axes.hydration.toFixed(0)}%</span>
        <span class="chip">oats ${(axes.oatFraction * 100).toFixed(0)}%</span>
      </div>
    </div>

    <section class="block">
      <h3>Predicted quality</h3>
      <div class="score-hero">
        <span class="num">${score.overall.toFixed(2)}</span>
        <span class="lab">weighted geometric mean — one weak component drags the whole point down</span>
      </div>
      <div class="components">${componentBars(score)}</div>
    </section>

    <section class="block">
      <h3>Topping</h3>
      <table class="ing">
        ${row(L.flour, g(t.flourG))}
        ${hasOats ? row(L.oats, g(t.oatsG)) : ''}
        ${row(L.butter, g(t.butterG))}
        ${row('Light brown sugar', g(t.sugarBrownG))}
        ${row('White sugar', g(t.sugarWhiteG))}
        ${row('Fine sea salt', g(t.saltG), tsp(t.saltTsp))}
        ${hasXanthan ? row('Xanthan gum', g(t.xanthanG), `${((t.xanthanG / t.flourG) * 100).toFixed(2)}% of flour`) : ''}
        ${t.soyMilkPowderG > 0.02 ? row('Soy milk powder', g(t.soyMilkPowderG), 'for browning') : ''}
        ${
          hasLiquid
            ? t.liquidSplit
              ? row('Soy milk, cold', g(t.liquidSplit.soyG)) +
                row('Lemon juice (to sour it)', g(t.liquidSplit.lemonG))
              : row(L.buttermilk, g(t.buttermilkG))
            : ''
        }
        ${hasLeaven ? row('Baking powder', g(t.bakingPowderG), tsp(t.bakingPowderTsp)) : ''}
        ${hasLeaven ? row('Bicarbonate of soda', g(t.bakingSodaG), tsp(t.bakingSodaTsp)) : ''}
        <tr class="total">
          <td>Total raw / dry weight</td>
          <td class="qty">${g(t.totalG)}</td>
          <td class="alt">${g(t.dryMassG)} dry</td>
        </tr>
      </table>
      ${
        r.constraintNotes.length
          ? `<div class="callout warn">${r.constraintNotes.map(esc).join('<br>')}</div>`
          : ''
      }
      ${r.dietNotes.map((n) => `<div class="callout">${esc(n)}</div>`).join('')}
    </section>

    ${
      r.substitutions.length
        ? `<section class="block">
            <h3>Substitutions and what they cost</h3>
            <div class="prose">
              <ul>${r.substitutions
                .map(
                  (s) =>
                    `<li><strong>${esc(s.from)} → ${esc(s.to)}.</strong> ${esc(s.why)}</li>`,
                )
                .join('')}</ul>
            </div>
          </section>`
        : ''
    }

    <section class="block">
      <h3>Filling</h3>
      <table class="ing">
        ${row(`${context.berry.label}`, g(f.berryMassG))}
        ${row('Sugar', g(f.sugarG))}
        ${row('Tapioca starch', g(f.tapiocaG), `or ${g(f.cornstarchAltG)} cornstarch`)}
        ${row('Lemon juice', g(f.lemonJuiceG))}
        ${row('Salt', g(f.saltG), 'a pinch')}
      </table>
      <div class="callout">${esc(f.starchNote)}</div>
      <div class="prose">
        <p>${esc(context.berry.note)} At pH ${esc(f.pH)}.</p>
        <p>Dosage comes from King Arthur's per-fruit chart — <strong>${g(f.pieDosageG)}</strong>
        for a double-crust pie — scaled to ${pct(f.openFaceFactor)} because an open topping
        evaporates water throughout the bake and needs less starch to reach the same set.</p>
      </div>
    </section>

    <section class="block">
      <h3>Shaping — ${esc(m.label)}</h3>
      <div class="prose">
        <p>${esc(m.method)}</p>
        <p>Heat reaches it by <strong>${esc(m.heatPath)}</strong>. Coverage
        ${pct(m.coverage)} of the surface; ${pct(m.effectiveExposure)} of it meets dry
        oven air rather than sitting against the fruit${
          m.effectiveSlump > 0.08
            ? `, after losing ${pct(m.effectiveSlump)} of it to slump`
            : ''
        }.</p>
        ${
          regimeIdx === 2
            ? `<div class="callout">The pastry band — cohesive enough to roll, and with
               almost no porosity of its own. The gaps you cut are the only thing keeping
               most of this topping off the fruit, and anything touching wet fruit is held
               near 100 °C and can never crisp. It is the sonker's trick: the surveyed
               Rockford crust runs about 51 parts liquid per 100 flour against a cobbler
               median of 77.</div>`
            : ''
        }
        ${
          regimeIdx === 3
            ? `<div class="callout warn">The awkward band: too slack to hold a cut edge, too
               stiff to drop cleanly, and at its greatest tendency to spread flat — which
               drives more of its mass down into the pinned zone against the fruit. Chilling
               the shaped mounds is doing real work here.</div>`
            : ''
        }
      </div>
    </section>

    <section class="block">
      <h3>Bake</h3>
      <div class="stages">
        ${bake.stages
          .map(
            (s) => `<div class="stage">
              <div class="temp">${s.celsius} °C <span style="font-size:12px;color:var(--text-muted)">/ ${s.fahrenheit} °F</span></div>
              <div class="mins">${s.minutes} min</div>
            </div>`,
          )
          .join('')}
        ${bake.stages.length > 1 ? `<div class="stage">
          <div class="temp">${bake.totalMinutes} min</div>
          <div class="mins">total</div>
        </div>` : ''}
        <div class="stage">
          <div class="temp">${bake.restMinutes} min</div>
          <div class="mins">rest before serving</div>
        </div>
      </div>
      <div class="prose">
        <p>${esc(bake.rationale)}</p>
        ${bake.prebake ? `<div class="callout warn">Bake the fruit alone for ${bake.prebakeMinutes} minutes first. At this hydration the topping has poor dry-heat access, and King Arthur pre-bakes for exactly this reason — to avoid "runny filling and gummy biscuits".</div>` : ''}
        <ul>${r.serving.doneness.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
        <p><strong>${esc(r.serving.rest)}</strong></p>
        <p>${esc(r.serving.overworking)}</p>
        <p style="color:var(--text-muted);font-size:13px">${esc(bake.descendingOption)}</p>
      </div>
    </section>

    <section class="block">
      <h3>Method</h3>
      <div class="prose">
        <ol style="padding-left:18px;margin:0">
          <li>Heat the oven to ${bake.celsius} °C / ${bake.fahrenheit} °F. Butter the dish.</li>
          ${
            r.diet.vegan && hasLiquid
              ? `<li>Stir the lemon juice into the soy milk and leave it 10 minutes to sour and thicken. Keep it cold.</li>`
              : ''
          }
          <li>Toss the berries with the sugar, tapioca, lemon and salt. Let them sit 15 minutes so the starch hydrates, then tip into the dish and level.</li>
          <li>Whisk the ${esc(r.diet.glutenFree ? 'flour blend' : 'flour')}${hasOats ? ', oats' : ''}, both sugars, salt${hasXanthan ? ', xanthan' : ''}${hasLeaven ? ', baking powder and soda' : ''} together.</li>
          <li>Rub or cut in the cold ${esc(r.diet.vegan ? 'vegan block' : 'butter')} until it is the size of small peas — stop while you can still see distinct pieces.</li>
          ${hasLiquid ? `<li>Add the cold ${esc(r.diet.vegan ? 'soured soy milk' : 'buttermilk')} and stir just until it comes together. Do not knead.</li>` : ''}
          ${r.diet.glutenFree ? `<li>Rest the mixture 20-30 minutes so the blend finishes absorbing water.</li>` : ''}
          <li>${esc(m.method)}</li>
          ${bake.prebake ? `<li>Bake the fruit alone for ${bake.prebakeMinutes} minutes, until it begins to bubble.</li>` : ''}
          <li>Bake ${bake.totalMinutes} min at ${bake.celsius} °C / ${bake.fahrenheit} °F, until the filling bubbles around the edges and the top is deep golden.</li>
          <li>Rest ${bake.restMinutes} minutes before serving.</li>
        </ol>
      </div>
    </section>

    <section class="block">
      <h3>Why these quantities</h3>
      <div class="prose">
        <p>The dish, the fruit and the coverage are held constant; the topping mass
        is derived. Baked volume is area × coverage × target thickness, divided by
        oven expansion and multiplied by raw density — so a leavened topping, which
        nearly doubles in the oven, needs less material to cover the same dish.</p>
        <p>Raw topping is <strong>${(context.toppingToFruitRatio * 100).toFixed(0)}%</strong> of
        the fruit weight here, but only <strong>${(context.dryToFruitRatio * 100).toFixed(0)}%</strong>
        once the buttermilk is discounted. Those two numbers move in opposite directions
        across the triangle, and the dry one is the honest measure of how much topping
        you are eating.</p>
      </div>
    </section>
  `;
}
