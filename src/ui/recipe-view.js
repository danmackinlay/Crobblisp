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
  // rubbed
  'surfaceCrisp', 'depth', 'stratification',
  'cooked', 'height', 'underside', 'cohesion',
  // poured
  'lid', 'set', 'lift', 'inversion', 'dilution',
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
    .filter((c) => c && c.weight > 0.01)
    .sort((a, b) => a.value - b.value);
  const [lowest, second] = ranked;

  if (score.overall >= 0.85) return 'a strong point on the surface';
  if (score.overall >= 0.7) return `sound — ${lowest.label.toLowerCase()} is the limiting factor`;
  return `weak on ${[lowest, second].map((c) => c.label.toLowerCase()).join(' and ')}`;
}

function componentBars(score) {
  return COMPONENT_ORDER.map((key) => {
    const c = score.components[key];
    // A zero-weight component is switched off for this point, not merely low —
    // inversion where the fruit is pre-baked, for instance. Showing an empty bar
    // would read as a failure rather than as an inapplicable criterion.
    if (!c || c.weight <= 0.01) return '';
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
  const poured = r.family.key === 'poured';
  const hasOats = t.oatsG > 0.5;
  const hasLiquid = t.buttermilkG > 0.5;
  const hasEgg = t.eggG > 0.5;
  const hasFlax = t.groundFlaxG > 0.05;
  const needsSouring = (t.liquidSplit?.lemonG ?? 0) > 0.05;
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
        <span${
          axes.fatBorneWater > 0.5 && t.buttermilkG < 0.5
            ? ' title="This water comes in inside the vegan block rather than being poured in, so it counts here but is not a separate ingredient."'
            : ''
        }><b>${axes.hydration.toFixed(0)}</b> water${
          axes.fatBorneWater > 0.5 && t.buttermilkG < 0.5 ? '<sup>*</sup>' : ''
        }</span>
        ${poured
          ? `<span><b>${basis.egg.toFixed(0)}</b> egg</span>`
          : `<span><b>${(axes.oatFraction * 100).toFixed(0)}</b> oats</span>`}
        <span><b>${basis.butter.toFixed(0)}</b> fat</span>
        <span><b>${basis.sugar.toFixed(0)}</b> sugar</span>
        <span><b>${axes.leaveningPower < 0.05 ? 'no' : axes.leaveningPower.toFixed(1)}</b> lift</span>
        <span><b>${basis.salt.toFixed(1)}</b> salt</span>
        <em>per 100 ${poured ? 'flour' : 'flour + oats'}</em>
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
        ${hasEgg ? row(L.egg, g(t.eggG), `${t.eggCount.toFixed(1)} large`) : ''}
        ${hasFlax ? row('Ground flaxseed', g(t.groundFlaxG), 'stands in for the egg') : ''}
        ${
          hasLiquid
            ? t.liquidSplit
              ? row(L.buttermilk, g(t.liquidSplit.soyG)) +
                (needsSouring ? row('Lemon juice, to sour it', g(t.liquidSplit.lemonG)) : '')
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
        <li>Heat the oven to ${bake.celsius} °C / ${bake.fahrenheit} °F.${poured ? '' : ' Butter the dish.'}</li>
        ${
          r.diet.vegan && hasLiquid && needsSouring
            ? `<li>Stir the lemon juice into the soy milk and leave it 10 minutes to sour. Keep it cold.</li>`
            : ''
        }
        ${hasFlax ? `<li>Stir the ground flaxseed into ${g(t.groundFlaxG * 3)} of the milk and leave it 10 minutes to gel — this is the egg replacement.</li>` : ''}
        <li>Toss the berries with the sugar, tapioca, lemon and salt. Rest 15 minutes so the starch hydrates${poured ? '.' : ', then tip into the dish and level.'}</li>
        ${poured ? `
        <li>Whisk the ${esc(r.diet.glutenFree ? 'flour blend' : 'flour')}, sugar, salt${hasXanthan ? ', xanthan' : ''}${hasLeaven ? ' and baking powder' : ''} together, then whisk in the ${esc(L.buttermilk.toLowerCase())}${hasEgg ? ' and eggs' : ''}${hasFlax ? ' and the flax gel' : ''} until just smooth. It should pour.</li>
        ${bake.prebake ? `<li>Bake the fruit alone for ${bake.prebakeMinutes} minutes, until it is hot and bubbling.</li>` : ''}
        ${m.assembly.steps.map((x) => `<li>${esc(x)}</li>`).join('')}
        ` : `
        <li>Whisk the ${esc(r.diet.glutenFree ? 'flour blend' : 'flour')}${hasOats ? ', oats' : ''}, both sugars, salt${hasXanthan ? ', xanthan' : ''}${hasLeaven ? ', baking powder and soda' : ''} together.</li>
        <li>Rub or cut in the cold ${esc(r.diet.vegan ? 'vegan block' : 'butter')} until it is the size of small peas. Stop while you can still see distinct pieces, and do not overwork it.</li>
        ${hasLiquid ? `<li>Add the cold ${esc(r.diet.vegan ? 'soured soy milk' : 'buttermilk')} and stir just until it comes together. Do not knead.</li>` : ''}
        ${r.diet.glutenFree ? `<li>Rest 20 minutes so the blend finishes absorbing water.</li>` : ''}
        <li>${esc(m.method)}</li>
        ${bake.prebake ? `<li>Bake the fruit alone for ${bake.prebakeMinutes} minutes first, until it begins to bubble.</li>` : ''}
        `}
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
        ${poured ? `<p class="prose callout warn"><strong>This number is not comparable to a rubbed
        score.</strong> The rubbed surface is calibrated: eight surveyed recipes at 4.5★ or better
        were scored against it, and none falls below 0.70. Not one poured or sonker source in the
        corpus carries a rating at all, so there is no equivalent test here. The ordering of the
        terms and the shape of the surface are grounded; the absolute level is not.</p>` : ''}

        ${poured ? `
        <h4>What it does in the oven — ${esc(m.label)}</h4>
        <p class="prose">This batter ${esc(m.behaviour)}. Fluidity reads ${m.fluidity.toFixed(2)}
        and inversion capacity ${m.inversionCapacity.toFixed(2)}${
          m.prebake
            ? `, but the fruit is pre-baked here, so the batter goes on top and none of that capacity is used`
            : `, so ${pct(m.lidFraction)} of the finished top is batter rather than exposed fruit`
        }. The mechanism — buoyancy, once the leavening drops the batter below the density of the
        fruit — is a model, not a measurement: the effect is described by three of the four sources
        but no source explains it, and every account online traces back to content farms citing
        nothing.</p>
        ` : `
        <h4>Shaping — ${esc(m.label)}</h4>
        <p class="prose">Heat reaches it by ${esc(m.heatPath)}. It covers ${pct(m.coverage)} of the
        surface, and ${pct(m.effectiveExposure)} of it meets dry oven air rather than sitting against
        the fruit${m.effectiveSlump > 0.08 ? `, after losing ${pct(m.effectiveSlump)} of that to slump` : ''}.
        Anything touching wet fruit is held near 100 °C by evaporative cooling and can never
        crisp, so exposure is the whole game.</p>
        `}

        ${
          poured && r.coords.sonker > 0.5
            ? `<p class="prose">Traditionally served with a <strong>dip</strong> — warm sweetened milk
               thickened slightly, poured over each portion at the table. One surveyed sonker pours
               about half a cup over the dish at the 40-minute mark instead, which is a deliberate
               late re-wetting and the exact inverse of everything the rubbed family does to keep a
               topping dry.</p>`
            : ''
        }
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
        ${poured ? `
        <p class="prose">A poured batter covers the whole dish, so load per unit area is taken
        <strong>directly from the sources</strong> rather than reconstructed from thickness and
        density — one fewer inferential step than the rubbed side manages. This point sits at
        <strong>${(t.totalG / context.dish.areaCm2).toFixed(2)} g/cm²</strong>, against measured
        values of 1.12 for the batter cobbler, 1.38 for the sonker (the heaviest load in the whole
        survey, rubbed family included) and 0.91 for the pudding cake.</p>
        ` : `
        <p class="prose">The dish and its coverage are held constant; topping mass is derived from
        area × coverage × thickness, divided by oven expansion. That lands on
        <strong>${(t.totalG / context.dish.areaCm2).toFixed(2)} g/cm²</strong> — the surveyed medians
        are 1.01 for a crumble, 0.83 for a crisp, 0.85 for a cobbler. Fruit-to-topping ratio spans
        11× across sources and is not a usable design rule; load per unit area is.</p>
        `}

        <p class="prose">${esc(bake.rationale)} ${esc(bake.descendingOption)}</p>
        <p class="prose">${esc(r.serving.rest)}</p>
      </div>
    </details>
  `;
}
