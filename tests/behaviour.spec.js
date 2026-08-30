// @ts-check
// The behavioural half — roughly half this app's accessibility lives in JavaScript
// that no scanner executes. axe (100 rules), WAVE and Nu all report clean on every
// invariant below, so without this file any of them can be reverted by someone tidying
// up and the whole toolchain will still say 0 errors.
//
// Keys and pointer actions go through page.keyboard / page.mouse so they are REAL
// events. element.click() and element.focus() would bypass the exact code paths that
// break — and `.focus()` does not match `:focus-visible`, so a focus-ring check driven
// that way measures nothing at all.
//
// Invariant ids (A6, B1…) refer to a11y-3-implementation.md.

const { test, expect } = require('@playwright/test');
const {
  settle, tabSweep, LOCS, STEP_LABELS, DEFAULT_STEPS, DEFAULT_PRICES, VISIBLE_FN,
} = require('./settle');

/* ─── helpers ──────────────────────────────────────────────────────────────── */

/** The step-thumb id actually rendered at this breakpoint ('' desktop vs '-m'). */
async function visibleThumb(page, loc) {
  return page.evaluate(([visSrc, l]) => {
    const vis = eval(visSrc);
    return ['', '-m'].map((s) => document.getElementById('step-thumb-' + l + s))
      .filter((el) => el && vis(el)).map((el) => el.id)[0] || null;
  }, [VISIBLE_FN, loc]);
}

/** Whichever frequency label is rendered for this location. */
async function freqText(page, loc) {
  return page.evaluate(([visSrc, l]) => {
    const vis = eval(visSrc);
    return ['-d', '-m'].map((s) => document.getElementById('freq-label-' + l + s))
      .filter((el) => el && vis(el)).map((el) => el.textContent.trim())[0] || null;
  }, [VISIBLE_FN, loc]);
}

const activeId = (page) => page.evaluate(() => {
  const a = document.activeElement;
  return a === document.body ? 'BODY' : (a.id || a.tagName.toLowerCase() + '.' + a.className);
});

const liveText = (page) =>
  page.evaluate(() => document.getElementById('cost-live').textContent.trim());

/**
 * Drive one path that changes the result and require the live region to change.
 * Compares before/after rather than clearing the node: updateCost() dedupes on
 * `dataset.last`, so a harness that blanks textContent alone would see nothing
 * rewritten and blame the app.
 */
async function announces(page, label, drive) {
  const before = await liveText(page);
  await drive();
  await expect.poll(() => liveText(page), { timeout: 4000, message: `${label} did not announce` })
    .not.toBe(before);
  expect(await liveText(page)).toMatch(/Estimated electricity cost .* pounds per year/);
}

/**
 * Wait until the focused element has finished moving, then return its rect.
 *
 * Two frames first, then CSS animations, then rect stability — in that order, and all
 * three are needed. `.skip-link` transitions `top` from -40px to 0 over 150ms, and a
 * plain "two identical consecutive samples" check LATCHED ONTO THE PRE-TRANSITION
 * PLATEAU: it returned top:-40, the sample points came out above the viewport, and the
 * SC 2.4.11 test flaked red on 2 runs in 8 across three different viewports. Waiting
 * for two animation frames guarantees the transition has actually started before
 * getAnimations() is consulted, and three identical samples (not two) covers the
 * browser's smooth-scroll easing tail.
 */
async function stableFocusRect(page, tries = 40) {
  await page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
  for (let i = 0; i < tries; i++) {
    const running = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return false;
      return a.getAnimations({ subtree: true }).some((x) => x.playState === 'running');
    });
    if (!running) break;
    await page.waitForTimeout(40);
  }
  let last = null, hits = 0;
  for (let i = 0; i < tries; i++) {
    const r = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return null;
      const b = a.getBoundingClientRect();
      return { t: Math.round(b.top), l: Math.round(b.left),
               w: Math.round(b.width), h: Math.round(b.height) };
    });
    const key = r && `${r.t},${r.l},${r.w},${r.h}`;
    if (key && key === last) { if (++hits >= 2) return r; } else hits = 0;
    last = key;
    await page.waitForTimeout(40);
  }
  return null;
}

/* ─── B3 · focus order ─────────────────────────────────────────────────────── */

