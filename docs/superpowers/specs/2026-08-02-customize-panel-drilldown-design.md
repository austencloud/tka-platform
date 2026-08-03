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

- Below `840px` container width: one column. Root list, or detail filling the
  panel with a back arrow. Selecting a `disabled` row does not navigate; it
  surfaces the reason.
- At or above `840px`: two-pane. A `clamp(20rem, 36%, 30rem)` list rail on the
  left, detail on the right, no back arrow, the active row marked `selected`.
  (Fluid, not the flat `22rem` first drafted — a hard rail ellipsised the Style
  summary at a 1039px panel while the detail pane had room to spare.)

Detail children are `flex: 0 0 auto` and capped at `min(100%, 48rem)`.
`flex-grow: 0` because `StyleExpandPanel` still declares `flex: 1;
justify-content: center` from its accordion days and otherwise floated its three
rows in the middle of a 970px pane; the 48rem cap because a three-row form has
no business spanning 1000px — it stranded the Blue/Red labels a third of a pane
from the controls they name. The pictograph grid still gets 48rem, wider than it
ever had.

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

- Width: `min(var(--create-panel-width, 480px), clamp(520px, 42vw, 1100px))`,
  replacing the flat `min(..., 520px)` cap. 1440 -> ~600 (one column) ·
  1920 -> ~810 (one column) · 2560 -> ~1075 (two-pane) · 3840 -> 1100 ceiling.
  Never wider than the generate panel it sits over.
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
carve-out `crossfade-primitive.md` names for heavy content. In two-pane mode the
detail pane fades on selection change rather than pushing.
`prefers-reduced-motion` collapses both to instant.

## Panel header

Title, Reset all, and Close are rendered by the overlay ABOVE the drill panel,
not inside its list (revised during build). As a `listHeader` they disappeared
the moment you drilled into a setting, leaving the one-column detail view with
no way to close the panel.

## Entry point

One-column mode always opens on the root list: choosing which factor to change
is itself the first decision. Two-pane mode restores the last-selected row,
since the list stays visible either way. Persistence reuses the existing
`tka-customize-active-section` localStorage key, widened from
`"style" | "startEnd"` to the four ids, with unknown values falling back to
`style`.

## Verification (done)

Measured and screenshotted at every viewport in
`visual-verification-mandatory.md`. `emulate` does not override the window's
1.1 device pixel ratio, so each target was emulated at CSS x 1.1 and the
resulting `innerWidth` confirmed.

| CSS viewport | Drawer | Panel | Mode | Max scrollers | Min cell |
|---|---|---|---|---|---|
| 3840x2160 | 1099 | 1039 | two-pane | 0 | 150px |
| 2560x1440 | 1075 | 1015 | two-pane | 0 | 146px |
| 1920x1080 | 806 | 746 | one column | 0 | 128px |
| 1440x900 | 604 | 544 | one column | 0 | 128px |
| 820x1180 | 811 (sheet) | — | one column | 1 | 184px |
| 960x412 | 519 | — | one column | 1 | 105px |
| 375x667 | 413 (sheet) | 381 | one column | 1 | 87px |

Asserted at each: **exactly one `.layer` in the stage** and **at most one
element with `scrollHeight > clientHeight`** — the class of bug this replaces.
Every cell clears the 44px floor. Mobile sheet measured at a constant 624px
across all four details, so drilling does not resize it. Row height constant at
71px including the locked state, so no value moves a neighbour.

Also verified: LOOP on renders End Position locked with the lock glyph and "Set
by LOOP" at unchanged row height; Close and Reset all remain reachable from
every detail screen.
