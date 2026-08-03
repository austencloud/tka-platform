---
date: 2026-08-02
status: active
area: create/generate
supersedes: accordion layout in CustomizeExpandedOverlay.svelte
---

# Customize Panel Drill-Down

## Problem

The Generate module's Customize panel presents four unrelated decisions at once
inside two accordion sections, with a fifth (End Position) nested *inside* a
fourth (Start Position). Choosing a start position and an end position happens on
the same screen, which is more than the user needs to hold at once.

It also could not scroll. Measured on the live page at 1920x1080 with LOOP off
and End Position expanded:

- `.overlay-content`, the only scroller: `scrollHeight 970 === clientHeight 970`
- `.accordion-section`: `height 919`, `scrollHeight 1334`, `overflow: hidden`

`.accordion-section:has(.accordion-header.active)` set `min-height: 0`, which let
the expanded section flex-shrink below its content inside the column-flex
scroller. The section absorbed 415px of overflow and clipped it against its own
`overflow: hidden`, so the scroller never overflowed and never scrolled. The
bottom row of the End Position grid, and the entire Start Orientation block
below it, were unreachable.

That specific defect is fixed ahead of this redesign (`flex-shrink: 0` on
`.accordion-section`, `min-height: 0` removed from the active-section rule), so
the panel is usable while this lands.

## Scope

The panel keeps exactly the settings it owns today: Style, Start Position, End
Position, Start Orientation. The generate card grid (Level, Word, Setups,
Length, Grid, Turn Intensity, LOOP) is untouched.

## Prior-art search

Per `never-hand-roll.md`, searched `src/lib/shared/**`, `src/lib/components/**`,
`src/lib/ui/**`, `src/lib/features/*/components/**` for a drill-down /
navigation-stack, a settings row, and a container-query two-pane layout.

- **Drill-down / master-detail:** no generic primitive.
  `src/lib/shared/admin/components/AdminTwoPanelLayout.svelte` is the closest —
  `list` + `detail` snippets, `hasSelection`, responsive placement. It is
  rejected on two specifics: it renders the detail inside a `Drawer` over a
  still-visible list (our panel *is* a `Drawer`; nesting one is not available),
  and it branches on `getDeviceDetector()` viewport state, while our seam must
  key off the panel's own width, which is decoupled from the viewport.
  `GalleryDrill.svelte` is the closest conceptual analog but is 6083 lines
  welded to browse-domain types.
- **Settings row:** no generic primitive. Closest are the inline `.option-btn`
  in `shared/settings/components/photo-picker/PhotoOptionsList.svelte` and the
  inline `.toggle-row` in `shared/settings/components/tabs/PreferencesTab.svelte`
  — both one-off markup, usable as visual reference only.
- **Container-query two-pane:** none. Every `container-type: inline-size` hit is
  a leaf component sizing its own content.

Creating new, in `shared/`, for both.

## Components

### New: `src/lib/shared/ui/components/settings-drill/SettingsDrillRow.svelte`

Setting name on top, current value below, chevron right. 44px touch floor.

```ts
{
  label: string;
  value: string;
  selected?: boolean;      // two-pane mode marks the active row
  disabled?: boolean;
  disabledReason?: string; // renders in place of the value, with a lock
  onclick: () => void;
}
```

**Two lines, not label-left/value-right** (revised during build). The values run
from `Any` to `Props: Choppy · Hands: Smooth · Dashes: High`, and measured at
2560 the long one ellipsised inside every two-pane rail width that still left
the detail pane usable. On its own line it gets the row's full width at every
size.

**No ghost sizer** (revised during build; the first draft specified one). Row
height comes from two fixed-size text lines and the value is clipped to one
line, so no value can change the row's box or move the rows below it — verified
71px on every row in every state, including locked. A `valueSizer` prop would
only have been a hand-maintained "longest string" constant drifting out of sync
with a derived summary.

The lock treatment reuses the markup already in `PositionSection.svelte`'s
`.value-locked`.

### New: `src/lib/shared/ui/components/settings-drill/SettingsDrillPanel.svelte`

```ts
{
  items: Array<{
    id: string;
    label: string;
    value: string;
    valueSizer?: string;
    disabled?: boolean;
    disabledReason?: string;
  }>;
  selected: string | null;   // bindable
  detail: Snippet<[string]>; // caller renders the chosen setting
  listHeader?: Snippet;      // Reset all, note
  onSelect?: (id: string | null) => void;
}
```

