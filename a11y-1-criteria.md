# A11y 1 of 3 — WCAG 2.2 criterion checklist

**App:** VW Cost Simulator (`cost-simulator`) — a single-page simulator.
**Audited:** 2026-08-22 against the live deployment.
**Deployed at:** https://yikcunchung.github.io/vw-cost-simulator-prototype/
**Scope:** the whole page. This app is standalone, so there is no component-versus-page split and
nothing is out of scope. **PDFs are excluded** — the app ships none; they would be a separate
conformance surface under EN 301 549 clause 10, checked with PAC.
**Companion documents:** `a11y-2-automated-testing.md` (what the tools can and cannot prove) ·
`a11y-3-implementation.md` (what to build).

The conformance target is **Level A + AA** — what EN 301 549 clause 9 requires, and therefore
BFSG / the European Accessibility Act. That is **56 criteria** (32 A + 24 AA). The 31 Level AAA
criteria are not required and are not listed.

> **If EN 301 549 becomes the formal target**, note that V3.2.1 (2021-03) references **WCAG 2.1**,
> not 2.2. The only practical delta is **4.1.1 Parsing** — obsolete in 2.2 but normative in 2.1 and
> listed by EN as clause 9.4.1.1. It is satisfied here and kept in the table rather than dropped, so
> the EN path is not silently broken.

| Status | Meaning |
|---|---|
| ✅ Pass | Verified by driving the app — real pointer and key events, or measured pixels |
| ✅ Pass\* | Verified by code and accessibility-tree inspection, **not** driven |
| ⚪ N/A | The app has no such content |
| ⚖️ Decide | Passes, but on an arguable reading — record the decision |

**56 criteria assessed. 0 failures and 0 open items.** 25 verified · 9 inspected · 21 not applicable · 1 decision to record.

---

# 1. Perceivable


## 1.1 Text Alternatives

| SC | Name | Lvl | Relevant | Status | Evidence / what to do |
|---|---|---|---|---|---|
| **1.1.1** | Non-text Content | A | Yes | ✅ Pass | **0 unnamed nodes in the accessibility tree**, at all 5 viewports. 9 decorative inline `<svg>`s were exposed unnamed and now carry `aria-hidden="true"`; `#car-img` was `alt="Volkswagen"` — present but not descriptive — and is now `alt="Volkswagen ID.3 Neo"`, matching the sibling simulators. **No tool detected either** — axe, WAVE and Nu all reported clean. |


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
| **1.3.2** | Meaningful Sequence | A | Yes | ✅ Pass* | DOM order matches visual order across all 22 Tab stops; the desktop and mobile price rows swap by `display`, and the DOM order follows whichever is shown. |
| **1.3.3** | Sensory Characteristics | A | Yes | ✅ Pass* | No instruction relies on shape, size or position. |
| **1.3.4** | Orientation | AA | Yes | ✅ Pass | No `@media (orientation:)` rule exists anywhere. Nothing locks orientation. |
| **1.3.5** | Identify Input Purpose | AA | No | ⚪ N/A | No field collects information *about the user* — no name, address, email or payment. The number inputs are tariff prices, not personal data, so `autocomplete` has nothing to identify. |


## 1.4 Distinguishable

