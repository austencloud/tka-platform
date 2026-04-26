# 3D Sequence Viewer Design

## Goal

Add a 3D viewing mode to the existing sequence viewer. Users can toggle from the 2D animation canvas to a Three.js scene where an avatar performs the same sequence with staves. The 3D view is a deeper layer of the same viewer, not a separate destination — every entry point (QR code, library browse, museum, compose) gets 3D mode for free.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Drop-in canvas replacement (Approach 1) | Orchestrator already manages all playback state. 3D is just a different renderer. |
| Entry point | Same universal viewer everywhere | Museum, QR, library, compose all route to the same viewer. Museum can get a simplified mini-viewer later using the same services. |
| Desktop trigger | Right-click context menu → "Enter 3D View" | Extends existing `CanvasContextMenuHost` pattern. |
| Mobile trigger | Corner icon (24px cube, fades after 3s) + long-press | Discoverability via icon, power-user shortcut via long-press. Both work. |
| Desktop layout | Inline swap — 3D replaces animation canvas (left pane) | Choreo card stays visible on the right. Beat sync highlights active beat. |
| Mobile layout | Full-screen takeover | No room for split. Floating controls for playback and effects. |
| Default camera | Slight angle (20-30 degrees off axis) | Immediately reads as 3D. User orbits from there. |
| Beat sync | Choreo card highlights active beat during 3D playback | Whole point of keeping choreo card visible on desktop. |
| Effects | Toggle UI + plugin interface in this spec, implementations deferred | Each Three.js effect (fire, LED, trails, charcoal) is its own spec. |
| Export | Interface hooks in this spec, recording implementation deferred | 3D canvas exposes renderer access and camera state stream for future GIF/video capture. |

## Current State

### Sequence Viewer Architecture

The viewer uses a headless orchestrator pattern:

```
/sequence/[id]/+page.svelte (route)
  → SequenceViewerOrchestrator.svelte (headless — owns all playback logic)
    → children snippet receives OrchestratorContext
      → ViewerSplitPane.svelte (CSS grid layout)
        → AnimatorCanvas.svelte (left pane — 2D animation)
        → ChoreoCard (right pane — static pictograph grid)
      → ViewerFooter.svelte (play/pause, BPM, stepping)
```

`SequenceViewerOrchestrator` manages: playback state (`isPlaying`, `currentStep`, `bpm`), export modes, fullscreen, tempo practice, LAN sync. It passes everything to children via `OrchestratorContext`.

`ViewerSplitPane` renders `AnimatorCanvas` on the left and `ChoreoCard` on the right. CSS grid with animated transitions. Desktop: 50/50 side-by-side. Mobile: 50/50 stacked vertically.

`AnimatorCanvas` accepts ~30 props including `sequenceData`, `currentStep`, `isPlaying`, prop types, effect configs, trail settings. Internally creates an `AnimationEngine` that owns 23+ canvas services.

### 3D Avatar Pipeline

Already production-ready in the museum:

```
createAvatarInstanceState(config, deps)
  → loadSequence(sequenceData)
  → play() / setProgress() / goToStep()
  → bluePropState / redPropState (reactive PropState3D getters)

Avatar3D.svelte
  → Receives PropState3D per hand
  → IK solving → arm positioning → leg animation
  → Supports GLTF models with procedural fallback

Staff3D.svelte
  → Positioned by PropState3D.worldPosition / worldRotation
```

`PropStateInterpolator.calculatePropState(config, progress)` converts `MotionConfig3D` + progress float (0-1) to `PropState3D` with world-space Vector3/Quaternion. Handles dash (cartesian interpolation), shift (circular/linear path), and static motions.

`MuseumPerformerStation3D.svelte` is the reference implementation: creates avatar state, loads sequence, renders Avatar3D + Staff3D. This exact pattern is reused.

### Context Menu Pattern

`CanvasContextMenuHost` uses a builder pattern (`buildCanvasContextMenuItems()`) that returns `ContextMenuEntry[]`. Menu items re-derive when visibility settings change via observer pattern. Adding a new item means adding an entry to the builder function.

## Design

### Component Architecture

