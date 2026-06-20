# Mandala Rosetta — Baked-Clip Grid (Design)

**Date:** 2026-06-18
**Route:** `src/routes/test/vtg-base-rotation/+page.svelte`
**Status:** Design — awaiting review

## Problem

The Mandala Rosetta renders ~42 live `AnimatorCanvas` engine instances at once
(2 spins × 7 turn values × 3 path shapes). The trail renderer caps the number of
simultaneous trails for performance, so as cells mount, the oldest cells silently
lose their trails. The live engines also strain to load in simultaneously.

## Goal

Replace the 42 live engines with 42 pre-baked, self-contained looping MP4 clips
that play simultaneously at a synced rate. Each clip bakes in the grid, the single
club, the lit just-traversed trail, the dotted hand-path line, **and** the static
glowing mandala. Strip the mode/settings controls bar; the page commits to one
frozen look and just displays everything.

## What a baked clip contains (composite order)

1. Opaque black base (existing export flatten step — keeps trail opacity honest;
   H.264 drops alpha).
2. Engine canvas: real grid + single club + lit FADE trail + dotted hand-path line.
   Captured by the existing offscreen export path.
3. **Static glowing mandala**, composited on top of every frame.

### Baking the mandala into the export

The export compositor (`export-frame-compositor.ts`) composites the engine canvas
plus the dotted path-line overlay, but NOT the `SequenceMandala` SVG (a DOM layer
outside the export container). To bake it in:

- Add one **optional** option to the export path:
  `frameOverlayDraw?: (ctx: CanvasRenderingContext2D, outputSizePx: number) => void`.
- The compositor calls it once per frame, after the black flatten + all canvas
  layers. The normal viewer export passes nothing, so it is unaffected.
- For the Rosetta bake, the callback draws the static mandala via the existing
  `renderMandalaToCanvas` (it already produces the soft glow). Because the mandala
  is static, it is rendered **once** to a memoized `OffscreenCanvas` at output
  resolution and `drawImage`-blitted each frame — cheap.
- **Alignment:** drawn at the same engine-alignment scale and tip the live overlay
  uses today — `alignScale · mandalaScale` with `tipDx = clubTipDx` (the
  override-aware `getTipPoints("club")` value), opacity `mandalaOpacity`. This
  guarantees the baked mandala registers exactly on the baked trail, since both
  resolve the tip to grid-radius `150 + clubTipDx` in 950-space.

## Frozen baked settings

The bake commits to the page's current tuned look (adjustable in code before the
bake, then frozen):

- Prop: single **club**, `show = "blue"`, the other hand stripped from the
  sequence (reuse the existing `prepare()` strip — see "Shared prep" below).
- Trail: `FADE`, `RIGHT_END`, `lineWidth 3`, `glowBlur 0`, `maxOpacity 1`,
  `minOpacity 0`, `fadeDurationMs 1500`, `tailLength 40`, `maxPoints 2000`.
- Mandala overlay: `opacity 0.55`, `scale 1.0`.
- `pathShape` per column (arc / linear / concave), turns per row (all 7 of
  `TURN_VALUES`).

### Shared prep

The single-prop preparation in `MandalaClubCell.prepare()` (strip the non-shown
hand from start position + every step, bake `propType: CLUB` + `pathShape` into
the shown hand) is extracted to a shared helper,
`prepareMandalaClubSequence(seq, { show, pathShape })`, in the vtg-lab services,
so the bake harness and any remaining consumer share one source of truth.

## Sync model

- Every clip is encoded at the **same speed** (same beat-rate) so paths advance
  in lockstep — this is the "simultaneity."
- Each clip = **one full LOOP period** (`loopCount 1`, `includeStartPosition`
  false, `includeEndHold` false — sequences are seamlessly loopable).
- Display uses `<video loop muted playsinline>`. All videos start together: hold
  playback until every video fires `canplay`, then `currentTime = 0` + `play()`
  on all at once.
- Different turn counts have different period lengths, so clips loop at different
  instants; the **rate** is identical, which is what reads as simultaneity.
- **Loop seam (accepted):** a FADE trail is not perfectly seamless — the fading
  tail is present at clip end and empty at restart, a minor pop. Chosen over a
  seamless PERSISTENT loop because the moving lit-segment highlight is the point.

