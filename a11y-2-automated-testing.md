# A11y 2 of 3 — What the automated tests cover, and what they cannot

**App:** VW Cost Simulator (`cost-simulator`).
**Audited:** 2026-08-22 against the live deployment, headless Chrome 151.0.7922.174, axe-core
4.13.0 (`axe.version` read from the engine, not the bundle filename).
**Deployed at:** https://yikcunchung.github.io/vw-cost-simulator-prototype/
**Companions:** `a11y-1-criteria.md` (every criterion) · `a11y-3-implementation.md` (what to build).

> **A clean automated run is necessary and nowhere near sufficient.** This app scores 0 axe
> violations, 0 WAVE errors, 0 HTML validity errors — and that missed the unnamed-graphic defect
> the AX tree found, can't test SC 2.5.3, can't judge if a name is *correct* not just present, and
> can't tell you what a screen reader actually says.

---

# 0. Scope of this evidence — read before quoting a number

**Standalone page** — `axe.run(document)` covers the whole conformance surface, no
component/page split. Local `index.html` and the deployed build are **byte-identical**.

---

# 1. Tool coverage at a glance

| Tool | Good for | Blind spots that matter here |
|---|---|---|
| **axe-core 4.13.0** | Structural ARIA, names, roles, contrast on solid backgrounds | No `label-in-name` rule (2.5.3); blind to unnamed `<svg>` (trap 10)/behaviour; punts on gradient contrast; **9 rules off by default incl. `target-size`** (trap 1) |
| **WAVE 3.3.1.0** | Different engine; catches empty labels/sr-only contrast axe passes | Needs a public URL. Reports `.sr-only` contrast as an error even clipped to 1×1 |
| **Nu HTML validator** | SC 4.1.1 Parsing, still normative under EN 301 549 | Says nothing about semantics/naming |
| **Accessibility tree (CDP)** | Ground truth for name/role/value | Exposure is not announcement — §5 |
| **Real key and pointer events** | Only way to test behaviour | Slow; assert state after every event |

## Required toolchain — coverage against it

| Required | Status | Note |
|---|---|---|
| **axe DevTools 4.12.1** | ✅ **Done — UI at WCAG 2.2 AA** | All 3 guided tests run, every flag a false positive (decorative icon, disabled-on-purpose select, value-readout span, one self-inconsistent finding) — §9.3 |
| **WAVE Evaluation Tool 3.3.1.0** | ✅ **Done — hosted and extension, both states** | Hosted via `wave.webaim.org/report#/<url>`; extension confirms **0 errors, 0 contrast errors** in default and info-modal-open states — §9.2 |
| **Zoom 400% and 320 × 256 px** | ✅ **Done** | `320×256 @ deviceScaleFactor 4`. **dsf 1 is a small screen, not zoomed** |
| **Operated via the keyboard** | ✅ **Done** | Driven with real `Input.dispatchKeyEvent` |
| **NVDA 2026.1.1.55980** | ❌ **Not done** | The one real screen-reader gap. **VoiceOver run instead — §9.1**, a deviation not a substitute |
| **PAC 26.1.0.0** | ⚪ **Not applicable** | Checks PDF/UA-1; app ships no PDFs (`*.pdf` count 0). Brochures/price lists would be a separate EN 301 549 clause 10 surface |

### NVDA vs VoiceOver — a deviation to record

**Deviation, not a substitution.** They disagree where this app is interesting: `<select>` naming
via `aria-labelledby`, live-region politeness, hidden-`<input>`-behind-`<label>` controls. Different
browser too (NVDA: Firefox/Chrome; VoiceOver: Safari). Budget an NVDA pass before sign-off.

---

# 2. Results

## axe-core — 0 violations

Bare `axe.run(document)` plus default-disabled rules force-enabled (98 rules). Viewports:
1440×900, 768×1024, 390×844, 320×640, 320×256 @ dsf 4 (literal 400% zoom).

| Measure | Value |
|---|---|
| Rules executed | 98 |
| Violations | **0** at every viewport |
| `target-size` | **passes 22 nodes**, 0 violations, 0 incomplete |
| JS exceptions | **0** |
| Horizontal scroll | none, at any viewport |

## Accessibility tree

| Measure | Value |
|---|---|
| Nodes (1440×900) | 426 |
| Named interactive / graphic nodes | 43 |
| **Unnamed** | **0** |
| Focusable controls | 21 |

> **This is where the one real defect was found.** Before the fix, **9 `role=image` nodes were exposed unnamed** — invisible to axe, WAVE and Nu alike. See trap 10.