// Measured, not guessed. Both breakpoints render a DIFFERENT set: `.step-row` is
// display:none below 960 and `.step-mobile-row` is display:none at 960 and up, and the
// two orders genuinely differ — desktop puts the frequency slider before the price
// input (left column then right), mobile puts the price input first because the slider
// is a separate row underneath it. Both match visual order; neither is a typo.
// The four "More information" buttons now carry stable ids (info-btn-distance/
// -miles/-location/-fuel) so each opens its own info modal; key() below resolves
// an element with an id to that id rather than the generic 'button.q-icon-btn'.
// Edit buttons are real focusable controls now (each jumps to its price field),
// so they are real tab stops right after the field they follow in the DOM.
const ORDER_DESKTOP = [
  'a.skip-link', 'info-btn-distance', 'dist-thumb-1', 'dist-thumb-2', 'info-btn-miles',
  'miles-slider', 'info-btn-location',
  'step-thumb-home', 'price-home-d', 'button.edit-icon-btn',
  'step-thumb-work', 'price-work-d', 'button.edit-icon-btn',
  'step-thumb-public', 'price-public-d', 'button.edit-icon-btn',
  'step-thumb-motorway', 'price-motorway-d', 'button.edit-icon-btn',
  'button.reset-link', 'info-btn-fuel',
  'price-petrol', 'button.edit-icon-btn', 'price-diesel', 'button.edit-icon-btn',
  'trim-select', 'battery-select', 'info-btn-cost', 'button.cta-button',
];
const ORDER_MOBILE = [
  'a.skip-link', 'info-btn-distance', 'dist-thumb-1', 'dist-thumb-2', 'info-btn-miles',
  'miles-slider', 'info-btn-location',
  'price-home-m', 'button.edit-icon-btn', 'step-thumb-home-m',
  'price-work-m', 'button.edit-icon-btn', 'step-thumb-work-m',
  'price-public-m', 'button.edit-icon-btn', 'step-thumb-public-m',
  'price-motorway-m', 'button.edit-icon-btn', 'step-thumb-motorway-m',
  'button.reset-link', 'info-btn-fuel',
  'price-petrol', 'button.edit-icon-btn', 'price-diesel', 'button.edit-icon-btn',
  'trim-select', 'battery-select', 'info-btn-cost', 'button.cta-button',
];
const expectedOrder = (page) =>
  page.viewportSize().width >= 960 ? ORDER_DESKTOP : ORDER_MOBILE;

const key = (s) => s.id || s.tag + '.' + s.cls.split(/\s+/)[0];

test('B3 the tab order is exactly the audited sequence', async ({ page }) => {
  await settle(page);
  const stops = (await tabSweep(page)).map(key);
  expect(stops).toEqual(expectedOrder(page));
});

test('B3 the skip link is the FIRST tab stop and reaches its target', async ({ page }) => {
  await settle(page);
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await page.keyboard.press('Tab');
  expect(await activeId(page)).toBe('a.skip-link');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  // Activating it must not strand focus on <body>.
  expect(await page.evaluate(() => location.hash)).toBe('#sim-main');
});

test('B3 controls hidden at this breakpoint are OUT of the tab order', async ({ page }) => {
  // Both sets keep tabIndex 0 in the DOM; only `display:none` removes them. A refactor
  // to `visibility:hidden` or `opacity:0` would leave eight invisible tab stops that
  // every scanner still reports as clean.
  await settle(page);
  const reached = new Set((await tabSweep(page)).map((s) => s.id));
  const hidden = await page.evaluate((visSrc) => {
    const vis = eval(visSrc);
    return [...document.querySelectorAll('.step-thumb-el, input[type=number]')]
      .filter((el) => !vis(el)).map((el) => el.id);
  }, VISIBLE_FN);

  expect(hidden.length, 'eight controls belong to the other breakpoint').toBe(8);
  expect(hidden.filter((id) => reached.has(id)), 'invisible controls in the tab order')
    .toEqual([]);
});

test('B6 no keyboard trap — Tab reaches every stop and Shift+Tab retraces it', async ({ page }) => {
  await settle(page);
  const order = expectedOrder(page);
  // tabSweep stops when the FIRST stop repeats, so terminating at exactly order.length
  // is the proof that Tab left the last control and wrapped rather than sticking.
  const stops = await tabSweep(page, order.length + 8);
  expect(stops.length, 'the sweep must terminate by wrapping, not by running out')
    .toBe(order.length);

  // Forward to stop 8, then retrace with Shift+Tab and require the exact reverse.
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  const forward = [];
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); forward.push(await activeId(page)); }
  expect(forward).toEqual(order.slice(0, 8));

  const back = [];
  for (let i = 0; i < 7; i++) { await page.keyboard.press('Shift+Tab'); back.push(await activeId(page)); }
  expect(back, 'Shift+Tab must retrace the forward order exactly')
    .toEqual(order.slice(0, 7).reverse());
  expect(back.includes('BODY'), 'focus fell to <body> going backwards').toBe(false);
});

/* ─── B4 · focus indicator ─────────────────────────────────────────────────── */

// The audited ring is `outline:2px solid var(--focus-orange)` (#C86C03) = rgb(200, 108, 3),
// matching range-simulator's focus-ring convention. Asserted on the COMPUTED value after
// a REAL Tab, on EVERY stop, for three reasons each of which is a way this test could
// have been fake:
//   - Chrome normalises #C86C03 to rgb(200, 108, 3), so a stylesheet-text check passes
//     while the ring is broken;
//   - `:focus-visible` does not match a programmatic .focus(), so a .focus()-driven
//     check measures nothing;
//   - the ring is set by FIVE separate rules (.dist-thumb/.step-thumb-el, select,
//     range-sibling, reset-link, number input). Checking one control lets a mutation
//     to any of the other four straight through.
const FOCUS_ORANGE = 'rgb(200, 108, 3)';

