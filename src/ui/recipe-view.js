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

const head = (label) => `<tr class="subhead"><td colspan="3">${esc(label)}</td></tr>`;

const COMPONENT_ORDER = [
  'surfaceCrisp', 'depth', 'stratification',
  'cooked', 'height', 'underside', 'cohesion',
];

/**
 * One line instead of seven bars, for the part of the page you read at a glance.
 *
 * Phrased relative to the overall score rather than against a fixed threshold.
 * A crumble scores 0.87 while sitting low on "structure beneath" and
 * "stratification" — it is a single-texture dish and those criteria barely apply
 * to it — so calling that "weak" would be misleading about a perfectly good
 * recipe. Only a genuinely poor point gets called weak.
 */
function verdict(score) {
  const ranked = COMPONENT_ORDER
    .map((k) => score.components[k])
    .filter(Boolean)
    .sort((a, b) => a.value - b.value);
  const [lowest, second] = ranked;

  if (score.overall >= 0.85) return 'a strong point on the surface';
  if (score.overall >= 0.7) return `sound — ${lowest.label.toLowerCase()} is the limiting factor`;
  return `weak on ${[lowest, second].map((c) => c.label.toLowerCase()).join(' and ')}`;
}

function componentBars(score) {
  return COMPONENT_ORDER.map((key) => {
    const c = score.components[key];
    if (!c) return '';
    return `
      <div class="comp" title="${esc(c.detail)}">
        <span class="name">${esc(c.label)}</span>
        <span class="track"><span class="fill" style="width:${(c.value * 100).toFixed(1)}%"></span></span>
        <span class="val">${c.value.toFixed(2)}</span>
      </div>`;
  }).join('');
}

