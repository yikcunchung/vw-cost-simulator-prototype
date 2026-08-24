// @ts-check
// The scanner half. axe runs INSIDE Playwright rather than under jest-axe: jsdom has
// no layout, so `target-size` (SC 2.5.8) and reflow cannot be evaluated there at all,
// and this app's whole build runs on DOMContentLoaded, which jsdom would race.
//
// Everything below arrives through settle() so it is measured against the BUILT page.
// See tests/settle.js for why that matters here.

const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { settle, waitForStableBox, VISIBLE_FN, FOCUSABLE_SELECTOR } = require('./settle');

// The nine rules axe-core 4.13.0 ships with `enabled:false` (a11y-2 trap 1).
// `target-size` is the SC 2.5.8 rule, so a stock run reports "0 violations" having
// never tested target size at all.
const DISABLED_BY_DEFAULT = [
  'target-size', 'aria-roledescription', 'color-contrast-enhanced',
  'duplicate-id', 'duplicate-id-active', 'identical-links-same-purpose',
  'landmark-complementary-is-top-level', 'meta-refresh-no-exceptions', 'audio-caption',
];
const RULES = Object.fromEntries(DISABLED_BY_DEFAULT.map((r) => [r, { enabled: true }]));

// `color-contrast-enhanced` is SC 1.4.6, Level **AAA**. It is force-enabled above so
// that the whole engine runs, but its findings are not AA failures and must not be
// reported as such. It is pinned by its own test below instead, so a NEW node
// appearing anywhere still turns the suite red.
const AAA_ONLY = new Set(['color-contrast-enhanced']);

const fmt = (vs) => JSON.stringify(
  vs.map((v) => ({ id: v.id, nodes: v.nodes.length, help: v.help,
                   targets: v.nodes.slice(0, 4).map((n) => n.target) })), null, 1);

/* ─── axe ──────────────────────────────────────────────────────────────────── */

test('axe: 0 AA violations in #sim-main, all nine default-disabled rules on', async ({ page }) => {
  await settle(page);
  const r = await new AxeBuilder({ page }).include('#sim-main').options({ rules: RULES }).analyze();

  const aa = r.violations.filter((v) => !AAA_ONLY.has(v.id));
  expect(aa, fmt(aa)).toEqual([]);

  // Assert the rule actually ran, rather than trusting the config. A typo in the
  // options object silently gives you back the stock 89-rule run.
  const ran = [...r.passes, ...r.violations, ...r.incomplete].map((x) => x.id);
  expect(ran, 'target-size must appear in the results, or SC 2.5.8 went untested')
    .toContain('target-size');
});

test('axe: 0 AA violations over the whole document', async ({ page }) => {
  // a11y-2 §0: this app is a standalone page, so there is no component-versus-page
  // split and `axe.run(document)` is the whole conformance surface. The scoped run
  // above is the component contract for the AEM port; this one is the page claim.
  await settle(page);
  const r = await new AxeBuilder({ page }).options({ rules: RULES }).analyze();
  const aa = r.violations.filter((v) => !AAA_ONLY.has(v.id));
  expect(aa, fmt(aa)).toEqual([]);
});

test('axe: target-size ran AND tested nodes — an empty rule result is the trap', async ({ page }) => {
  await settle(page);
  const r = await new AxeBuilder({ page }).options({ rules: RULES }).analyze();
  const bucket = ['passes', 'violations', 'incomplete']
    .map((b) => ({ b, res: r[b].find((x) => x.id === 'target-size') }))
    .find((x) => x.res);
  expect(bucket, 'target-size is missing from passes, violations AND incomplete').toBeTruthy();
  // A rule that ran against zero nodes proves nothing. a11y-2 records 22 nodes.
  expect(bucket.res.nodes.length, `target-size landed in ${bucket.b} with no nodes`)
    .toBeGreaterThan(0);
  // `incomplete` is where an OBSCURED element lands, so an undersized target can be
  // absent from `violations` because axe could not decide (a11y-2 trap 2).
  const inc = r.incomplete.find((x) => x.id === 'target-size');
  expect(inc ? inc.nodes.map((n) => n.target) : [], 'unresolved target-size nodes').toEqual([]);
});