Owns the root list, the detail frame (back arrow + title), the swap between
them, and the seam. `container-type: inline-size` on the root.

**Single column at every size.** Root list, or detail filling the panel with a
back arrow. Selecting a `disabled` row does not navigate; it surfaces the
reason.

A two-pane variant (list rail + detail above an 840px container seam) was built,
measured, and **removed** — see Width below.

Detail children are `flex: 0 0 auto`. `flex-grow: 0` because
`StyleExpandPanel` still declares `flex: 1; justify-content: center` from its
accordion days and otherwise floated its three rows in the middle of the pane.
A `.drill-fill` opt-in class takes the remaining height for the pictograph-grid
wrappers so the grids can size against it.

Scroller discipline is the panel's job and only the panel's: the detail body is
the single `overflow-y: auto` element. The list rail scrolls independently in
two-pane mode. Detail title row and list header are pinned. No descendant of a
detail body may declare its own scroller — enforced by the verification step
below.

### Rewritten: `CustomizeExpandedOverlay.svelte`

Drops the accordion (730 lines) and becomes a declaration of four items plus
four detail snippets. All local state, handlers, `emitStartEndChange`,
`performResetAll`, and the summary derivations carry over unchanged.

| id | Label | Value | Detail body |
|---|---|---|---|
| `style` | Style | `styleSummary` | `StyleExpandPanel` |
| `startPos` | Start Position | `startEndDisplay` | `SegmentedControl` + `MultiSelectPositionPicker` |
| `endPos` | End Position | `Any` / position name | `PositionPickerGrid` + the "Any" reset button |
| `startOri` | Start Orientation | `In / In` etc. | the two `PropOrientationControl` cyclers |

Every detail body is an existing component, used as-is.

`PositionSection` is no longer used here: the drill row is its header, so
keeping it would nest a collapsible inside a detail view. The component stays in
the codebase — `browse/.../bento-filter/PositionOptionsSheet.svelte` still uses
it, as does the back-compat re-export at
`create/generate/components/modals/customize/PositionSection.svelte`.

The `endPos` row is always present. When LOOP is on (`isFreeformMode === false`)
it is `disabled` with reason "Set by LOOP". Today the row vanishes, which
changes the list length and moves the rows below it, and leaves a user who saw
the setting once with no explanation.

### Changed: `CustomizeDrawer.svelte`

- Width: `min(var(--create-panel-width, 480px), clamp(480px, 30vw, 620px))`.
  1440 -> ~520 · 1920 -> 575 · 2560 -> 619 · 3840 -> 619. Never wider than the
  generate panel it sits over.

  **Revised twice.** The flat `520px` cap was first raised to a
  `clamp(520px, 42vw, 1100px)` band so the two-pane seam could fire. Built and
  screenshotted, that was wrong: at 2560 the drawer was 1075px — 2.7x the 400px
  cap both sibling drawers in this same slot use (`PresetDrawer.svelte:375`,
  `LOOPDrawer.svelte:121`) — it covered the generate panel completely, and its
  detail pane ran ~1300px tall for a three-row form. Three attempts to make
  content fill that pane each produced a worse artifact: centering the grid
  stranded the preset control 396px above it, and spreading the Style axes put
  275px between PROPS and HANDS so they stopped reading as one group.

  The leftover height is structural — four small settings do not fill a
  full-height column in any arrangement — so the panel was sized to its content
  instead of the reverse, and the two-pane branch deleted rather than left as an
  unreachable code path. At ~620px the drawer matches its neighbours, the
  generate panel stays readable beside it, and the remaining void is the same
  one `PresetDrawer` has with two saved setups.

  Not fixed by shrinking the drawer's HEIGHT: a short top-anchored right drawer
  would be a first anywhere in the repo. Every other right-side drawer fills its
  column, and `LOOPDrawer.svelte:117` says why in its own words — "the list rows
  stretch to spread across that height, so there is no empty bottom and no
  floating-box-in-corner look."
- Mobile bottom sheet: `height: 85dvh` fixed, replacing `height: auto` +
  `max-height: 85dvh`. Drilling from a three-row Style screen to a 16-cell grid
  must not resize the sheet.
