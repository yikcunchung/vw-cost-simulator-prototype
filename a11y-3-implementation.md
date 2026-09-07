# A11y 3 of 3 — What to build

**App:** VW Cost Simulator (`cost-simulator`). **Target:** production vw.com — AEM + React SPA
Editor + styled-components.
**Companions:** `a11y-1-criteria.md` (every criterion, pass/fail) ·
`a11y-2-automated-testing.md` (what the tools can/can't prove).

**Scope:** the whole page — standalone, no component/page split.

> **Do not copy the reference build.** It is vanilla HTML/JS and it is a *behavioural
> specification*, not source to port. A meaningful share of the required behaviour lives in
> JavaScript — a port that copies the DOM and rewrites the logic will silently drop it.

---

## Start here — the defect that shipped, and that no tool caught

**9 decorative inline `<svg>`s were exposed as unnamed graphics — axe (98 rules), WAVE and Nu all
scored 0 errors.** Only the AX tree caught it. Cause: Chrome maps a bare `<svg>` to `role=image`,
`name=""`; `svg-img-alt`/`role-img-alt` are `inapplicable` with no `role`, `image-alt` only checks
`<img>`.

**Fixed with `aria-hidden="true"`** — already the pattern on every `.q-icon` SVG; these 9 were just
missed. SC 1.1.1 is the rule; the DoD's AX-tree assertion keeps it fixed.

Two more invisible naming defects shipped alongside: `#car-img` had `alt="Volkswagen"` (present,
not descriptive), four `aria-label`s read "Public **charging charging** price". **Present and
unique doesn't make a name correct.**

---
# 1. Semantics and naming

### SC 1.1.1 — Every inline `<svg>` is either named or hidden

**Level A**

Chrome maps a bare `<svg>` to `role=image`, `name=""`, `ignored=false`. It is therefore **exposed to
assistive technology as an unnamed graphic** — it is not "decorative by default".

```jsx
// ✗ exposed, unnamed — this is the defect that shipped
<svg width="24" height="24" viewBox="0 0 24 24"><path d="…"/></svg>

// ✓ decorative: remove it from the tree
<svg aria-hidden="true" focusable="false" width="24" height="24">…</svg>

// ✓ meaningful: give it a role AND a name
<svg role="img" aria-label="Volkswagen" width="32" height="32">…</svg>
```

> **No scanner catches this** — `svg-img-alt`/`role-img-alt` are `inapplicable` with no `role`;
> `image-alt` only checks `<img>`. axe/WAVE/Nu all scored clean on pages with up to 16 of these.
> **Assert `0` unnamed, non-`ignored` `role=image` nodes on the AX tree.**

**In React:** put it in the icon component itself, so it cannot be forgotten per call site.

```jsx
export const Icon = ({ label, ...p }) =>
  label ? <svg role="img" aria-label={label} {...p}/> 
        : <svg aria-hidden="true" focusable="false" {...p}/>;
```

---

### SC 4.1.2, 2.4.4 — An icon-only control needs a real name, not a hidden one

**Level A**

If a control's only content is an icon, the control carries `aria-label`; the icon inside it is
`aria-hidden`. Never name the icon and leave the button unnamed — the name sits on the focusable
thing.

---

### SC 1.3.1, 4.1.2 — A `<select>` is named by its visible label

**Level A**

Use `aria-labelledby` pointing at the visible label element. Don't retype the label into an
`aria-label` — that's how visible text and name drift apart (see SC 2.5.3 above).

**Trap:** a `<select>`'s `<option>` text is **not** its label. Comparing concatenated option text
against the accessible name manufactures failures that don't exist.

---

### SC 2.5.3 — The visible label sits inside the accessible name

**Level A**

If a control has a visible text label, the accessible name must **contain that text, contiguously**
— otherwise a speech-input user can't activate it by saying what they see.

```jsx
// ✗ visible "Motor / Battery Capacity", name "Motor and battery capacity"
//   one character — "/" written as the word "and" — is a Level A failure
// ✗ visible "in … weather", name "in which weather"  (a word spliced between)
// ✓ append, never splice:  visible "of my ID.7", name "of my ID.7 variant"
```

**axe has no rule for this at all.** It must be checked by hand, against the accessibility tree.

---

### SC 1.3.1, 2.4.1, 2.4.6 — One `h1`, no skipped levels, real landmarks

**Level A / AA**

One `h1`; heading levels descend without gaps; `role="banner"` on the topbar, a `<main>`; skip link
as the **first** tab stop, pointing at an id that exists.

---

### SC 1.3.1 — Each FAQ item is a `role="group"` around its question and answer

**Level A**

`div.faq-item[role="group"]` wraps each of the 4 question/answer pairs. Without it a screen
reader hears an isolated expand/collapse button, with no cue it belongs to a set — `role="group"`
gives the pair a container an AT can announce membership in.

---

### SC 4.1.3 — A visually hidden polite live region, updated on every path

**Level AA**

```html
<p id="cost-live" class="sr-only" aria-live="polite"></p>
```

The region must already be in the DOM at load — injecting and writing to it in the same tick isn't
announced. Write from **every** path that changes the result, not just the common one.

> **Keep the `.sr-only` clip.** `position:absolute; width:1px; height:1px; clip:rect(0,0,0,0);
> clip-path:inset(50%); white-space:nowrap`. Set an explicit `color` — a clipped region inheriting
> a matching colour reads as a 1:1 contrast error to WAVE even though nothing renders.

---

### SC 3.1.1, 3.1.2 — `lang` on the document, and on any passage that differs

**Level A / AA**

`<html lang="en">`. If a CMS field can hold a string in another language, the rendering component
must emit `lang` alongside it.

---
# 2. Keyboard and focus

### SC 2.1.1 — Everything the mouse can do, the keyboard can do

**Level A**

Every custom control — anything not a native `<button>`, `<a>`, `<select>`, `<input>` — needs an
explicit key handler. Assert the **state change**, not just that the handler fired.

---

### SC 4.1.2 — A custom widget exposes role, name **and** value, on every path

**Level A**

A slider built from a `<div>` needs the full contract, value written from every path that can
change it — keyboard, drag, click-on-track:

```html
<div role="slider" tabindex="0"
     aria-label="Current charge level"
     aria-valuemin="0" aria-valuemax="100"
     aria-valuenow="20" aria-valuetext="20 percent">
```

**Derive the ARIA from state, never set it imperatively in one branch only.** In React:
`aria-valuenow={value}` — desync becomes impossible.

> **CDP caveat, not a defect:** `Accessibility.getPartialAXTree` reports `valuetext: ""` for every
> ARIA widget even when `aria-valuetext` is set — not measurable over CDP, needs a real reader.
> Don't read the empty string as a failure.

> **Fixed `dist-thumb-1`/`dist-thumb-2` to announce both segments, not one.** Each `aria-valuetext`
> originally spoke only its own side ("33% city"); now both neighbours: `dist-thumb-1` "33% City,
> 34% Country road", `dist-thumb-2` "34% Country road, 33% Motorway", `aria-label`s aligned to
> range-simulator's wording. Found via manual VoiceOver — axe/WAVE only check non-empty.

> **Fixed: min/max must reflect the actually-reachable range, not the widget's theoretical one.**
> Both thumbs statically advertised `aria-valuemin="0" aria-valuemax="100"` though JS clamps them
> from crossing each other — thumb1's real ceiling at rest (33/67) is 67, not 100. Found via
> production DOM comparison (`aria-valuemax="65"`), fixed by updating each thumb's max/min to the
> other's live position in `setPositions()`:
> ```js
> thumb1.setAttribute('aria-valuemax', String(v2));
> thumb2.setAttribute('aria-valuemin', String(v1));
> ```

---

### SC 2.4.3 — Focus order matches visual order

**Level A**

Drive real `Tab`, assert `document.activeElement` at each stop. Responsive layouts are where this
breaks: a control moving visually at a breakpoint must move in the DOM too, not via CSS `order`.

---

### SC 2.4.7 — A visible focus indicator on every control, styled consistently

**Level AA**

`outline: 2px solid var(--navy-dark); outline-offset: 3px`. Apply to **every** focusable thing
incl. skip/inline links — a browser-default fallback ring still passes, but is a visible
inconsistency an auditor notices first.

**Never remove an outline without replacing it.** If the real control is a visually hidden
`<input>` behind a styled surrogate, style the ring on the surrogate:

```css
.vw-switch input:focus-visible ~ .vw-switch-track { outline: 2px solid #293043; outline-offset: 3px; }
```

---

### SC 2.4.11 — A focused control is never left under sticky chrome

**Level AA**

Use `scroll-padding-top`/`scroll-padding-bottom` equal to the fixed-bar heights, or a `focusin`
handler that scrolls the control clear. Verify **after the scroll settles** — reading right after
`.focus()` catches mid-flight smooth-scroll and false-fails.

---

### SC 2.1.2 — No keyboard trap

**Level A**

Tab must cycle through every stop and out the other side. Any disclosure or panel must be escapable.

---

### SC 2.1.1 — A scrollable region is keyboard reachable

**Level A** (ACT rule `0ssw9k`)

A region that scrolls must be focusable so a keyboard user can scroll it: `tabindex="0"` +
`role="group"` + an accessible name.

> **Two rules disagree here, by construction.** axe's experimental `focus-order-semantics` flags
> `tabindex="0"` on a `role="group"` as a defect — tagged `best-practice` + `experimental`, no
> `wcag2*` tag, maps to no WCAG criterion. **Keep the `tabindex`** — 2.1.1 wins.

---
# 3. Pointer and targets

### SC 2.5.8 — Every target is at least 24×24 CSS px

**Level AA**

> **axe won't catch this** — `target-size` is `enabled:false` by default in axe-core 4.13.0; a
> stock run reports "0 violations" without testing it. Turn on:
> `axe.run(el, { rules: { 'target-size': { enabled: true } } })`

A visually small control can still be a compliant target if a transparent `::before` enlarges the
**hit area** — a legitimate technique, not a loophole. WCAG defines a target as "the region of the
display that will accept a pointer action":

```css
.thumb { width: 18px; height: 18px; }
.thumb::before {                    /* the real 24x24 target */
  content: ""; position: absolute; inset: 50% auto auto 50%;
  width: 24px; height: 24px; transform: translate(-50%, -50%);
  pointer-events: auto;             /* and the parent must not clip it */
}
```

**Prove it, don't assume it.** Ray-cast `document.elementFromPoint` outward from the centre in
0.5px steps, confirm the hit region really is ≥24×24 — and that a real drag *starts* from the
enlarged area, not just a hit-test.

**If a target genuinely is undersized**, the spacing exception is the fallback — test depends on
the neighbour:

- against a **full-size** neighbour: a 24px-diameter circle centred on the undersized target must
  not intersect the neighbour's **box** — i.e. **≥12px from centre to box edge**
- against **another undersized** target: **≥24px centre-to-centre**

Centre-to-centre against a full-size neighbour is the wrong test — gives a falsely comfortable
number.

---

### SC 2.5.2 — Activation happens on the up-event

**Level A**

Native `<button>` gets this free. A custom control must fire on `pointerup`/`click`, never
`pointerdown` — so a user can drag off to abort.

---

### SC 2.5.7 — Dragging always has a non-drag, single-*pointer* alternative

**Level AA**

**Requires a single-pointer, no-drag way to set the value** — a `click`/`tap` handler on the track
that jumps the thumb straight to position. Arrow keys don't satisfy this SC (2.1.1/2.5.7 evaluated
independently, per the W3C Understanding note) since touchscreen users may have no keyboard. Native
`<input type="range">` gets this free; a custom `role="slider"` must implement track-click.

