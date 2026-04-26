# 3D Sequence Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3D viewing mode to the sequence viewer where an avatar performs the sequence with staves, toggled via right-click context menu (desktop) or corner icon (mobile).

**Architecture:** `Viewer3DCanvas` is a drop-in replacement for `AnimatorCanvas` inside `ViewerSplitPane`. The existing `SequenceViewerOrchestrator` drives playback — the 3D avatar is a puppet positioned each frame via `goToStep()` + `setProgress()`, never self-playing. On mobile, 3D mode goes full-screen via `Viewer3DFullscreen` overlay.

**Tech Stack:** Svelte 5, TypeScript, Threlte (@threlte/core, @threlte/extras), Three.js, existing Avatar3D + Staff3D + PropStateInterpolator

**Spec:** `docs/superpowers/specs/2026-03-31-3d-sequence-viewer-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|----------------|
| `src/lib/shared/3d/domain/types/CameraStateSnapshot.ts` | Type: camera position/rotation/FOV for export hooks |
| `src/lib/shared/3d/domain/types/Viewer3DExportHooks.ts` | Interface: renderer access, camera stream, frame capture |
| `src/lib/shared/3d/services/contracts/IViewer3DEffectPlugin.ts` | Interface: effect activate/deactivate/update/dispose |
| `src/lib/shared/3d/state/viewer-3d-state.svelte.ts` | State factory: renderMode, avatarState, effectToggles, WebGL2 check |
| `src/lib/shared/3d/context/viewer-3d-context.ts` | Context: set/get viewer-3d state |
| `src/lib/shared/3d/components/Viewer3DCanvas.svelte` | Threlte canvas with avatar, staves, lighting, ground plane |
| `src/lib/shared/3d/components/Viewer3DScene.svelte` | Inner scene: Avatar3D + Staff3D + stage + lights |
| `src/lib/shared/3d/components/Viewer3DCamera.svelte` | Orbit controls, default angle, plane presets, keyboard shortcuts |
| `src/lib/shared/3d/components/Viewer3DEffectPills.svelte` | Floating effect toggle pill row (disabled "Coming soon" for now) |
| `src/lib/shared/3d/components/Viewer3DCornerIcon.svelte` | 24px cube icon, fades after 3s, tappable |
| `src/lib/shared/3d/components/Viewer3DFullscreen.svelte` | Mobile full-screen overlay with floating controls |

### Modified Files

| File | Lines of Interest | Change |
|------|-------------------|--------|
| `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuBuilder.ts` | L29 (deps type), L270 (builder fn) | Add optional viewer3DState + sequenceData to deps, add menu item |
| `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuHost.svelte` | L15 (Props) | Read viewer-3d context internally, accept optional sequenceData prop |
| `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte` | L565 (CanvasContextMenuHost) | Pass sequenceData prop to CanvasContextMenuHost |
| `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte` | L55 (Props), L138 (animation pane), L164 (AnimatorCanvas) | Add renderMode prop, conditional canvas render, corner icon overlay |
| `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` | L49 (OrchestratorContext), L879 (enterEditMode), L1618 (render) | Create viewer-3d-state, add renderMode to context, auto-exit on export, dispose on teardown |
| `src/routes/sequence/[id]/+page.svelte` | L68-88 (URL params), L478 (orchestrator) | Add `render=3d` URL param support |

---

## Task 1: Type Definitions and Interfaces

**Files:**
- Create: `src/lib/shared/3d/domain/types/CameraStateSnapshot.ts`
- Create: `src/lib/shared/3d/domain/types/Viewer3DExportHooks.ts`
- Create: `src/lib/shared/3d/services/contracts/IViewer3DEffectPlugin.ts`

- [ ] **Step 1: Create directories**

The following directories don't exist yet and must be created:
- `src/lib/shared/3d/domain/types/` (existing: domain/constants/, domain/enums/, domain/models/)
- `src/lib/shared/3d/context/` (new)

```bash
mkdir -p src/lib/shared/3d/domain/types src/lib/shared/3d/context
```

- [ ] **Step 2: Create CameraStateSnapshot type**

```typescript
// src/lib/shared/3d/domain/types/CameraStateSnapshot.ts
export interface CameraStateSnapshot {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  fov: number;
  target: { x: number; y: number; z: number };
  timestamp: number;
}
```

- [ ] **Step 3: Create Viewer3DExportHooks interface**

```typescript
// src/lib/shared/3d/domain/types/Viewer3DExportHooks.ts
import type { WebGLRenderer, Scene } from "three";
import type { CameraStateSnapshot } from "./CameraStateSnapshot";

