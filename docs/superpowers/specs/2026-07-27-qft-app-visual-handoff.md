# QfT App — bring it to 2026

**Date:** 2026-07-27
**For:** a fresh agent picking this up
**Route:** `/notation/qft` · **Design:** `2026-07-27-qft-archive-app-design.md`

## Status — picked up and done (2026-07-27, commit `13933245f6`)

All six dated items below were addressed. Read the rest for the reasoning; it
still describes why each change was made. What changed against this document:

1. **White card** — resolved by removing the diagrams from the main flow
   entirely rather than by recolouring them. They were briefly composed onto
   the dark page behind a toggle; Austen's call was that they are archival
   material and belong on their paper, whole. They now live in an archive view,
   as published, uncropped, credited to Drex. `scripts/publish-qft-frames.mjs`
   is the shipping path.
2. **Linear motion** — corrected in framing. A steady spin IS constant
   velocity; easing each increment would invent a stutter. Play, pause and
   scrub were the snaps, and those now have weight.
3–6. Trail recency, hierarchy, notation grouping, chrome — all done.

Two bugs fixed on the way: hydration kept the server's frame `src` (SSR renders
move 0, the client restores another), and the wide-and-short tier overflowed
its shell.

**Still open, in priority order:**

- The marketing-shell fight, unchanged and still Austen's call (below).
- Six of eight moves still have no quoted passage. Source work.
- Cropping is no longer used for anything that ships, which retires hard
  constraint 6 for the shipping path: `publish-qft-frames.mjs` takes every frame
  at full source size, panels and captions included, because an archive shows
  the artifact as posted. `extract-qft-frames.mjs` and its documented edge cases
  still feed the private archive — leave those alone.
- Instrument mode got the slider and the new table but not the composition
  pass; it still centres a title over an off-centre stage.

## Read this first

The app works. It is clear, navigable, correct, and tested. **Your job is not to
fix it — it is to make it look like it was made this decade.**

Austen's rating of the current state, and mine, agree: **it reads as 2016.**
The restored diagrams are genuinely 2011 and must stay that way; everything we
built around them is competent and generic. The question to answer with every
change is *"does this look like 2026 or does it look like output?"*

Do not restructure the information architecture. Do not rename things. Do not
rewrite the model. The content decisions are settled and were settled with the
person who owns them.

## What exists

| Thing | Path |
|---|---|
| The app (guide + instrument modes) | `src/routes/notation/qft/+page.svelte` |
| Guide pane — original beside computed | `src/lib/shared/notation/qft/components/QftGuidePane.svelte` |
| Restored animation, frame-driven | `.../components/QftFrames.svelte` |
| Computed stage (SVG) | `.../components/QftStage.svelte` |
| Notation table + compact strip | `.../components/QftTable.svelte` |
| Model — pure, no Svelte | `.../qft-model.ts` |
| Naming + degenerate cases | `.../qft-naming.ts` |
| Session persistence | `.../qft-session.ts` |
| The eight moves, sources, timeline | `.../qft-guide.ts` |
| Frame extractor | `scripts/extract-qft-frames.mjs` |
| Frames served from | `static/qft-frames/<stem>/<0-8>.webp` |
| Sourcing archive (private) | `docs/reference/archive/qft-notation/README.md` |

Tests: `tests/unit/qft-model.test.ts`, 26 passing. They encode the published
tables. **If one fails, you broke the model — not the test.**

## The dated list, most damaging first

### 1. The white card (worst offender)

Charlie's drawings are black line art on white, and they sit on the dark page
inside a hard white rectangle. It reads as a screenshot glued onto a website.

The frames are line art on flat white, which means they can be **keyed to
transparency and recoloured to the page palette** — the drawing composed *into*
the page instead of pasted onto it. Alpha from luminance, then tint. The
extractor already produces clean frames to work from.

**The tension you must resolve with Austen before doing it:** recolouring alters
how a historical artifact appears, on a page whose whole claim is faithful
restoration. The likely answer is a toggle — composed by default, *"show as
published"* available — but **ask, do not assume.** This is the one change that
touches the archival premise rather than the styling.

### 2. Motion is linear everywhere

Every animation is `cursor += delta / duration` with no easing. Constant
velocity is the single clearest tell of a hand-rolled 2012 animation. The prop
should feel like it has mass.