```
SequenceViewerOrchestrator (unchanged — owns playback state)
  ├── ViewerSplitPane (modified — conditional canvas rendering)
  │     ├── LEFT:  AnimatorCanvas (2D)  ──OR──  Viewer3DCanvas (3D)
  │     └── RIGHT: ChoreoCard (unchanged — reacts to currentStep)
  │
  ├── Viewer3DFullscreen (new — mobile-only full-screen wrapper)
  │     ├── Viewer3DCanvas
  │     └── Floating controls (playback, effects, close)
  │
  ├── ViewerFooter (unchanged — playback controls work for both modes)
  └── renderMode toggle: '2d' | '3d' added to OrchestratorContext

**Note on naming:** The orchestrator already has `ViewMode = "animation" | "image" | "split"` which controls pane layout. The 3D toggle is a separate concept — which *renderer* is active — so it uses a distinct name: `renderMode: '2d' | '3d'`. These are orthogonal: `viewMode` controls layout, `renderMode` controls the left pane's renderer.
```

### Viewer3DCanvas — The Core Component

A Svelte component that renders a Threlte scene with an avatar performing a sequence. Drop-in replacement for `AnimatorCanvas` in the split pane.

**Props:**

```typescript
interface Viewer3DCanvasProps {
  // Matches AnimatorCanvas's key props (same data, different renderer)
  sequenceData: SequenceData | null;
  currentStep: number;
  isPlaying: boolean;
  bluePropType?: string | null;
  redPropType?: string | null;

  // 3D-specific
  onRendererReady?: (renderer: WebGLRenderer) => void;
  onCameraStateChange?: (state: CameraStateSnapshot) => void;
}
```

**Internal structure:**

```
Viewer3DCanvas.svelte
  ├── <Canvas> (Threlte)
  │     ├── Viewer3DScene.svelte
  │     │     ├── Avatar3D (reused from shared/3d)
  │     │     ├── Staff3D × 2 (blue + red)
  │     │     ├── Ground plane / stage
  │     │     └── Lighting rig
  │     ├── Viewer3DCamera.svelte (orbit controls, angle presets)
  │     └── Effect mount points (empty slots for future plugins)
  ├── Corner effect toggle pills (floating UI)
  └── Camera reset button (floating, bottom-right)
```

**Playback synchronization:**

The orchestrator drives `currentStep` as a number. The 2D animation engine interpolates smoothly within beats (fractional values like 1.35 mean "beat 1, 35% through"). The 3D canvas converts this to the avatar state's format:

```typescript
// Orchestrator's currentStep → AvatarInstanceState
// currentStep is a float: integer part = beat index, fractional = sub-beat progress
// Beat 0 = start position (static), beats 1+ = motion steps
const beatIndex = Math.floor(currentStep);
const subBeatProgress = currentStep - beatIndex;

// 3D step 0 = first motion step (2D beat 1)
const stepIndex3D = Math.max(0, beatIndex - 1);
const progress3D = beatIndex < 1 ? 0 : subBeatProgress;

// Apply to avatar state — puppet mode, not self-playing
avatarState.goToStep(stepIndex3D);
avatarState.setProgress(progress3D);
```

**Important: If `currentStep` only increments in integer jumps (no fractional values), the 3D avatar will snap between poses rather than interpolate smoothly.** The implementer must verify that the orchestrator's animation loop produces fractional `currentStep` values. If it doesn't, the 3D canvas needs its own interpolation: on each Threlte frame tick, lerp `progress` from 0 to 1 between integer step transitions based on BPM timing.

**Puppet mode — do NOT call `avatarState.play()`.** `AvatarInstanceState` has its own internal playback loop with `play()`, `pause()`, auto-step-advance, and `handleCycleComplete`. We deliberately bypass all of that. The orchestrator is the single source of truth for playback timing. The avatar is positioned externally each frame via `goToStep()` + `setProgress()`. Never call `avatarState.play()` — that would start a second competing clock.

**Why puppet mode?** The orchestrator already owns the playback loop (BPM, play/pause, stepping, tempo practice, LAN sync). Duplicating that in the avatar state means two clocks that can drift. The puppet model guarantees the choreo card beat highlight and the 3D avatar are always on the exact same frame.

### Viewer3DFullscreen — Mobile Wrapper

On mobile, entering 3D mode renders this component as a fixed overlay instead of swapping within the split pane.

```typescript
interface Viewer3DFullscreenProps {
  sequenceData: SequenceData | null;
  currentStep: number;
  isPlaying: boolean;
  bpm: number;
  word: string | null;
  bluePropType?: string | null;
  redPropType?: string | null;
  onClose: () => void;
  onPlaybackToggle: () => void;
  onBpmChange: (bpm: number) => void;
  onStepForward: () => void;
  onStepBackward: () => void;
}
```

