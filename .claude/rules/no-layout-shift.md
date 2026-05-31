# No Layout Shift — ENFORCED

## The Problem This Solves

A dynamic label in the Inspect dock read `{colorName} · {tierLabel}` — "Red ·
Special JSON" vs "Blue · Special JSON". The color word and tier label are
different widths, so every selection switch resized the title box and shoved
every sibling in the row to the right. Jarring, and below 2026 web standards.

Austen's feedback (2026-05-30): *"it causes the entire thing to shift over all
of the elements ... which is very awkward and definitely does not represent
modern 2026 web standards ... this is an incredibly naive thing to do and you
can do better than that."*

The `frontend-design` plugin does NOT cover this — it is aesthetics-only (bold
typography, color, animation). Layout stability is a separate discipline. This
rule owns it.

## The Rule

When ANY element's text or contents change at runtime — selection labels, tab
titles, live counters, status words, toggling icons, loading→loaded swaps,
expand/collapse — the element MUST NOT change the size of its box in a way that
moves sibling or downstream elements. Reserve space for the worst case up front.

A control that reflows its neighbors when its own value changes is a defect, not
a detail. Treat it the same as a visual bug.

## The Techniques (pick the cheapest that fits)

1. **Ghost-sizer (variable text, unknown-longest, zero magic numbers).** Stack a
   hidden sizer holding the LONGEST possible variant under the live text in one
   grid cell; the cell sizes to the sizer, the live text overlays it. Canonical
   impl: `PipelineEditorDock.svelte` `.dock-title` (`display: inline-grid`;
   sizer + live both `grid-area: 1 / 1`; sizer `visibility: hidden`).
   ```html
   <span class="title">            <!-- display: inline-grid -->
     <span class="sizer" aria-hidden="true">Blue · Global Override</span>
     <span class="live">{liveText}</span>   <!-- both grid-area: 1 / 1 -->
   </span>
   ```
2. **`font-variant-numeric: tabular-nums`** for any changing NUMBER (counters,
   coordinates, timers, BPM, percentages) so digit-width never jitters.
3. **`min-width` / fixed `width` in `ch`** when the set of values is known and
   small (e.g. a unit suffix, a 2-state word) — size it to the wider value.
4. **Reserve the slot, toggle `visibility`/`opacity`** (not `display`) for
   appear/disappear elements (unsaved dots, badges, spinners) so the gap is
   always there.
5. **Fixed-size media boxes** — set `width`/`height` or `aspect-ratio` on images,
   canvases, icons, and async-loaded content so first paint doesn't relayout.
6. **Equal-width flex/grid segments** for control groups so the active/selected
   indicator and the neighbors don't move as the selection changes.

## The Self-Check (before claiming any dynamic UI done)

For every element whose contents change at runtime, ask: *if this shows its
longest / widest / tallest possible value, does anything else on screen move?*
If yes — reserve the space first. If you can't answer because you don't know the
longest value, enumerate the variants (they're in the code) and size to the max.

## Forbidden

- A label like `{a} · {b}` where `a` or `b` varies in width and the element has
  intrinsic (content) sizing with siblings after it.
- Changing numbers without `tabular-nums`.
- `display: none` ↔ `block` toggles for transient status elements inside a row
  (use reserved space + visibility instead).
- Async content (images, pictographs, 3D canvases) with no reserved box,
  causing a reflow on load.
- Shipping a dynamic-content change without running the self-check above.

## Related

- `verification-protocol.md` — prove the fix (no shift) with evidence
- `never-hand-roll.md` — reach for a stable shared primitive before rolling one
- `frontend-design` plugin — aesthetics; does NOT cover layout stability