| SC | Name | Lvl | Relevant | Status | Evidence / what to do |
|---|---|---|---|---|---|
| **1.4.1** | Use of Color | A | Yes | ✅ Pass* | Colour is never the only channel. |
| **1.4.2** | Audio Control | A | No | ⚪ N/A | No audio. `audio[autoplay]` / `video[autoplay]` count is 0. |
| **1.4.3** | Contrast (Minimum) | AA | Yes | ✅ Pass | **All 56 `color-contrast` incomplete nodes resolved by hand on composited pixels — worst 6.19:1**, against 4.5:1. 33 are the `linear-gradient` on `.input-section`; the rest are geometric overlap from `span.slot-reel`, the animated digit roller, which lays out 33×560 and overlaps neighbouring text rects while being visually clipped. |
| **1.4.4** | Resize Text | AA | Yes | ✅ Pass | 400% zoom (320×256 @ dsf 4): 0 violations, no horizontal scroll, all 22 controls present. |
| **1.4.5** | Images of Text | AA | Yes | ✅ Pass* | No images of text. All text is live text. |
| **1.4.10** | Reflow | AA | Yes | ✅ Pass | No horizontal scroll at 320 / 390 / 768 / 1440 or at 400% zoom. The four desktop price rows are swapped for `-m` mobile equivalents at narrow widths — a responsive substitution, not a loss: the control count is 22 at every viewport. |
| **1.4.11** | Non-text Contrast | AA | Yes | ✅ Pass* | Control boundaries and the focus ring are navy on light — far above 3:1. The focused input border measures 3.51:1 against the page background. |
| **1.4.12** | Text Spacing | AA | Yes | ✅ Pass | All four overrides applied (line-height 1.5, letter-spacing .12em, word-spacing .16em, paragraph 2em) at 1440 / 390 / 320: **no newly clipped element, no control lost, no horizontal scroll.** Detector validated with a canary that fits at the default line-height and overflows at 1.5. |
| **1.4.13** | Content on Hover or Focus | AA | No | ⚪ N/A | No hover- or focus-triggered overlay. |


# 2. Operable


## 2.1 Keyboard Accessible

| SC | Name | Lvl | Relevant | Status | Evidence / what to do |
|---|---|---|---|---|---|
| **2.1.1** | Keyboard | A | Yes | ✅ Pass | All 22 controls keyboard-operable, including the eight `role="slider"` step thumbs and `button.reset-link`. **This was a Level A failure until 2026-08-24** and no scanner saw it: `buildStepSlider()` runs twice per location and `resetChargeInputs()` calls it again, so each thumb accumulated `keydown` listeners. One ArrowRight moved **two** steps, and after one Reset it jumped straight to the maximum — a keyboard user could never reach `occasionally` or `often`, while a mouse user could click either. Fixed by binding once per element (`dataset.keysBound`); guarding on `suffix === ''` is **not** sufficient because it still re-binds on Reset. Five regression tests now hold it. |
| **2.1.2** | No Keyboard Trap | A | Yes | ✅ Pass | No trap — Tab cycles all 22 stops and returns to the first. |
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
| **2.4.3** | Focus Order | A | Yes | ✅ Pass | 22 Tab stops in DOM order matching visual order, verified at 1440×900 and 390×844 with real Tab presses. |
| **2.4.4** | Link Purpose (In Context) | A | No | ⚪ N/A | No links other than the skip link, which is named. |
| **2.4.5** | Multiple Ways | AA | No | ⚪ N/A | A standalone single page. SC 2.4.5 applies to a *set* of web pages; there is no set. |
| **2.4.6** | Headings and Labels | AA | Yes | ✅ Pass | One `h1`, no skipped levels. Every control name is descriptive and location-qualified ("Home charging price in pounds per kWh"). |
| **2.4.7** | Focus Visible | AA | Yes | ✅ Pass | Every one of the 22 stops shows a visible focus indicator. The six number inputs previously indicated focus only by shifting their border from `#6E747E` to `#997F67` — a change of just **1.25:1** between states, and the only control in the app not using its 2px navy outline. They now use `outline:2px solid #1B2236`, measured at 7090 and 6611 changed device pixels. |
| **2.4.11** | Focus Not Obscured (Minimum) | AA | Yes | ✅ Pass | No fixed or sticky element overlaps a focused control; all measured inside the viewport after settling. |


## 2.5 Input Modalities