**Layout:**

```
┌─────────────────────────┐
│ FLOW                  ✕ │  ← word label + close button
│                         │
│                         │
│      [3D Avatar]        │  ← Viewer3DCanvas fills viewport
│                         │
│                         │
│   ◄◄   ▶   ►►          │  ← playback controls (floating)
│  🔥 Fire  LED  Trails   │  ← effect toggle pills
└─────────────────────────┘
```

Top bar: gradient fade from black, sequence word on left, close (X) on right.
Bottom bar: gradient fade from black, playback controls centered, effect pills below.
Touch: one-finger orbit, pinch zoom, two-finger pan. Double-tap cycles plane-view presets (front/side/top).

### State Management

Following the Factory + Context pattern:

**`viewer-3d-state.svelte.ts`:**

```typescript
export function createViewer3DState(deps: {
  propInterpolator: IPropStateInterpolator;
  sequenceConverter: ISequenceConverter;
}) {
  let renderMode = $state<'2d' | '3d'>('2d');
  let avatarState = $state<AvatarInstanceState | null>(null);
  let effectToggles = $state<Record<string, boolean>>({
    fire: false,
    led: false,
    trails: false,
    charcoal: false,
  });

  // Camera state for export hooks
  let cameraSnapshot = $state<CameraStateSnapshot | null>(null);

  function enter3D(sequenceData: SequenceData) {
    if (!avatarState) {
      avatarState = createAvatarInstanceState(
        { id: 'viewer', positionX: 0 },
        { propInterpolator: deps.propInterpolator, sequenceConverter: deps.sequenceConverter }
      );
    }
    avatarState.loadSequence(sequenceData);
    renderMode = '3d';
  }

  function exit3D() {
    renderMode = '2d';
    // Don't destroy avatar state — keep it warm for re-entry
  }

  function toggleEffect(name: string) {
    effectToggles[name] = !effectToggles[name];
  }

  function dispose() {
    avatarState?.destroy();
    avatarState = null;
  }

  return {
    get renderMode() { return renderMode; },
    get avatarState() { return avatarState; },
    get effectToggles() { return effectToggles; },
    get cameraSnapshot() { return cameraSnapshot; },
    enter3D,
    exit3D,
    toggleEffect,
    updateCameraSnapshot(snapshot: CameraStateSnapshot) { cameraSnapshot = snapshot; },
    dispose,
  };
}
```

**`viewer-3d-context.ts`:**

```typescript
import { getContext, setContext } from 'svelte';
import type { createViewer3DState } from '../state/viewer-3d-state.svelte';

const KEY = Symbol('viewer-3d');
type Viewer3DState = ReturnType<typeof createViewer3DState>;

export function setViewer3DContext(state: Viewer3DState) {
  setContext(KEY, state);
}

export function getViewer3DContext(): Viewer3DState {
  return getContext<Viewer3DState>(KEY);
}
```

### Effect Plugin Interface

Effects are deferred, but the interface is defined now so the toggle UI works and future implementations plug in cleanly.

```typescript
// shared/3d/services/contracts/IViewer3DEffectPlugin.ts

export interface IViewer3DEffectPlugin {
  /** Unique name matching the toggle key (e.g., 'fire', 'led') */
  readonly name: string;

  /** Display label for the toggle pill */
  readonly label: string;

  /** Whether this effect is currently active */
  readonly active: boolean;

  /** Activate the effect in the 3D scene */
  activate(scene: Scene, avatarState: AvatarInstanceState): void;

  /** Deactivate and clean up GPU resources */
  deactivate(): void;

  /** Per-frame update (called from Threlte useTask) */
  update(delta: number): void;

  /** Full cleanup */
  dispose(): void;
}
```

When no plugin is registered for an effect name, the toggle pill renders as disabled with a "Coming soon" tooltip. This lets the UI exist before the implementations.

### Export Hooks

The 3D canvas exposes what a future export system needs:

```typescript
export interface Viewer3DExportHooks {
  /** Access to the Three.js WebGLRenderer for frame capture */
  getRenderer(): WebGLRenderer | null;

  /** Current camera state (position, rotation, FOV) */
  getCameraState(): CameraStateSnapshot;

  /** Subscribe to camera state changes (for recording orbit paths) */
  onCameraStateChange(callback: (state: CameraStateSnapshot) => void): () => void;

  /** Render a single frame at a specific step (for GIF frame capture) */
  renderAtStep(step: number): void;

  /** Get the scene for advanced capture (post-processing, etc.) */
  getScene(): Scene | null;
}

export interface CameraStateSnapshot {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  fov: number;
  target: { x: number; y: number; z: number };
  timestamp: number;
}
```