test('axe: the only AAA contrast finding is the known .disclaimer-copy node', async ({ page }) => {
  // 5.33:1 measured — a comfortable AA pass (4.5:1 required at 14px) and a
  // deliberate AAA (7:1) miss on the muted legal copy. Pinned, not suppressed: a
  // second node appearing anywhere fails this test.
  await settle(page);
  const r = await new AxeBuilder({ page }).options({ rules: RULES }).analyze();
  const nodes = r.violations.filter((v) => v.id === 'color-contrast-enhanced')
    .flatMap((v) => v.nodes.map((n) => n.target.join(' ')));
  expect(nodes).toEqual(['.disclaimer-copy']);
});

/* ─── names ────────────────────────────────────────────────────────────────── */

test('no visible interactive node is unnamed', async ({ page }) => {
  await settle(page);
  const unnamed = await page.evaluate(([visSrc, sel]) => {
    const vis = eval(visSrc);
    return [...document.querySelectorAll(sel)].filter(vis).filter((el) => {
      const lb = el.getAttribute('aria-labelledby');
      const name = (el.getAttribute('aria-label')
        || (lb ? lb.split(/\s+/).map((i) => (document.getElementById(i) || {}).textContent || '').join(' ') : '')
        || (el.labels && el.labels.length ? [...el.labels].map((l) => l.textContent).join(' ') : '')
        || el.textContent || (el.querySelector('img') || {}).alt || '');
      return name.trim() === '';
    }).map((el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '.' + el.className));
  }, [VISIBLE_FN, FOCUSABLE_SELECTOR]);
  expect(unnamed).toEqual([]);
});

test('no unnamed graphic — the whole class axe is blind to', async ({ page }) => {
  // THE defect that shipped in this suite: 9 decorative inline <svg>s exposed as
  // unnamed graphics. Chrome maps a bare <svg> to role=image, name="", ignored=false.
  // `svg-img-alt` and `role-img-alt` are INAPPLICABLE to an <svg> with no `role`, and
  // `image-alt` only inspects <img> — so axe, WAVE and Nu all returned clean on it.
  // This assertion is the only check that works.
  await settle(page);
  const bad = await page.evaluate(() => {
    const out = { bareSvg: [], namelessRoleImg: [], imgNoAlt: [] };
    for (const s of document.querySelectorAll('svg')) {
      if (s.getAttribute('aria-hidden') === 'true' || s.closest('[aria-hidden="true"]')) continue;
      if (!s.hasAttribute('role')) { out.bareSvg.push(s.getAttribute('class') || s.outerHTML.slice(0, 60)); continue; }
      const n = (s.getAttribute('aria-label') || (s.querySelector('title') || {}).textContent || '').trim();
      if (s.getAttribute('role') === 'img' && n === '') out.namelessRoleImg.push(s.getAttribute('class') || '(no class)');
    }
    for (const i of document.querySelectorAll('img')) {
      if (i.getAttribute('aria-hidden') === 'true') continue;
      if (!i.hasAttribute('alt')) out.imgNoAlt.push(i.id || i.src.split('/').pop());
    }
    return out;
  });
  expect(bad).toEqual({ bareSvg: [], namelessRoleImg: [], imgNoAlt: [] });
});

test('visible interactive controls have unique accessible names', async ({ page }) => {
  // The eight step thumbs are two sets of four sharing four names — only one set is
  // rendered per breakpoint (`.step-row` vs `.step-mobile-row`, display:none), so the
  // check MUST be scoped to what is visible or it manufactures four duplicates.
  await settle(page);
  const names = await page.evaluate(([visSrc, sel]) => {
    const vis = eval(visSrc);
    return [...document.querySelectorAll(sel)].filter(vis).map((el) => {
      const lb = el.getAttribute('aria-labelledby');
      return ((el.getAttribute('aria-label')
        || (lb ? lb.split(/\s+/).map((i) => (document.getElementById(i) || {}).textContent || '').join(' ') : '')
        || el.textContent || '')).replace(/\s+/g, ' ').trim();
    });
  }, [VISIBLE_FN, FOCUSABLE_SELECTOR]);

  expect(names.length, 'expected the full visible control set').toBe(22);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  expect(dupes, `duplicate accessible names among visible controls: ${JSON.stringify(names)}`)
    .toEqual([]);
});

