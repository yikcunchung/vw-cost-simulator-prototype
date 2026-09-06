# A11y 1 of 3 — WCAG 2.2 criterion checklist

**App:** VW Cost Simulator (`cost-simulator`) — a single-page simulator.
**Audited:** 2026-08-22, re-verified 2026-08-31 — orange focus ring, button-based edit icons, ID.
Polo model group, 29-control tab order: all pushed to `origin/main` and live, tree clean.
**Deployed at:** https://yikcunchung.github.io/vw-cost-simulator-prototype/
**Scope:** the whole page. Standalone app — no component/page split, nothing out of scope.
**PDFs excluded** — none shipped; would be a separate EN 301 549 clause 10 surface, checked with PAC.
**Companion documents:** `a11y-2-automated-testing.md` (what the tools can/can't prove) ·
`a11y-3-implementation.md` (what to build).

**Conformance target: Level A + AA** (EN 301 549 clause 9 / BFSG / EAA) — **56 criteria** (32 A +
24 AA). 31 Level AAA criteria not required, not listed.

> **If EN 301 549 becomes the formal target:** V3.2.1 references WCAG 2.1, not 2.2 — the only
> delta is **4.1.1 Parsing** (obsolete in 2.2, normative in 2.1, EN clause 9.4.1.1). Satisfied
> here, kept in the table so the EN path isn't silently broken.

| Status | Meaning |
|---|---|
| ✅ Pass | Verified by driving the app — real pointer/key events, or measured pixels |
| ✅ Pass\* | Verified by code/AX-tree inspection, **not** driven |
| ⚪ N/A | No such content |
| ⚖️ Decide | Passes on an arguable reading — record the decision |

**56 criteria assessed. 0 failures and 0 open items.** 25 verified · 10 inspected · 21 not applicable.

---

# 1. Perceivable


## 1.1 Text Alternatives

| SC | Name | Lvl | Relevant | Status | Evidence / what to do |
|---|---|---|---|---|---|
| **1.1.1** | Non-text Content | A | Yes | ✅ Pass | **0 unnamed nodes** (5 viewports). Fix: 9 decorative `<svg>`s → `aria-hidden="true"`; `#car-img` alt → `"Volkswagen ID.3 Neo"`. axe/WAVE/Nu all clean — neither caught by any tool. |


## 1.2 Time-based Media

| SC | Name | Lvl | Relevant | Status | Evidence / what to do |
|---|---|---|---|---|---|
| **1.2.1** | Audio-only and Video-only (Prerecorded) | A | No | ⚪ N/A | No audio-only or video-only content. |
| **1.2.2** | Captions (Prerecorded) | A | No | ⚪ N/A | No prerecorded video with audio. |
| **1.2.3** | Audio Description or Media Alternative (Prerecorded) | A | No | ⚪ N/A | No prerecorded video. |
| **1.2.4** | Captions (Live) | AA | No | ⚪ N/A | No live media. |
| **1.2.5** | Audio Description (Prerecorded) | AA | No | ⚪ N/A | No prerecorded video. |


## 1.3 Adaptable

| SC | Name | Lvl | Relevant | Status | Evidence / what to do |
|---|---|---|---|---|---|
| **1.3.1** | Info and Relationships | A | Yes | ✅ Pass | One `h1`, `role="banner"` topbar, `main`, two named `<select>`s, six labelled number inputs and eight `role="slider"` thumbs. axe 0 violations on structure rules at 98 rules. |
| **1.3.2** | Meaningful Sequence | A | Yes | ✅ Pass* | DOM order matches visual order, all 29 Tab stops (up from 22, see 4.1.2). Desktop/mobile price rows swap by `display`; DOM order follows whichever shows. |
| **1.3.3** | Sensory Characteristics | A | Yes | ✅ Pass* | No instruction relies on shape, size or position. |
| **1.3.4** | Orientation | AA | Yes | ✅ Pass | No `@media (orientation:)` rule exists anywhere. Nothing locks orientation. |
| **1.3.5** | Identify Input Purpose | AA | No | ⚪ N/A | No field collects information *about the user* — no name, address, email, payment. Inputs are tariff prices, not personal data; `autocomplete` has nothing to identify. |


## 1.4 Distinguishable

| SC | Name | Lvl | Relevant | Status | Evidence / what to do |
|---|---|---|---|---|---|
| **1.4.1** | Use of Color | A | Yes | ✅ Pass* | Colour is never the only channel. |
| **1.4.2** | Audio Control | A | No | ⚪ N/A | No audio. `audio[autoplay]` / `video[autoplay]` count is 0. |
| **1.4.3** | Contrast (Minimum) | AA | Yes | ✅ Pass | **56 `color-contrast` incomplete nodes resolved by hand — worst 6.19:1** vs 4.5:1 required. Cause: `linear-gradient` on `.input-section` (33), `span.slot-reel` digit-roller overlap (rest). |
| **1.4.4** | Resize Text | AA | Yes | ✅ Pass | 400% zoom (320×256 @ dsf 4): 0 violations, no horizontal scroll, all 29 controls present. |
| **1.4.5** | Images of Text | AA | Yes | ✅ Pass* | No images of text. All text is live text. |
| **1.4.10** | Reflow | AA | Yes | ✅ Pass | No horizontal scroll at 320/390/768/1440 or 400% zoom; 29 controls at every viewport. Desktop price rows swap for `-m` mobile equivalents — substitution, not loss. |
| **1.4.11** | Non-text Contrast | AA | Yes | ✅ Pass | `.fl-input`/`.fl-select` border `rgb(110,116,126)` 4.32:1; focus ring `#C86C03` 3.44:1 / 3.51:1 — both clear 3:1. **Deliberate deviation from the real core's failing `rgb(161,164,172)`** (2.29:1): this prototype's job is to pass. |
| **1.4.12** | Text Spacing | AA | Yes | ✅ Pass | **All 4 overrides pass at 1440/390/320** — no clipping, no lost control, no scroll (canary-validated). Fix: `.select-group` stacks trim/battery-select vertically so labels get full row width; each `<option>` also wrapped in a matching `<optgroup label>`. |
| **1.4.13** | Content on Hover or Focus | AA | No | ⚪ N/A | No hover- or focus-triggered overlay. |


# 2. Operable


## 2.1 Keyboard Accessible

| SC | Name | Lvl | Relevant | Status | Evidence / what to do |
|---|---|---|---|---|---|
| **2.1.1** | Keyboard | A | Yes | ✅ Pass | All 29 controls operable. **Was a Level A failure until 2026-08-24**, invisible to any scanner: `buildStepSlider()`/`resetChargeInputs()` double-bound `keydown`, so ArrowRight moved two steps and Reset jumped to max. Fixed via `dataset.keysBound` guard (5 regression tests). |
| **2.1.2** | No Keyboard Trap | A | Yes | ✅ Pass | No trap — Tab cycles all 29 stops and returns to the first. |
| **2.1.4** | Character Key Shortcuts | A | No | ⚪ N/A | No single-character key shortcuts are registered. |


## 2.2 Enough Time

| SC | Name | Lvl | Relevant | Status | Evidence / what to do |
|---|---|---|---|---|---|
| **2.2.1** | Timing Adjustable | A | No | ⚪ N/A | No time limit exists anywhere in the app. |
| **2.2.2** | Pause, Stop, Hide | A | No | ⚪ N/A | Nothing moves, blinks or auto-updates. The result changes only on user input. |


## 2.3 Seizures and Physical Reactions

| SC | Name | Lvl | Relevant | Status | Evidence / what to do |
|---|---|---|---|---|---|
| **2.3.1** | Three Flashes or Below Threshold | A | Yes | ✅ Pass* | Nothing flashes. No animation exceeds three cycles per second. |


## 2.4 Navigable

| SC | Name | Lvl | Relevant | Status | Evidence / what to do |
|---|---|---|---|---|---|
| **2.4.1** | Bypass Blocks | A | Yes | ✅ Pass | `a.skip-link → #main`, the first Tab stop. |
| **2.4.2** | Page Titled | A | Yes | ✅ Pass | `<title>Volkswagen Cost Simulator</title>` — descriptive and unique. |
| **2.4.3** | Focus Order | A | Yes | ✅ Pass | 29 Tab stops in DOM order matching visual order, verified at 1440×900 and 390×844 with real Tab presses. |
| **2.4.4** | Link Purpose (In Context) | A | No | ⚪ N/A | No links other than the skip link, which is named. |
| **2.4.5** | Multiple Ways | AA | No | ⚪ N/A | A standalone single page. SC 2.4.5 applies to a *set* of web pages; there is no set. |
| **2.4.6** | Headings and Labels | AA | Yes | ✅ Pass | One `h1`, no skipped levels. Every control name is descriptive and location-qualified ("Home charging price in pounds per kWh"). |
| **2.4.7** | Focus Visible | AA | Yes | ✅ Pass | All 29 stops show a visible indicator. Fix: 10 number inputs previously signalled focus only via a 1.25:1 border shift; now `outline:2px solid var(--focus-orange)` (`#C86C03`), same ring as every other control (see 1.4.11). |
| **2.4.11** | Focus Not Obscured (Minimum) | AA | Yes | ✅ Pass | No fixed or sticky element overlaps a focused control; all measured inside the viewport after settling. |


## 2.5 Input Modalities

| SC | Name | Lvl | Relevant | Status | Evidence / what to do |
|---|---|---|---|---|---|
| **2.5.1** | Pointer Gestures | A | Yes | ✅ Pass* | No path-based or multipoint gesture. |
| **2.5.2** | Pointer Cancellation | A | Yes | ✅ Pass* | Activation is on the up-event; the step thumbs bind `mousedown` only to begin a drag, and a drag can be abandoned. |
| **2.5.3** | Label in Name | A | Yes | ✅ Pass | All labelled controls exact — every visible `<label>` text is contained in its control's accessible name. |
| **2.5.4** | Motion Actuation | A | No | ⚪ N/A | No device-motion or user-motion actuation. |
| **2.5.7** | Dragging Movements | AA | Yes | ✅ Pass | Satisfied via `click` on the track (`.dist-block`, `.step-track-wrap`), not arrow keys — keyboard equivalence alone doesn't meet this SC. `#miles-slider` is native `<input type="range">`, exempt outright. |
| **2.5.8** | Target Size (Minimum) | AA | Yes | ✅ Pass | **No target under 24×24.** `.step-thumb-el` renders 18×18, real target **24.0×24.0** via transparent `::before` (ray-cast confirmed). `button.reset-link` (20px) passes on spacing exception: 30px clearance vs 12px required. |


# 3. Understandable


## 3.1 Readable

| SC | Name | Lvl | Relevant | Status | Evidence / what to do |
|---|---|---|---|---|---|
| **3.1.1** | Language of Page | A | Yes | ✅ Pass | `<html lang="en">`; axe `html-has-lang` clean. |
| **3.1.2** | Language of Parts | AA | No | ⚪ N/A | Every string is English. No passage changes language, so no `lang` attribute is needed. |


## 3.2 Predictable

| SC | Name | Lvl | Relevant | Status | Evidence / what to do |
|---|---|---|---|---|---|
| **3.2.1** | On Focus | A | Yes | ✅ Pass* | Focus alone changes nothing — no control acts on `focus`. |
| **3.2.2** | On Input | A | Yes | ✅ Pass | Changing a price or a slider recomputes the cost and announces it. No context change. |
| **3.2.3** | Consistent Navigation | AA | No | ⚪ N/A | Applies across a set of web pages. This is a standalone page. |
| **3.2.4** | Consistent Identification | AA | No | ⚪ N/A | Applies across a set of web pages. This is a standalone page. |
| **3.2.6** | Consistent Help | A | No | ⚪ N/A | No help mechanism is offered, and the criterion applies across a set of pages. |


## 3.3 Input Assistance

| SC | Name | Lvl | Relevant | Status | Evidence / what to do |
|---|---|---|---|---|---|
| **3.3.1** | Error Identification | A | Yes | ✅ Pass | An out-of-range price sets `aria-invalid="true"`, links a `.field-error` via `aria-describedby`, and names the permitted range — not a silent bad-value computation. |
| **3.3.2** | Labels or Instructions | A | Yes | ✅ Pass | Every input is labelled, and the permitted range is stated in the error text when exceeded. |
| **3.3.3** | Error Suggestion | AA | Yes | ✅ Pass | The error message names the valid range, which is the suggestion. |
| **3.3.4** | Error Prevention (Legal, Financial, Data) | AA | No | ⚪ N/A | Nothing is submitted, purchased or legally committed. The app computes an estimate and stores nothing. |
| **3.3.7** | Redundant Entry | A | No | ⚪ N/A | No multi-step process re-asks for information. |
| **3.3.8** | Accessible Authentication (Minimum) | AA | No | ⚪ N/A | No authentication of any kind. |


# 4. Robust


## 4.1 Compatible

| SC | Name | Lvl | Relevant | Status | Evidence / what to do |
|---|---|---|---|---|---|
| **4.1.1** | Parsing | A | Yes | ✅ Pass | Nu HTML validator: **0 errors**. Obsolete in WCAG 2.2 but normative under EN 301 549 clause 9.4.1.1, so it is checked and kept. |
| **4.1.2** | Name, Role, Value | A | Yes | ✅ Pass* | **AX tree: 29 controls, 0 unnamed, 0 duplicate role+name.** Fix: 10 edit-icon buttons re-architected `<label for>` → real `<button>`, each a unique `aria-label` (e.g. "Edit home charging price"), icon `alt=""` — resolves the old six-identical-"Edit" ambiguity (Tab-stop trade-off below). |
| **4.1.3** | Status Messages | AA | Yes | ✅ Pass | `#cost-live` (`aria-live="polite"`, in the DOM at load, 1×1 clipped, explicit white `color`) announces every recomputation — verified across 7 changes, e.g. "...848 pounds per year" → 844 → 904. |

---

# What is actually left to do

**No open criteria and no known failures.** The one 4.1.2 open decision (six identical
`<img alt="Edit">` graphics) is resolved — real `<button>`s with unique `aria-label`s now (see 4.1.2).

**Not a WCAG failure, but a product decision:** the 10 edit buttons were `<label for>` (unfocusable);
as real `<button>`s, each adds a Tab stop that only refocuses an already-reachable field (22→29
total). Nothing in 2.4.3/2.1.1 requires reverting — keep, or `tabindex="-1"` for pointer/touch-only.

**VoiceOver, WAVE, and axe DevTools all run manually** (§9, `a11y-2-automated-testing.md`); every
AI-flagged item was a false positive. One real gap found independently and fixed: distance-thumbs'
static `aria-valuemin`/`max` didn't track the true bounded range (see `a11y-3-implementation.md`).
**NVDA 2026.1.1.55980 remains outstanding** — required before sign-off (VoiceOver is a deviation,
not a substitute).

# Decisions an auditor could challenge

24 of 56 A/AA criteria have **no machine-testable ACT rule** (incl. 1.4.11, 1.4.13, 2.5.1, 2.5.2,
2.5.8, 2.4.11) — "passes" there reflects **judgement**, not a test result.

**The strongest claim this evidence supports:**

> *"This app meets WCAG 2.2 A/AA on every automated and runtime check available. VoiceOver, WAVE,
> and axe DevTools have all been run manually; NVDA is the one instrument still owed."*

Stronger than a tool-clean claim, and true unlike one: the one real defect found (distance-thumbs'
static, boundary-only range/naming, SC 4.1.2) was invisible to axe, WAVE, and Nu alike.