- The `:global(... .accordion-*)` overrides go away with the accordion.

## Motion

Root <-> detail is a horizontal push, **one keyed layer with an intro only and
no `out:` transition** (revised during build). The first implementation used two
`{#if}` branches each carrying `in:`/`out:` fly. Measured, the outgoing layer
persisted in the DOM long past its 200ms duration — seconds, and on light
content too, not just the 16-pictograph grids — which meant two scrollers and a
stale hit-testable list sitting under the detail. An intro-only keyed block
removes the old layer synchronously, so the stage provably holds exactly one
layer; verified at every viewport.

It deliberately does not use `<Crossfade>`: that primitive keys on `{#key}` and
remounts its children, and these detail bodies are heavy pictograph grids — the
carve-out `crossfade-primitive.md` names for heavy content.
`prefers-reduced-motion` collapses it to instant.

## Grid sizing

A 4x4 grid of square cells is as tall as it is wide, so the panel's WIDTH caps
it and it cannot consume a full-height column's leftover height. It takes the
width it has, sits under its control, and the remainder stays empty.

`width: min(100%, max(20rem, calc(100cqh - var(--grid-reserve))))` on
`.variations-grid`, inside a `container-type: size` wrapper:

- `100cqh` caps the grid by the height actually available, so a short window
  gets a smaller grid instead of a scroll it doesn't need.
- `--grid-reserve` is whatever the picker puts above its grid — `3.5rem` for
  `MultiSelectPositionPicker`'s "N of 16 enabled" line, `5.25rem` for
  `PositionPickerGrid`'s full-height "Any" button. Under-reserving cost a 16px
  scroll at 375px.
- The `20rem` floor stops the height cap squeezing cells into smudges: at
  960x412 it had driven them to exactly 44px, the bare touch floor. Below the
  floor the grid keeps its size and the body scrolls — a readable cell you
  scroll to beats an unreadable one you don't.

## Panel header

Title, Reset all, and Close are rendered by the overlay ABOVE the drill panel,
not inside its list (revised during build). As a `listHeader` they disappeared
the moment you drilled into a setting, leaving the one-column detail view with
no way to close the panel.

## Entry point

Always opens on the root list: choosing which factor to change is itself the
first decision.

The accordion's `tka-customize-active-section` localStorage persistence is
**removed**. It existed because a collapsed accordion section hid its value, so
reopening on the wrong section buried what the user last changed. The root list
shows all four current values, so nothing is buried and there is nothing to
restore.

## Verification (done)

Measured and screenshotted at every viewport in
`visual-verification-mandatory.md`. `emulate` does not override the window's
1.1 device pixel ratio, so each target was emulated at CSS x 1.1 and the
resulting `innerWidth` confirmed.

| CSS viewport | Drawer | Scrollers | Cell |
|---|---|---|---|
| 3840x2160 | 619 | 0 | 132px |
| 2560x1440 | 619 | 0 | 132px |
| 1920x1080 | 575 | 0 | 121px |
| 820x1180 | 811 (sheet) | 0–1 | 184px |
| 960x412 | 479 | 1 | 72px |
| 375x667 | 413 (sheet) | 0 | 77px |

"Scrollers" counts only elements whose computed `overflow-y` is `auto`/`scroll`
AND which overflow — the invariant that matters. An earlier count included
`overflow: visible` elements, which merely overflow into the designated
scroller and are not a second scroller.

Asserted at each: **exactly one `.layer` in the stage** and **at most one
element with `scrollHeight > clientHeight`** — the class of bug this replaces.
Every cell clears the 44px floor. Mobile sheet measured at a constant 624px
across all four details, so drilling does not resize it. Row height constant at
71px including the locked state, so no value moves a neighbour.

Also verified: LOOP on renders End Position locked with the lock glyph and "Set
by LOOP" at unchanged row height; Close and Reset all remain reachable from
every detail screen.

## Open follow-up

At 3840 the leftover height below a detail is large — the grid ends roughly a
fifth of the way down a 2160px column. It is the same shape every right-side
drawer in this slot has at that size, and it is not fixable by arranging these
four settings differently (see Width). Closing it needs *content*: a live
preview of what the current settings produce, or the Generate button, which the
drawer currently covers. Deferred, not solved.
