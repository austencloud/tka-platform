---
status: backlog
value: 2
effort: M
remaining: "Unscored until triage 2026-07-25; spec body carries no status line. Needs a read-through to establish real state before this score is trusted."
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Left Rail 2D/3D Split

## Summary

Move 2D/3D render mode selection from the floating `RenderModeToggle` button on the right rail into the left `ViewerContentRail` sidebar. The rail becomes four items: 2D Animation, 3D Animation, Card, Videos.

## Changes

### 1. Expand `ContentType` union

**File:** `src/lib/shared/sequence-viewer/services/viewer-state-persistence.ts`

- Add `'animation-3d'` to `ContentType`: `'animation' | 'animation-3d' | 'card' | 'videos'`
- Update `isValidContentType` to include `'animation-3d'`

### 2. Update `ViewerContentRail.svelte`

**File:** `src/lib/shared/sequence-viewer/components/ViewerContentRail.svelte`

Four-item modes array:

| id | icon | label |
|----|------|-------|
| `animation` | `fa-play` | 2D Animation |
| `animation-3d` | `fa-cube` | 3D Animation |
| `card` | `fa-grip` | Card |
| `videos` | `fa-video` | Videos |

- Accept new prop `webgl2Available: boolean` (default true)
- Conditionally include `animation-3d` entry only when `webgl2Available` is true

### 3. Update `onSelectMode` handler in DrawerHost

**File:** `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`

- `animation` → `exit3D()` if currently 3D, then `enterExport('animation-export')`
- `animation-3d` → `enter3D(sequence)`, then `enterExport('animation-export')`
- `card` / `videos` → unchanged

### 4. Active state sync in DrawerHost

When computing `activeMode` for the rail:
- If `viewerMode === 'animation'` (or `'split'`) and `renderMode === '3d'` → `'animation-3d'`
- Otherwise current logic

### 5. Remove `RenderModeToggle` from `RightRail.svelte`

**File:** `src/lib/shared/sequence-viewer/components/RightRail.svelte`

- Remove `RenderModeToggle` import and rendering
- Keep 3D-only chips (performers, tempo, export, gear) — they still appear when in 3D mode
- The right rail still exists for 3D controls; it just no longer contains the 2D/3D toggle

### 6. No new components

Everything routes through existing `enter3D()`/`exit3D()` flow. No new panels, layouts, or scenes.