---
# 4. Visual

### SC 1.4.3 — Text contrast ≥4.5:1, measured on composited pixels

**Level AA**

Over a gradient, image, or overlapping element, axe returns **`incomplete`**, not a pass — resolve
by hand, on real pixels.

**How to measure without producing a false result:**

- `clip` is **document-absolute**, `getBoundingClientRect()` is **viewport-relative** — mixing them
  gives exactly `1.00:1` (crop missed).
- Crop to the **glyph band** (`Range.getClientRects()` union), excluding the element's own border.
- Take the **dominant** background colour, not worst minority — at 12px the glyph core is <1% of
  the crop.

---

### SC 1.4.11 — Non-text contrast ≥3:1

**Level AA**

Control boundaries, focus rings and selected-state indicators.

---

### SC 1.4.10, 1.4.4 — No content loss at 320×256 CSS px

**Level AA**

**400% zoom is `setDeviceMetricsOverride{ width:320, height:256, deviceScaleFactor:4 }`.**
`dsf 1` is a small screen — a different test.

Content may scroll in **one** direction only. A horizontal carousel inside a bounded, keyboard-
operable region is the permitted exception; page-level horizontal scroll is not.

Sufficient techniques: **C31** (flexbox), **C32** (media queries + grid), **C34** (un-fix sticky).

