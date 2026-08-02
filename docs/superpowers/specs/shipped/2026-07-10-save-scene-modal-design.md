# Save Scene Modal — "Packing List" Design

**Date:** 2026-07-10
**Status:** Approved (Austen: "Yes!")
**Extends:** `2026-07-10-save-a-3d-scene-collection-design.md`

## Problem

The Save scene button ships as a bare button in the Scene popover. Two failures:

1. **Wrong home.** The Scene popover picks environments; saving is a different
   verb. It reads as "save this environment," not "save everything."
2. **Opaque capture.** The user has no idea what gets saved — performers?
   props? effects? tempo? The capture is also genuinely incomplete: tempo/BPM,
   per-performer overrides (prop/effort/effect/staff length), and prop sizes
   are NOT captured today.

Goal: the whole shebang is reproducible, and the user can SEE what "the whole
shebang" means at save time — without an overwhelming parameter dump.

## Design

### Placement

- Remove the button from `SceneSelectorPopover`.
- New standalone rail button on `RightRail`, between **Export** and **Scene**:
  bookmark icon, `.rail-chip` styling cloned from `ViewerPopover.svelte`
  (56×56, blur, tooltip). Click opens a modal (BaseModal), not a popover.

### The modal — packing list

`BaseModal` (`src/lib/shared/foundation/ui/modal/BaseModal.svelte`), size ~md.

Layout:

- Header: live poster thumbnail (from `captureScene3DPoster`) + editable name
  input (default `"<word> — 3D scene"`).
- Body: **7 category rows**, each a toggle row (`role="switch"` button +
  indicator — no checkboxes). Each row shows a LIVE summary generated from
  current state, so the row itself teaches what it contains. All ON by default.
- Footer: selection status line ("Everything selected" / "5 of 7 groups") +
  primary **Save scene** button.

### The 7 groups → data mapping

| Group | Contents |
|---|---|
| `performance` | steps, bpm |
| `performers` | count, positions, facing, formation, names, selected index |
| `props` | default prop, per-performer prop overrides, global blue/red prop types, propSizeLinked, staff lengths (global + per-performer) |
| `efforts` | default effortId, per-performer effort overrides |
| `effects` | global effectToggles, per-performer effect overrides |
| `scene` | backgroundType, oceanVariant, sceneFeatures |
| `camera` | camera snapshot, navMode, activePreset, activeCameraPreset, visiblePlanes, showGridLabels |

No per-parameter granularity in v1 — group level only. A group row can grow an
expander later if demand appears.

### Snapshot v2

`Scene3DSnapshot` version bumps to 2 (schema accepts 1 or 2):

- `+ bpm?: number` (read from the playback seam; absent when unavailable)
- `+ groups: Record<GroupId, boolean>` — the saved-group mask
- `StoredPerformerSnapshot + settings?: { prop, effortId, effect,
  staffLengthCm }` (nullable fields = inherit)
- v1 entries stay valid: missing `groups` = all groups implied; missing
  performer `settings` = no overrides.

### Persistence v2 (viewer-3d-state)

`StoredPerformerSnapshot` (the `tka-viewer3d-performers` key) gains the same
optional `settings` block; `enter3D()` restores overrides via the performer
setters inside `withoutUndo`; the persistence `$effect` serializes them. This
also fixes per-performer overrides not surviving a reload — independent of
saving scenes.

### Apply-side group filtering

`applyScene3DLook` / `openScene3DInViewer` consult `snapshot.groups`: only
seed the keys belonging to saved groups. `performance` off (or no steps) =
look-only apply. BPM applies through the playback seam when present.

### BPM seam

BPM lives in `playback-controller.svelte.ts` (`bpmLocal`), threaded via
ArtPane props — not reachable from the 3D context. The rail/modal gets an
optional `getBpm?: () => number` (and apply path an `initialBpm` seed)
through the existing viewer prop seam, mirroring how `getPlaybackController`
was threaded for auto-export. Exact wiring resolved at implementation;
fallback = omit bpm rather than block the save.

## Not in scope

- Per-parameter toggles inside groups (v2 candidate)
- Quality tier (device-local, never saved)
- Walk styles / future performer locomotion (capture when the feature exists)
- Live 3D re-render in the detail preview (poster still)

## Testing

- zod: v1 snapshot still parses; v2 with groups/settings/bpm parses; bad group
  key rejected.
- capture: per-performer overrides land in snapshot; group mask respected by
  apply (unit test on the seed-config builder).
- Modal: manual verification (Austen) — rows show live summaries, toggling
  Performance off produces a look-only save.