## Generation (one-time bake)

- A dev-only `?bake` mode on this same route. When present, it shows a "Bake all"
  button instead of the grid.
- On click: loop over all 42 prepared sequences, calling
  `videoExportOrchestrator.executeExport(detachedCanvas, playbackController,
  panelState, onProgress, opts)` for each, with:
  `format "mp4"`, `codec "h264"`, fixed `fps` + `resolution`, `loopCount 1`,
  `bluePropType "club"`, `redPropType null`, `effectOverrides { trails: true }`,
  `includeStartPosition false`, `includeEndHold false`, and the
  `frameOverlayDraw` mandala callback bound to that cell's sequence/pathShape.
- One `playbackController` + `panelState` reused; per sequence
  `panelState.setSequenceData(prepared)` + `playbackController.initialize(...)`
  before each export. Each `executeExport` disposes its own offscreen engine.
- **Output:** via the **File System Access API** — prompt once for a directory
  (the user picks `static/mandala-rosetta/`), then write each blob there.
- **Filenames:** `{iso|anti}-{turnsSlug}-{shape}.mp4`, where `turnsSlug` replaces
  `.` with `_` (e.g. `iso-0_5-arc.mp4`, `anti-3-concave.mp4`).
- Progress UI: per-clip counter (`baking 17 / 42 …`) so a long bake is legible.
- The user runs the bake (their GPU/browser); the committed clips live in
  `static/mandala-rosetta/`.

## Display page (controls removed)

- Delete the entire controls bar (mode buttons, preview toggle, all sliders,
  mandala opacity/scale). No live trail state, no `MandalaClubCell` on the grid.
- Keep the current 4K-fit layout exactly: `.page` flex column `100dvh`, two
  boards side by side, `--cell: min(11vh, 12vw)`, explicit `auto + repeat(7,
  var(--cell))` matrix rows, compact header.
- Each cell renders `<video src="/mandala-rosetta/{spin}-{turnsSlug}-{shape}.mp4"
  loop muted playsinline>` sized to fill the cell (square clip, `object-fit:
  cover`). The clip path is built deterministically from spin + turns + shape; a
  cell with no corresponding sequence renders empty (same guard as today).
- Click a cell → zoom overlay with a larger `<video>` of the same clip (mirrors
  the current zoom behavior).
- A small sync controller starts all videos together on first load.

## Files

**Create:**
- `static/mandala-rosetta/*.mp4` — the 42 baked clips (committed after the bake).
- `src/lib/features/lab/vtg-lab/services/prepare-mandala-club-sequence.ts` —
  extracted shared single-prop prep.
- `src/lib/features/lab/vtg-lab/services/bake-mandala-clips.ts` — the batch bake
  harness (loop + executeExport + FS Access write).

**Modify:**
- `src/lib/features/compose/services/export-frame-compositor.ts` — add the
  optional `frameOverlayDraw` per-frame hook.
- `src/lib/shared/compose/domain/video-export-types.ts` and
  `video-export-orchestrator.ts` — thread the new optional option through.
- `src/routes/test/vtg-base-rotation/+page.svelte` — remove controls; swap grid
  cells from `MandalaClubCell` to `<video>`; add `?bake` mode wiring.

**Delete (after extraction):**
- `src/lib/features/lab/vtg-lab/components/MandalaClubCell.svelte` — its
  single-prop `prepare()` moves to the shared helper; the bake harness drives
  `executeExport`'s own offscreen engine directly and the display page uses
  `<video>`, so the live-engine cell component is no longer referenced. (Confirm
  no other importer via grep before deleting.)

## Out of scope

- Changing the mandala geometry, alignment math, or the trail look (all already
  tuned and verified this session).
- Any change to the normal viewer's "Download Animation" export behavior.
- A generic batch-export framework — this harness is Rosetta-specific.

## Risks / open notes

- **Loop seam** on FADE trail — accepted (above).
- **File count / size:** 42 small square clips at a modest resolution (target
  ~512²) and short period; expected to be a few MB total. Confirm total weight
  after the first bake; drop resolution if needed.
- **FS Access API** is Chrome-only — fine for the dev-only bake step. The shipped
  display page only needs `<video>`, universally supported.