test('B4 every tab stop paints a focus indicator, and the audited ring where the app styles one',
  async ({ page }) => {
    await settle(page);
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });

    const seen = [];
    for (let i = 0; i < expectedOrder(page).length; i++) {
      await page.keyboard.press('Tab');
      seen.push(await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        // #miles-slider is opacity:0, so its ring is painted on the sibling
        // .slider-thumb. Reading the input's own outline would measure the invisible
        // element and pass on nothing.
        const ring = el.id === 'miles-slider' ? document.getElementById('miles-thumb') : el;
        const s = getComputedStyle(ring);
        return {
          k: el.id || el.tagName.toLowerCase() + '.' + el.className.split(/\s+/)[0],
          ringOn: ring === el ? 'self' : ring.id,
          color: s.outlineColor, style: s.outlineStyle, width: parseFloat(s.outlineWidth),
          fv: el.matches(':focus-visible'),
          styled: el.matches('.dist-thumb, .step-thumb-el, .fl-select select, '
            + 'input[type=number], button.reset-link') || el.id === 'miles-slider',
        };
      }));
    }

    expect(seen.filter((s) => s === null), 'focus was lost mid-sweep').toEqual([]);
    expect(seen.length).toBe(expectedOrder(page).length);
    for (const s of seen) {
      expect(s.fv, `${s.k} did not match :focus-visible after a real Tab`).toBe(true);
      expect(s.style, `${s.k} paints no outline at all`).not.toBe('none');
      expect(s.width, `${s.k} outline width`).toBeGreaterThanOrEqual(1);
      if (s.styled) {
        expect(s.color, `audited ring colour on ${s.k} (ring on ${s.ringOn})`).toBe(FOCUS_ORANGE);
        expect(s.style, `audited ring style on ${s.k}`).toBe('solid');
        expect(s.width, `audited ring width on ${s.k}`).toBeGreaterThanOrEqual(2);
      }
    }
    // Guard the guard: if the `styled` matcher ever stops matching anything, the block
    // above becomes a no-op that still passes.
    expect(seen.filter((s) => s.styled).length,
      'the audited-ring matcher matched nothing — this test would pass on a stripped page')
      .toBeGreaterThanOrEqual(11);
  });

/* ─── B5 · SC 2.4.11 focus not obscured ────────────────────────────────────── */

test('B5 no focused control is entirely hidden by the fixed chrome', async ({ page }) => {
  // Real hit-testing rather than rect arithmetic: sample a grid inside the focused
  // control and require at least one point to reach it. A fixed bar sitting on top
  // wins elementFromPoint, so full occlusion fails here and nothing else.
  // Measured AFTER the scroll settles — a synchronous read right after the Tab
  // catches `scroll-padding` mid-flight and reports a false failure (a11y-3 B5).
  await settle(page);
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });

  const bad = [];
  for (let i = 0; i < expectedOrder(page).length; i++) {
    await page.keyboard.press('Tab');
    const r = await stableFocusRect(page);
    expect(r, 'focus was lost during the sweep').not.toBeNull();
    const reachable = await page.evaluate(() => {
      const el = document.activeElement;
      const b = el.getBoundingClientRect();
      const xs = [b.left + 1, b.left + b.width / 2, b.right - 1];
      const ys = [b.top + 1, b.top + b.height / 2, b.bottom - 1];
      for (const x of xs) for (const y of ys) {
        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
        const e = document.elementFromPoint(x, y);
        if (e && (e === el || el.contains(e) || el.contains(e.parentElement))) return true;
      }
      return false;
    });
    if (!reachable) bad.push(await activeId(page));
  }
  expect(bad, 'controls entirely covered by fixed content while focused').toEqual([]);
});

/* ─── B1 / B2 / C3 · the step sliders ──────────────────────────────────────── */