---

### SC 1.4.12 — The text-spacing overrides must not clip anything

**Level AA**

```css
* { line-height:1.5 !important; letter-spacing:.12em !important; word-spacing:.16em !important; }
p { margin-bottom:2em !important; }
```

Nothing may newly clip, no control lost, no horizontal scroll.

> **Build target sizes out of `padding`, not `line-height`** — this SC overrides `line-height`, so
> a line-height-based 24px target collapses under the very override being tested; padding is
> unaffected.

> **Fix the width first, not just the recovery path.** `.select-group` stacks selects vertically,
> unconditionally, giving each floating label the full row width everywhere — zero clipping at
> every width.
>
> Secondary safeguard: wrap `<option>`s in a matching `<optgroup label="…">` so opening the select
> reveals the text in full:
> ```html
> <select aria-labelledby="battery-fl-label">
>   <optgroup label="Motor / Battery Capacity">
>     <option value="50">125 kW (170 PS) · 50 kWh</option>
>   </optgroup>
> </select>
> ```
> Apply everywhere that rebuilds the select's `innerHTML` — a static fix alone is undone on
> rebuild. The optgroup is a safety net, not the primary fix: neither present means no escape.

---

### SC 1.3.4 — Never lock orientation

**Level AA**

No `@media (orientation:)` rule hides or restricts content.

