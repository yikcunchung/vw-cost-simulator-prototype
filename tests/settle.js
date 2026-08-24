// Shared arrival gate.
//
// This app has NO IntersectionObserver and no lazy init — grep confirms zero
// occurrences in index.html. The gate is a single `window.addEventListener
// ('DOMContentLoaded', …)` at index.html:1400, which runs:
//
//     initDistSlider(); buildStepSlider(loc, '') x4; buildStepSlider(loc, '-m') x4;
//     updateMiles(); onTrimChange(); initSticky();
//
// That is still a deferred build, and it is still the trap: the markup ships the
// eight `#step-dots-*` containers EMPTY (the 40 `.step-dot` children are created
// in JS), `#result-ev-cost` ships the literal text "£–" (the `.slot-digit` reels
// are created in JS), `#result-freq` ships "–", and `#cost-live` ships empty. Audit
// between `domcontentloaded` and the handler and every check passes against a shell.
//
// So: navigate, then POLL for a real built-state condition. Never a fixed sleep —
// two honest runs would disagree.

// 8 sliders (4 locations x desktop/mobile) x 5 dots each. Built in JS.
const STEP_DOT_TOTAL = 40;
// Locations, in DOM order.
const LOCS = ['home', 'work', 'public', 'motorway'];
// index.html:1119 — the five frequency labels the step sliders expose.
const STEP_LABELS = ['never', 'occasionally', 'sometimes', 'often', 'always'];
// index.html:1122 — the defaults resetChargeInputs() restores.
const DEFAULT_STEPS = { home: 3, work: 2, public: 2, motorway: 1 };
const DEFAULT_PRICES = { home: '0.24', work: '0.32', public: '0.52', motorway: '0.75' };

async function settle(page) {
  await page.goto('/index.html');

  // Guard against auditing the wrong document entirely.
  await page.waitForFunction(() => !!document.getElementById('sim-main'));

  // Built, not merely present. All four conditions are things the markup does NOT
  // ship, so this fails loudly rather than silently measuring an empty shell.
  await page.waitForFunction(
    (n) => document.querySelectorAll('.step-dot').length >= n
      && document.querySelectorAll('#result-ev-cost .slot-digit').length > 0
      && (document.getElementById('result-freq').textContent || '').includes('week')
      && (document.getElementById('cost-live').textContent || '').trim() !== '',
    STEP_DOT_TOTAL,
    { timeout: 15_000 },
  );

  // Fonts and images must be resolved before any contrast assertion. Half-painted
  // text lets axe compute a background it otherwise cannot determine, which flips
  // colour-contrast findings from `incomplete` (the honest answer over the
  // `.input-section` gradient — a11y-2 records 36 of them, all passing on
  // composited pixels) into hard `violations`.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('#content img')];
    return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0);
  }, null, { timeout: 15_000 });

  return page.locator('#sim-main');
}

/**
 * Wait until an element's box stops changing.
 *
 * Nothing here animates open, but `#car-img` swaps on every trim change and the
 * `.slot-reel` columns transition — a control measured mid-reflow reports a
 * transient size. Polls for two identical consecutive samples rather than
 * asserting a size, so it cannot mask a genuine failure.
 */
async function waitForStableBox(page, selector, tries = 25) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    const box = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return `${Math.round(r.width)}x${Math.round(r.height)}`;
    }, selector);
    if (box !== null && box === last) return box;
    last = box;
    await page.waitForTimeout(80);
  }
  return last;
}

/** True when an element and every ancestor is rendered (`display` not `none`). */
const VISIBLE_FN = `(el) => {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
  }
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}`;

/** Every focusable control the app owns, whether rendered at this viewport or not. */
const FOCUSABLE_SELECTOR =
  'a[href], button, select, input:not([type=hidden]), [role="slider"], [tabindex]:not([tabindex="-1"])';

/**
 * Real Tab sweep from the top of the document. Returns one record per stop, in
 * order, stopping when the first stop repeats or focus leaves the document.
 * Uses page.keyboard so these are real key events — element.focus() would not
 * exercise the tab order at all, and would not match :focus-visible either.
 */
async function tabSweep(page, max = 60) {
  await page.evaluate(() => {
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
    window.scrollTo(0, 0);
  });
  const stops = [];
  let first = null;
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const s = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body || a === document.documentElement) return null;
      const r = a.getBoundingClientRect();
      return {
        id: a.id || null,
        tag: a.tagName.toLowerCase(),
        cls: a.className && typeof a.className === 'string' ? a.className : '',
        role: a.getAttribute('role'),
        sig: (a.id || a.tagName + '.' + a.className) + '|' + (a.getAttribute('aria-label') || '').slice(0, 28),
        x: Math.round(r.left), y: Math.round(r.top),
        w: Math.round(r.width), h: Math.round(r.height),
        inApp: !!document.getElementById('sim-main')?.contains(a),
      };
    });
    if (s === null) break;           // focus left the page (browser chrome)
    if (first === null) first = s.sig;
    else if (s.sig === first) break; // wrapped
    stops.push(s);
  }
  return stops;
}

module.exports = {
  settle, waitForStableBox, tabSweep,
  STEP_DOT_TOTAL, LOCS, STEP_LABELS, DEFAULT_STEPS, DEFAULT_PRICES,
  VISIBLE_FN, FOCUSABLE_SELECTOR,
};