## WAVE 3.3.1.0 — real engine, public URL

| Errors | Contrast errors | Alerts | Features | Structure | ARIA |
|---|---|---|---|---|---|
| **0** | **0** | 0 | 29 | 3 | 45 |

Confirmed to have analysed the real page — control count and document title read back out of
WAVE's iframe, not assumed.

## Nu HTML validator — 0 errors

SC 4.1.1 Parsing. Obsolete in WCAG 2.2 but normative under EN 301 549 clause 9.4.1.1, so checked
and kept.

## Contrast — the `incomplete` bucket resolved by hand

axe punts whenever the background is a gradient, an image, or overlapped — **not passes**, a BITV
tester must resolve every one. At 1440×900 there were **36**: 33 "bgGradient" from `.input-section`'s
`linear-gradient`, the rest "bgOverlap" from `span.slot-reel` (the animated digit roller, 33×560)
geometrically overlapping neighbouring text.

**Every one resolves to a pass — worst ratio 6.19:1** vs 4.5:1 required (no element ≥16px, so no
large-text 3:1 threshold applies). Measured on composited pixels: PIL crop, viewport-relative
coords, dominant background vs glyph-band foreground.

## Orientation and text spacing

**SC 1.3.4 Orientation — pass.** No `@media (orientation:)` rule exists anywhere.

**SC 1.4.12 Text Spacing — pass.** All four overrides (`line-height:1.5`, `letter-spacing:0.12em`,
`word-spacing:0.16em`, `p margin-bottom:2em`) at 1440/390/320: **no newly clipped element, no
control lost, no horizontal scroll.**

> **Nuance:** select floating labels do still truncate under these overrides — not counted as loss,
> since each `<option>` is wrapped in a matching `<optgroup label>`, revealing the text in full on
> open. A label with no matching optgroup would still fail.

> **Detector validated:** a canary fitting at default line-height, overflowing only at 1.5, was
> injected and detected (one already clipped pre-override proves nothing).

---

# 3. Validate the harness before trusting a zero

Every axe detector was re-run against the page with that defect injected:

| Injected defect | Rule | Fired |
|---|---|---|
| `<button>` with no accessible name | `button-name` | ✅ |
| `<img>` with no `alt` | `image-alt` | ✅ |
| Text at ~1.2:1 | `color-contrast` | ✅ |
| Two elements sharing an `id` | `duplicate-id` | ✅ |
| `<input>` with no label | `label` | ✅ |
| `<a href>` with no text | `link-name` | ✅ |
| Two adjacent 12×12 buttons | `target-size` | ✅ |

**`target-size` first appeared to miss — harness fault, not axe's.** Canaries were injected under
the sticky topbar (`position:fixed;top:0;left:0`); axe marked them obscured, only `violations` was
read. Traps 1 and 2.

---

# 4. Ten traps that produce a confident false pass

**1 · Bare `axe.run()` is not every rule.** 9 rules are `enabled:false` by default in axe-core
4.13.0: `target-size` (2.5.8), `aria-roledescription`, `color-contrast-enhanced`, `duplicate-id`,
`duplicate-id-active`, `identical-links-same-purpose`, `landmark-complementary-is-top-level`,
`meta-refresh-no-exceptions`, `audio-caption`. Force-enable, confirm in `passes`; check
`axe._audit.rules.filter(r => !r.enabled)` first.

**2 · `violations` is not the whole result.** `incomplete` is the "needs review" bucket a BITV/EN
301 549 tester must resolve by hand — also where an *obscured* element lands, so an undersized
target can be missing from `violations` because axe couldn't decide, not because it passed.

**3 · `runOnly: {type:'tag'}` is not "all rules".** A tag filter silently skips every untagged rule.

**4 · 400% zoom is `deviceScaleFactor: 4`.** `320×256 @ dsf 1` is a small screen, not the zoomed
test 1.4.4 asks for.

**5 · WAVE reads stale counts.** Poll until icon counts go **stable**, not until
`wave.report.iconlist` merely exists — reading early returns the *previous* page's numbers. Also
`iconlist.error` is `{description, count, items}`, not a map; summing it as one yields a false
all-zero pass.

**6 · `Page.captureScreenshot` clip is document-absolute; `getBoundingClientRect()` is
viewport-relative.** Mixing them photographs a blank region — scores exactly `1.00:1`, one colour.
The clip missed, contrast didn't fail.

**7 · Anti-aliasing/borders aren't the background.** Taking the *worst* minority colour in a text
crop flags white-on-dark as failure — it found the border. Crop to the **glyph band**
(`Range.getClientRects()` union), use the **dominant** colour.

