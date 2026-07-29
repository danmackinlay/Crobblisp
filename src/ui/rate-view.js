import {
  buildBakeRecord,
  validateBakeRecord,
  observationsFor,
  CONTESTED_OBSERVATIONS,
  recordFilename,
  recordJson,
  pullRequestUrl,
  BAKE_SCHEMA,
} from '../model/bake-record.js';

/**
 * "I made this" — the form that turns a prediction into a data point.
 *
 * Three destinations, in increasing order of commitment, and the first two need
 * nothing from anybody:
 *
 *   1. LOCAL. Saved in this browser. The bake becomes a marker on the surface,
 *      so a point you liked can be found again — which is most of the value and
 *      costs no trust at all.
 *   2. A FILE. Download the record as JSON. Yours to keep, mail, or attach.
 *   3. A PULL REQUEST. Opens GitHub's own new-file editor with the record
 *      already filled in. Nothing is transmitted by this page: the link just
 *      opens a URL, and you review, commit and open the PR yourself.
 *
 * No account, no name, no email is asked for anywhere. If you open a pull
 * request GitHub attributes it to you, and that is a choice made at that point
 * rather than one this form makes on your behalf.
 */

const STORAGE_KEY = 'crobble.bakes.v1';

/**
 * Saving re-renders the whole form, which would otherwise snap the panel shut
 * and throw away the confirmation the moment it appeared. The open state is
 * read back off the old DOM and a one-shot message survives exactly one render.
 */
let flash = null;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function loadBakes() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((b) => b?.schema === BAKE_SCHEMA) : [];
  } catch {
    // A corrupt or unreadable store must not take the whole page down with it.
    return [];
  }
}

function saveBakes(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false; // private mode, or quota. The download path still works.
  }
}

