# Visual Verification Is Mandatory — ENFORCED

## The Problem This Solves

On 2026-07-26 a Creators redesign shipped a segmented control ~1765px wide on a
1846px panel — three short labels stretched into a progress bar — plus stranded
partial rows and a title whose count sat in a pool of dead space. Every one of
those was visible in the FIRST screenshot of the page. No screenshot was taken.
`svelte-check` was green and 46/46 tests passed, and that was reported as
progress.

Austen (2026-07-26): *"If you had simply taken one screenshot you would have
immediately noticed the buttons being absolutely massively wide ... I have spent
the last three weeks telling every single agent OK great good job you did the
thing now make it work on 4K. I don't want to do that anymore."*

Two failures made it possible, and both are closed here:

1. **A permission excuse.** The old `CLAUDE.md` browser section said interactive
   DevTools commands need explicit verbal permission, so agents read "don't open
   the browser" and shipped blind. Verifying your own visual diff now has
   standing permission — it is part of the edit, not a favor to ask for.
2. **A wrong definition of done.** "Compiles + tests pass" was treated as done
   for a *visual* change. Types and unit tests cannot see a 1765px button.

## The Rule

**If your diff changes what a surface looks like, you look at it before you
report on it.** Not the user. You.

That means: launch Chrome with the debugging port, load the route, resize to each
required viewport, screenshot, and READ the screenshot for defects. Then iterate
— fix, reload, screenshot again — until you would put your name on the frame.
The loop ends when the picture is right, not when the code compiles.

"I can't verify this visually" is only true if the browser genuinely will not
start. It is never true because you didn't ask.

## The Required Viewports (all of them, every visual change)

| Name | Size | Why it is on the list |
|---|---|---|
| 4K @ 200% | **1920 × 1080** | The most common real 4K setup. Windows' default. |
| 4K @ 150% | **2560 × 1440** | The middle tier a single `min-width` seam always misses. |
| 4K @ 100% / TV | **3840 × 2160** | Nothing scales for you here. Type and elements must step. |
| Laptop | **1440 × 900** | The base design must still be the base design. |
| Tablet | **820 × 1180** | Portrait, two-ish columns. |
| Z Fold 7 folded, landscape | **960 × 412** | Wide AND short. Kills stacked layouts + tall chrome. |
| iPhone SE | **375 × 667** | The floor. If it fits here it fits anywhere. |

Skipping a viewport is allowed only when the change provably cannot reach it
(e.g. a desktop-only pane), and you say which you skipped and why.

## What To Actually Look For

Screenshotting and not reading the screenshot is the same as not screenshotting.
Every frame, check:

1. **Is any control absurdly wide?** A row of 2–4 short labels must size to its
   labels. If a button, chip, tab, or segmented control spans most of the
   viewport, it is broken. This is the single most common failure — a shared
   primitive with `width: 100%` defeats a consumer's `flex: 0 0 auto`, because
   `flex-basis: auto` resolves to that `width`. Override `width` too.
2. **Dead space.** Cells far wider than their content, a title marooned from its
   neighbour, gutters bigger than the things they separate.
3. **Orphans and stranded rows.** A last row holding one item, or a grid with
   empty tracks trailing the final cell.
4. **Does anything float on the animated background** with nothing behind it?
5. **Does the page dead-end** a third of the way down at 4K, or overflow
   horizontally at 375?
6. **Are small glyphs legible** at this size, or do they read as punctuation?
7. **Does it look like a product, or like output?** If the honest answer is
   "output," keep going. That is the whole bar.

## Cost Is Not The Objection

Use `take_screenshot` with `format: "webp", quality: 70`. Use
`evaluate_script` returning measured numbers (element widths, column counts,
computed font sizes) for cheap between-screenshot checks — a JSON of ten
measurements costs a rounding error and catches width bugs precisely. Screenshot
to confirm composition; measure to confirm arithmetic.

One wrong-looking page costs Austen an hour and a round trip. A handful of webp
frames costs less than the message asking whether to take them.

## Forbidden

- Reporting a visual change as done, fixed, or green with no frame observed.
- Asking permission to open the browser to verify your own diff.
- Treating `npm run check` / passing tests as verification of appearance.
- Shipping any layout change without the 4K viewports (`4k-native-layout.md`).
- Handing the user a screenshot request ("reload and send me a shot") in place of
  taking one — that is the exact loop this rule exists to end.
- Delegating the visual judgment to a subagent or workflow that also cannot see
  the page. Design fan-outs produce documents, not pixels; build it yourself and
  look at it (`fable-routing.md` → Workflow Cost Discipline).

## Related

- `verification-protocol.md` — the general "prove it" rule; this is its visual arm
- `4k-native-layout.md` — what "at home on 4K" means, and the 1680 seam
- `no-layout-shift.md`, `clickables-look-like-buttons.md`, `never-hand-roll.md`
- Memory: `feedback_visual_verification_mandatory`, `feedback_4k_is_home`