for (const loc of LOCS) {
  test(`B1/B2 ${loc} step slider: keys move it and the ARIA follows the dots`, async ({ page }) => {
    await settle(page);
    const id = await visibleThumb(page, loc);
    expect(id, `no rendered step thumb for ${loc}`).not.toBeNull();

    await page.locator('#' + id).focus();
    expect(await activeId(page)).toBe(id);

    // Read the exposed value, its text, the dots and the visible label together. The
    // point is that all four are ONE derivation from `chargeSteps[loc]` — a11y-3 B2:
    // "derive the ARIA from state, never set it imperatively in one branch only".
    const read = () => page.evaluate(([i, l]) => {
      const el = document.getElementById(i);
      const dots = [...document.querySelectorAll(
        '#step-dots-' + i.replace('step-thumb-', '') + ' .step-dot')];
      return {
        now: +el.getAttribute('aria-valuenow'), text: el.getAttribute('aria-valuetext'),
        min: el.getAttribute('aria-valuemin'), max: el.getAttribute('aria-valuemax'),
        role: el.getAttribute('role'), tabIndex: el.tabIndex,
        active: dots.filter((d) => d.classList.contains('active')).length,
        total: dots.length, focused: document.activeElement.id, l,
      };
    }, [id, loc]);

    const base = await read();
    expect(base.role).toBe('slider');
    expect(base.min).toBe('0');
    expect(base.max).toBe('4');
    expect(base.tabIndex, 'a custom slider must be a tab stop').toBeGreaterThanOrEqual(0);
    expect(base.now, 'the default step from index.html:1122').toBe(DEFAULT_STEPS[loc]);
    expect(base.total, 'five dots, all built in JS — the markup ships the container empty').toBe(5);

    // Every key, and after each one the whole derivation must still agree.
    // Directions are asserted, not magnitudes: the magnitude is wrong today and is
    // pinned by its own test below, so keeping it out of here means this test still
    // guards the derivation once that defect is fixed.
    for (const [k, dir] of [['ArrowRight', +1], ['ArrowUp', +1], ['PageUp', +1],
                            ['ArrowLeft', -1], ['ArrowDown', -1], ['PageDown', -1],
                            ['End', 'max'], ['Home', 'min'], ['ArrowRight', +1],
                            ['End', 'max'], ['ArrowLeft', -1], ['Home', 'min']]) {
      const before = (await read()).now;
      await page.keyboard.press(k);
      await page.waitForTimeout(80);
      const s = await read();

      expect(s.focused, `${k} moved focus off the thumb`).toBe(id);
      expect(s.now, `${loc} aria-valuenow out of range after ${k}`).toBeGreaterThanOrEqual(0);
      expect(s.now, `${loc} aria-valuenow out of range after ${k}`).toBeLessThanOrEqual(4);
      if (dir === 'max') expect(s.now, `End on ${loc}`).toBe(4);
      else if (dir === 'min') expect(s.now, `Home on ${loc}`).toBe(0);
      else if (dir > 0) expect(s.now, `${k} on ${loc} must not decrease`).toBeGreaterThanOrEqual(before);
      else expect(s.now, `${k} on ${loc} must not increase`).toBeLessThanOrEqual(before);

      expect(s.text, `${loc} aria-valuetext must be derived from aria-valuenow after ${k}`)
        .toBe(STEP_LABELS[s.now]);
      expect(s.active, `${loc} active dot count must match aria-valuenow after ${k}`).toBe(s.now);
      expect(await freqText(page, loc), `${loc} visible label after ${k}`)
        .toBe(STEP_LABELS[s.now]);
    }

    // An unrecognised key must be ignored, not swallowed or acted on.
    const before = (await read()).now;
    await page.keyboard.press('KeyQ');
    await page.waitForTimeout(60);
    expect((await read()).now).toBe(before);
  });
}

// ── KNOWN DEFECT, found by this suite ────────────────────────────────────────
// One arrow key press moves a step slider by TWO steps, not one. Measured at every
// viewport: from 0, ArrowRight goes 0 -> 2 -> 4; from 4, ArrowLeft goes 4 -> 2 -> 0.
//
// Cause: buildStepSlider(loc, suffix) is called twice per location — once with '' and
// once with '-m' (index.html:1402-1405) — and each call attaches a keydown listener to
// BOTH `#step-thumb-<loc>` and `#step-thumb-<loc>-m` via its own `['', '-m'].forEach`
// (index.html:1181-1193). Every thumb therefore carries two identical handlers.
//
// This is SC 2.1.1 (Level A), not cosmetic: a mouse user can click any of the five
// dots, but a keyboard user starting from an even step can never land on 1
// ("occasionally") or 3 ("often") — the steps move in twos and Home/End only reach the
// ends. a11y-1 records 2.1.1 as a pass; no scanner can see this.
//
// FIXED: the keydown handlers are now bound once per element ever, via a
// `t.dataset.keysBound` flag. Guarding on `suffix === ''` would NOT have been enough —
// it halves the base count but still re-binds on every Reset.
//
// These were pinned as expected-failures while the defect stood, so the day it was fixed
// they went red for passing unexpectedly. That is what un-pinned them. They now assert
// the correct behaviour and guard against the listeners stacking back up.
for (const loc of LOCS) {
  test(`SC 2.1.1 ${loc}: one arrow key moves exactly one step`,
    async ({ page }) => {
      await settle(page);
      const id = await visibleThumb(page, loc);
      const now = () => page.evaluate((i) =>
        +document.getElementById(i).getAttribute('aria-valuenow'), id);

      await page.locator('#' + id).focus();
      await page.keyboard.press('Home');
      await page.waitForTimeout(80);
      expect(await now()).toBe(0);

      for (let expected = 1; expected <= 4; expected++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(80);
        expect(await now(), `${expected} ArrowRight presses from 0`).toBe(expected);
      }
    });
}

