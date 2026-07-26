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

## When It Fires (and when it does not)

This is a proportionality rule, not a ritual. Booting Chrome to confirm a
one-word copy change is its own kind of failure — Austen (2026-07-26): *"it's
probably going to make the teensiest tiniest changes and insist that it has to
open up the Chrome browser to look at it which maybe I don't want."*

**Fires — screenshot required:**
- A new surface, page, panel, or component you built
- Anything that changes SIZE, POSITION, COUNT, or STRUCTURE: layout, grid or
  column math, flex/grid properties, width/height/padding/gap, breakpoints,
  responsive tiers, adding or removing an element
- Any change to a shared primitive's box (it lands on every consumer)
- Anything the user asked to be "pretty", "premium", "gorgeous", "4K-friendly"
- Any change you are reporting as a fix for a visual defect

**Does not fire — say what you changed and move on:**
- Copy and label text (unless the new string is much longer — that is a size
  change, see the ghost-sizer half of `no-layout-shift.md`)
- Swapping one design token for another of the same kind (color, radius token)
- Comments, types, prop plumbing, non-visual logic
- A change already screenshotted this session whose frame would be identical

**Batch it.** One verification pass over a finished piece of work beats a frame
after every edit. Make the whole change, then look, then iterate on what the
frames show. If the user says skip it, skip it — this rule loses to a direct
instruction like every other.

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

**Reaching a real 3840 viewport needs `--force-device-scale-factor=1`.** Windows
runs Austen's 4K display at 200%, so a normally-launched Chrome maxes out at a
1920 CSS viewport and `resize_page(3840, …)` cannot exceed the physical screen.
The flag makes one physical pixel one CSS pixel, giving a genuine 3840 viewport.
Expect Chrome's OWN UI (tabs, URL bar) to render at half physical size in that
window — that is the flag working, not a bug, and it is worth saying so out loud
if Austen sees the window, because it looks broken.

## Which Browser Tool (settled 2026-07-26)

**Verifying your own diff uses Chrome DevTools MCP. Always.** Claude in Chrome
(`mcp__claude-in-chrome__*`) is not the tool for this job, and the difference is
in the tool schemas, not in taste:

| | Chrome DevTools MCP | Claude in Chrome |
|---|---|---|
| Screenshot cost | `format: "webp", quality: 70` — ~4x cheaper than PNG | `computer` screenshot takes **no format/quality params**. Full fidelity, every frame. |
| Viewport | `resize_page(w, h)` sets the **page** dimensions — 3840×2160 is a real 3840 CSS viewport | `resize_window(w, h)` sizes the **OS window**; tab strip and URL bar eat the top, and it cannot exceed the physical screen |
| Cheap measurement | `evaluate_script` returns JSON — ten element widths for a rounding error, no image | built around visual coordinates |
| Session | your own instance, `--user-data-dir=C:\Users\Austen\.claude\chrome-profile` | drives Austen's signed-in Chrome |
| Scoping | `uid` screenshots one element; `filePath` writes the image to disk instead of into context | full-viewport frames only |

Claude in Chrome is for *acting* in Austen's live browser — external dashboards
(Cloudflare, Firebase, Stripe, PayPal) where his signed-in session is the whole
point, per global `CLAUDE.md` → Web Browsing. It stays there.

**The canonical loop:**

1. Launch own Chrome with `--force-device-scale-factor=1` (see the note above —
   required to reach a real 3840 viewport).
2. `resize_page` per viewport from the table above.
3. `evaluate_script` returning measured numbers — control widths, column counts,
   computed font sizes. Catches the 1765px-button class of bug precisely, for
   near-zero tokens.
4. `take_screenshot` `format: "webp", quality: 70` to judge composition, which
   numbers cannot.
5. Fix, reload, repeat until the frame is right.

Measure to confirm arithmetic; screenshot to confirm composition. Neither
replaces the other.

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

The loop above is already the cheap one — webp/70 frames plus JSON measurement
passes. Two more levers when a run gets frame-heavy: `uid` on `take_screenshot`
to shoot one element instead of the page, and `filePath` on `take_screenshot` /
`evaluate_script` to write output to disk instead of into context.

One wrong-looking page costs Austen an hour and a round trip. A handful of webp
frames costs less than the message asking whether to take them.

## Forbidden

- Reporting a visual change as done, fixed, or green with no frame observed.
- Asking permission to open the browser to verify your own diff.
- Treating `npm run check` / passing tests as verification of appearance.
- Shipping any layout change without the 4K viewports (`4k-native-layout.md`).
- Handing the user a screenshot request ("reload and send me a shot") in place of
  taking one — that is the exact loop this rule exists to end.
- Using Claude in Chrome to verify your own diff, or driving Austen's
  signed-in window for it. DevTools MCP, own instance.
- Taking a screenshot without `format: "webp", quality: 70`.
- A viewport sweep done with `resize_window` (OS window) instead of
  `resize_page` (page dimensions) — the two are not the same size.
- Delegating the visual judgment to a subagent or workflow that also cannot see
  the page. Design fan-outs produce documents, not pixels; build it yourself and
  look at it (`fable-routing.md` → Workflow Cost Discipline).

## Related

- `verification-protocol.md` — the general "prove it" rule; this is its visual arm
- `4k-native-layout.md` — what "at home on 4K" means, and the 1680 seam
- `no-layout-shift.md`, `clickables-look-like-buttons.md`, `never-hand-roll.md`
- Memory: `feedback_visual_verification_mandatory`, `feedback_4k_is_home`