These hooks are exposed via the `onRendererReady` callback prop and stored in the viewer-3d-state for access by export UI.

### Trigger UI Changes

#### Desktop: Context Menu

The `CanvasContextMenuHost` uses a builder that receives a `CanvasContextMenuDeps` object. To add the 3D toggle:

1. **Extend `CanvasContextMenuDeps`** with an optional `viewer3DState` field and optional `sequenceData` field.
2. **Pass from `ViewerSplitPane`** — the split pane has access to the viewer-3d context and the sequence data. It passes these when constructing the `CanvasContextMenuHost` props.
3. **Add to `buildCanvasContextMenuItems()`** in `CanvasContextMenuBuilder.ts`:

```typescript
// Only show when viewer3DState is provided (i.e., in sequence viewer context)
if (deps.viewer3DState && deps.sequenceData) {
  items.push({ type: 'separator' });
  items.push({
    type: 'action',
    label: deps.viewer3DState.renderMode === '3d' ? 'Exit 3D View' : 'Enter 3D View',
    icon: '◇',
    action: () => {
      if (deps.viewer3DState!.renderMode === '3d') {
        deps.viewer3DState!.exit3D();
      } else {
        deps.viewer3DState!.enter3D(deps.sequenceData!);
      }
    },
    highlight: deps.viewer3DState.renderMode === '3d',
  });
}
```

This keeps the context menu unchanged in contexts where there's no viewer-3d state (e.g., compose tab's animation canvas).

#### Mobile: Corner Icon

A `Viewer3DCornerIcon.svelte` component (24x24px cube icon) rendered as a **sibling overlay in `ViewerSplitPane`**, positioned absolutely over the bottom-right of the animation canvas pane. It does NOT live inside `AnimatorCanvas` — this avoids modifying a shared component that's used outside the sequence viewer.

```
Behavior:
- Full opacity for 3 seconds after mount
- Fades to 40% opacity after 3 seconds via CSS transition
- Returns to full opacity on hover/touch
- Tappable: calls viewer3DState.enter3D(sequenceData)
- Only visible when renderMode === '2d'
- Only rendered when on mobile (< 768px) or always? → Always render. Desktop users can use it too.
```

#### Mobile: Long-Press

`AnimatorCanvas` already has a 500ms long-press handler that opens the context menu. We do NOT add a separate long-press for 3D entry. Instead, the context menu (which now includes "Enter 3D View") is the long-press target on mobile too. This avoids conflicting gesture handlers.

The corner icon provides the direct-tap entry. Long-press opens the context menu where "Enter 3D View" is available alongside other options. Two distinct paths, no conflicts.

### Camera Behavior

**Default position:** Orbit mode, 20-25 degrees azimuth off center, 10 degrees elevation above eye level. Distance: 2.5m from avatar center, looking at chest height (~1.2m Y).

**Controls:**
- Desktop: mouse drag = orbit, scroll = zoom, right-drag = pan
- Mobile: one-finger drag = orbit, pinch = zoom, two-finger drag = pan

**Plane presets:** Double-tap (mobile) or number keys 1/2/3 (desktop) snap to:
- 1: Front view (wall plane)
- 2: Side view (wheel plane)
- 3: Top view (floor plane)

These use the existing UCC camera tween infrastructure. The preset target positions are offset versions of the default angle, aligned to each plane's normal.

**Reset:** A small button in the corner returns to the default angle. Or press `R` on desktop.

### ViewerSplitPane Prop Mapping

`ViewerSplitPane` currently passes ~15 individual props to `AnimatorCanvas`, destructured from structured prop groups (`playback: ViewerPlaybackState`, `propRendering: PropRenderingProps`, etc.). The `Viewer3DCanvas` needs a much smaller subset:

```typescript
// ViewerSplitPane extracts these from its existing prop groups for the 3D canvas:
const viewer3DProps = {
  sequenceData: props.playback.sequenceData,       // from ViewerPlaybackState
  currentStep: props.playback.currentStep,          // from ViewerPlaybackState
  isPlaying: props.playback.isPlaying,              // from ViewerPlaybackState
  bluePropType: props.propRendering.bluePropType,   // from PropRenderingProps
  redPropType: props.propRendering.redPropType,     // from PropRenderingProps
};
```