test('SC 2.5.3 — each select name CONTAINS its visible label, contiguously', async ({ page }) => {
  // axe has no `label-in-name` rule at all, so nothing else on the toolchain sees
  // this. Both of these were real, shipped failures: the name was "Which model are
  // you interested in?" (does not contain "The new ID.3 Neo") and "Motor and battery
  // capacity" (the visible "/" rewritten as the word "and" — one character, Level A).
  await settle(page);
  for (const [sel, lbl] of [['trim-select', 'trim-fl-label'], ['battery-select', 'battery-fl-label']]) {
    const r = await page.evaluate(([s, l]) => {
      const el = document.getElementById(s);
      const ref = el.getAttribute('aria-labelledby');
      const name = ref
        ? ref.split(/\s+/).map((i) => (document.getElementById(i) || {}).textContent || '').join(' ').trim()
        : (el.getAttribute('aria-label') || '').trim();
      return { ref, name, visible: (document.getElementById(l).textContent || '').trim() };
    }, [sel, lbl]);
    expect(r.ref, `${sel} must be named by its visible label element, not a retyped aria-label`)
      .toBe(lbl);
    expect(r.visible.length, `${lbl} is empty`).toBeGreaterThan(0);
    expect(r.name, `visible label "${r.visible}" must sit inside the name "${r.name}"`)
      .toContain(r.visible);
  }
});

test('recorded decision: the "Edit" graphics are labels, not controls', async ({ page }) => {
  // a11y-1 decisions table: six identically named `<img alt="Edit">` graphics are a
  // RECORDED DECISION, not a defect. `alt=""` was deliberately rejected because it
  // produced 10 WAVE "Empty form label" errors. This test pins the decision so a
  // later tidy-up cannot silently reopen it, and asserts the thing that actually
  // matters: each spinbutton they label is uniquely named.
  await settle(page);
  const r = await page.evaluate((visSrc) => {
    const vis = eval(visSrc);
    const imgs = [...document.querySelectorAll('img.edit-icon')].filter(vis);
    const targets = imgs.map((i) => {
      const lab = i.closest('label');
      const el = lab && document.getElementById(lab.getAttribute('for'));
      return el ? (el.getAttribute('aria-label') || '') : null;
    });
    return {
      visibleCount: imgs.length,
      alts: [...new Set(imgs.map((i) => i.alt))],
      insideLabel: imgs.every((i) => !!i.closest('label')),
      isControl: imgs.some((i) => i.hasAttribute('role') || i.tabIndex >= 0 || i.onclick),
      targets,
    };
  }, VISIBLE_FN);

  expect(r.visibleCount, 'six visible Edit graphics per the recorded decision').toBe(6);
  expect(r.alts, 'all six share one name deliberately').toEqual(['Edit']);
  expect(r.insideLabel, 'they must stay inside <label>, which is why they are not controls').toBe(true);
  expect(r.isControl, 'an Edit graphic must never become focusable or a control').toBe(false);
  expect(r.targets.filter((t) => !t), 'every Edit label must point at a real control').toEqual([]);
  expect(new Set(r.targets).size, `the labelled spinbuttons must be uniquely named: ${JSON.stringify(r.targets)}`)
    .toBe(6);
});

/* ─── targets (SC 2.5.8) ───────────────────────────────────────────────────── */

// Scroll an element so its centre sits in the middle of the band that the fixed page
// chrome does not cover. `scrollIntoView` is not used: `html { scroll-padding-top:72px;
// scroll-padding-bottom:140px }` leaves 44 CSS px of scrollport at 320x256, so it
// cannot centre anything there.
//
// Naively centring on `innerHeight / 2` was wrong and produced a real false failure.
// At 320x256 that put the thumbs at y=128 while the mobile `.sticky-result` bar —
// which the very act of scrolling makes `.visible`, i.e. `pointer-events:auto` — sat
// at y=139. The ray then stopped 10.59px below centre and reported a 23.58px target.
// That is the harness obscuring the control, not the control being undersized;
// whether page chrome covers a FOCUSED control is SC 2.4.11 and is tested separately
// in behaviour.spec.js. Two passes, because the band moves when you scroll.
const CENTRE_FN = `(el) => {
  const band = () => {
    let top = 0, bottom = window.innerHeight;
    for (const c of document.querySelectorAll('#topbar, .sticky-result')) {
      const s = getComputedStyle(c);
      if (s.position !== 'fixed' || s.display === 'none' || s.pointerEvents === 'none') continue;
      const b = c.getBoundingClientRect();
      if (b.height === 0) continue;
      if (b.top <= 0) top = Math.max(top, b.bottom);
      else bottom = Math.min(bottom, b.top);
    }
    return (top + bottom) / 2;
  };
  for (let i = 0; i < 2; i++) {
    const r = el.getBoundingClientRect();
    window.scrollBy(0, Math.round(r.top + r.height / 2 - band()));
  }
}`;