**8 · A `<select>`'s options are not its label.** Comparing concatenated `<option>` text against
the accessible name manufactures SC 2.5.3 failures that don't exist. Compare the `<label>` instead.

**9 · `Network.setCacheDisabled` is a no-op unless `Network.enable` runs first** — re-auditing
silently re-measures the old page. Enable the domain, or cache-bust the URL.

**10 · axe is blind to unnamed inline SVGs.** `svg-img-alt`/`role-img-alt` return `inapplicable`
for `<svg>` with no `role`; `image-alt` only checks `<img>`. **Read `role=image` off the AX tree,
assert 0 unnamed** — how every unnamed-graphic failure here was found; axe/WAVE/Nu saw none.

---

# 5. What automation will never close

**NVDA remains the one outstanding instrument** — VoiceOver, WAVE, axe DevTools all run manually
(§9). AX tree confirms what's *exposed*; readers differ in what they *announce* — needs a human.

**A name can be present, unique, and wrong.** Every automated check here passes on a control
labelled "button". Names must be read against what they describe.

**SC 2.5.3 Label in Name has no axe rule.** It was checked by hand — see `a11y-1-criteria.md`.

---

# 6. Manual testing — what to do

**All 3 manual runs done — results in §9; NVDA outstanding** (§1). Reusable procedure lives in
`../audit-evidence/manual-testing-guide.md` (identical across all 5 sibling apps). Below: only
what's specific to cost-simulator.

## App-specific Step 0

- **Live** — `https://yikcunchung.github.io/vw-cost-simulator-prototype/`.
- **Confirm on screen:** 5 info-modal triggers (`info-btn-location`, `info-btn-distance`,
  `info-btn-miles`, `info-btn-fuel`, `info-btn-cost`), distance-distribution block (home/work/
  public step sliders), miles slider, price inputs with edit-icon buttons, trim/battery selects.
- **29 Tab stops** (raised from 22 after edit-icons became real focusable buttons — re-verify live).

## App-specific notes for the central procedure's Run 2 (WAVE)

- Confirmed **0 errors, 0 contrast errors** in both the default state and the info-modal-open state
  — §9.2.

---

# 7. Verification checklist

Tick only what you actually observed against the central sign-off checklist in
`../audit-evidence/manual-testing-guide.md`. **An untested box is not a pass.**

---

# 8. Re-running the automated suite

Identical across all five sibling apps — see `../audit-evidence/manual-testing-guide.md` for the
CDP re-run script (serve locally, drive headless Chrome over CDP, run axe/AX-tree/reflow/
text-spacing/WAVE checks, diff local against live). Substitute this app's own port and live URL.

**Automate the structural half in CI, don't mistake it for the whole.** A structural-only suite is
exactly what scores clean on a build with a Level A naming failure.

---

# 9. Manual run results

## 9.1 Screen reader — VoiceOver / Safari, complete

Full Tab-order walk (29 stops), all 5 info-modals (open/read/close, focus returns to trigger),
rotor sweep (Form Controls, Headings — 1 `<h1>`, Landmarks) — all clear. One real gap found and
fixed: `dist-thumb-1`/`dist-thumb-2` only announced their own segment (e.g. "33% city") not both
neighbours, unlike range-simulator's identical component — see `a11y-3-implementation.md`.

## 9.2 WAVE 3.3.1.0 — extension, complete

Extension pass against the live build: **0 errors, 0 contrast errors** in both default and
info-modal-open states.

## 9.3 axe DevTools 4.12.1 — automated scan + Interactive Elements + Forms, complete

All run against the live build. Findings, all false positives:
- **Automated scan (default):** 1× false flag on `.sim-header-icon` (`alt=""`, correctly decorative).
- **Automated scan (info-modal-open):** 0 issues.
- **Interactive Elements:** 3 items, all false/inconclusive — `battery-select` (disabled-on-purpose),
  a `<span class="label-freq">` value-readout (text mirror, not a control), one self-inconsistent
  finding (highlight ≠ its own reasoning).
- **Forms guided test:** clear.

**Real gap found via DOM comparison against production, not any tool:** `dist-thumb-1`/
`dist-thumb-2` exposed static `aria-valuemin="0" aria-valuemax="100"` though neither can cross the
other. Fixed to narrow dynamically; `aria-label`s aligned to range-simulator's naming — see
`a11y-3-implementation.md`.

## 9.4 Outstanding

**NVDA 2026.1.1.55980** — not yet run; see the deviation note in §1. Required before formal
BITV/EN 301 549 sign-off.
