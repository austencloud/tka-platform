# Handoff: the choreo card's printed word overflows its header

**For:** Codex (Sol)
**From:** Claude, 2026-07-30
**Scope:** `packages/render-composition/src/header-renderer.ts` (+ its consumers'
tests). Do NOT touch anything else — see Constraints.

## The bug

A long word runs off both ends of the card header and under the badges.

`W-Θ-OYEΩ-X-Ω-OZDΘ-` renders as `Θ-OYEΩ-X-Ω-OZDΘ`: the leading `W-` and the
trailing dash are cut, and the remaining glyphs run beneath the difficulty badge
on the left and the LOOP icon strip on the right.

This is on the **printed card**, not a CSS surface. It affects the choreo-card
thumbnails in the gallery and profile tiles, the print/export path, and
physical decks.

## Root cause (verified by reading the file, not inferred)

In `header-renderer.ts`, glyph scale is derived from **height alone**:

```ts
const scale = availableH / data.naturalHeight;   // ~line 81, and ~line 162
const glyphW = data.naturalWidth * scale;
totalWidth += glyphW;
```

`totalWidth` is then used **only to centre** the word:

```ts
let cursorX = canvasWidth / 2 - totalWidth / 2;  // ~line 93, and ~line 173
```

Nothing ever compares `totalWidth` to the space available, so a word wider than
the header overflows symmetrically — which is why both ends are cut rather than
one.

Two separate code paths do this and both need the fix:

1. the plain token path (~lines 77–121)
2. the compressed-segment path (~lines 153–215), used when `compressWord`
   returns a repeated run

Second, independent miss: the badges are laid out from `headerHeight`
(`badgeSize = headerHeight * BADGE_SIZE_SCALE`, `badgePadding = headerHeight *
BADGE_PADDING_SCALE`, ~lines 262–275) but the word's width math never subtracts
those zones, so even a word that fits the canvas can collide with them.

## What to implement

After `totalWidth` is known, fit it to the space that is actually free:

- available width = `canvasWidth` − (left badge zone when
  `showDifficultyBadge`) − (right icon zone when LOOP icons render) − a small
  breathing gap on each side.
- if `totalWidth > available`, multiply every per-glyph `scale` (and the dash
  bar width/gap, and the letter/group gaps) by `available / totalWidth`, then
  recompute `cursorX` from the shrunken total so it stays centred.
- the word must remain vertically centred in the header after shrinking; do not
  let the smaller scale drift the baseline.

Apply to BOTH paths. A word that already fits must render byte-identically to
today — the shrink is a clamp, not a rescale.

There is a DOM sibling of this bug already fixed in
`src/lib/shared/animation-engine/components/layers/WordHeader.svelte`
(commit `d15bba72a3`) — same shape, different medium. Worth reading for the
width model: a dash-letter is nearly twice as wide as a plain one because
`.dash-bar` adds ~0.70em plus a gap. The canvas constants `DASH_W_SVG` /
`DASH_GAP_SVG` are the equivalents here.

## Constraints — read before touching anything

1. **Cache invalidation is the hard part, and it is your call to raise, not to
   silently skip.** Card thumbnails are cached in the cloud and locally, keyed
   by content via `src/lib/shared/browse/services/thumbnail-key-deriver.ts`.
   That key does NOT include a renderer version, so every already-cached
   thumbnail will keep serving the OLD clipped image after your fix lands, and
   only new renders will be correct. Decide and state how to handle it (a
   version token folded into the key is the obvious route). Do not quietly ship
   the render change alone and call it done.
2. **Do not change render output for words that already fit.** Anything that
   shifts pixels for a fitting word invalidates cache entries for no reason.
3. **Do not touch `addWord` defaults or `GALLERY_DEFAULTS`.** Flipping a
   composition default drops renders off the shared cloud cache
   (`usesDefaults` in the deriver) — that is a separate, expensive failure mode.
4. **The working tree is shared with other agent sessions.** At the time of
   writing, another session has in-flight, uncommitted work in
   `src/lib/features/create/shared/workspace-panel/**` (including a new
   untracked `WorkspaceShareControl.svelte` that currently has 7 type errors)
   and in `src/lib/shared/share/services/sharer.ts` +
   `tests/unit/share-intake/native-share-adapter.test.ts` (2 failing tests).
   **Those failures are not yours and not mine — do not fix them, do not commit
   them, do not revert them.**
5. **Commit with an explicit pathspec** — `git commit -m "..." -- <files>`.
   A bare `git commit` sweeps the shared index and will steal another session's
   work. Work on `main`; do not create a branch or worktree.

## How to verify

The rendered card is a raster, so read pixels rather than trusting the DOM:

- render a card for the word `W-Θ-OYEΩ-X-Ω-OZDΘ-` and assert the drawn word's
  left edge is ≥ the left badge zone and its right edge ≤ the right icon zone.
- assert a short word (e.g. `ABC`) renders identical output before and after
  your change.
- cover both paths: a non-repeating long word and a repeating one that trips
  `compressWord` into the compressed-segment branch.

`npm run check` must be clean **for the files you touched** (expect the 7
pre-existing errors in `WorkspaceShareControl.svelte` — not yours).
`npm run test:ci` — expect the 2 pre-existing `native-share-adapter` failures.