// Ray-cast the real hit region outward from the centre. a11y-3 C1: "Prove it, do not
// assume it." Returns null when the centre itself does not hit the element, so an
// unmeasurable case fails loudly instead of scoring 0x0 and looking like a defect
// (or, worse, being quietly filtered out as noise).
//
// The boundary is found by doubling then BISECTING, not by fixed 0.5px steps. A fixed
// step quantises each direction downward independently, and the two losses add: at
// 320x256 @ dsf 4 the thumbs measured 23.5 against a real 24.98, which is a false
// failure produced entirely by the harness.
const RAY_FN = `(el) => {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const hits = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && (e === el || el.contains(e)); };
  if (!hits(cx, cy)) return null;
  const reach = (dx, dy) => {
    let lo = 0, hi = 1;
    while (hi <= 64 && hits(cx + dx * hi, cy + dy * hi)) { lo = hi; hi *= 2; }
    if (hi > 64) return 64;
    for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (hits(cx + dx * m, cy + dy * m)) lo = m; else hi = m; }
    return lo;
  };
  return { w: reach(-1, 0) + reach(1, 0), h: reach(0, -1) + reach(0, 1),
           corners: [[11,11],[11,-11],[-11,11],[-11,-11]].every(([x, y]) => hits(cx + x, cy + y)),
           box: { w: +r.width.toFixed(1), h: +r.height.toFixed(1) } };
}`;

test('SC 2.5.8 — the .step-thumb-el ::before really is a 24x24 hit area', async ({ page }) => {
  // Load-bearing (a11y-3 §7). The thumbs render 18x18; the transparent `::before`
  // is the actual target. If someone deletes it as dead CSS the spacing exception
  // will NOT rescue them — `div.step-track-wrap` has its own click handler, so it is
  // itself a target and the thumb sits inside it: centre-to-box distance 0 against
  // 12px required. axe reaches "pass" here by the wrong route (it measures 18x18,
  // fails on size, then passes on offset, and its neighbour set excludes
  // `div[click]`), so `target-size` must not be trusted for this pattern.
  await settle(page);
  const ids = await page.evaluate((visSrc) => {
    const vis = eval(visSrc);
    return [...document.querySelectorAll('.step-thumb-el')].filter(vis).map((el) => el.id);
  }, VISIBLE_FN);
  expect(ids.length, 'four step thumbs are rendered at every breakpoint').toBe(4);

  for (const id of ids) {
    await waitForStableBox(page, '#' + id);
    const r = await page.evaluate(([centre, ray, i]) => {
      const el = document.getElementById(i);
      eval(centre)(el);
      const b = getComputedStyle(el, '::before');
      return { pseudo: { w: b.width, h: b.height }, ray: eval(ray)(el) };
    }, [CENTRE_FN, RAY_FN, id]);

    expect(r.pseudo, `#${id}: the ::before rule is gone — nothing enlarges the hit area`)
      .toEqual({ w: '24px', h: '24px' });
    expect(r.ray, `#${id}: elementFromPoint at its own centre did not return it — unmeasurable, not a pass`)
      .not.toBeNull();
    expect(r.ray.box.w, `#${id} renders 18x18 by design`).toBeLessThan(24);
    // Measured 24.98 x 24.98 at all four viewports: a 24px pseudo-element plus
    // device-pixel snapping against a fractional parent origin. Errs high, so the
    // exact ::before assertion above is the precise guard and this proves it is
    // actually reachable — not clipped by an ancestor, not pointer-events:none.
    expect(r.ray.w, `#${id} hit-region width`).toBeGreaterThanOrEqual(24);
    expect(r.ray.h, `#${id} hit-region height`).toBeGreaterThanOrEqual(24);
    expect(r.ray.corners, `#${id} must be hit at all four +/-11 corners`).toBe(true);
  }
});