// The same defect compounds. resetChargeInputs() calls buildStepSlider() again for
// both suffixes (index.html:1257-1258), so every Reset adds two MORE keydown listeners
// per thumb. Measured: from 0, ArrowRight lands on 2 before any reset and on 4 (the
// maximum, in one press) afterwards — so once a user has pressed Reset, the arrow keys
// reach nothing but the two ends.
//
// This survived the obvious fix: guarding on `suffix === ''` halves the base count but
// still re-binds on every Reset. Only binding exactly once per element closes it, which
// is what `dataset.keysBound` does. Keep this test — it is the one that catches a
// regression reintroducing the stacking.
test('SC 2.1.1 Reset does not multiply the step-slider key handlers',
  async ({ page }) => {
    await settle(page);
    const id = await visibleThumb(page, 'home');
    const fromZero = async () => {
      await page.locator('#' + id).focus();
      await page.keyboard.press('Home');
      await page.waitForTimeout(80);
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(80);
      return page.evaluate((i) => +document.getElementById(i).getAttribute('aria-valuenow'), id);
    };
    const before = await fromZero();
    await page.locator('button.reset-link').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    expect(await fromZero(), 'one ArrowRight must travel the same distance after a Reset')
      .toBe(before);
  });

test('B2 the desktop and mobile step sliders share one state', async ({ page }) => {
  // chargeSteps is a single object; both sliders for a location must be written on
  // every path, or the hidden one goes stale and exposes a wrong aria-valuenow the
  // moment the viewport crosses 960px.
  await settle(page);
  const id = await visibleThumb(page, 'home');
  await page.locator('#' + id).focus();
  await page.keyboard.press('End');
  await page.waitForTimeout(100);
  const both = await page.evaluate(() => ['step-thumb-home', 'step-thumb-home-m']
    .map((i) => ({ i, now: document.getElementById(i).getAttribute('aria-valuenow'),
                   text: document.getElementById(i).getAttribute('aria-valuetext') })));
  expect(both[0].now).toBe('4');
  expect(both[1].now).toBe('4');
  expect(both[0].text).toBe('always');
  expect(both[1].text).toBe('always');
});

test('C3 the step track responds to a click, so dragging is never required', async ({ page }) => {
  await settle(page);
  const id = await visibleThumb(page, 'home');
  await page.locator('#' + id).focus();
  await page.keyboard.press('Home');
  await page.waitForTimeout(100);
  expect(await page.locator('#' + id).getAttribute('aria-valuenow')).toBe('0');

  const box = await page.evaluate((i) => {
    const wrap = document.getElementById(i).closest('.step-track-wrap');
    wrap.scrollIntoView({ block: 'center' });
    const r = wrap.getBoundingClientRect();
    return { x: r.left + r.width, y: r.top + r.height / 2 };
  }, id);
  await page.mouse.click(box.x - 1, box.y);
  await page.waitForTimeout(150);
  expect(await page.locator('#' + id).getAttribute('aria-valuenow'),
    'a click at the far end of the track must set the maximum step').toBe('4');
});

/* ─── B2 · the distribution slider ─────────────────────────────────────────── */

const distState = (page) => page.evaluate(() => {
  const t = (i) => document.getElementById('dist-thumb-' + i);
  const seg = (i) => parseInt(document.getElementById('dist-label-' + i)
    .querySelector('.dist-seg-pct').textContent, 10);
  return {
    v1: +t(1).getAttribute('aria-valuenow'), v2: +t(2).getAttribute('aria-valuenow'),
    x1: t(1).getAttribute('aria-valuetext'), x2: t(2).getAttribute('aria-valuetext'),
    segs: [seg(0), seg(1), seg(2)],
    focused: document.activeElement.id,
  };
});

test('B2 the dist thumbs expose a value that matches the visible segments', async ({ page }) => {
  // role=slider means the exposed value must follow the visual position on EVERY path,
  // or AT reads a stale number. The two boundary values and the three segment
  // percentages are one derivation: [v1, v2 - v1, 100 - v2].
  await settle(page);
  for (const [thumb, keys] of [[1, ['ArrowRight', 'ArrowRight', 'PageUp', 'ArrowLeft']],
                               [2, ['ArrowLeft', 'PageDown', 'ArrowRight']]]) {
    await page.locator(`#dist-thumb-${thumb}`).focus();
    for (const k of keys) {
      await page.keyboard.press(k);
      await page.waitForTimeout(60);
      const s = await distState(page);
      expect(s.focused, `${k} moved focus off dist-thumb-${thumb}`).toBe(`dist-thumb-${thumb}`);
      expect(s.segs, `segments must be [v1, v2-v1, 100-v2] = ${[s.v1, s.v2 - s.v1, 100 - s.v2]}`)
        .toEqual([s.v1, s.v2 - s.v1, 100 - s.v2]);
      expect(s.x1, 'aria-valuetext must carry the same number as aria-valuenow')
        .toBe(`${s.v1}% city`);
      expect(s.x2).toBe(`${s.v2}% by country road boundary`);
      expect(s.v1).toBeLessThanOrEqual(s.v2);
    }
  }
});

