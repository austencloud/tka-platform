# Chip / Filter-Bar Primitives — ENFORCED

## The Problem This Solves

The codebase had filter bars hand-rolled as raw `<button class="chip">` rows in
a dozen features — each reinventing toggle state, active styling, counts, and
a11y, drifting visually and behaviorally. They were consolidated onto two shared
primitives (2026-05-30, spec
`docs/superpowers/specs/active/2026-05-30-chip-consolidation-design.md`). The
generic `never-hand-roll.md` did not prevent the drift on its own, so this rule
names the canonical primitives and the routing decision explicitly.

## The Two Canonical Primitives

| Need | Primitive | Path |
|---|---|---|
| Multi-select / independent toggles | `FilterChipBase` (`mode="toggle"`) | `src/lib/shared/browse/components/filter-chips/FilterChipBase.svelte` |
| Single-select group (exactly one active) | `SegmentedControl` | `src/lib/shared/3d/components/controls/SegmentedControl.svelte` |

`FilterChipBase` also has `mode="dropdown"` (chip opens a popover list) and
`mode="action"` (momentary button — clear/apply). Props worth knowing before you
reach for a workaround: `size="sm"` (denser rows, touch-target floor preserved),
`iconSnippet` (a Snippet slot for a bitmap/inline-SVG leading glyph when `icon`'s
FontAwesome class won't do), `count`, `chipColor`. `SegmentedControl` supports
`size="sm"`, `color`, and optional per-`Option` `count` and `tone` values.

## Blue / Red Prop Identity

When an option means the blue/left prop or red/right prop, set its
`SegmentedControl` option `tone` to `"blue"` or `"red"`. The tone colors the
option before selection and follows the selected indicator.

For a single option in a row, keep a visible Blue/Red or Left/Right label —
one tinted chip among neutral siblings is not self-evident. But when the WHOLE
control is already unmistakably that prop (a fully blue-tinted row: border,
background wash, and the selected-turn indicator all blue) AND a non-visual
identity cue remains (the container's `aria-label`, e.g. `"Blue turns"`), the
word is redundant and may be dropped — colour plus the aria-label carries it.
Austen (2026-07-22, option-picker turns rows): *"no need for the words blue and
red when the thing itself is both blue and red ... having it be colored is
plenty enough."* Never drop BOTH the word and the aria-label; that strands
screen-reader and colour-blind users.

Do not infer prop identity from the words Left and Right. Those words also name
camera views, prop ends, and spatial directions. The caller owns the meaning and
must opt in with `tone`. Independent Blue/Red visibility toggles use the shared
`MotionColorChips` component, which carries the same semantic colors.

## The Routing Rule (apply per bar)

- **Mutually-exclusive options, exactly one active** (including an explicit "All"
  reset) → **`SegmentedControl`**. It owns the single-select group semantics and
  the sliding indicator; N toggle chips can only fake it via parent state and
  lose the indicator.
- **Independent booleans, many can be on at once** → **N × `FilterChipBase`
  `mode="toggle"`**.
- **"At most one" that clears on re-click (no always-on option)** →
  `FilterChipBase` toggles (SegmentedControl can't represent the none-selected
  state — its indicator has nowhere to go).

## The Rule

Before building or editing ANY filter/selector bar:

1. Use `FilterChipBase` or `SegmentedControl` per the routing rule above. Do not
   hand-roll `<button class="chip|pill|filter-pill|filter-chip">` filter buttons.
2. If a prop is missing for your case, **extend the shared primitive** (as
   `size`/`iconSnippet`/`count` were added) rather than forking a local copy.
   A second `FilterChipBase` once existed and was deleted — do not recreate it.
3. Before claiming a filter-bar task done, grep your diff: any new
   `class="chip"`/`class="pill"` interactive filter button means you bypassed the
   primitive — replace it. (No `type="checkbox"` either — see `no-checkboxes.md`.)

## Keep-Separate (do NOT fold into the above)

These are distinct interaction models, intentionally not consolidated:
`MorphChip`/`MorphChipGroup`, `BpmChips`, `MotionColorChips`, `PresetChip`,
nav pills (`shared/animation-panel/pill-nav/*` — retained per
`feedback_keep_pill_nav`), and any `*Badge` (display-only, never interactive).
Bars with per-option colors + dynamic lists + an inline add-action (e.g.
VideoFilterBar Category/Performer) legitimately stay hand-built — SegmentedControl
can't express them. When you keep a bar, say why.

## Forbidden

- A new filter bar built from raw `class="chip"` buttons when one of the two
  primitives fits.
- Forking a local `FilterChipBase`/`SegmentedControl` copy instead of extending
  the shared one.
- Routing a single-select group to N toggle chips (drops the indicator + the
  exactly-one invariant).
- Shipping a filter-bar change without grep-proof the diff added no raw chip
  buttons.

## Related

- `never-hand-roll.md` (master rule), `primitive-discovery.md`, `no-checkboxes.md`
- Spec: `docs/superpowers/specs/active/2026-05-30-chip-consolidation-design.md`