export interface Viewer3DExportHooks {
  getRenderer(): WebGLRenderer | null;
  getCameraState(): CameraStateSnapshot;
  onCameraStateChange(callback: (state: CameraStateSnapshot) => void): () => void;
  renderAtStep(step: number): void;
  getScene(): Scene | null;
}
```

- [ ] **Step 4: Create IViewer3DEffectPlugin interface**

```typescript
// src/lib/shared/3d/services/contracts/IViewer3DEffectPlugin.ts
import type { Scene } from "three";
import type { AvatarInstanceState } from "../../state/avatar-instance-state.svelte";

export interface IViewer3DEffectPlugin {
  readonly name: string;
  readonly label: string;
  readonly active: boolean;
  activate(scene: Scene, avatarState: AvatarInstanceState): void;
  deactivate(): void;
  update(delta: number): void;
  dispose(): void;
}
```

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: No new errors from these type files.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/domain/types/CameraStateSnapshot.ts src/lib/shared/3d/domain/types/Viewer3DExportHooks.ts src/lib/shared/3d/services/contracts/IViewer3DEffectPlugin.ts
git commit -m "feat(3d): add type definitions for viewer export hooks and effect plugin interface"
```

---

## Task 2: State Factory and Context

**Files:**
- Create: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`
- Create: `src/lib/shared/3d/context/viewer-3d-context.ts`
- Reference: `src/lib/shared/3d/state/avatar-instance-state.svelte.ts:95` (createAvatarInstanceState)

- [ ] **Step 1: Create the viewer-3d-context**

```typescript
// src/lib/shared/3d/context/viewer-3d-context.ts
import { getContext, setContext } from "svelte";
import type { createViewer3DState } from "../state/viewer-3d-state.svelte";

const KEY = Symbol("viewer-3d");
type Viewer3DState = ReturnType<typeof createViewer3DState>;

export function setViewer3DContext(state: Viewer3DState) {
  setContext(KEY, state);
}