export function deleteBake(id) {
  const next = loadBakes().filter((b) => b.id !== id);
  saveBakes(next);
  return next;
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * @param el       container
 * @param recipe   the CURRENT recipe object from buildRecipe()
 * @param family   the family object, for the vertex fingerprint
 * @param onChange called after a save or delete, with the new list
 */
export function renderRateForm(el, recipe, family, onChange) {
  const observations = observationsFor(recipe.family.key);
  const bakes = loadBakes();
  const mine = bakes.filter((b) => b.point.family === recipe.family.key);
  const wasOpen = el.querySelector('#rate-block')?.open ?? false;

  el.innerHTML = `
    <details class="rate" id="rate-block"${wasOpen ? ' open' : ''}>
      <summary>Made it? Rate this point</summary>
      <div class="rate-body">
        <div class="rate-row">
          <label for="rate-stars">How was it?</label>
          <div class="stars" id="rate-stars" role="radiogroup" aria-label="Rating out of 5">
            ${[1, 2, 3, 4, 5].map((n) => `
              <button type="button" class="star" data-v="${n}" role="radio"
                      aria-checked="false" aria-label="${n} out of 5">${n}</button>`).join('')}
          </div>
          <span class="stars-note" id="rate-stars-note">no rating yet</span>
        </div>

        <div class="rate-row">
          <label for="rate-date">Baked on</label>
          <input type="date" id="rate-date">
          <label for="rate-oven">Oven</label>
          <select id="rate-oven">
            <option value="unknown">not sure</option>
            <option value="conventional">conventional</option>
            <option value="fan">fan / convection</option>
            <option value="gas">gas</option>
          </select>
        </div>

        <fieldset class="rate-obs">
          <legend>What actually happened? <span class="muted">(tick any)</span></legend>
          <div class="obs-grid">
            ${observations.map((o) => `
              <label class="obs ${o.polarity}${CONTESTED_OBSERVATIONS.includes(o.key) ? ' contested' : ''}">
                <input type="checkbox" value="${esc(o.key)}">
                <span>${esc(o.label)}</span>
              </label>`).join('')}
          </div>
        </fieldset>

        <div class="rate-row">
          <label class="inline"><input type="checkbox" id="rate-followed" checked>
            I followed the recipe as given</label>
        </div>
        <div class="rate-row" id="rate-dev-row" hidden>
          <label for="rate-deviations">What did you change?</label>
          <input type="text" id="rate-deviations"
                 placeholder="different fruit, less sugar, smaller dish…">
        </div>

        <div class="rate-row">
          <label for="rate-review">Notes <span class="muted">(optional)</span></label>
          <textarea id="rate-review" rows="3"
                    placeholder="How the top came out, how it held up the next day, what you would change…"></textarea>
        </div>

        <div class="rate-actions">
          <button type="button" class="primary" id="rate-save">Save to this browser</button>
          <button type="button" id="rate-download">Download record</button>
          <button type="button" id="rate-pr">Open a pull request…</button>
        </div>
        <p class="rate-status" id="rate-status" role="status"></p>
        <p class="prose tiny">Saved locally; the pull request opens GitHub prefilled for you to
        commit. No name or email collected.</p>

        ${mine.length ? `
        <div class="my-bakes">
          <h4>Your bakes on this triangle</h4>
          <ul>
            ${mine.map((b) => `
              <li>
                <button type="button" class="link goto" data-id="${esc(b.id)}">
                  ${'★'.repeat(b.outcome.rating)}${'·'.repeat(5 - b.outcome.rating)}
                  ${esc(b.naming || b.point.family)}
                </button>
                <span class="muted">${esc(b.bakedOn)}</span>
                <button type="button" class="link danger del" data-id="${esc(b.id)}">remove</button>
              </li>`).join('')}
          </ul>
        </div>` : ''}
      </div>
    </details>
  `;

  const $ = (sel) => el.querySelector(sel);
  const status = $('#rate-status');
  let rating = 0;

  if (flash) {
    status.textContent = flash.text;
    status.className = `rate-status ${flash.kind}`;
    flash = null;
  }

  $('#rate-date').value = new Date().toISOString().slice(0, 10);

  $('#rate-stars').addEventListener('click', (ev) => {
    const b = ev.target.closest('.star');
    if (!b) return;
    rating = Number(b.dataset.v);
    for (const s of el.querySelectorAll('.star')) {
      const on = Number(s.dataset.v) <= rating;
      s.classList.toggle('on', on);
      s.setAttribute('aria-checked', String(Number(s.dataset.v) === rating));
    }
    $('#rate-stars-note').textContent = `${rating} out of 5`;
  });

  $('#rate-followed').addEventListener('change', (ev) => {
    $('#rate-dev-row').hidden = ev.target.checked;
  });

  const collect = () => ({
    rating,
    bakedOn: $('#rate-date').value || undefined,
    ovenType: $('#rate-oven').value,
    followedRecipe: $('#rate-followed').checked,
    deviations: $('#rate-deviations')?.value ?? '',
    review: $('#rate-review').value,
    observations: [...el.querySelectorAll('.obs input:checked')].map((i) => i.value),
  });

  const make = () => {
    const rec = buildBakeRecord(recipe, collect(), { family });
    // Carried for the marker label only, and stripped before the record is
    // written out — a display string is not data and should not enter the corpus.
    rec.naming = recipe.naming.name;
    const { ok, errors } = validateBakeRecord(rec);
    if (!ok) {
      status.textContent = errors[0];
      status.className = 'rate-status bad';
      return null;
    }
    return rec;
  };

  const forFile = (rec) => {
    const { naming, ...clean } = rec;
    return clean;
  };

  $('#rate-save').addEventListener('click', () => {
    const rec = make();
    if (!rec) return;
    const next = [...loadBakes(), rec];
    const stored = saveBakes(next);
    const text = stored
      ? 'Saved. It is now a marker on the surface — click it to come back.'
      : 'Could not save (private browsing?). Use "Download record" instead.';
    if (stored) {
      flash = { text, kind: 'good' };
      onChange(next);
    } else {
      status.textContent = text;
      status.className = 'rate-status bad';
    }
  });

  $('#rate-download').addEventListener('click', () => {
    const rec = make();
    if (!rec) return;
    download(recordFilename(rec).split('/').pop(), recordJson(forFile(rec)));
    status.textContent = 'Downloaded.';
    status.className = 'rate-status good';
  });

  $('#rate-pr').addEventListener('click', () => {
    const rec = make();
    if (!rec) return;
    const url = pullRequestUrl(forFile(rec));
    if (!url) {
      // Long URLs get truncated by browsers and proxies, and a silently
      // truncated record is worse than no record.
      download(recordFilename(rec).split('/').pop(), recordJson(forFile(rec)));
      status.textContent =
        'That review is too long to carry in a link, so the record was downloaded instead — '
        + 'add it to data/bakes/ in a pull request.';
      status.className = 'rate-status bad';
      return;
    }
    window.open(url, '_blank', 'noopener');
    status.textContent = 'GitHub opened in a new tab with the record filled in. Review it, then commit.';
    status.className = 'rate-status good';
  });

  for (const b of el.querySelectorAll('.del')) {
    b.addEventListener('click', () => {
      flash = { text: 'Removed from this browser.', kind: 'good' };
      onChange(deleteBake(b.dataset.id));
    });
  }
  for (const b of el.querySelectorAll('.goto')) {
    b.addEventListener('click', () => {
      const rec = loadBakes().find((x) => x.id === b.dataset.id);
      if (rec) onChange(loadBakes(), rec.point);
    });
  }
}