export function renderRecipe(el, r) {
  const { topping: t, filling: f, morphology: m, bake, score, context, naming, axes, basis } = r;
  const L = r.labels;
  const hasOats = t.oatsG > 0.5;
  const hasLiquid = t.buttermilkG > 0.5;
  const hasLeaven = t.bakingPowderG > 0.05 || t.bakingSodaG > 0.05;
  const hasXanthan = t.xanthanG > 0.02;
  const dietTag = [r.diet.vegan && 'vegan', r.diet.glutenFree && 'gluten-free']
    .filter(Boolean)
    .join(' · ');

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
      </div>
      <!--
        The carried variables. The triangle is a two-dimensional slice through a
        much larger recipe space: hydration and oat fraction are the coordinates,
        but fat, sugar, leavening and salt are all moving too, along lines fixed
        by the corner values. Showing them makes that visible rather than implied.
      -->
      <div class="carried">
        <span><b>${axes.hydration.toFixed(0)}</b> liquid</span>
        <span><b>${(axes.oatFraction * 100).toFixed(0)}</b> oats</span>
        <span><b>${basis.butter.toFixed(0)}</b> fat</span>
        <span><b>${basis.sugar.toFixed(0)}</b> sugar</span>
        <span><b>${axes.leaveningPower < 0.05 ? 'no' : axes.leaveningPower.toFixed(1)}</b> lift</span>
        <span><b>${basis.salt.toFixed(1)}</b> salt</span>
        <em>per 100 flour + oats</em>
      </div>
    </div>

    <div class="verdict">
      <span class="num">${score.overall.toFixed(2)}</span>
      <span class="lab">predicted quality — ${esc(verdict(score))}</span>
    </div>

    <section class="block">
      <h3>Ingredients</h3>
      <table class="ing">
        ${head('Topping')}
        ${row(L.flour, g(t.flourG))}
        ${hasOats ? row(L.oats, g(t.oatsG)) : ''}
        ${row(L.butter, g(t.butterG))}
        ${row('Light brown sugar', g(t.sugarBrownG))}
        ${row('White sugar', g(t.sugarWhiteG))}
        ${row('Fine sea salt', g(t.saltG), tsp(t.saltTsp))}
        ${hasXanthan ? row('Xanthan gum', g(t.xanthanG)) : ''}
        ${t.soyMilkPowderG > 0.02 ? row('Soy milk powder', g(t.soyMilkPowderG)) : ''}
        ${
          hasLiquid
            ? t.liquidSplit
              ? row('Soy milk, cold', g(t.liquidSplit.soyG)) +
                row('Lemon juice, to sour it', g(t.liquidSplit.lemonG))
              : row(L.buttermilk, g(t.buttermilkG))
            : ''
        }
        ${hasLeaven ? row('Baking powder', g(t.bakingPowderG), tsp(t.bakingPowderTsp)) : ''}
        ${hasLeaven ? row('Bicarbonate of soda', g(t.bakingSodaG), tsp(t.bakingSodaTsp)) : ''}

        ${head('Filling')}
        ${row(context.berry.label, g(f.berryMassG))}
        ${row('Sugar', g(f.sugarG))}
        ${row('Tapioca starch', g(f.tapiocaG), `or ${g(f.cornstarchAltG)} cornstarch`)}
        ${row('Lemon juice', g(f.lemonJuiceG))}
        ${row('Salt', g(f.saltG), 'a pinch')}
      </table>
      ${
        r.constraintNotes.length
          ? `<div class="callout warn">${r.constraintNotes.map(esc).join('<br>')}</div>`
          : ''
      }
      ${r.dietNotes.map((n) => `<div class="callout">${esc(n)}</div>`).join('')}
    </section>

    <section class="block">
      <h3>Method</h3>
      <ol class="method">
        <li>Heat the oven to ${bake.celsius} °C / ${bake.fahrenheit} °F. Butter the dish.</li>
        ${
          r.diet.vegan && hasLiquid
            ? `<li>Stir the lemon juice into the soy milk and leave it 10 minutes to sour. Keep it cold.</li>`
            : ''
        }
        <li>Toss the berries with the sugar, tapioca, lemon and salt. Rest 15 minutes so the starch hydrates, then tip into the dish and level.</li>
        <li>Whisk the ${esc(r.diet.glutenFree ? 'flour blend' : 'flour')}${hasOats ? ', oats' : ''}, both sugars, salt${hasXanthan ? ', xanthan' : ''}${hasLeaven ? ', baking powder and soda' : ''} together.</li>
        <li>Rub or cut in the cold ${esc(r.diet.vegan ? 'vegan block' : 'butter')} until it is the size of small peas. Stop while you can still see distinct pieces, and do not overwork it.</li>
        ${hasLiquid ? `<li>Add the cold ${esc(r.diet.vegan ? 'soured soy milk' : 'buttermilk')} and stir just until it comes together. Do not knead.</li>` : ''}
        ${r.diet.glutenFree ? `<li>Rest 20 minutes so the blend finishes absorbing water.</li>` : ''}
        <li>${esc(m.method)}</li>
        ${bake.prebake ? `<li>Bake the fruit alone for ${bake.prebakeMinutes} minutes first, until it begins to bubble.</li>` : ''}
        <li>Bake ${bake.totalMinutes} minutes, until the filling bubbles around the edges and the top is deep golden.</li>
        <li>Rest ${bake.restMinutes} minutes before serving.</li>
      </ol>
    </section>

    <section class="block">
      <h3>Bake</h3>
      <div class="stages">
        <div class="stage">
          <div class="temp">${bake.celsius} °C</div>
          <div class="mins">${bake.fahrenheit} °F</div>
        </div>
        <div class="stage">
          <div class="temp">${bake.totalMinutes} min</div>
          <div class="mins">in the oven</div>
        </div>
        <div class="stage">
          <div class="temp">${bake.restMinutes} min</div>
          <div class="mins">rest before serving</div>
        </div>
      </div>
    </section>

    <details class="why">
      <summary>Why these numbers</summary>

      <div class="why-body">
        <h4>Predicted quality</h4>
        <div class="components">${componentBars(score)}</div>
        <p class="prose">Combined as a weighted geometric mean, so one weak component drags the
        whole point down — an uncooked underside is not rescuable by a good crust.</p>

        <h4>Shaping — ${esc(m.label)}</h4>
        <p class="prose">Heat reaches it by ${esc(m.heatPath)}. It covers ${pct(m.coverage)} of the
        surface, and ${pct(m.effectiveExposure)} of it meets dry oven air rather than sitting against
        the fruit${m.effectiveSlump > 0.08 ? `, after losing ${pct(m.effectiveSlump)} of that to slump` : ''}.
        Anything touching wet fruit is held near 100 °C by evaporative cooling and can never
        crisp, so exposure is the whole game.</p>

        ${
          m.regime === 'rollable-sheet'
            ? `<p class="prose">This is the pastry band, and the sonker's trick: cohesive enough to
               roll, with almost no porosity of its own. The gaps you cut are the only thing keeping
               the topping off the fruit.</p>`
            : ''
        }
        ${
          m.regime === 'slack-drop'
            ? `<p class="prose">The awkward band — too slack to hold a cut edge, too stiff to drop
               cleanly, and at its greatest tendency to spread flat, which pushes more of its mass
               into the pinned zone. Chilling is doing real work here.</p>`
            : ''
        }

        <h4>Filling</h4>
        <p class="prose">${esc(context.berry.note)} At pH ${esc(f.pH)}. Thickener comes from King
        Arthur's per-fruit chart — ${g(f.pieDosageG)} for a double-crust pie — scaled to
        ${pct(f.openFaceFactor)} because an open topping evaporates water throughout the bake.
        Tapioca over cornstarch for setting clear and thickening harder per gram.</p>

        ${
          r.substitutions.length
            ? `<h4>Substitutions, and what they cost</h4>
               <ul class="prose">${r.substitutions
                 .map((s) => `<li><strong>${esc(s.from)} → ${esc(s.to)}.</strong> ${esc(s.why)}</li>`)
                 .join('')}</ul>`
            : ''
        }

        <h4>Quantities</h4>
        <p class="prose">The dish and its coverage are held constant; topping mass is derived from
        area × coverage × thickness, divided by oven expansion. That lands on
        <strong>${(t.totalG / context.dish.areaCm2).toFixed(2)} g/cm²</strong> — the surveyed medians
        are 1.01 for a crumble, 0.83 for a crisp, 0.85 for a cobbler. Fruit-to-topping ratio spans
        11× across sources and is not a usable design rule; load per unit area is.</p>

        <p class="prose">${esc(bake.rationale)} ${esc(bake.descendingOption)}</p>
        <p class="prose">${esc(r.serving.rest)}</p>
      </div>
    </details>
  `;
}
