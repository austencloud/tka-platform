# Hand Path Cards: Purpose-Built Data Approach

**Date:** 2026-03-19
**Status:** Ready for implementation
**Supersedes:** `2026-03-19-hand-path-render-mode-design.md` (render-time transform approach — partially implemented but defeated by multi-layer caching)

## Problem

The L1 Quartered Rotated LOOP deck has 64 sequences mapping to 18 unique hand paths. We need to render hand path cards showing pure spatial trajectories: where each hand goes, stripped of letters, orientation, and prop type.

### Why the render-time transform approach failed

The first attempt added a `handPathMode` flag that transformed motion data (pro/anti → float) at render time in PictographPreparer. This was defeated by the caching architecture:

- **4+ cache layers:** PictographPreparer cache, LayerCompositor LRU cache, IndexedDB blob cache, cloud thumbnail cache
- **Flag penetration:** The `handPathMode` flag needs to reach `prepareSingle()` through: ChoreoCard → PropAwareThumbnail → ThumbnailRenderOrchestrator → ThumbnailRenderer → SequenceRenderer → ImageComposer → PictographPreparer. Missing it at ANY point returns cached staff-prop renders.
- **Result:** TKA visibility toggle worked (handled at composition layer), but the motion/prop transform never reached the actual renderer consistently.

### The right approach

Instead of transforming existing sequence data at render time, **construct purpose-built PictographData** for each hand path. The data already IS what we want to render — no transform needed, no cache conflicts.

## Design

### Data Model: HandPathPictograph

For each beat of a hand path, construct a minimal `PictographData` with:

```typescript
{
  // No letter — hand paths don't have letters
  letter: null,

  // Position derived from the hand path trace
  startPosition: "alpha1",  // or whatever the actual position is
  endPosition: "alpha3",

  motions: {
    blue: {
      motionType: "float",      // shifts become float (shows trajectory arrow)
                                // OR "dash" for dash motions
                                // OR "static" for static motions
      turns: "fl",              // float marker (for shifts), 0 for dash/static
      startLocation: "s",       // actual grid location
      endLocation: "w",         // actual grid location
      rotationDirection: "noRotation",
      startOrientation: "in",   // doesn't matter — HAND prop ignores orientation
      endOrientation: "in",
      propType: "hand",         // HAND prop — PropPlacer returns 0° rotation
      color: "blue",
      handPath: "cw",           // derived from start→end locations
      // ... other required fields with safe defaults
    },
    red: { /* same structure */ }
  }
}
```

### Key differences from sequence data

| Field | Sequence Data | Hand Path Data |
|---|---|---|
| letter | "A", "Φ", etc. | null |
| motionType | pro, anti, dash, static | float, dash, static |
| turns | 0 | "fl" (float) or 0 |
| propType | staff (overridden by settings) | hand (never overridden) |
| orientation | in, out, clock, counter | in (ignored — HAND = 0° rotation) |
| handPath | derived or null | explicitly set from locations |

### Arrow positioning without letters

The current arrow positioning system uses letter-based lookup tables. Hand paths don't have letters. Two options:

**Option A (recommended): Use position-pair identifiers.** The arrow system already knows how to position arrows based on motion type + start/end locations. The letter is primarily used for manual adjustment lookups. For hand paths, skip manual adjustments and use the default calculated positions. This should work without modification since the arrow lifecycle calculates positions from motion data, not letters.

**Option B: Map position transitions to pseudo-letters.** Use alpha1→alpha3, beta5→beta7, etc. as identifiers in place of letters. This would require extending the arrow placement lookup tables.

### Construction: Where hand path data gets built

**In the seeder script** (`scripts/seed-l1-deck.ts`): For each unique handPathId, store a pre-built array of hand-path PictographData objects alongside the sequence data in Firestore. This way the data is constructed once at seed time, not at render time.

```
decks/l1-quartered-loop/
  metadata: { handPaths: { [handPathId]: PictographData[] } }
  sequences/
    alpha1-AB/...
```

**OR in DeckFamilySection** at runtime: When grouping by handPathId, construct the PictographData from the representative sequence's motion data. Strip letters, convert pro/anti → float, set propType to HAND.

The runtime approach is simpler (no Firestore schema change) and the data construction is cheap (just object spread + overrides).

### Rendering

Hand path PictographData feeds directly into the existing `PropAwareThumbnail` pipeline. No `handPathMode` flag needed anywhere — the data IS the hand path. The renderer sees:
- propType: "hand" → renders HAND SVG, 0° rotation
- motionType: "float" → renders float arrow (trajectory direction)
- motionType: "dash" → renders dash arrow
- letter: null → no TKA overlay
- No special caching considerations — it's just a different pictograph

### What stays from the current implementation

The `handPathMode` flag on `PreviewCellRenderOptions` and the PictographPreparer transform can be **removed** — they're no longer needed. The purpose-built data approach eliminates the need for render-time transforms.

However, the `handPathMode` concept may still be useful for other contexts (e.g., toggling a viewer to show hand paths). Keep the interfaces but don't rely on them for the deck cards.

## Files involved

### Modify
- `DeckFamilySection.svelte` — construct HandPathPictograph data from representative sequences
- Possibly `DeckLoader.ts` — if storing hand path data in Firestore

### May need to verify
- Arrow positioning pipeline — confirm it works without letters
- `PropPlacer.ts` — already handles HAND prop (0° rotation) ✓
- `PictographPreparer.ts` — confirm it handles null letter gracefully

### Can remove (optional cleanup)
- `handPathMode` flag threading through ImageComposer, ThumbnailRenderer, etc.
- `transformForHandPath()` and `deriveHandPath()` in PictographPreparer

## Existing hand path data

The seeder already computes and stores `handPathId` on each sequence:
- `metadata.handPathId` — the full 8-beat location trace, color-canonical
- Example: `n→e→e→s→s→w→w→n→n|s→w→w→n→n→e→e→s→s`

The 64 sequences have 18 unique hand paths across 6 families:
- Dual-Shift+Dash: 4 hand paths, 12 sequences
- Dual-Shift+Dual-Dash: 3 hand paths, 10 sequences
- Dual-Shift+Static: 3 hand paths, 10 sequences
- Shift+Shift: 2 hand paths, 8 sequences
- Shift+Cross-Shift: 4 hand paths, 16 sequences
- Cross-Shift+Cross-Shift: 2 hand paths, 8 sequences

## Testing strategy

1. Construct one hand path PictographData manually
2. Feed it to PropAwareThumbnail directly
3. Verify: HAND props render, float arrows show trajectory, no letters, no orientation rotation
4. If arrow positioning fails without a letter, investigate the arrow lifecycle pipeline
