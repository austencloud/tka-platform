# Level 1 Guide — Printable v1 Release (Design)

Date: 2026-06-20
Status: approved approach (Approach 1), pending spec review

## Goal

Ship the Level 1 guide as a **printable static v1** Austen can print and hand to
people, confidently referenced. Today it's a fully-built web-only HTML guide at
`/guide/level-1` (3 chapters, ~38 sections), dark glassmorphic, labeled v0.5,
with no print path and ~20 video-only motion demos that don't print.

## Approach (chosen: Approach 1 — add print, keep web as-is)

Web interactive guide is unchanged (keeps looping videos). We add a dedicated
single-document **print route** that produces one clean hand-out PDF, fix two
content errors, and bump the version. Rejected alternatives: replacing all web
videos with static pictographs (bigger change to a working page right before
release); print-only swap without re-baking (web keeps showing the 2 wrong
demos — fails "confidently referenced").

The "what should a motion demo look like on paper" question is answered by the
**original PDF** (verified by screenshot): each motion is a static grid
pictograph — dots for the 8 points, an arrow for direction, a hand for the end
position. That is canonical TKA pictograph notation, which the guide already
renders via `GuidePictograph` → `PictographRenderer`.

## Workstreams

### 1. `GuideMotion` — dual render (screen video / paper pictograph)

`GuideMotionVideo.svelte` becomes (or is wrapped by) `GuideMotion.svelte`. Given
a motion `id` it renders BOTH:
- the existing looping `<video>` (shown on screen), and
- a static `GuidePictograph` (shown on paper / in the print route) built from the
  motion's config.

Config → pictograph adapter (≈5 lines, reuses `makeMotion` from
`guide-motion-configs.ts`):
```
configToPictographData(config) => {
  id: `guide-pic-${config.id}`,
  gridMode: DIAMOND,
  motions: {
    blue: makeMotion(BLUE, bStart, bEnd, bMotion),
    red:  makeMotion(RED, red.start, red.end, red.motionType),
  },
}
```
`GuidePictograph` already supports `printMode`, `showArrows`, `eager`. The pictograph
is `propType={PropType.HAND}`, `showArrows` true (arrow = the motion), `eager` true.

Visibility: `.gm-video` shown by default, `.gm-print` hidden; under `@media print`
AND when an ancestor sets a force-print class (the print route, for on-screen
preview), swap them. Section components (`HandMotions`, `Type1AlphaBeta`, etc.)
keep using the same `id`s — only the import name changes.

### 2. `/guide/level-1/print` route — the single hand-out document

New route with its OWN minimal layout (NO sidebar). Stacks, in order:
- the landing intro ("Read Me First", title, byline), then
- all 3 chapters' sections in nav order (reusing the existing `_sections/*`
  components and the `setGuideData` context each chapter page already sets).

Print-grade CSS scoped to this route:
- white background, near-black text, no glass / `backdrop-filter` / shadows;
- single full-width column, generous prose measure;
- `@page { size: Letter; margin: 0.6in; }`;
- `break-inside: avoid` on `.guide-section`, figures, pictograph cells, combo
  cells; `break-after: avoid` on headings;
- scroll-reveal animations disabled;
- force-print view so motion demos show pictographs (not video) even in the
  on-screen preview of this route.

This route is the source for both browser "Print → Save as PDF" and the
regenerated downloadable PDF. Precedent: `/guide/codex/poster` does the same
single-tall-sheet print pattern.

### 3. Content correctness — two dual-shift fixes (MCP-grounded)

In `guide-motion-configs.ts`:
- **`t1-together-same`** (section "Together-Same / Beta to Beta"): currently red
  S→E, blue S→W → actually ends at **alpha**. Fix to genuine β→β per letter **G**
  (beta3→beta5, Together-Same, verified via MCP `get_pictograph_data`): both hands
  **E→S, PRO**. Update the label/caption ("both hands shift from east to south").
- **`t1-gamma-opposite`** (section "Gamma, opposite directions"): currently stays
  in one gamma half → same-direction. Fix to genuine opposite per letter **M**
  (gamma3→gamma13, Quarter-Opp, MCP-verified): blue **N→W**, red **E→S**, both PRO.

These fixes correct the print pictographs immediately (rendered live from config)
and the web videos after re-bake.

### 4. Re-bake the 2 changed videos

Run `/test/guide-motion-bake`, re-bake `t1-together-same` and `t1-gamma-opposite`,
commit the 2 changed `static/guide/level-1/motions/*.mp4`. (Driven via the dev
server; can be done through Chrome DevTools MCP.)

### 5. Version bump v0.5 → v1.0

In landing `+page.svelte`:
- byline `v 0.5` → `v 1.0`;
- PDF download label `(v0.5)` → `(v1.0)`;
- soften the "work-in-progress" framing in "Read Me First" to a confident v1 line
  (keep the "continually growing" spirit without "work-in-progress").

### 6. Regenerate the downloadable PDF

Regenerate `static/guides/level-1.pdf` from the `/print` route (Chrome headless
print-to-PDF). Keep the `/guides/level-1.pdf` download link; it now serves v1.

## Out of scope (v1)

- Replacing web videos with pictographs (Approach 2 — future maintenance win).
- Level 2 guide.
- Demoting the written guide to a codex (separate, later).

## Verification

- Print route renders all 38 sections on white, motion demos as pictographs with
  arrows, no sidebar, clean page breaks (screenshot via Chrome DevTools MCP).
- The 2 fixed demos show correct geometry (β→β and gamma-opposite) in both the
  print pictograph and the re-baked web video.
- `npm run check` clean; landing shows v1.0; regenerated PDF opens and matches.