export function getViewer3DContext(): Viewer3DState {
  return getContext<Viewer3DState>(KEY);
}
```

- [ ] **Step 2: Create the viewer-3d-state factory**

Create `src/lib/shared/3d/state/viewer-3d-state.svelte.ts` with the full factory function from the spec. Key points:
- Import `createAvatarInstanceState` from `./avatar-instance-state.svelte`
- Import `IPropStateInterpolator` from `../services/contracts/IPropStateInterpolator`
- Import `ISequenceConverter` from `../services/contracts/ISequenceConverter`
- Import `CameraStateSnapshot` from `../domain/types/CameraStateSnapshot`
- `enter3D(sequenceData)` creates/reuses avatar state, sets renderMode
- `exit3D()` sets renderMode to '2d', keeps avatar warm
- `dispose()` destroys avatar state
- Returns object with getter accessors per state-management pattern

**WebGL2 detection — runs once on factory creation, cached:**

```typescript
// At the top of createViewer3DState, before any $state declarations:
function detectWebGL2(): boolean {
  if (typeof document === 'undefined') return false; // SSR guard
  const testCanvas = document.createElement('canvas');
  const gl = testCanvas.getContext('webgl2');
  const supported = !!gl;
  if (gl) {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return supported;
}

const _webgl2Available = detectWebGL2();
```

Then expose in the return object:

```typescript
return {
  get webgl2Available() { return _webgl2Available; },
  get renderMode() { return renderMode; },
  // ... rest of getters
};
```

And guard `enter3D`:

```typescript
function enter3D(sequenceData: SequenceData) {
  if (!_webgl2Available) return; // No-op if WebGL2 not supported
  // ... rest of enter3D
}
```

This ensures the context menu item (Task 3) and corner icon (Task 7) can read `webgl2Available` immediately on mount.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/state/viewer-3d-state.svelte.ts src/lib/shared/3d/context/viewer-3d-context.ts
git commit -m "feat(3d): add viewer-3d state factory and context for render mode management"
```

---

## Task 3: Context Menu Integration

**Files:**
- Modify: `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuBuilder.ts:29,270`
- Modify: `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuHost.svelte:15`

**Key insight:** `CanvasContextMenuHost` is rendered inside `AnimatorCanvas` (line 565 of AnimatorCanvas.svelte), NOT in `ViewerSplitPane`. We cannot prop-drill viewer3DState from ViewerSplitPane → AnimatorCanvas → CanvasContextMenuHost without modifying AnimatorCanvas. Instead, the builder reads the viewer-3d context via Svelte's `getContext` — if it's available (set by the orchestrator), the 3D menu item appears; if not (e.g., compose tab), it doesn't.

- [ ] **Step 1: Extend CanvasContextMenuDeps**

In `CanvasContextMenuBuilder.ts`, add optional fields to the `CanvasContextMenuDeps` interface (around line 29):

```typescript
import type { SequenceData } from "$lib/shared/types/SequenceData"; // adjust import path

// Add to existing interface:
viewer3DState?: {
  renderMode: '2d' | '3d';
  enter3D: (data: SequenceData) => void;
  exit3D: () => void;
  webgl2Available: boolean;
};
sequenceData?: SequenceData | null;
```

- [ ] **Step 2: Add menu item to builder function**

At the end of `buildCanvasContextMenuItems()` (around line 270+), before the return:

```typescript
if (deps.viewer3DState?.webgl2Available && deps.sequenceData) {
  items.push({ type: "separator" });
  items.push({
    type: "action",
    label: deps.viewer3DState.renderMode === "3d" ? "Exit 3D View" : "Enter 3D View",
    icon: "◇",
    action: () => {
      if (deps.viewer3DState!.renderMode === "3d") {
        deps.viewer3DState!.exit3D();
      } else {
        deps.viewer3DState!.enter3D(deps.sequenceData!);
      }
    },
  });
}
```

- [ ] **Step 3: Wire context into CanvasContextMenuHost**

In `CanvasContextMenuHost.svelte`, import and try to read the viewer-3d context:

```typescript
import { getViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";

// Try to get context — returns undefined if not set (e.g., compose tab)
let viewer3DState: ReturnType<typeof getViewer3DContext> | undefined;
try {
  viewer3DState = getViewer3DContext();
} catch {
  // Context not available — not in a sequence viewer. That's fine.
}
```

Then pass to the builder deps:

```typescript
// In the buildCanvasContextMenuItems() call, add:
viewer3DState,
sequenceData: viewer3DState ? /* get from context or a prop */ : undefined,
```

**For `sequenceData`:** The host needs access to the current sequence. Two options:
1. Add an optional `sequenceData` prop to `CanvasContextMenuHost.svelte` Props (line 15). `AnimatorCanvas` already receives `sequenceData` as a prop and can pass it through.
2. Store sequenceData in the viewer-3d context alongside renderMode.

**Recommended: Option 1.** Add `sequenceData?: SequenceData | null` to `CanvasContextMenuHost` Props. In `AnimatorCanvas.svelte`, pass `sequenceData` to `CanvasContextMenuHost`. This is a minimal change to AnimatorCanvas (one prop pass-through, not a viewer3D-specific prop).

- [ ] **Step 4: Pass sequenceData in AnimatorCanvas**

In `AnimatorCanvas.svelte` (around line 565 where CanvasContextMenuHost is rendered), add:

```svelte
<CanvasContextMenuHost
  ...existing props...
  sequenceData={sequenceData}
/>
```

`sequenceData` is already a prop of `AnimatorCanvas` (it's in its Props interface). This is just threading it one level deeper.

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: No new errors. Existing usages of CanvasContextMenuHost that don't pass sequenceData get `undefined` which is fine (the 3D menu item won't appear).

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuBuilder.ts src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuHost.svelte src/lib/shared/animation-engine/components/AnimatorCanvas.svelte
git commit -m "feat(3d): add 'Enter 3D View' option to canvas context menu via context"
```

---

## Task 4: Viewer3DScene (Inner 3D Scene)

**Files:**
- Create: `src/lib/shared/3d/components/Viewer3DScene.svelte`
- Reference: `src/lib/shared/3d/components/Avatar3D.svelte` (props interface)
- Reference: `src/lib/shared/3d/components/Staff3D.svelte`
- Reference: `src/lib/features/museum-2d/components/game/MuseumPerformerStation3D.svelte:64-129` (reference pattern)

- [ ] **Step 1: Create Viewer3DScene**

This component renders inside a Threlte `<Canvas>`. It contains:
- `Avatar3D` receiving `bluePropState` and `redPropState`
- Two `Staff3D` instances (blue + red)
- A ground plane (simple disc or circle mesh)
- Directional light + ambient light
- A `useTask` loop that converts `currentStep` to avatar positioning

Props:
```typescript
interface Props {
  sequenceData: SequenceData | null;
  currentStep: number;
  isPlaying: boolean;
  avatarState: AvatarInstanceState;
}
```

Follow the pattern from `MuseumPerformerStation3D.svelte` lines 64-129:
- `avatarState.bluePropState` and `avatarState.redPropState` are reactive getters
- Avatar3D receives `position={{ x: 0, y: 0, z: 0 }}`, `facingAngle={0}`, `isActive={false}`, `isMoving={false}`
- Staff3D receives `propState={avatarState.bluePropState}`, `color="blue"`, `avatarPosition={{ x: 0, y: 0, z: 0 }}`, `facingAngle={0}`

**The `useTask` sync loop** — runs every Threlte frame:
```typescript
useTask(() => {
  const beatIndex = Math.floor(currentStep);
  const subBeatProgress = currentStep - beatIndex;
  const stepIndex3D = Math.max(0, beatIndex - 1);
  const progress3D = beatIndex < 1 ? 0 : subBeatProgress;

  avatarState.goToStep(stepIndex3D);
  avatarState.setProgress(progress3D);
});
```

**Lighting:**
```svelte
<T.AmbientLight intensity={0.4} />
<T.DirectionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
```

**Ground plane:**
```svelte
<T.Mesh rotation.x={-Math.PI / 2} receiveShadow>
  <T.CircleGeometry args={[2, 64]} />
  <T.MeshStandardMaterial color="#1a1a2e" />
</T.Mesh>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DScene.svelte
git commit -m "feat(3d): add Viewer3DScene — avatar, staves, lighting, ground plane"
```

---

## Task 5: Viewer3DCamera (Orbit Controls)

**Files:**
- Create: `src/lib/shared/3d/components/Viewer3DCamera.svelte`
- Reference: existing `OrbitControls` usage in `src/lib/shared/3d/components/` files

- [ ] **Step 1: Create Viewer3DCamera**

This component lives inside the Threlte `<Canvas>`. It provides:
- A `PerspectiveCamera` set as the default camera
- `OrbitControls` from `@threlte/extras`
- Default position: 2.5m distance, 20-25 degrees azimuth, 10 degrees elevation, looking at (0, 1.2, 0)
- Camera state change callback

Props:
```typescript
interface Props {
  onCameraStateChange?: (state: CameraStateSnapshot) => void;
}
```

```svelte
<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { OrbitControls } from "@threlte/extras";
  import type { CameraStateSnapshot } from "../domain/types/CameraStateSnapshot";

  let { onCameraStateChange }: Props = $props();

  // Default: slight angle (20 deg azimuth, 10 deg elevation, 2.5m distance)
  // Looking at chest height (0, 1.2, 0)
  const defaultPosition = { x: 0.85, y: 1.6, z: 2.3 };
  const defaultTarget = { x: 0, y: 1.2, z: 0 };
</script>

<T.PerspectiveCamera
  makeDefault
  position={[defaultPosition.x, defaultPosition.y, defaultPosition.z]}
  fov={50}
>
  <OrbitControls
    target={[defaultTarget.x, defaultTarget.y, defaultTarget.z]}
    enableDamping
    dampingFactor={0.1}
    minDistance={1}
    maxDistance={8}
  />
</T.PerspectiveCamera>
```

Keyboard shortcuts (1/2/3 for plane presets, R for reset) will be added in a follow-up — they need the camera ref which requires wiring through OrbitControls. For v1, orbit controls with the default angle are sufficient.

- [ ] **Step 2: Run typecheck**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DCamera.svelte
git commit -m "feat(3d): add Viewer3DCamera with orbit controls and default angle"
```

---

## Task 6: Viewer3DCanvas (Main Component)

**Files:**
- Create: `src/lib/shared/3d/components/Viewer3DCanvas.svelte`
- Reference: `src/lib/shared/3d/components/Scene3D.svelte` (Canvas usage pattern)

- [ ] **Step 1: Create Viewer3DCanvas**

This is the drop-in replacement for AnimatorCanvas. It wraps a Threlte `<Canvas>` with Viewer3DScene and Viewer3DCamera inside.

```svelte
<script lang="ts">
  import { Canvas } from "@threlte/core";
  import Viewer3DScene from "./Viewer3DScene.svelte";
  import Viewer3DCamera from "./Viewer3DCamera.svelte";
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import type { SequenceData } from "$lib/shared/types/SequenceData"; // adjust import
  import type { CameraStateSnapshot } from "../domain/types/CameraStateSnapshot";

  interface Props {
    sequenceData: SequenceData | null;
    currentStep: number;
    isPlaying: boolean;
    bluePropType?: string | null;
    redPropType?: string | null;
    onRendererReady?: (renderer: any) => void;
    onCameraStateChange?: (state: CameraStateSnapshot) => void;
  }

  let { sequenceData, currentStep, isPlaying, onCameraStateChange }: Props = $props();

  const viewer3DState = getViewer3DContext();
  const avatarState = $derived(viewer3DState.avatarState);
</script>

<div class="viewer-3d-canvas">
  {#if avatarState && sequenceData}
    <Canvas>
      <Viewer3DCamera {onCameraStateChange} />
      <Viewer3DScene {sequenceData} {currentStep} {isPlaying} {avatarState} />
    </Canvas>
  {:else}
    <div class="viewer-3d-loading">Loading 3D viewer...</div>
  {/if}
</div>

<style>
  .viewer-3d-canvas {
    width: 100%;
    height: 100%;
    position: relative;
    background: #1a1a2e;
  }
  .viewer-3d-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(255, 255, 255, 0.4);
    font-size: var(--font-size-min, 14px);
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DCanvas.svelte
git commit -m "feat(3d): add Viewer3DCanvas — Threlte wrapper for sequence viewer"
```

---

## Task 7: Viewer3DCornerIcon

**Files:**
- Create: `src/lib/shared/3d/components/Viewer3DCornerIcon.svelte`

- [ ] **Step 1: Create the corner icon component**

A small cube icon that fades after 3 seconds. Tapping enters 3D mode.

```svelte
<script lang="ts">
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import type { SequenceData } from "$lib/shared/types/SequenceData"; // adjust import

  interface Props {
    sequenceData: SequenceData | null;
  }

  let { sequenceData }: Props = $props();
  const viewer3DState = getViewer3DContext();

  let faded = $state(false);

  $effect(() => {
    const timer = setTimeout(() => { faded = true; }, 3000);
    return () => clearTimeout(timer);
  });

  function handleClick() {
    if (sequenceData && viewer3DState.webgl2Available) {
      viewer3DState.enter3D(sequenceData);
    }
  }
</script>

{#if viewer3DState.renderMode === '2d' && viewer3DState.webgl2Available}
  <button
    class="corner-icon"
    class:faded
    onclick={handleClick}
    aria-label="Enter 3D view"
  >
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  </button>
{/if}

<style>
  .corner-icon {
    position: absolute;
    bottom: 12px;
    right: 12px;
    z-index: 5;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: opacity 0.6s ease, background 0.2s ease;
    opacity: 1;
  }
  .corner-icon.faded {
    opacity: 0.4;
  }
  .corner-icon:hover, .corner-icon:active {
    opacity: 1;
    background: rgba(255, 255, 255, 0.15);
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DCornerIcon.svelte
git commit -m "feat(3d): add corner icon for 3D mode entry"
```

---

## Task 8: Viewer3DEffectPills

**Files:**
- Create: `src/lib/shared/3d/components/Viewer3DEffectPills.svelte`

- [ ] **Step 1: Create effect toggle pills**

All pills are disabled with "Coming soon" tooltip since no 3D effects are implemented yet. The toggle UI is ready for when effect plugins are registered.

```svelte
<script lang="ts">
  import { getViewer3DContext } from "../context/viewer-3d-context";

  const viewer3DState = getViewer3DContext();

  const effects = [
    { name: "fire", label: "Fire", icon: "🔥" },
    { name: "led", label: "LED", icon: "💡" },
    { name: "trails", label: "Trails", icon: "〰" },
    { name: "charcoal", label: "Sparks", icon: "✦" },
  ];
</script>

<div class="effect-pills">
  {#each effects as effect}
    <button
      class="effect-pill"
      class:active={viewer3DState.effectToggles[effect.name]}
      disabled
      title="Coming soon"
      aria-label="{effect.label} effect (coming soon)"
    >
      <span class="effect-icon">{effect.icon}</span>
      <span class="effect-label">{effect.label}</span>
    </button>
  {/each}
</div>

<style>
  .effect-pills {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
  .effect-pill {
    padding: 6px 12px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.3);
    font-size: var(--font-size-compact, 12px);
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: not-allowed;
    opacity: 0.5;
  }
  .effect-pill.active {
    background: rgba(139, 139, 255, 0.15);
    border-color: rgba(139, 139, 255, 0.3);
    color: rgba(139, 139, 255, 0.8);
    opacity: 1;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DEffectPills.svelte
git commit -m "feat(3d): add effect toggle pills (disabled, ready for future plugins)"
```

---

## Task 9: Viewer3DFullscreen (Mobile Overlay)

**Files:**
- Create: `src/lib/shared/3d/components/Viewer3DFullscreen.svelte`

- [ ] **Step 1: Create the full-screen mobile wrapper**

A fixed-position overlay that wraps `Viewer3DCanvas` with floating playback controls and effect pills.

Props (updated from spec to match actual orchestrator API):

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
  onStepForward: () => void;   // maps to ctx.stepFullBeatForward
  onStepBackward: () => void;  // maps to ctx.stepFullBeatBackward
}
```

The component structure:

```svelte
<div class="viewer-3d-fullscreen">
  <!-- Top bar -->
  <div class="top-bar">
    <span class="word-label">{word}</span>
    <button class="close-button" onclick={onClose} aria-label="Exit 3D view">✕</button>
  </div>

  <!-- 3D canvas fills remaining space -->
  <div class="canvas-area">
    <Viewer3DCanvas {sequenceData} {currentStep} {isPlaying} />
  </div>

  <!-- Bottom bar -->
  <div class="bottom-bar">
    <div class="playback-controls">
      <button onclick={onStepBackward} aria-label="Previous beat">⏮</button>
      <button onclick={onPlaybackToggle} aria-label={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button onclick={onStepForward} aria-label="Next beat">⏭</button>
    </div>
    <Viewer3DEffectPills />
  </div>
</div>
```

Styles:
- `.viewer-3d-fullscreen`: `position: fixed; inset: 0; z-index: 100; background: #0a0a14; display: flex; flex-direction: column;`
- `.top-bar` / `.bottom-bar`: `position: absolute; left: 0; right: 0; padding: 16px; z-index: 1;` with `background: linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)` (top) and reverse (bottom)
- `.canvas-area`: `flex: 1; position: relative;`
- Playback buttons: 44px touch targets (WCAG AAA), circular, semi-transparent background
- Close button: 36px, top-right corner

- [ ] **Step 2: Run typecheck**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DFullscreen.svelte
git commit -m "feat(3d): add full-screen mobile 3D viewer overlay"
```

---

## Task 10: Wire ViewerSplitPane

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte:55,138,164`

- [ ] **Step 1: Add renderMode prop**

In the Props interface (line 55), add:
```typescript
renderMode?: '2d' | '3d';
```

Default to `'2d'` in destructuring.

- [ ] **Step 2: Conditional canvas rendering**

Around line 164 where `AnimatorCanvas` is rendered, wrap in an `{#if}`:

```svelte
{#if renderMode === '3d'}
  <Viewer3DCanvas
    sequenceData={playback.animationState.sequenceData}
    currentStep={playback.currentStep}
    isPlaying={playback.isPlaying}
    bluePropType={propRendering.bluePropType}
    redPropType={propRendering.redPropType}
  />
{:else}
  <AnimatorCanvas ... />  <!-- existing, unchanged -->
{/if}
```

**Note:** `playback` is of type `ViewerPlaybackState`. The `sequenceData` lives at `playback.animationState.sequenceData`, NOT directly on `playback`. Check the actual type definition to confirm the exact path — the orchestrator's `splitPanePlayback` object may use a different structure. Read the `ViewerPlaybackState` interface before implementing.

Import `Viewer3DCanvas` from `$lib/shared/3d/components/Viewer3DCanvas.svelte`.

- [ ] **Step 3: Add corner icon overlay**

Inside the animation pane div (around line 138), after the canvas, add:

```svelte
<Viewer3DCornerIcon sequenceData={playback.sequenceData} />
```

The corner icon positions itself absolutely within the pane. Import from `$lib/shared/3d/components/Viewer3DCornerIcon.svelte`.

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: No errors. AnimatorCanvas path unchanged, Viewer3DCanvas gets the subset.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte
git commit -m "feat(3d): wire ViewerSplitPane to conditionally render 3D canvas"
```

---

## Task 11: Wire SequenceViewerOrchestrator

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte:49,879,1618`

- [ ] **Step 1: Create and distribute viewer-3d-state**

Near the top of the component (after DI imports), add:

```typescript
import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
import { setViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
import { container } from "$lib/shared/di";

const viewer3DState = createViewer3DState({
  propInterpolator: container.items.propStateInterpolator,
  sequenceConverter: container.items.sequenceConverter,
});
setViewer3DContext(viewer3DState);
```

Add cleanup:
```typescript
$effect(() => {
  return () => viewer3DState.dispose();
});
```

- [ ] **Step 2: Add renderMode to OrchestratorContext**

In the `OrchestratorContext` interface (line 49), add:

```typescript
renderMode: '2d' | '3d';
viewer3DState: ReturnType<typeof createViewer3DState>;
```

In the `context` object passed to the children snippet (find where it's constructed before line 1618), add:

```typescript
renderMode: viewer3DState.renderMode,
viewer3DState,
```

- [ ] **Step 3: Auto-exit 3D on export mode**

In `enterEditMode` (line 879), add at the top:

```typescript
if (viewer3DState.renderMode === '3d') {
  viewer3DState.exit3D();
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: Errors where OrchestratorContext consumers need to handle new fields. These should be optional or have defaults.

**Important:** Check if `OrchestratorContext` is consumed by other components that destructure it. If so, the new fields should be optional (`renderMode?: ...`) to avoid breaking them. Or verify that all consumers use the snippet pattern and don't destructure exhaustively.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte
git commit -m "feat(3d): wire viewer-3d state into SequenceViewerOrchestrator"
```

---

## Task 12: Wire Route for URL Param

**Files:**
- Modify: `src/routes/sequence/[id]/+page.svelte:68-88,478`

- [ ] **Step 1: Read render param from URL**

In the URL params section (around line 68-88), add:

```typescript
const urlRenderMode = $derived($page.url.searchParams.get("render") as '2d' | '3d' | null);
```

- [ ] **Step 2: Pass to orchestrator**

Where `SequenceViewerOrchestrator` is rendered (line 478), the render mode should be restored after the state is created. Since the orchestrator creates the viewer-3d-state internally, the URL param needs to be passed as a prop:

Add to SequenceViewerOrchestrator Props:
```typescript
initialRenderMode?: '2d' | '3d';
```

And in the orchestrator, after creating viewer3DState:
```typescript
if (initialRenderMode === '3d' && viewer3DState.webgl2Available && sequence) {
  viewer3DState.enter3D(sequence);
}
```

Also add a `$effect` to write the URL param when renderMode changes (using the existing `onUrlParamChange` callback):

```typescript
$effect(() => {
  if (viewer3DState.renderMode === '3d') {
    onUrlParamChange?.('render', '3d');
  } else {
    onUrlParamChange?.('render', ''); // Remove param
  }
});
```

This keeps the URL in sync so the state is shareable and survives page refresh.

In the route file, pass:
```svelte
<SequenceViewerOrchestrator
  ...existing props...
  initialRenderMode={urlRenderMode || undefined}
>
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`

- [ ] **Step 4: Commit**

```bash
git add src/routes/sequence/[id]/+page.svelte src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte
git commit -m "feat(3d): support render=3d URL param for direct 3D mode entry"
```

---

## Task 13: Wire Mobile Fullscreen in Route

**Files:**
- Modify: `src/routes/sequence/[id]/+page.svelte`

- [ ] **Step 1: Render Viewer3DFullscreen on mobile**

In the route's children snippet (inside the `SequenceViewerOrchestrator` children), add a conditional for mobile 3D:

```svelte
{#if ctx.isMobile && ctx.renderMode === '3d'}
  <Viewer3DFullscreen
    sequenceData={ctx.effectiveSequence}
    currentStep={ctx.currentStepLocal}
    isPlaying={ctx.isPlayingLocal}
    bpm={ctx.bpmLocal}
    word={ctx.effectiveSequence?.word ?? null}
    onClose={() => ctx.viewer3DState.exit3D()}
    onPlaybackToggle={ctx.handlePlaybackToggle}
    onBpmChange={ctx.handleBpmChange}
    onStepForward={ctx.stepFullBeatForward}
    onStepBackward={ctx.stepFullBeatBackward}
  />
{/if}
```

**Note:** The orchestrator exposes `stepHalfBeatForward`, `stepHalfBeatBackward`, `stepFullBeatForward`, `stepFullBeatBackward` (NOT `handleStepForward`/`handleStepBackward`). Using full-beat stepping for the 3D fullscreen controls since the user is watching a performance, not doing fine-grained notation editing.

Import `Viewer3DFullscreen` from `$lib/shared/3d/components/Viewer3DFullscreen.svelte`.

- [ ] **Step 2: Pass renderMode to ViewerSplitPane**

In the same children snippet, where ViewerSplitPane is rendered, add:

```svelte
<ViewerSplitPane
  ...existing props...
  renderMode={ctx.isMobile ? '2d' : ctx.renderMode}
/>
```

On mobile, the split pane always renders 2D (the fullscreen overlay handles 3D). On desktop, it swaps inline.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`

- [ ] **Step 4: Manual verification**

Open the app at `http://localhost:5173/sequence/<any-sequence-id>`.
1. Right-click on the animation canvas → should see "Enter 3D View" in context menu
2. Click it → left pane should swap to 3D scene with avatar
3. Right-click again → should see "Exit 3D View"
4. Click exit → back to 2D

On mobile (or narrow viewport):
1. Corner icon should appear on animation canvas
2. Tap it → full-screen 3D overlay
3. Close button → back to 2D viewer

- [ ] **Step 5: Commit**

```bash
git add src/routes/sequence/[id]/+page.svelte
git commit -m "feat(3d): wire mobile fullscreen and desktop inline swap in sequence route"
```

---

## Task 14: Integration Test — Full Flow

- [ ] **Step 1: Build check**

Run: `npm run build`
Expected: Clean build with no errors.

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 3: Existing tests pass**

Run: `npm test`
Expected: All existing tests pass. No regressions.

- [ ] **Step 4: Manual smoke test**

Test these flows:
1. Navigate to `/sequence/<id>` → 2D viewer works normally
2. Right-click canvas → "Enter 3D View" appears
3. Click "Enter 3D View" → 3D avatar appears, staves animate
4. Choreo card on right highlights active beat
5. Play/pause works in 3D mode (footer controls)
6. Right-click → "Exit 3D View" → back to 2D
7. Corner icon visible → tap enters 3D
8. Narrow window → corner icon tap → full-screen overlay
9. Close overlay → back to 2D
10. Navigate to `/sequence/<id>?render=3d` → starts in 3D mode
11. Enter export mode while in 3D → auto-exits to 2D first

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(3d): integration fixes from smoke testing"
```