`ViewerSplitPane` gains one new prop: `renderMode: '2d' | '3d'`. When `renderMode === '3d'`, it renders `Viewer3DCanvas` with the subset above instead of `AnimatorCanvas` with the full prop set. The `ChoreoCard` in the right pane is unchanged.

### Responsive Layout Integration

**Desktop (>= 768px) when `renderMode === '3d'`:**
- Left pane renders `Viewer3DCanvas` instead of `AnimatorCanvas`
- Right pane still renders `ChoreoCard` — unchanged
- Instant swap (no crossfade — Svelte `{#if}` block, not CSS transition)

**Mobile (< 768px) when `renderMode === '3d'`:**
- `Viewer3DFullscreen` renders as a `position: fixed` overlay on top of everything
- The split pane underneath is untouched (frozen, still mounted)
- Close button or back gesture dismisses the overlay, restoring the split pane
- `Viewer3DFullscreen` is rendered by the orchestrator's children snippet, NOT inside ViewerSplitPane

**Fullscreen mode (`isFullscreen`):**
- If already in fullscreen 2D and user enters 3D → inline swap within fullscreen
- If in 3D fullscreen and user exits 3D → inline swap back to 2D within fullscreen

### Choreo Card Beat Sync

The choreo card already receives `currentStep` from the orchestrator and highlights the active beat. This works identically whether the left pane is 2D or 3D because the orchestrator drives `currentStep` in both modes. No changes needed to the choreo card.

### DI Wiring

`createViewer3DState` requires `IPropStateInterpolator` and `ISequenceConverter`. Both are already registered in the DI container:

```typescript
// In SequenceViewerOrchestrator, where viewer-3d-state is created:
import { container } from '$lib/shared/di';

const viewer3DState = createViewer3DState({
  propInterpolator: container.items.propStateInterpolator,
  sequenceConverter: container.items.sequenceConverter,
});
setViewer3DContext(viewer3DState);
```

No new DI registrations needed. The viewer-3d-state is a component-level state factory (created in the orchestrator, distributed via context), not a DI-registered service.