test('B2 Home and End clamp the dist thumbs without crossing them', async ({ page }) => {
  await settle(page);
  await page.locator('#dist-thumb-1').focus();
  await page.keyboard.press('Home');
  await page.waitForTimeout(80);
  let s = await distState(page);
  expect(s.v1).toBe(0);
  expect(s.segs).toEqual([0, s.v2, 100 - s.v2]);

  await page.keyboard.press('End');
  await page.waitForTimeout(80);
  s = await distState(page);
  expect(s.v1, 'thumb 1 must stop at thumb 2, not pass it').toBeLessThanOrEqual(s.v2);

  await page.locator('#dist-thumb-2').focus();
  await page.keyboard.press('End');
  await page.waitForTimeout(80);
  s = await distState(page);
  expect(s.v2).toBe(100);
  expect(s.segs).toEqual([s.v1, 100 - s.v1, 0]);
});

test('C3 clicking the dist block moves the nearer thumb', async ({ page }) => {
  await settle(page);
  const before = await distState(page);
  const p = await page.evaluate(() => {
    const b = document.getElementById('dist-block');
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width * 0.1, y: r.top + r.height / 2 };
  });
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(150);
  const after = await distState(page);
  expect(after.v1, 'a click at 10% must pull thumb 1 down from ~33').toBeLessThan(before.v1);
  expect(after.v2, 'thumb 2 must not move').toBe(before.v2);
  expect(after.segs).toEqual([after.v1, after.v2 - after.v1, 100 - after.v2]);
});

/* ─── B2 · the miles slider ────────────────────────────────────────────────── */

test('B2 the miles slider keeps aria-valuetext honest', async ({ page }) => {
  // The markup ships aria-valuetext="10000 miles"; updateMiles() rewrites it to the
  // localised "10,000 miles per year". A stale valuetext is worse than none, and no
  // scanner compares the two.
  await settle(page);
  const at = () => page.evaluate(() => {
    const s = document.getElementById('miles-slider');
    return { v: s.value, text: s.getAttribute('aria-valuetext'),
             tip: document.getElementById('miles-tip').textContent.trim(),
             focused: document.activeElement.id };
  });
  const base = await at();
  expect(base.text, 'the raw markup value must have been rewritten on init')
    .toBe(`${Number(base.v).toLocaleString('en-GB')} miles per year`);

  await page.locator('#miles-slider').focus();
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'End', 'Home']) {
    await page.keyboard.press(k);
    await page.waitForTimeout(60);
    const s = await at();
    expect(s.focused).toBe('miles-slider');
    expect(s.text, `aria-valuetext after ${k}`)
      .toBe(`${Number(s.v).toLocaleString('en-GB')} miles per year`);
    expect(s.tip, `visible tooltip after ${k}`)
      .toBe(`${Number(s.v).toLocaleString('en-GB')} mi`);
  }
  expect((await at()).v, 'Home must reach the minimum').toBe('1000');
});

/* ─── A6 · SC 4.1.3 the live region ────────────────────────────────────────── */

test('A6 the live region is mounted, polite, and populated at rest', async ({ page }) => {
  // It must already be in the DOM at load: injecting a region and writing to it in the
  // same tick is not announced. `#result-ev-cost` is aria-hidden because its
  // textContent is every digit of every reel column, so this region is the ONLY
  // accessible form of the app's output.
  await settle(page);
  const s = await page.evaluate(() => {
    const el = document.getElementById('cost-live');
    return { live: el.getAttribute('aria-live'), text: el.textContent.trim(),
             evHidden: document.getElementById('result-ev-cost').getAttribute('aria-hidden'),
             stickyHidden: document.getElementById('sticky-cost-display').getAttribute('aria-hidden') };
  });
  expect(s.live).toBe('polite');
  expect(s.text).toMatch(/^Estimated electricity cost [\d,]+ pounds per year$/);
  expect(s.evHidden, 'the reel would otherwise read out every digit of every column').toBe('true');
  expect(s.stickyHidden).toBe('true');
});

