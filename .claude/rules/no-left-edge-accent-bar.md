# No Decorative Edge Accent Strips - ENFORCED

## Terminology

This pattern is commonly called a **left accent border**, **accent rail**,
**status stripe**, or **callout/inset border**. There is no single inventor or
standard name. It predates generative UI and still has legitimate historical
uses in alerts, inset text, navigation, and document callouts.

That history does not make it appropriate for Flow Arts Composer. The pattern
has become a default generated-dashboard flourish because one CSS declaration
creates the appearance of hierarchy without requiring the interface to earn it
through composition. In this product it reads as machine output.

## The Rule

**Never attach a thin decorative color strip to one edge of a UI container.**

The ban applies to cards, tiles, panels, rows, buttons, callouts, menus, list
items, dialogs, and any other containing surface. It applies to every edge and
to every claimed purpose, including:

- selection, focus, current location, or active state;
- category, module, owner, or content identity;
- status, severity, progress, or priority;
- visual emphasis or an attempt to make a neutral card feel designed.

The previous exception for an identity color shown on every item is revoked.
Color may encode identity, but it may not do so as a decorative container-edge
strip.

## Banned Implementations

The implementation does not change the pattern. All of these are violations:

- `border-left`, `border-right`, `border-top`, or `border-bottom` used as a
  colored accent on a container;
- an inset `box-shadow` that draws a narrow colored edge;
- an absolutely positioned `::before` or `::after` pseudo-element used as a
  narrow edge strip;
- a thin colored child element placed flush against an edge;
- a gradient whose only job is to imitate an accent strip;
- moving the strip to a different edge, making it thicker, rounding its ends,
  or applying it to every item in a set.

## What To Use Instead

Treat state and identity as properties of the whole object:

1. Use a full outline or ring around a selected element.
2. Tint or fill the whole selected surface.
3. Use the selected treatment owned by `SegmentedControl`, `FilterChipBase`, or
   the relevant shared primitive.
4. Put identity color inside the actual icon, glyph, thumbnail, pictograph, or
   artwork.
5. Pair semantic color with a clear icon and label for status or severity.
6. Establish hierarchy with size, spacing, alignment, typography, grouping,
   and real content.

State still needs a non-color cue such as `aria-current`, `aria-pressed`, or
`aria-selected`.

## Narrow Non-Decorative Cases

These are not accent-strip treatments:

- a neutral structural divider or pane boundary using the theme stroke;
- chart geometry, a progress meter, a ruler, or another actual data graphic;
- an edge that is literally part of rendered artwork or a physical artifact,
  rather than chrome attached to its containing UI surface.

If a colored edge could be removed without losing data or structure, it is
decoration and is banned.

## Existing Violations

Existing instances are legacy violations, not precedent. Remove one whenever
its owning surface is deliberately restyled. Do not copy it into new work.

The Create front door is the reference correction: each creation method carries
its identity through the icon and a restrained whole-surface tint with a full
perimeter border. It does not attach color to one edge.

## Review Check

Before shipping container styling, search the changed CSS for per-edge borders,
inset shadows, and edge-positioned pseudo-elements. Inspect each hit by meaning,
not just syntax. Reject any implementation that produces a decorative colored
edge strip.

## Related

- `docs/architecture/visual-design-canon.md`
- `visual-verification-mandatory.md`
- `chip-primitives.md`
- `never-hand-roll.md`
- `no-checkboxes.md`