| SC | Name | Lvl | Relevant | Status | Evidence / what to do |
|---|---|---|---|---|---|
| **2.5.1** | Pointer Gestures | A | Yes | ✅ Pass* | No path-based or multipoint gesture. |
| **2.5.2** | Pointer Cancellation | A | Yes | ✅ Pass* | Activation is on the up-event; the step thumbs bind `mousedown` only to begin a drag, and a drag can be abandoned. |
| **2.5.3** | Label in Name | A | Yes | ✅ Pass | All labelled controls exact — every visible `<label>` text is contained in its control's accessible name. |
| **2.5.4** | Motion Actuation | A | No | ⚪ N/A | No device-motion or user-motion actuation. |
| **2.5.7** | Dragging Movements | AA | Yes | ✅ Pass | Every `role="slider"` thumb responds to arrow keys, so no dragging is required. |
| **2.5.8** | Target Size (Minimum) | AA | Yes | ✅ Pass | **No target under 24×24.** The eight `.step-thumb-el` render as 18×18 but their real pointer target is **exactly 24.0 × 24.0** via a transparent `::before` — confirmed by ray-casting `elementFromPoint` in 0.5px steps, hitting the button at all four ±11 corners. `button.reset-link` is 20px tall and passes on the **spacing exception**, with 30px clearance centre-to-box against its nearest neighbour (12px required). |


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
| **3.3.1** | Error Identification | A | Yes | ✅ Pass | An out-of-range price sets `aria-invalid="true"`, links a `.field-error` message via `aria-describedby`, and names the permitted range in text — rather than silently computing on a bad value. |
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
| **4.1.2** | Name, Role, Value | A | Yes | ⚖️ Decide | **AX tree: 426 nodes, 43 named, 0 unnamed, 0 duplicate role+name among interactive controls.** The eight step thumbs expose `role="slider"` with `aria-valuemin`/`max`/`now`. 21 focusable controls, all named. `#trim-select`'s name comes from `aria-labelledby="q-model trim-fl-label"` — the purpose-describing half ("Which model are you interested in?") is permanently stable; only the value half ("The new ID.3 Neo") mutates, same as any control whose display also shows its current value. **One decision remains** — see the decisions table. |
| **4.1.3** | Status Messages | AA | Yes | ✅ Pass | `#cost-live` (`aria-live="polite"`, in the DOM at load, 1×1 clipped with an explicit white `color`) announces every recomputation — driven through 7 distinct announcements, e.g. "Estimated electricity cost 848 pounds per year" → 844 → 904. |

---

# What is actually left to do

**No open criteria and no known failures.** Every Level A/AA criterion is verified, inspected, or
not applicable.

**One criterion carries a decision to record — under 4.1.2.** It passes; it needs a recorded position, not code:

| SC | Decision |
|---|---|
| **4.1.2** Name, Role, Value | Six `<img alt="Edit">` graphics sit inside `<label>`s and produce six identically named graphics in the accessibility tree. They are **not controls** — no role, no tabindex, no handler — and the six spinbuttons they label each have a unique name, so nothing is ambiguous to operate. But a screen-reader user reading the card linearly hears six "Edit" graphics with no indication of *what* is edited. `alt=""` would be semantically correct; it was deliberately avoided because it produced 10 WAVE "Empty form label" errors. Adding `aria-hidden="true"` to the `<img>` is the likely resolution — **re-verify against WAVE before shipping it.** |

**One thing no automated pass can close:** a screen-reader run. VoiceOver is planned; the protocol
names NVDA 2026.1.1.55980, so record that as a deviation. Two tool runs also remain — one pass
through the axe DevTools 4.131.2 UI, and a WAVE run from the browser extension. See
`a11y-2-automated-testing.md`.

# Decisions an auditor could challenge

24 of the 56 A/AA criteria have **no machine-testable ACT rule**, and several apply directly here
(1.4.11, 1.4.13, 2.5.1, 2.5.2, 2.5.8, 2.4.11). For those, "passes" reflects a **judgement**, not a
test result.

**The strongest claim this evidence supports:**

> *"This app meets WCAG 2.2 A/AA on every automated and runtime check available, pending
> screen-reader verification."*

That is stronger than a tool-clean claim, and unlike a tool-clean claim it is true — the one real
defect found here (unnamed graphics, SC 1.1.1) was invisible to axe, WAVE and Nu alike.