test('A6 every path that changes the result announces it', async ({ page }) => {
  await settle(page);

  await announces(page, 'miles slider', async () => {
    await page.locator('#miles-slider').focus();
    await page.keyboard.press('ArrowRight');
    expect(await activeId(page)).toBe('miles-slider');
  });

  const thumb = await visibleThumb(page, 'home');
  await announces(page, 'step slider', async () => {
    await page.locator('#' + thumb).focus();
    await page.keyboard.press('End');
    expect(await activeId(page)).toBe(thumb);
  });

  const price = await page.evaluate((visSrc) => {
    const vis = eval(visSrc);
    return ['price-home-d', 'price-home-m'].find((i) => vis(document.getElementById(i)));
  }, VISIBLE_FN);
  await announces(page, 'charging price input', async () => {
    await page.locator('#' + price).focus();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('0.99');
    expect(await activeId(page)).toBe(price);
  });

  // Native <select>s are driven with selectOption, not page.keyboard. Headless
  // Chromium does not implement arrow-key navigation of a native select popup — it was
  // measured: ArrowDown on a focused #trim-select leaves the value at "Trend" at every
  // viewport. selectOption still goes through the browser and fires real input/change
  // events, so the app's `change` listener (index.html:1455-1456) is exercised; what
  // cannot be verified here is the popup's own key handling, which is UA behaviour.
  await announces(page, 'trim select', async () => {
    await page.selectOption('#trim-select', 'Life');
  });

  await announces(page, 'battery select', async () => {
    await page.selectOption('#battery-select', '58');   // Life exposes three
  });

  await announces(page, 'reset', async () => {
    await page.locator('button.reset-link').focus();
    await page.keyboard.press('Enter');
    expect(await activeId(page)).toBe('button.reset-link');
  });
});

test('A6 the live region carries the EV cost only — the petrol path is silent', async ({ page }) => {
  // Boundary, measured and recorded rather than asserted as a failure. #cost-live only
  // ever carries "Estimated electricity cost N pounds per year". Editing the petrol or
  // diesel price rewrites #result-petrol-cost / #result-diesel-cost and writes NOTHING
  // to the region, so those updates are not announced.
  //
  // Defensible, and deliberately not marked as a defect: unlike the EV figure — whose
  // visible form is an aria-hidden digit reel, leaving the live region as its only
  // accessible copy — the petrol and diesel figures are plain readable text that a
  // screen-reader user can navigate to. Recorded so a reviewer decides knowingly, and
  // so a port that widens the region's remit shows up here as a diff.
  await settle(page);
  const before = await liveText(page);
  const petrolBefore = await page.locator('#result-petrol-cost').textContent();

  await page.locator('#price-petrol').focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('1.99');
  await page.waitForTimeout(400);

  expect(await page.locator('#result-petrol-cost').textContent(),
    'the petrol result must at least update').not.toBe(petrolBefore);
  expect(await page.locator('#result-petrol-cost').getAttribute('aria-hidden'),
    'that result is only defensible while it is directly readable').toBeNull();
  expect(await liveText(page), 'nothing announces the petrol change today').toBe(before);
});

test('A6 the reel is rebuilt on every update and never loses aria-hidden', async ({ page }) => {
  await settle(page);
  await page.locator('#miles-slider').focus();
  for (const k of ['End', 'Home', 'ArrowRight']) {
    await page.keyboard.press(k);
    await page.waitForTimeout(120);
    const s = await page.evaluate(() => ({
      hidden: document.getElementById('result-ev-cost').getAttribute('aria-hidden'),
      reels: document.querySelectorAll('#result-ev-cost .slot-reel').length,
      digits: document.querySelectorAll('#result-ev-cost .slot-digit').length,
    }));
    expect(s.hidden, `aria-hidden lost after ${k}`).toBe('true');
    expect(s.reels, `no reel columns after ${k}`).toBeGreaterThan(0);
    expect(s.digits).toBe(s.reels);
  }
});

/* ─── focus survives the DOM rebuilds ──────────────────────────────────────── */

test('focus is never dropped to <body> by a rebuild', async ({ page }) => {
  // Three paths rewrite innerHTML underneath the user: onTrimChange() rebuilds
  // #battery-select's options, resetChargeInputs() rebuilds all 40 step dots, and
  // buildCostSlots() rebuilds the result reel. Conditional rendering that destroys the
  // subtree containing focus drops it to <body> (a11y-3 §5.3) and no scanner sees it.
  await settle(page);

  // Trend exposes one battery option, Life exposes three, so this genuinely rewrites
  // #battery-select's innerHTML underneath the focused control.
  expect(await page.locator('#battery-select option').count()).toBe(1);
  await page.locator('#trim-select').focus();
  await page.selectOption('#trim-select', 'Life');
  await page.waitForTimeout(150);
  expect(await activeId(page), 'trim change rebuilt #battery-select and lost focus')
    .toBe('trim-select');
  expect(await page.locator('#battery-select option').count(),
    'the battery options must have been rebuilt for the new trim').toBe(3);

  await page.locator('#battery-select').focus();
  await page.selectOption('#battery-select', '79');
  await page.waitForTimeout(150);
  expect(await activeId(page), 'the select itself must survive its options being replaced')
    .toBe('battery-select');

  const thumb = await visibleThumb(page, 'work');
  await page.locator('#' + thumb).focus();
  await page.keyboard.press('End');
  await page.waitForTimeout(100);
  await page.locator('button.reset-link').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  expect(await activeId(page), 'reset rebuilt all 40 dots and lost focus')
    .toBe('button.reset-link');
  // And the thumb it rebuilt around is still focusable and still correct.
  await page.locator('#' + thumb).focus();
  expect(await activeId(page)).toBe(thumb);
});

