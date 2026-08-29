# Visual Verification Is Mandatory — ENFORCED

## The Problem This Solves

On 2026-07-26 a Creators redesign shipped a segmented control ~1765px wide on a
1846px panel — three short labels stretched into a progress bar — plus stranded
partial rows and a title whose count sat in a pool of dead space. Every one of
those was visible in the FIRST screenshot of the page. No screenshot was taken.
`svelte-check` was green and 46/46 tests passed, and that was reported as
progress.

Austen (2026-07-26): _"If you had simply taken one screenshot you would have
immediately noticed the buttons being absolutely massively wide ... I have spent
the last three weeks telling every single agent OK great good job you did the
thing now make it work on 4K. I don't want to do that anymore."_

Two failures made it possible, and both are closed here:

1. **A permission excuse.** The old `CLAUDE.md` browser section said interactive
   DevTools commands need explicit verbal permission, so agents read "don't open
   the browser" and shipped blind. Verifying your own visual diff now has
   standing permission — it is part of the edit, not a favor to ask for.
2. **A wrong definition of done.** "Compiles + tests pass" was treated as done
   for a _visual_ change. Types and unit tests cannot see a 1765px button.

## The Rule

**If your diff changes what a surface looks like, you look at it before you
report on it.** Not the user. You.

That means: launch Chrome with the debugging port, load the route, resize to each
required viewport, screenshot, and READ the screenshot for defects. Then iterate
— fix, reload, screenshot again — until you would put your name on the frame.
The loop ends when the picture is right, not when the code compiles.

For a redesign of an existing surface, "right" includes comparison to the
pre-change baseline and the surrounding product. Before editing, capture or
inspect the existing surface and list the visual/interaction owners that must
survive. After editing, the verification report must say which were preserved,
extended, replaced, or deliberately removed. A frame that fits the viewport but
looks unrelated to the app is a failed frame.

"I can't verify this visually" is only true if the browser genuinely will not
start. It is never true because you didn't ask.

## When It Fires (and when it does not)

This is a proportionality rule, not a ritual. Booting Chrome to confirm a
one-word copy change is its own kind of failure — Austen (2026-07-26): _"it's
probably going to make the teensiest tiniest changes and insist that it has to
open up the Chrome browser to look at it which maybe I don't want."_

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

| Name                       | Size            | Why it is on the list                                     |
| -------------------------- | --------------- | --------------------------------------------------------- |
| 4K @ 200%                  | **1920 × 1080** | The most common real 4K setup. Windows' default.          |
| 4K @ 150%                  | **2560 × 1440** | The middle tier a single `min-width` seam always misses.  |
| 4K @ 100% / TV             | **3840 × 2160** | Nothing scales for you here. Type and elements must step. |
| Laptop                     | **1440 × 900**  | The base design must still be the base design.            |
| Tablet                     | **820 × 1180**  | Portrait, two-ish columns.                                |
| Z Fold 7 folded, landscape | **960 × 412**   | Wide AND short. Kills stacked layouts + tall chrome.      |
| iPhone SE                  | **375 × 667**   | The floor. If it fits here it fits anywhere.              |

Skipping a viewport is allowed only when the change provably cannot reach it
(e.g. a desktop-only pane), and you say which you skipped and why.

**Keep the visible browser at normal Windows display scaling.** Never launch it
with `--force-device-scale-factor`; that shrinks Chrome's tabs, URL bar, and all
page content to an unreadable size. Chrome DevTools MCP now exposes per-page
device-metric emulation. `emulate(viewport: "3840x2160x1")` produces a real 3840
CSS viewport and screenshot without changing the operating-system window. Clear
the viewport emulation after the verification pass.

## Which Browser Tool (settled 2026-07-26)

**Verifying your own diff uses Chrome DevTools MCP. Always.** Claude in Chrome
(`mcp__claude-in-chrome__*`) is not the tool for this job, and the difference is
in the tool schemas, not in taste:

|                   | Chrome DevTools MCP                                                                                    | Claude in Chrome                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Screenshot cost   | `format: "webp", quality: 70` — ~4x cheaper than PNG                                                   | `computer` screenshot takes **no format/quality params**. Full fidelity, every frame.                                      |
| Viewport          | `emulate(viewport: "<w>x<h>x1")` sets per-page device metrics, including a real 3840×2160 CSS viewport | `resize_window(w, h)` sizes the **OS window**; tab strip and URL bar eat the top, and it cannot exceed the physical screen |
| Cheap measurement | `evaluate_script` returns JSON — ten element widths for a rounding error, no image                     | built around visual coordinates                                                                                            |
| Session           | dedicated `Agent DevTools` profile from `scripts/launch-chrome-debug.ps1`; manual sign-in survives restarts | drives Austen's everyday Chrome                                                                                            |
| Scoping           | `uid` screenshots one element; `filePath` writes the image to disk instead of into context             | full-viewport frames only                                                                                                  |

Claude in Chrome is for _acting_ in Austen's live browser — external dashboards
(Cloudflare, Firebase, Stripe, PayPal) where his signed-in session is the whole
point, per global `CLAUDE.md` → Web Browsing. It stays there.

**The canonical loop:**

1. Start or reuse the dedicated browser with
   `pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank`.
   The launcher reuses one shared window, preserves its last manual placement,
   preserves the separate `Agent DevTools` taskbar identity, and must be the
   only way agents start Chrome. Do not pass `--force-device-scale-factor` or
   override `-ProfileDirectory`.
2. Open a task-owned page in the default browser context, in the background for
   screenshot-only checks. Keep its returned page ID and provide that `pageId`
   to every page-scoped tool instead of relying on `select_page`. Then call
   `emulate` with `<width>x<height>x1` for each viewport in the table.
3. `evaluate_script` returning measured numbers — control widths, column counts,
   computed font sizes. Catches the 1765px-button class of bug precisely, for
   near-zero tokens.
4. `take_screenshot` `format: "webp", quality: 70` to judge composition, which
   numbers cannot.
5. Fix, reload, repeat until the frame is right. Clear viewport emulation and
   close only the task-owned page when the pass is complete. Never close or
   resize the shared browser window.

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
8. **Can the text be read, not merely measured?** Query computed font sizes for
   every visible control and text role. Essential text is at least 14px;
   supplementary metadata is at least 12px. Then inspect the frame at its real
   viewing scale. A numeric minimum does not excuse weak weight, low contrast,
   excessive tracking, or too much copy in too little space.
9. **Did the component consume the theme or paint over it?** Query representative
   foreground/background pairs and verify contrast. Components consume the
   app's contrast-aware text tokens; locally redefining theme-looking variables
   to force an aesthetic is a failure.
10. **Are nested interaction scopes visible?** If a page has an outer carousel
    and an inner chapter/tab/slider control, each level needs a distinct visual
    language and a visible label. Keyboard correctness alone does not teach the
    user which arrows will move what.
11. **Did responsive design recompose or merely hide?** Check what information
    disappears at every breakpoint. Hiding the guide, context, or action that
    explains the page is not a mobile treatment.

## False Positives That Do Not Count As A Pass

- `scrollWidth === clientWidth` while the content is tiny, sparse, or confusing;
- every target is 44px while its visible affordance is a 1–2px hairline;
- no console errors while the page ignores the design system;
- a 12px token used for primary navigation or body copy;
- a screenshot taken but not compared with the old surface or sibling modules;
- a citation/source test that checks only for non-empty strings;
- a 4K frame that technically fills a shell while its meaningful content sits
  in a small island surrounded by dead space.

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
- Launching the visible browser with `--force-device-scale-factor`, or doing a
  viewport sweep by resizing the operating-system window instead of using
  per-page `emulate`.
- Delegating the visual judgment to a subagent or workflow that also cannot see
  the page. Design fan-outs produce documents, not pixels; build it yourself and
  look at it (`fable-routing.md` → Workflow Cost Discipline).

## Related

- `verification-protocol.md` — the general "prove it" rule; this is its visual arm
- `4k-native-layout.md` — what "at home on 4K" means, and the 1680 seam
- `no-layout-shift.md`, `clickables-look-like-buttons.md`, `never-hand-roll.md`
- Memory: `feedback_visual_verification_mandatory`, `feedback_4k_is_home`