test('SC 2.5.8 — every visible target clears 24x24 by box, hit area or proven spacing', async ({ page }) => {
  await settle(page);
  // Wait for the boxes to stop changing first. A control measured mid-reflow reports
  // a transient size; polling for two identical samples cannot mask a real failure.
  await waitForStableBox(page, 'button.cta-button');

  const small = await page.evaluate(([visSrc, sel]) => {
    const vis = eval(visSrc);
    return [...document.querySelectorAll(sel)].filter(vis).map((el) => {
      const r = el.getBoundingClientRect();
      return { key: el.id || el.tagName.toLowerCase() + '.' + el.className,
               w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
    }).filter((b) => b.w < 24 || b.h < 24);
  }, [VISIBLE_FN, FOCUSABLE_SELECTOR]);

  // Anything undersized must be individually justified. The two documented cases are
  // `.step-thumb-el` (24x24 pseudo-element, proven above) and `button.reset-link`
  // (20px tall, on the SC 2.5.8 spacing exception). Anything else is a new failure.
  const unexplained = small.filter((b) => !/step-thumb|reset-link/.test(b.key));
  expect(unexplained, `undersized targets with no recorded exception: ${JSON.stringify(small)}`)
    .toEqual([]);

  // Prove the reset-link exception rather than assuming it. Against a FULL-SIZE
  // neighbour the test is 24px-diameter circle vs the neighbour's BOX — i.e. >=12px
  // from centre to box edge. Centre-to-centre is the wrong test and gives a falsely
  // comfortable number (a11y-3 C1).
  const gap = await page.evaluate(([visSrc, sel]) => {
    const vis = eval(visSrc);
    const all = [...document.querySelectorAll(sel)].filter(vis);
    const el = all.find((x) => x.classList.contains('reset-link'));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let min = Infinity, who = null;
    for (const o of all) {
      if (o === el) continue;
      const b = o.getBoundingClientRect();
      const dx = Math.max(b.left - cx, 0, cx - b.right);
      const dy = Math.max(b.top - cy, 0, cy - b.bottom);
      const d = Math.hypot(dx, dy);
      if (d < min) { min = d; who = o.id || o.className; }
    }
    return { min: +min.toFixed(1), who, h: +r.height.toFixed(1) };
  }, [VISIBLE_FN, FOCUSABLE_SELECTOR]);

  if (small.some((b) => /reset-link/.test(b.key))) {
    expect(gap, 'reset-link not found').not.toBeNull();
    expect(gap.min, `reset-link spacing exception: nearest neighbour ${gap.who} at ${gap.min}px centre-to-box, 12px required`)
      .toBeGreaterThanOrEqual(12);
  }
});

/* ─── structure ────────────────────────────────────────────────────────────── */

test('landmarks, one h1, no skipped heading levels, resolvable skip link', async ({ page }) => {
  await settle(page);
  const r = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length,
    levels: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => +h.tagName[1]),
    banner: document.querySelectorAll('[role="banner"], header').length,
    main: document.querySelectorAll('[role="main"], main').length,
    skipHref: (document.querySelector('a.skip-link') || {}).getAttribute
      ? document.querySelector('a.skip-link').getAttribute('href') : null,
    lang: document.documentElement.getAttribute('lang'),
    title: document.title,
  }));
  expect(r.h1).toBe(1);
  expect(r.banner).toBe(1);
  expect(r.main).toBe(1);
  expect(r.lang).toBe('en');
  expect(r.title.length).toBeGreaterThan(0);
  expect(r.skipHref, 'the skip link must point at a fragment').toMatch(/^#./);
  const target = await page.locator(r.skipHref).count();
  expect(target, `skip link target ${r.skipHref} does not exist`).toBe(1);
  for (let i = 1; i < r.levels.length; i++) {
    expect(r.levels[i] - r.levels[i - 1], `heading level jump at index ${i}: ${r.levels}`)
      .toBeLessThanOrEqual(1);
  }
});