test('reset restores every default, on both breakpoints at once', async ({ page }) => {
  await settle(page);
  const thumb = await visibleThumb(page, 'motorway');
  await page.locator('#' + thumb).focus();
  await page.keyboard.press('End');
  const price = await page.evaluate((visSrc) => {
    const vis = eval(visSrc);
    return ['price-home-d', 'price-home-m'].find((i) => vis(document.getElementById(i)));
  }, VISIBLE_FN);
  await page.locator('#' + price).focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('7.77');
  await page.waitForTimeout(150);

  await page.locator('button.reset-link').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);

  const s = await page.evaluate(([locs, defSteps, defPrices]) => {
    const out = { steps: {}, prices: {}, dots: document.querySelectorAll('.step-dot').length,
                  labels: {}, mismatch: [] };
    for (const l of locs) {
      for (const sfx of ['', '-m']) {
        const t = document.getElementById('step-thumb-' + l + sfx);
        out.steps[l + sfx] = +t.getAttribute('aria-valuenow');
        if (+t.getAttribute('aria-valuenow') !== defSteps[l]) out.mismatch.push('step ' + l + sfx);
      }
      for (const sfx of ['-d', '-m']) {
        const p = document.getElementById('price-' + l + sfx);
        out.prices[l + sfx] = p.value;
        if (p.value !== defPrices[l]) out.mismatch.push('price ' + l + sfx);
      }
      out.labels[l] = document.getElementById('freq-label-' + l + '-d').textContent.trim();
    }
    return out;
  }, [LOCS, DEFAULT_STEPS, DEFAULT_PRICES]);

  expect(s.mismatch, `reset left state behind: ${JSON.stringify(s)}`).toEqual([]);
  expect(s.dots, 'reset must rebuild all 40 dots').toBe(40);
  for (const l of LOCS) expect(s.labels[l]).toBe(STEP_LABELS[DEFAULT_STEPS[l]]);
});

/* ─── SC 3.3.1 / 3.3.3 · error identification ──────────────────────────────── */

test('3.3.1/3.3.3 an out-of-range price is named, described and then cleared', async ({ page }) => {
  // The only app in the suite that needs these. Before the fix, 999 in a max="9.99"
  // field computed silently and presented "978,966 pounds per year" as a valid answer.
  await settle(page);
  // The error node is looked up by its own id, NOT through aria-describedby: once the
  // value is corrected the app unlinks the description, and a helper that resolves the
  // node through that attribute then reports `null` and looks like a pass.
  const read = (id) => page.evaluate((i) => {
    const el = document.getElementById(i);
    const n = document.getElementById(i + '-err');
    return { invalid: el.getAttribute('aria-invalid'),
             desc: el.getAttribute('aria-describedby'),
             msg: n ? n.textContent.trim() : null, hidden: n ? n.hidden : null,
             exists: !!n, min: el.getAttribute('min'), max: el.getAttribute('max'),
             focused: document.activeElement.id };
  }, id);

  const target = await page.evaluate((visSrc) => {
    const vis = eval(visSrc);
    return ['price-home-d', 'price-home-m'].find((i) => vis(document.getElementById(i)));
  }, VISIBLE_FN);

  expect((await read(target)).invalid, 'nothing is invalid at rest').toBeNull();

  await page.locator('#' + target).focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('999');
  await page.waitForTimeout(150);
  let s = await read(target);
  expect(s.focused).toBe(target);
  expect(s.invalid).toBe('true');
  expect(s.desc, 'the message must be linked, not just rendered').toBe(target + '-err');
  expect(s.hidden, 'a hidden message is not an error identification').toBe(false);
  // SC 3.3.3 asks for a suggestion: the permitted range, in text.
  expect(s.msg).toContain(s.min);
  expect(s.msg).toContain(s.max);

  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('0.31');
  await page.waitForTimeout(150);
  s = await read(target);
  expect(s.invalid, 'aria-invalid must be removed, not left set').toBeNull();
  expect(s.desc, 'the stale description must be unlinked').toBeNull();
  expect(s.exists, 'the message node stays in the DOM, hidden').toBe(true);
  expect(s.hidden, 'the corrected field must not keep a visible error').toBe(true);
  expect(s.msg, 'the stale message text must be cleared too').toBe('');
});
