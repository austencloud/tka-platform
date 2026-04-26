# Trail Point Assignments

**Date:** 2026-03-11
**Status:** Approved
**Scope:** Trail endpoint configuration per prop type, UI in Tip Points tab, PropPositionCalculator override

## Problem

Trails currently calculate emission endpoints from prop geometry: `propDimensions.width / 2` offset from center along the rotation axis. This works for symmetrical props like staves, but produces wrong positions for asymmetrical or oddly-shaped props like Big Hoop (width 600 → offset 300px, way past the rim).

There's no way to correct trail positions per prop type. The unified tip points system (fire/LED/charcoal) already has accurate per-prop positions, but trails don't read from it.

## Solution

Each prop type gets an optional trail point assignment: up to 2 trail endpoints (left, right), each sourced from an existing tip point, a custom position, or disabled entirely.

### Data Model

```typescript
interface TrailPointConfig {
  left: TrailPointSource;
  right: TrailPointSource;
}

type TrailPointSource =
  | { type: "none" }
  | { type: "tip"; index: number }
  | { type: "custom"; dx: number; dy: number }
```

- `"none"` — no trail from this end
- `"tip"` — use tip point at `index` from the unified `getTipPoints()` registry
- `"custom"` — manual dx/dy offset from prop center (same coordinate space as tip points)

### Default Behavior

If no trail config exists for a prop type, fall back to the current geometric calculation. Existing trail behavior is unchanged until explicitly configured.

### UI: Trail Points Section

Located in the Tip Points tab of the Effects Lab, below the existing "Points" and "Actions" sections. Appears as a third card section called "Trail Points."

For the currently selected prop type:
- **Left trail** dropdown: `None | Tip 1 | Tip 2 | ... | Custom`
- **Right trail** dropdown: same options
- When "Custom" is selected, dx/dy inputs appear (same style as tip point coord inputs)
- The SVG canvas above already shows numbered tip points, so dropdown labels map directly

The section updates the canvas to show trail assignment indicators (e.g., small arrow or "L"/"R" labels on the assigned tip points).

### Persistence

Stored in the same persistence layer as tip point overrides:
- Firestore path: `config/effectPoints` (existing document, new `trailAssignments` field)
- localStorage cache: `tka-effect-points-cache` (existing key, new field)
- Strategy: localStorage instant + Firestore debounced 1s (unchanged)

The `TipPointOverrideProvider` gains methods for trail assignments:
- `getTrailAssignment(propType: string): TrailPointConfig | null`
- `saveTrailAssignment(propType: string, config: TrailPointConfig): void`

### PropPositionCalculator Changes

`calculateEndpoint()` and `calculateEndpoints()` gain an optional trail config parameter. When provided:
1. Look up `TrailPointConfig` for the prop type
2. If assignment exists and source is `"tip"`, resolve the tip point's `dx/dy` and convert to canvas coordinates
3. If `"custom"`, use the custom `dx/dy` directly
4. If `"none"`, return `null` for that endpoint (trail renderer skips it)
5. If no assignment, fall back to current geometric calculation

### Trail Renderer Integration

`TrailCapturer`, `TrailPathGenerator`, and `AnimationPathCache` already call `PropPositionCalculator`. The calculator's signature changes to accept trail config, but callers just pass it through. A new override provider callback (similar to `setTipPointOverrideProvider`) lets the feature layer inject trail assignments into the domain layer without circular dependencies.

## Files

| Action | File | Notes |
|--------|------|-------|
| New | `TrailPointTypes.ts` | `TrailPointConfig`, `TrailPointSource` types |
| New | `TrailPointAssignmentSection.svelte` | UI section in Tip Points tab |
| Update | `PropTipPoints.ts` | Add trail assignment override provider callback |
| Update | `TipPointOverrideProvider.ts` | Add trail assignment get/save methods |
| Update | `IEffectPointOverrideProvider.ts` | Add trail assignment to interface |
| Update | `PropPositionCalculator.ts` | Accept trail config, resolve tip/custom/none |
| Update | `IPropPositionCalculator.ts` | Updated signatures |
| Update | `EffectPointListPanel.svelte` | Add TrailPointAssignmentSection below Actions |
| Update | `EffectPointEditorState` | Expose trail assignment state for current prop |
| Update | `effects-lab-container.ts` | Wire trail assignment provider |
| Update | `EffectPointsPersister.ts` | Persist trail assignments alongside tip points |

## What Doesn't Change

- Tip point positions (fire/LED/charcoal) — untouched
- Trail rendering (splines, colors, opacity, width) — untouched
- Trail tuning UI (in Trails mode) — untouched
- TrackingMode enum — still used, but trail assignments take priority when present
- Props without trail assignments — unchanged geometric fallback