---
# 5. React, styled-components and AEM — the ones that bite

1. **`styled-components` drops unknown props.** `aria-*`/`role` pass through on DOM elements but
   **not** through a custom component unless forwarded. Spread `{...rest}` onto the DOM node.
2. **AEM `EditableComponent` injects a wrapper `<div>`.** Anything relying on a parent-child ARIA
   relationship (`radiogroup` owning its radios, `aria-labelledby` across a boundary) breaks once
   each child is separately authorable. Keep the group as **one** component, or wire `aria-owns`.
3. **Conditional rendering destroys focus.** Unmounting a panel while focus is inside drops focus
   to `<body>` — return focus to the opener explicitly.
4. **`useId()` for every label association** — hand-written ids collide once placed twice on a
   page; `duplicate-id-aria` is a real failure.
5. **A CSS-in-JS `:focus-visible` must survive minification** — verify the ring in the built
   bundle, not just dev.
6. **Icons: name or hide at the component boundary** (SC 1.1.1) — a per-call-site decision gets
   missed.
7. **Live regions must mount before they're written to.** Render unconditionally; write on update.

---

# 6. Definition of Done

- [ ] **axe with `target-size` explicitly enabled** — off by default, so without it CI passes SC
      2.5.8 without ever testing it
- [ ] **AX tree asserted** — `0` unnamed `role=image` nodes, `0` unnamed interactive nodes, every
      duplicate role+name pair reviewed
- [ ] **Real keyboard run** — Tab/Shift+Tab/Enter/Space/Arrows/Escape, asserting
      `document.activeElement` and resulting state at each step
- [ ] **All states, not just default** — expand every disclosure, open every panel, select every
      option, re-run checks after each
- [ ] **Reflow at 320×256 @ dsf 4** — nothing lost, no page-level horizontal scroll
- [ ] **Contrast on composited pixels** wherever text sits over gradient/imagery
- [ ] **SC 2.5.3 by hand** — visible label contained in the accessible name; no tool does this
- [ ] **Names are correct**, not merely present/unique — read each against what it describes
- [ ] **Screen reader** — one pass with NVDA or VoiceOver, not optional
- [ ] **The suite fails when it should** — inject the defect, confirm the detector fires

---

# 7. App-specific notes

**The step thumbs are 18×18 and still pass SC 2.5.8 — because of a pseudo-element.**

```css
.step-thumb-el { width: 18px; height: 18px; }
.step-thumb-el::before {                 /* the real target: exactly 24.0 x 24.0 */
  content: ""; position: absolute; inset: 50% auto auto 50%;
  width: 24px; height: 24px; transform: translate(-50%, -50%);
  pointer-events: auto;
}
```

Ray-casting `elementFromPoint` in 0.5px steps confirms 24.0×24.0, all four ±11 corners return the
button. **Load-bearing:** removing `::before` as dead CSS isn't rescued by the spacing exception —
the enclosing `div.step-track-wrap` has its own click handler, so centre-to-box distance is 0
(12px required).

> **axe reaches the right verdict by the wrong route** — measures 18×18, fails on size, passes on
> *offset* (neighbour set excludes `div[click]`/`label`, missing the wrapper). Don't rely on
> `target-size` here; prove the hit area yourself.

**`button.reset-link` is 20px tall, passes on the spacing exception** — 30px clearance centre-to-box
vs 12px required. That one *is* exception-dependent — give it 24px if the layout ever tightens.

**The 10 edit icons were re-architected from `<label for>` to real `<button>`s** — each a unique
`aria-label` (e.g. "Edit home charging price"), icon `alt=""`, resolving the old six-identical-
"Edit" ambiguity. Trade-off: Tab-stop count 22→29, each only refocuses an already-reachable field —
nothing requires reverting, but worth a deliberate call (keep, or `tabindex="-1"` for touch-only).

**Error handling is already correct — keep it.** Out-of-range price sets `aria-invalid="true"`,
links `.field-error` via `aria-describedby`, names the permitted range — SC 3.3.1/3.3.3, the only
app in the suite needing them.

**Fixed the weakest focus indicator on the page:** number inputs signalled focus only via a
**1.25:1** border-colour shift (`#6E747E`→`#997F67`); now the same 2px outline as every other
control. Apply at the *design-system* level when porting, or this recurs.

**Contrast: 56 nodes go `incomplete`, every one passes — worst ratio 6.19:1.** Cause:
`linear-gradient` on `.input-section` + `span.slot-reel` digit-roller overlap — expect the same
noise in the port, not a defect.