test('#cost-live keeps its sr-only clip AND its explicit colour', async ({ page }) => {
  // The clip must survive: without it the region renders as visible text inside the
  // navy result card. The explicit colour must survive too — it inherited #1b2236 on
  // #1b2236 (1:1), which real WAVE reports as a Contrast Error even though the region
  // is clipped to 1x1 and nothing renders.
  await settle(page);
  const s = await page.evaluate(() => {
    const el = document.getElementById('cost-live');
    const c = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { pos: c.position, clipPath: c.clipPath, overflow: c.overflow, color: c.color,
             live: el.getAttribute('aria-live'), w: Math.round(r.width), h: Math.round(r.height),
             cls: el.className };
  });
  expect(s.live).toBe('polite');
  expect(s.cls).toContain('sr-only');
  expect(s.pos).toBe('absolute');
  expect(s.clipPath).toBe('inset(50%)');
  expect(s.overflow).toBe('hidden');
  expect(s.w).toBeLessThanOrEqual(1);
  expect(s.h).toBeLessThanOrEqual(1);
  expect(s.color, 'an inherited navy here is 1:1 on the navy card').toBe('rgb(255, 255, 255)');
});

test('no page-level horizontal scroll at this viewport', async ({ page }) => {
  await settle(page);
  const r = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  }));
  expect(r.sw, `document is ${r.sw}px wide in a ${r.cw}px viewport`).toBeLessThanOrEqual(r.cw);
});

test('SC 1.4.12 — the four text-spacing overrides clip nothing new', async ({ page }) => {
  // "No new clipping" is worthless unless the detector has been watched to fire, so
  // this diffs the clipped set before against after rather than asserting an empty
  // set: `.slot-digit` and `#cost-live` are clipped BY DESIGN and are in both.
  await settle(page);
  const r = await page.evaluate(() => {
    const clipped = () => [...document.querySelectorAll('#sim-main *')].filter((el) => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.overflow === 'visible') return false;
      return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
    }).map((el) => (el.id || el.tagName + '.' + el.className).slice(0, 48));
    const controls = () => document.querySelectorAll(
      '#sim-main button, #sim-main select, #sim-main input, #sim-main [role="slider"]').length;

    const before = clipped(); const nBefore = controls();
    const st = document.createElement('style');
    st.textContent = '*{line-height:1.5 !important;letter-spacing:.12em !important;'
      + 'word-spacing:.16em !important}p{margin-bottom:2em !important}';
    document.head.appendChild(st);
    void document.body.offsetHeight;

    const after = clipped(); const nAfter = controls();
    const hs = document.documentElement.scrollWidth > document.documentElement.clientWidth;
    // The floating select label is the only description of that control, and it was
    // the one thing that truncated (166px into 156px) under these overrides.
    const labels = [...document.querySelectorAll('.fl-select .fl-label')]
      .map((l) => ({ id: l.id, over: l.scrollWidth - l.clientWidth }));
    st.remove();
    return { newly: after.filter((x) => !before.includes(x)), hs, nBefore, nAfter, labels };
  });
  expect(r.newly, 'newly clipped under the SC 1.4.12 overrides').toEqual([]);
  expect(r.hs, 'the overrides introduced page-level horizontal scroll').toBe(false);
  expect(r.nAfter, 'a control was lost under the overrides').toBe(r.nBefore);
  expect(r.labels.filter((l) => l.over > 0), 'a floating select label truncated').toEqual([]);
});

test('no JS exception through a full interaction pass', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await settle(page);

  // Every path that mutates state, driven for real.
  await page.locator('#miles-slider').focus();
  await page.keyboard.press('ArrowRight');
  const thumb = await page.evaluate((visSrc) => {
    const vis = eval(visSrc);
    return [...document.querySelectorAll('.step-thumb-el')].filter(vis)[0].id;
  }, VISIBLE_FN);
  await page.locator('#' + thumb).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Home');
  await page.keyboard.press('End');
  await page.locator('#dist-thumb-1').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('PageUp');
  await page.locator('#price-petrol').focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('999');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('1.70');
  for (const v of ['Life', 'Style', 'PoloGTI', 'Trend']) await page.selectOption('#trim-select', v);
  await page.locator('button.reset-link').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  expect(errs).toEqual([]);
});