**Lifecycle cleanup:** The orchestrator must call `viewer3DState.dispose()` on destroy (via `onDestroy` or Svelte 5's teardown equivalent) to release the avatar state and prevent GPU resource leaks on route navigation.

### WebGL2 Detection

On `Viewer3DCanvas` mount, check for WebGL2 support before initializing Threlte:

```typescript
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl2');
const webgl2Supported = !!gl;
gl?.getExtension('WEBGL_lose_context')?.loseContext(); // Cleanup test context
```

If unsupported:
- `Viewer3DCanvas` renders a centered message: "3D view requires a browser with WebGL2 support"
- `viewer3DState.enter3D()` checks a `webgl2Available` flag and no-ops if false
- The context menu item and corner icon are hidden when `!webgl2Available`

The check runs once when `createViewer3DState` is first called (orchestrator mount) and caches the result in `webgl2Available`. This way the context menu item and corner icon can read the flag immediately.

### Export Mode Interaction

When the user enters export mode (image or video capture) while in 3D:
- The orchestrator auto-exits 3D mode (`viewer3DState.exit3D()`) before entering export
- The export mode entry point (`enterEditMode()` in the orchestrator) checks `renderMode` and calls `exit3D()` first
- A future "3D export" feature will remove this restriction, using the export hooks defined above

### Museum Integration

The museum opens the same sequence viewer. When a user examines an exhibit with a sequence:

1. Museum reads the `sequenceId` from the exhibit data
2. Navigates to `/sequence/[encoded-id]` (or passes data via handoff)
3. The universal sequence viewer loads with all features: 2D animation, 3D mode toggle, effects, export

This is already how the museum could work — it just needs to navigate to the route instead of showing its own `SequenceView.svelte` panel. The detail panel's "View Full Sequence" button (or a new "Dive In" button) triggers the navigation.

For a future simplified museum viewer: the same `Viewer3DCanvas` component and `createViewer3DState` factory can be used in a custom museum component without the full `SequenceViewerOrchestrator`. The services are reusable; only the UI wrapper changes.

## File Inventory

### New Files

| File | Purpose |
|------|---------|
| `src/lib/shared/3d/components/Viewer3DCanvas.svelte` | Drop-in 3D canvas component (Threlte scene, avatar, staves) |
| `src/lib/shared/3d/components/Viewer3DScene.svelte` | Inner scene: avatar, staves, ground, lighting |
| `src/lib/shared/3d/components/Viewer3DCamera.svelte` | Orbit camera with plane presets and tween support |
| `src/lib/shared/3d/components/Viewer3DFullscreen.svelte` | Mobile full-screen overlay with floating controls |
| `src/lib/shared/3d/components/Viewer3DEffectPills.svelte` | Effect toggle pill row (fire, LED, trails, charcoal) |
| `src/lib/shared/3d/components/Viewer3DCornerIcon.svelte` | 24px cube icon overlay for mobile 3D entry |
| `src/lib/shared/3d/state/viewer-3d-state.svelte.ts` | State factory: view mode, avatar state, effect toggles, camera |
| `src/lib/shared/3d/context/viewer-3d-context.ts` | Context: setViewer3DContext / getViewer3DContext |
| `src/lib/shared/3d/services/contracts/IViewer3DEffectPlugin.ts` | Effect plugin interface |
| `src/lib/shared/3d/domain/types/CameraStateSnapshot.ts` | Camera state type for export hooks |
| `src/lib/shared/3d/domain/types/Viewer3DExportHooks.ts` | Export hook interface |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` | Add `renderMode` to state, create viewer-3d-state, pass via context, add to OrchestratorContext. Auto-exit 3D on export mode entry. |
| `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte` | Accept `renderMode` prop, conditionally render AnimatorCanvas or Viewer3DCanvas. Render Viewer3DCornerIcon as sibling overlay. Pass viewer3DState to CanvasContextMenuHost. |
| `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuBuilder.ts` | Extend `CanvasContextMenuDeps` with optional `viewer3DState` and `sequenceData`. Add "Enter/Exit 3D View" menu item when present. |
| `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuHost.svelte` | Accept optional `viewer3DState` and `sequenceData` props, pass through to builder deps. |
| `src/routes/sequence/[id]/+page.svelte` | Pass `render=3d` URL param support, restore 3D mode from URL. |

### Not Modified

| File | Why |
|------|-----|
| `AnimationEngine.svelte.ts` | 2D engine is untouched. 3D mode doesn't use it. |
| `AnimatorCanvas.svelte` | Not modified. Corner icon is a sibling in ViewerSplitPane. Long-press uses existing context menu. |
| `Avatar3D.svelte` | Reused as-is. No changes needed. |
| `Staff3D.svelte` | Reused as-is. |
| `PropStateInterpolator.ts` | Consumed, not modified. |
| `ChoreoCard` | Already reacts to currentStep. Beat sync is free. |
| `ViewerFooter` | Playback controls work identically for 2D and 3D. |
| `UnifiedCameraController.svelte` | Museum camera. Viewer3D uses its own orbit camera. |

## Edge Cases

1. **Sequence has no data loaded yet:** 3D toggle button / context menu item disabled until `sequenceData` is non-null.

2. **User toggles 3D mid-playback:** Avatar snaps to current beat position instantly. No transition animation needed — the frame-by-frame sync via `currentStep` handles continuity.

3. **User resizes window while in 3D:** Threlte canvas resizes automatically (it observes parent container). Mobile: no resize concern (fullscreen).

4. **User enters export mode while in 3D:** The orchestrator's `enterEditMode()` auto-calls `viewer3DState.exit3D()` before entering export mode. The user sees the 2D canvas swap back, then the export UI appears. Future: 3D export via the export hooks will remove this restriction.

5. **GLTF model fails to load:** Avatar3D falls back to procedural IKFigure3D. This already works — no special handling needed.

6. **Browser doesn't support WebGL2:** Detected on first `enter3D()` call (cached). If unsupported: `enter3D()` no-ops, context menu item and corner icon are hidden, `Viewer3DCanvas` shows a fallback message if somehow mounted.

7. **Performance on low-end mobile:** The 3D scene is one avatar + two staves + ground plane. Lightweight. If frame rate drops below 30fps, could add a quality toggle (lower shadow resolution, simpler lighting), but not in v1.

## Out of Scope

- Three.js effect implementations (fire, LED, trails, charcoal) — separate specs per effect
- GIF/video export recording pipeline — separate spec, hooks defined here
- Simplified museum mini-viewer — future work, reuses same services
- Avatar customization (body type, clothing) — separate feature
- Multiple simultaneous avatars — single performer only in v1
- Prop type switching in 3D (staves → fans → clubs) — separate feature, architecture supports it
- Audio sync — no audio system exists yet
- VR/AR mode — way out of scope
