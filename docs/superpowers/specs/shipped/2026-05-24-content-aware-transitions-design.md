# Content-Aware Transition Strategy

## Problem

`crossfadeCellImages()` uses simultaneous opacity crossfade (350ms overlap) for ALL image swaps in ChoreoCard. This works for style changes (dark↔light — same arrows, different colors) but breaks for structural content changes (prop context Left→Right — different arrows, positions, glyphs). During the overlap window, both old and new pictograph content renders on top of each other, creating a visual mess.

## Root Cause

`classifyChange()` correctly distinguishes `"dark-mode-only"` from `"grid-stable-image"`, but both feed into the same `crossfadeCellImages()` with identical overlapping transition behavior.

## Design

Two transition modes based on change type:

| Change type | Mode | Behavior |
|---|---|---|
| `"dark-mode-only"` | `"crossfade"` | Overlapping: old fades out while new fades in simultaneously (current behavior). Works because structure is identical — only colors differ. |
| `"grid-stable-image"` | `"swap"` | Sequential: fade old to opacity 0 → swap image src → fade new from 0 to 1. No overlap period. Clean cut between structurally different content. |

## Implementation

### 1. `crossfader-state.svelte.ts`

Add `transitionMode` state that consumers can read:

```typescript
let transitionMode = $state<"crossfade" | "swap">("crossfade");

function beginCrossfade(newDarkMode: boolean, mode: "crossfade" | "swap" = "crossfade"): void {
  transitionMode = mode;
  activeDarkMode = newDarkMode;
  crossfadeActive = true;
}
```

Expose `transitionMode` on the returned object.

### 2. `CellRenderer.svelte`

Add sequential swap CSS classes alongside existing crossfade classes:

```css
/* Existing overlapping crossfade */
.cell-fade-old { opacity: 0; transition: opacity 350ms ease; }
.cell-fade-new { opacity: 1; transition: opacity 350ms ease; }

/* New sequential swap — old exits first, then new enters */
.cell-swap-out { opacity: 0; transition: opacity 150ms ease-out; }
.cell-swap-in { opacity: 0; animation: swap-in 200ms ease-in 150ms forwards; }

@keyframes swap-in {
  to { opacity: 1; }
}
```

Class selection driven by `transitionMode` from crossfader state.

### 3. `ChoreoCard.svelte` — $effect change type routing

In the main `$effect` that handles render key changes:

- `"dark-mode-only"` → `crossfadeCellImages()` with mode `"crossfade"`
- `"grid-stable-image"` → `crossfadeCellImages()` with mode `"swap"`

The `crossfadeCellImages` function already renders all new images before triggering the transition — only the CSS transition strategy differs.

### 4. Timing

- Sequential swap total: ~350ms (150ms out + 200ms in with 150ms delay)
- Same perceived duration as overlapping crossfade
- No overlap window where both old and new content is simultaneously visible

## What Doesn't Change

- `classifyChange()` logic
- `"full"` re-render path (spinners)
- `"layout-only"` path
- Worker pool rendering
- Image pre-rendering in `crossfadeCellImages()`

## Success Criteria

- Toggle prop context (Left↔Right): no overlap of old/new pictograph content during transition
- Toggle dark mode: smooth overlapping crossfade (no regression)
- Total transition time feels the same (~350ms)