Note the constraint: **the frame index must stay locked to the step index.**
Charlie's animation has nine discrete frames and cannot be eased. So the
computed stage can ease while the original cannot, and if you ease one and not
the other they visibly diverge — which destroys the page's whole claim. Solve
this deliberately. Easing *within* a step while both hit each boundary together
is one answer.

### 3. The stage is flat

Uniform strokes, plain circles, a static trail path. Nothing has depth, weight,
or recency. The trail is the biggest opportunity: it is currently one static
path, when it could carry motion — the recent portion bright, the older portion
falling away. That is also *truer*, since a spinner sees a fading afterimage.

### 4. No hierarchy

Title, spec line, two figures, table, quote — all roughly the same visual
weight. Nothing tells the eye where to start. At 4K especially, the composition
is a row of equals in a large dark field.

### 5. The table looks like a spreadsheet

Seven columns of digits, uniform. It is the *notation* — the whole point of the
system — and it currently reads as data exhaust. The three groups (depart ·
radius · arrive) are not visually grouped, and the active row is a background
tint. Consider treating the current row as the subject and the rest as context.

### 6. The chrome is generic

Pill chips and a bottom toolbar. Nothing wrong, nothing memorable.

## Hard constraints — do not break these

1. **No narrator.** The only prose on the page is quoted from the source. Every
   label states a fact, never an interpretation. Do not add explanatory copy,
   taglines, or voice. This is a deliberate decision, not an oversight.
2. **Excerpt, not mirror.** The full extraction stays private. What ships is the
   restored images, short sourced quotes, and the computed model.
3. **The model is correct. Do not adjust it to make something look better.** It
   reproduces every published table including Charlie's `n` placements. If a
   visual looks wrong, the visual is wrong.
4. **Frame index = step index.** Nine frames, eight increments plus the close.
   Verified against the model, not assumed. Everything about the pairing rests
   on this.
5. **Crops are not squared.** Squaring drags the source table panels back into
   shot. Each card takes its frame's real proportions from the manifest.
6. **Do not re-tune the crop gutter heuristic.** It was tuned, it fails, and two
   files carry explicit edges with the reason documented. `triquetraanimated`'s
   table sits *below* its diagram, which no column rule can reach. Eleven files,
   fully inspected. Leave it.
7. **Crossfades go through `Crossfade.svelte`** (`.claude/rules/crossfade-primitive.md`).
   Hand-rolled crossfades in this repo have caused layout shift every time.
8. **Screenshot your own work** (`.claude/rules/visual-verification-mandatory.md`).
   1920 / 2560 / 3840 / 1440 / 820 / 960×412 / 375. A green typecheck is not
   visual proof. This is the rule the last visual regression here violated.

## Known unfinished — not yours unless you want it

- **The marketing shell fight.** The route sits inside `.mkt-shell` / `.mkt-stage`,
  which carry their own `min-height` and a footer. So `100dvh` does not mean the
  viewport: the app measures ~1499px in a 1080px window and the page keeps a
  scrollbar. An app-shaped route must either opt out of that layout or size
  against the shell. **This is a decision for Austen, not a fix to pick.** Every
  future fixed-viewport route hits the same wall.
- **Six of eight moves have no quoted passage.** Only two are verified in the
  archive README. Do not invent the rest. This is source work.
- **Only 1920 is verified.** The compact breakpoint and the fold-open landscape
  rule are written and unproven.

## Verified facts you can build on

- Every archive animation is exactly nine frames.
- At radius 0 the hand has no compass bearing; the column holds at 8, following
  the source's own pendulum table. QfT has no symbol for the centre.
- One-rotation antispin traces an ellipse of half-width `|radius − 1|` and
  half-height `radius + 1`. At radius 1 the width is exactly zero — a straight
  line — and the shape inverts through that boundary rather than rotating.
- The petal count derives from downbeats and spin only and never looks at
  radius, which is why `isDegenerateLine` exists.

## The question to keep asking

Not "is this clear?" — it already is. Ask **"does this look like a product, or
does it look like output?"** If the honest answer is output, keep going.

Austen's bar, in his words, is that arriving at 4K-native, 2026-native quality
is the job, not a follow-up round.
