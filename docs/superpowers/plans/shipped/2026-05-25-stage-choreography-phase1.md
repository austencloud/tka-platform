# Stage Choreography Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the existing stage module from global-formations to per-performer marks model, add top-down camera flip with SVG formation overlay, beat-synced playback implementing UnifiedPlaybackContext, and sidebar with performer selection + mark properties + formation presets.

**Architecture:** The existing `src/lib/features/stage/` module gets rewritten in-place. Types and state are rebuilt from scratch to match the v2 per-performer marks data model. The SVG canvas (StageCanvas) is replaced by FormationOverlay layered on top of the 3D viewer. The BeatTimeline is replaced by a wrapper around `animation-timeline-js`. All shared primitives (TransportControls, BpmChips, FormationSelector, CollapsibleSection, ContextMenu) are reused directly.

**Tech Stack:** Svelte 5 (runes), TypeScript, camera-controls (installed), animation-timeline-js (to install), @austencloud/scene-3d (FormationPreset types), bits-ui (context menu)

---

## File Structure

```
src/lib/features/stage/
├── StageModule.svelte                        # REWRITE: Entry, grid layout (canvas + sidebar + timeline)
├── domain/
│   └── stage-types.ts                        # REWRITE: Per-performer marks model types
├── state/
│   ├── stage-choreography-state.svelte.ts    # REWRITE: Marks-based state, implements UnifiedPlaybackContext
│   ├── stage-edit-mode.svelte.ts             # CREATE: Camera mode toggle, selection, drag state (~50 lines)
│   ├── formation-presets.ts                  # MODIFY: Adapt to return marks[0] positions
│   └── formation-interpolator.ts             # REWRITE: Per-performer mark interpolation with walk styles
├── components/
│   ├── StageViewer.svelte                    # CREATE: Thin wrapper configuring Viewer3DScene for stage
│   ├── FormationOverlay.svelte               # CREATE: SVG overlay with performer dots, marks, paths
│   ├── StageTimeline.svelte                  # CREATE: Svelte wrapper around animation-timeline-js
│   ├── StageSidebar.svelte                   # CREATE: Right sidebar with collapsible sections
│   └── MarkProperties.svelte                 # CREATE: Mark detail panel (beats, walk style, position)
├── locomotion/
│   ├── clip-registry.ts                      # KEEP: Already correct
│   └── locomotion-controller.ts              # KEEP: Already correct
└── (DELETE old components: StageEditorPanel, StageCanvas, BeatTimeline, PerformerDot, PathLine, Stage3DPreview, LocomotingPerformer)
```

**Justification for new files:**
- `StageViewer.svelte` — grep "Viewer3DScene" usage: all instances configure it inline per-feature. This is a 20-line config wrapper, not a reusable component.
- `FormationOverlay.svelte` — grep "overlay", "Overlay": found `PathLinesOverlay`, `GlyphOverlay`, `Recording3DOverlay` — all are visual-only, no interactive dragging. This is genuinely new (per-spec §4).
- `StageTimeline.svelte` — grep "Timeline", "timeline": found `UnifiedTimeline` (simple scrubber) and old `BeatTimeline` (too basic). Neither wraps `animation-timeline-js`. New wrapper justified.
- `StageSidebar.svelte` — feature-specific layout of reused CollapsibleSection components. Not a generic component.
- `MarkProperties.svelte` — feature-specific mark editing UI. Uses standard buttons/steppers, not a reusable primitive.
- `stage-edit-mode.svelte.ts` — ~50 lines of UI state (camera mode, selection). Feature-specific.

---

## Task 1: Install animation-timeline-js + Update Types

**Files:**
- Modify: `package.json`
- Rewrite: `src/lib/features/stage/domain/stage-types.ts`

- [ ] **Step 1: Install animation-timeline-js**

Run: `npm install animation-timeline-js`
Expected: Package added to dependencies.

- [ ] **Step 2: Verify installation**

Run: `npm ls animation-timeline-js`
Expected: Shows version in dependency tree.

- [ ] **Step 3: Write the new types file**

```typescript
// src/lib/features/stage/domain/stage-types.ts

export interface StageChoreography {
  id: string;
  name: string;
  bpm: number;
  stageWidth: number;
  stageDepth: number;
  performers: Performer[];
  sharedSequenceId: string | null;
}

export interface Performer {
  id: string;
  index: number;
  label: string;
  color: string;
  marks: Mark[];
  sequenceId: string | null;
}

export interface Mark {
  id: string;
  x: number;
  z: number;
  beats: number;
  walkStyle: WalkStyle;
  easing: EasingType;
}

export type WalkStyle = 'crab' | 'direct';
export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export type FormationPresetId =
  | 'line'
  | 'triangle'
  | 'diamond'
  | 'circle'
  | 'v-shape'
  | 'grid'
  | 'stagger'
  | 'cluster';

export const PERFORMER_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

export const PERFORMER_COLORS = [
  '#ff6b6b',
  '#4ecdc4',
  '#ffe66d',
  '#a06cd5',
  '#ff9a76',
  '#6bcf7f',
  '#7eb8da',
  '#e87ea1',
] as const;

export const DEFAULT_STAGE_WIDTH = 10;
export const DEFAULT_STAGE_DEPTH = 8;
export const DEFAULT_BPM = 120;
export const DEFAULT_PERFORMER_COUNT = 4;
```

- [ ] **Step 4: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | head -30`
Expected: Type errors only in files that import old types (expected — we're rewriting them next).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/features/stage/domain/stage-types.ts
git commit -m "feat(stage): install animation-timeline-js, rewrite types to per-performer marks model

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Stage Edit Mode State

**Files:**
- Create: `src/lib/features/stage/state/stage-edit-mode.svelte.ts`

- [ ] **Step 1: Write stage-edit-mode state**

```typescript
// src/lib/features/stage/state/stage-edit-mode.svelte.ts

export type CameraMode = 'orbit' | 'top-down';

export function createStageEditMode() {
  let cameraMode = $state<CameraMode>('orbit');
  let selectedPerformerId = $state<string | null>(null);
  let selectedMarkId = $state<string | null>(null);
  let multiSelectedPerformerIds = $state<Set<string>>(new Set());
  let isDragging = $state(false);

  function toggleCameraMode() {
    cameraMode = cameraMode === 'orbit' ? 'top-down' : 'orbit';
  }

  function selectPerformer(id: string, addToSelection = false) {
    if (addToSelection) {
      const next = new Set(multiSelectedPerformerIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      multiSelectedPerformerIds = next;
      selectedPerformerId = id;
    } else {
      multiSelectedPerformerIds = new Set([id]);
      selectedPerformerId = id;
    }
    selectedMarkId = null;
  }

  function selectMark(performerId: string, markId: string) {
    selectedPerformerId = performerId;
    selectedMarkId = markId;
    multiSelectedPerformerIds = new Set([performerId]);
  }

  function clearSelection() {
    selectedPerformerId = null;
    selectedMarkId = null;
    multiSelectedPerformerIds = new Set();
  }

  return {
    get cameraMode() { return cameraMode; },
    get selectedPerformerId() { return selectedPerformerId; },
    get selectedMarkId() { return selectedMarkId; },
    get multiSelectedPerformerIds() { return multiSelectedPerformerIds; },
    get isDragging() { return isDragging; },
    set isDragging(v: boolean) { isDragging = v; },
    toggleCameraMode,
    selectPerformer,
    selectMark,
    clearSelection,
  };
}

export type StageEditMode = ReturnType<typeof createStageEditMode>;
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json -- src/lib/features/stage/state/stage-edit-mode.svelte.ts 2>&1 | tail -5`
Expected: No errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/stage/state/stage-edit-mode.svelte.ts
git commit -m "feat(stage): add stage edit mode state (camera toggle, selection, multi-select)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Rewrite Choreography State (Marks Model + UnifiedPlaybackContext)

**Files:**
- Rewrite: `src/lib/features/stage/state/stage-choreography-state.svelte.ts`
- Modify: `src/lib/features/stage/state/formation-presets.ts`

- [ ] **Step 1: Rewrite formation-presets to return mark positions**

The existing `generateFormation` returns `PerformerPose[]`. We need it to return `{x: number, z: number}[]` for setting marks[0].

```typescript
// src/lib/features/stage/state/formation-presets.ts

import type { FormationPresetId } from '../domain/stage-types';

export interface PresetPosition {
  x: number;
  z: number;
}

export function generatePresetPositions(
  preset: FormationPresetId,
  performerCount: number,
  stageWidth: number,
  stageDepth: number
): PresetPosition[] {
  const normalized = PRESET_GENERATORS[preset](performerCount);
  return normalized.slice(0, performerCount).map((p) => ({
    x: p.x * stageWidth,
    z: p.z * stageDepth,
  }));
}

type NormalizedPoint = { x: number; z: number };

const PRESET_GENERATORS: Record<FormationPresetId, (n: number) => NormalizedPoint[]> = {
  line: (n) =>
    Array.from({ length: n }, (_, i) => ({
      x: (i + 1) / (n + 1),
      z: 0.5,
    })),

  triangle: (n) => {
    if (n <= 2) return PRESET_GENERATORS.line(n);
    const pts: NormalizedPoint[] = [];
    let remaining = n;
    let row = 0;
    let perRow = 1;
    while (remaining > 0) {
      const count = Math.min(perRow, remaining);
      for (let i = 0; i < count; i++) {
        pts.push({
          x: 0.5 + (i - (count - 1) / 2) * 0.15,
          z: 0.3 + row * 0.2,
        });
      }
      remaining -= count;
      row++;
      perRow++;
    }
    return pts;
  },

  diamond: (n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return { x: 0.5 + Math.cos(a) * 0.25, z: 0.5 + Math.sin(a) * 0.3 };
    }),

  circle: (n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return { x: 0.5 + Math.cos(a) * 0.3, z: 0.5 + Math.sin(a) * 0.3 };
    }),

  'v-shape': (n) => {
    const pts: NormalizedPoint[] = [];
    const half = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const side = i < half ? -1 : 1;
      const idx = i < half ? i : i - half;
      pts.push({
        x: 0.5 + side * (idx + 1) * 0.12,
        z: 0.3 + idx * 0.15,
      });
    }
    return pts;
  },

  grid: (n) => {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    return Array.from({ length: n }, (_, i) => ({
      x: ((i % cols) + 1) / (cols + 1),
      z: (Math.floor(i / cols) + 1) / (rows + 1),
    }));
  },

  stagger: (n) => {
    const perRow = Math.ceil(n / 2);
    return Array.from({ length: n }, (_, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const offset = row % 2 === 1 ? 0.06 : 0;
      return {
        x: (col + 1) / (perRow + 1) + offset,
        z: 0.35 + row * 0.3,
      };
    });
  },

  cluster: (n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const r = 0.1;
      return { x: 0.5 + Math.cos(a) * r, z: 0.5 + Math.sin(a) * r };
    }),
};
```

- [ ] **Step 2: Rewrite stage-choreography-state with marks model + UnifiedPlaybackContext**

```typescript
// src/lib/features/stage/state/stage-choreography-state.svelte.ts

import type {
  StageChoreography,
  Performer,
  Mark,
  FormationPresetId,
  WalkStyle,
  EasingType,
} from '../domain/stage-types';
import {
  PERFORMER_COLORS,
  PERFORMER_LABELS,
  DEFAULT_STAGE_WIDTH,
  DEFAULT_STAGE_DEPTH,
  DEFAULT_BPM,
  DEFAULT_PERFORMER_COUNT,
} from '../domain/stage-types';
import { generatePresetPositions } from './formation-presets';
import type { UnifiedPlaybackContext } from '$lib/shared/timeline/unified-playback-context';

function createPerformer(index: number): Performer {
  return {
    id: crypto.randomUUID(),
    index,
    label: PERFORMER_LABELS[index] ?? `P${index}`,
    color: PERFORMER_COLORS[index] ?? '#888',
    marks: [],
    sequenceId: null,
  };
}

function createMark(x: number, z: number, beats = 0): Mark {
  return {
    id: crypto.randomUUID(),
    x,
    z,
    beats,
    walkStyle: 'direct',
    easing: 'linear',
  };
}

function totalBeatsForPerformer(performer: Performer): number {
  return performer.marks.reduce((sum, m) => sum + m.beats, 0);
}

export function createStageChoreographyState(): UnifiedPlaybackContext & {
  choreography: StageChoreography;
  getPerformer(id: string): Performer | undefined;
  setPerformerCount(count: number): void;
  applyPreset(preset: FormationPresetId): void;
  addMark(performerId: string, x: number, z: number, beats?: number): void;
  updateMarkPosition(markId: string, x: number, z: number): void;
  updateMarkBeats(markId: string, beats: number): void;
  updateMarkWalkStyle(markId: string, walkStyle: WalkStyle): void;
  updateMarkEasing(markId: string, easing: EasingType): void;
  deleteMark(markId: string): void;
  setBpm(bpm: number): void;
  interpolatedPositions: { performerId: string; x: number; z: number; facing: number }[];
} {
  let choreography = $state<StageChoreography>({
    id: crypto.randomUUID(),
    name: 'Untitled Choreography',
    bpm: DEFAULT_BPM,
    stageWidth: DEFAULT_STAGE_WIDTH,
    stageDepth: DEFAULT_STAGE_DEPTH,
    performers: Array.from({ length: DEFAULT_PERFORMER_COUNT }, (_, i) => createPerformer(i)),
    sharedSequenceId: null,
  });

  let isPlaying = $state(false);
  let elapsed = $state(0);
  let animationFrame: number | null = null;
  let lastTimestamp = 0;

  const maxTotalBeats = $derived(
    Math.max(1, ...choreography.performers.map(totalBeatsForPerformer))
  );

  const duration = $derived((maxTotalBeats * 60) / choreography.bpm);

  const overallProgress = $derived(duration > 0 ? Math.min(1, elapsed / duration) : 0);

  const currentStep = $derived.by(() => {
    const longestPerformer = choreography.performers.reduce(
      (best, p) => (totalBeatsForPerformer(p) > totalBeatsForPerformer(best) ? p : best),
      choreography.performers[0]!
    );
    const currentBeat = overallProgress * maxTotalBeats;
    let accumulated = 0;
    for (let i = 1; i < longestPerformer.marks.length; i++) {
      accumulated += longestPerformer.marks[i]!.beats;
      if (accumulated >= currentBeat) return i - 1;
    }
    return Math.max(0, longestPerformer.marks.length - 2);
  });

  const totalSteps = $derived(
    Math.max(1, ...choreography.performers.map((p) => Math.max(0, p.marks.length - 1)))
  );

  const beatMarkerPositions = $derived.by(() => {
    if (maxTotalBeats <= 0) return [];
    const longestPerformer = choreography.performers.reduce(
      (best, p) => (totalBeatsForPerformer(p) > totalBeatsForPerformer(best) ? p : best),
      choreography.performers[0]!
    );
    const positions: number[] = [];
    let accumulated = 0;
    for (let i = 1; i < longestPerformer.marks.length; i++) {
      accumulated += longestPerformer.marks[i]!.beats;
      positions.push(accumulated / maxTotalBeats);
    }
    return positions;
  });

  const interpolatedPositions = $derived.by(() => {
    const currentBeat = overallProgress * maxTotalBeats;
    return choreography.performers.map((performer) => {
      if (performer.marks.length === 0) {
        return { performerId: performer.id, x: choreography.stageWidth / 2, z: choreography.stageDepth / 2, facing: 0 };
      }
      if (performer.marks.length === 1) {
        const m = performer.marks[0]!;
        return { performerId: performer.id, x: m.x, z: m.z, facing: 0 };
      }

      let accumulated = 0;
      for (let i = 1; i < performer.marks.length; i++) {
        const mark = performer.marks[i]!;
        const prevAccumulated = accumulated;
        accumulated += mark.beats;
        if (accumulated >= currentBeat || i === performer.marks.length - 1) {
          const fromMark = performer.marks[i - 1]!;
          const localProgress = mark.beats > 0
            ? Math.min(1, (currentBeat - prevAccumulated) / mark.beats)
            : 1;
          const eased = applyEasing(localProgress, mark.easing);

          let x: number, z: number, facing: number;
          if (mark.walkStyle === 'crab') {
            x = fromMark.x + (mark.x - fromMark.x) * eased;
            z = fromMark.z + (mark.z - fromMark.z) * eased;
            facing = 0;
          } else {
            x = fromMark.x + (mark.x - fromMark.x) * eased;
            z = fromMark.z + (mark.z - fromMark.z) * eased;
            const dx = mark.x - fromMark.x;
            const dz = mark.z - fromMark.z;
            facing = Math.abs(dx) + Math.abs(dz) > 0.01 ? Math.atan2(dx, -dz) : 0;
          }
          return { performerId: performer.id, x, z, facing };
        }
      }
      const lastMark = performer.marks.at(-1)!;
      return { performerId: performer.id, x: lastMark.x, z: lastMark.z, facing: 0 };
    });
  });

  function applyEasing(t: number, easing: EasingType): number {
    switch (easing) {
      case 'linear': return t;
      case 'easeIn': return t * t;
      case 'easeOut': return 1 - (1 - t) * (1 - t);
      case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
  }

  function tick() {
    if (!isPlaying) return;
    const now = performance.now();
    const dt = (now - lastTimestamp) / 1000;
    lastTimestamp = now;
    elapsed = Math.min(elapsed + dt, duration);
    if (elapsed >= duration) {
      isPlaying = false;
      elapsed = duration;
      animationFrame = null;
      return;
    }
    animationFrame = requestAnimationFrame(tick);
  }

  function togglePlay() {
    if (isPlaying) {
      isPlaying = false;
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
    } else {
      if (elapsed >= duration) elapsed = 0;
      isPlaying = true;
      lastTimestamp = performance.now();
      tick();
    }
  }

  function seek(progress: number) {
    elapsed = Math.max(0, Math.min(1, progress)) * duration;
  }

  function toggleLoop() {
    // v1: no loop support
  }

  function getPerformer(id: string): Performer | undefined {
    return choreography.performers.find((p) => p.id === id);
  }

  function setPerformerCount(count: number) {
    const clamped = Math.max(2, Math.min(8, count));
    const current = choreography.performers.length;
    if (clamped > current) {
      for (let i = current; i < clamped; i++) {
        choreography.performers.push(createPerformer(i));
      }
    } else if (clamped < current) {
      choreography.performers = choreography.performers.slice(0, clamped);
    }
  }

  function applyPreset(preset: FormationPresetId) {
    const positions = generatePresetPositions(
      preset,
      choreography.performers.length,
      choreography.stageWidth,
      choreography.stageDepth
    );
    choreography.performers.forEach((performer, i) => {
      const pos = positions[i];
      if (pos) {
        performer.marks = [createMark(pos.x, pos.z, 0)];
      }
    });
  }

  function addMark(performerId: string, x: number, z: number, beats = 4) {
    const performer = choreography.performers.find((p) => p.id === performerId);
    if (!performer) return;
    const clampedX = Math.max(0, Math.min(choreography.stageWidth, x));
    const clampedZ = Math.max(0, Math.min(choreography.stageDepth, z));
    performer.marks.push(createMark(clampedX, clampedZ, beats));
  }

  function updateMarkPosition(markId: string, x: number, z: number) {
    for (const performer of choreography.performers) {
      const mark = performer.marks.find((m) => m.id === markId);
      if (mark) {
        mark.x = Math.max(0, Math.min(choreography.stageWidth, x));
        mark.z = Math.max(0, Math.min(choreography.stageDepth, z));
        return;
      }
    }
  }

  function updateMarkBeats(markId: string, beats: number) {
    for (const performer of choreography.performers) {
      const mark = performer.marks.find((m) => m.id === markId);
      if (mark) {
        mark.beats = Math.max(1, Math.min(32, beats));
        return;
      }
    }
  }

  function updateMarkWalkStyle(markId: string, walkStyle: WalkStyle) {
    for (const performer of choreography.performers) {
      const mark = performer.marks.find((m) => m.id === markId);
      if (mark) {
        mark.walkStyle = walkStyle;
        return;
      }
    }
  }

  function updateMarkEasing(markId: string, easing: EasingType) {
    for (const performer of choreography.performers) {
      const mark = performer.marks.find((m) => m.id === markId);
      if (mark) {
        mark.easing = easing;
        return;
      }
    }
  }

  function deleteMark(markId: string) {
    for (const performer of choreography.performers) {
      const idx = performer.marks.findIndex((m) => m.id === markId);
      if (idx > 0) {
        performer.marks.splice(idx, 1);
        return;
      }
    }
  }

  function setBpm(bpm: number) {
    choreography.bpm = Math.max(15, Math.min(180, bpm));
  }

  return {
    get choreography() { return choreography; },
    get overallProgress() { return overallProgress; },
    get currentStep() { return currentStep; },
    get totalSteps() { return totalSteps; },
    get isPlaying() { return isPlaying; },
    get isLooping() { return undefined; },
    get duration() { return duration; },
    get elapsed() { return elapsed; },
    get beatMarkerPositions() { return beatMarkerPositions; },
    get bpm() { return choreography.bpm; },
    get playbackMode() { return undefined; },
    get interpolatedPositions() { return interpolatedPositions; },
    seek,
    togglePlay,
    toggleLoop,
    onBpmChange: setBpm,
    getPerformer,
    setPerformerCount,
    applyPreset,
    addMark,
    updateMarkPosition,
    updateMarkBeats,
    updateMarkWalkStyle,
    updateMarkEasing,
    deleteMark,
    setBpm,
  };
}

let instance: ReturnType<typeof createStageChoreographyState> | null = null;

export function getStageChoreographyState() {
  if (!instance) {
    instance = createStageChoreographyState();
  }
  return instance;
}
```

- [ ] **Step 3: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -c "Error"`
Expected: Errors only in deleted/stale component imports (old StageCanvas, etc.), not in state files.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/stage/state/stage-choreography-state.svelte.ts src/lib/features/stage/state/formation-presets.ts
git commit -m "feat(stage): rewrite choreography state to per-performer marks + UnifiedPlaybackContext

Implements full playback engine with per-mark interpolation, walk style
support (direct/crab), easing, and UnifiedPlaybackContext interface for
TransportControls compatibility.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Formation Interpolator Rewrite

**Files:**
- Rewrite: `src/lib/features/stage/state/formation-interpolator.ts`

- [ ] **Step 1: Rewrite interpolator for marks model**

The old interpolator works on formations. The new one works per-performer with marks. However, the main interpolation logic is now inside `stage-choreography-state.svelte.ts` (the `interpolatedPositions` derived). The standalone interpolator becomes a utility for computing speed (needed by locomotion controller).

```typescript
// src/lib/features/stage/state/formation-interpolator.ts

import type { Mark, EasingType } from '../domain/stage-types';

export function applyEasing(t: number, easing: EasingType): number {
  switch (easing) {
    case 'linear': return t;
    case 'easeIn': return t * t;
    case 'easeOut': return 1 - (1 - t) * (1 - t);
    case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}

export function computeMarkDistance(from: Mark, to: Mark): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function computeMarkSpeed(from: Mark, to: Mark, bpm: number): number {
  if (to.beats <= 0) return 0;
  const distance = computeMarkDistance(from, to);
  const durationSeconds = (to.beats * 60) / bpm;
  return distance / durationSeconds;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json -- src/lib/features/stage/state/formation-interpolator.ts 2>&1 | tail -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/stage/state/formation-interpolator.ts
git commit -m "feat(stage): rewrite interpolator as utility for mark distance/speed computation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: StageViewer Component (Thin 3D Wrapper)

**Files:**
- Create: `src/lib/features/stage/components/StageViewer.svelte`

- [ ] **Step 1: Write StageViewer**

This thin wrapper mounts `Viewer3DScene` (or the relevant 3D canvas from the shared system) configured for stage mode. It receives interpolated positions and passes them into the 3D system.

```svelte
<!-- src/lib/features/stage/components/StageViewer.svelte -->
<script lang="ts">
  import { Canvas } from '@threlte/core';
  import Scene3D from '$lib/shared/3d/components/Scene3D.svelte';
  import { getStageChoreographyState } from '../state/stage-choreography-state.svelte';

  const stageState = getStageChoreographyState();
  const interpolatedPositions = $derived(stageState.interpolatedPositions);
  const choreography = $derived(stageState.choreography);
</script>

<div class="stage-viewer">
  <Canvas>
    <Scene3D
      performerCount={choreography.performers.length}
      performerPositions={interpolatedPositions}
    />
  </Canvas>
</div>

<style>
  .stage-viewer {
    width: 100%;
    height: 100%;
    position: relative;
  }
</style>
```

**Note:** The exact props for Scene3D/Viewer3DScene will need to be verified against the current API. The implementer should read `src/lib/shared/3d/components/Scene3D.svelte` to determine the correct prop interface for passing performer positions. If Scene3D doesn't accept a `performerPositions` prop, the integration will go through the viewer-3d-state performer manager instead.

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json -- src/lib/features/stage/components/StageViewer.svelte 2>&1 | tail -10`
Expected: May have type issues depending on Scene3D props — resolve by reading Scene3D's actual interface.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/stage/components/StageViewer.svelte
git commit -m "feat(stage): add StageViewer thin wrapper over Scene3D

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: FormationOverlay SVG Component

**Files:**
- Create: `src/lib/features/stage/components/FormationOverlay.svelte`

- [ ] **Step 1: Write FormationOverlay**

This is the primary new visual component. SVG overlay with performer dots, marks, paths, drag interaction.

```svelte
<!-- src/lib/features/stage/components/FormationOverlay.svelte -->
<script lang="ts">
  import { getStageChoreographyState } from '../state/stage-choreography-state.svelte';
  import { createStageEditMode, type StageEditMode } from '../state/stage-edit-mode.svelte';

  interface Props {
    editMode: StageEditMode;
  }

  let { editMode }: Props = $props();

  const stageState = getStageChoreographyState();
  const choreography = $derived(stageState.choreography);

  let containerEl: HTMLDivElement | null = $state(null);
  let svgWidth = $state(800);
  let svgHeight = $state(600);

  const margin = 48;

  $effect(() => {
    if (!containerEl) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]!;
      svgWidth = entry.contentRect.width;
      svgHeight = entry.contentRect.height;
    });
    observer.observe(containerEl);
    return () => observer.disconnect();
  });

  function stageToSvgX(x: number): number {
    return margin + (x / choreography.stageWidth) * (svgWidth - margin * 2);
  }

  function stageToSvgZ(z: number): number {
    return margin + (z / choreography.stageDepth) * (svgHeight - margin * 2);
  }

  function svgToStageX(svgX: number): number {
    return ((svgX - margin) / (svgWidth - margin * 2)) * choreography.stageWidth;
  }

  function svgToStageZ(svgZ: number): number {
    return ((svgZ - margin) / (svgHeight - margin * 2)) * choreography.stageDepth;
  }

  let draggingMarkId: string | null = $state(null);

  function handleMarkPointerDown(e: PointerEvent, markId: string, performerId: string) {
    e.preventDefault();
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    draggingMarkId = markId;
    editMode.isDragging = true;
    editMode.selectMark(performerId, markId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!draggingMarkId) return;
    const svg = containerEl?.querySelector('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = e.clientX - rect.left;
    const svgZ = e.clientY - rect.top;
    const stageX = svgToStageX(svgX);
    const stageZ = svgToStageZ(svgZ);
    stageState.updateMarkPosition(draggingMarkId, stageX, stageZ);
  }

  function handlePointerUp() {
    draggingMarkId = null;
    editMode.isDragging = false;
  }

  function handleStageClick(e: MouseEvent) {
    if (!editMode.selectedPerformerId) return;
    const svg = containerEl?.querySelector('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = e.clientX - rect.left;
    const svgZ = e.clientY - rect.top;
    const stageX = svgToStageX(svgX);
    const stageZ = svgToStageZ(svgZ);
    stageState.addMark(editMode.selectedPerformerId, stageX, stageZ);
  }

  const dotRadius = 24;
  const markRadius = 16;
</script>

<div
  class="formation-overlay"
  bind:this={containerEl}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
>
  <svg
    width={svgWidth}
    height={svgHeight}
    xmlns="http://www.w3.org/2000/svg"
    role="application"
    aria-label="Formation editor"
  >
    <!-- Stage boundary -->
    <rect
      x={margin}
      y={margin}
      width={svgWidth - margin * 2}
      height={svgHeight - margin * 2}
      fill="none"
      stroke="rgba(255, 255, 255, 0.15)"
      stroke-width="2"
      rx="8"
    />
    <rect
      x={margin - 4}
      y={margin - 4}
      width={svgWidth - margin * 2 + 8}
      height={svgHeight - margin * 2 + 8}
      fill="none"
      stroke="rgba(255, 255, 255, 0.06)"
      stroke-width="1"
      rx="10"
    />

    <!-- Dot grid -->
    {#each Array.from({ length: Math.floor(choreography.stageWidth) + 1 }, (_, i) => i) as x}
      {#each Array.from({ length: Math.floor(choreography.stageDepth) + 1 }, (_, i) => i) as z}
        <circle
          cx={stageToSvgX(x)}
          cy={stageToSvgZ(z)}
          r="1.5"
          fill="rgba(255, 255, 255, 0.12)"
        />
      {/each}
    {/each}

    <!-- Center crosshair -->
    <line
      x1={stageToSvgX(choreography.stageWidth / 2)}
      y1={margin}
      x2={stageToSvgX(choreography.stageWidth / 2)}
      y2={svgHeight - margin}
      stroke="rgba(255, 255, 255, 0.06)"
      stroke-width="1"
      stroke-dasharray="4 4"
    />
    <line
      x1={margin}
      y1={stageToSvgZ(choreography.stageDepth / 2)}
      x2={svgWidth - margin}
      y2={stageToSvgZ(choreography.stageDepth / 2)}
      stroke="rgba(255, 255, 255, 0.06)"
      stroke-width="1"
      stroke-dasharray="4 4"
    />

    <!-- Click target for adding marks -->
    <rect
      x={margin}
      y={margin}
      width={svgWidth - margin * 2}
      height={svgHeight - margin * 2}
      fill="transparent"
      onclick={handleStageClick}
      style="cursor: {editMode.selectedPerformerId ? 'crosshair' : 'default'}"
    />

    <!-- Per-performer paths and marks -->
    {#each choreography.performers as performer}
      {@const isSelected = editMode.multiSelectedPerformerIds.has(performer.id)}

      <!-- Path lines -->
      {#each performer.marks as mark, i}
        {#if i > 0}
          {@const prevMark = performer.marks[i - 1]!}
          <line
            x1={stageToSvgX(prevMark.x)}
            y1={stageToSvgZ(prevMark.z)}
            x2={stageToSvgX(mark.x)}
            y2={stageToSvgZ(mark.z)}
            stroke={performer.color}
            stroke-width={isSelected ? 2 : 1}
            stroke-opacity={isSelected ? 0.8 : 0.3}
            stroke-dasharray={isSelected ? 'none' : '4 4'}
          />

          <!-- Beat label between marks -->
          {#if isSelected}
            <text
              x={(stageToSvgX(prevMark.x) + stageToSvgX(mark.x)) / 2}
              y={(stageToSvgZ(prevMark.z) + stageToSvgZ(mark.z)) / 2 - 8}
              text-anchor="middle"
              fill={performer.color}
              font-size="12"
              font-weight="600"
              opacity="0.8"
            >{mark.beats}b</text>
          {/if}
        {/if}
      {/each}

      <!-- Marks (numbered waypoints) -->
      {#each performer.marks as mark, i}
        {#if i === 0}
          <!-- Origin dot (larger) -->
          <g
            onpointerdown={(e) => handleMarkPointerDown(e, mark.id, performer.id)}
            style="cursor: grab; touch-action: none;"
            role="button"
            tabindex="0"
            aria-label="Performer {performer.label} origin at {mark.x.toFixed(1)}, {mark.z.toFixed(1)}"
          >
            <circle
              cx={stageToSvgX(mark.x)}
              cy={stageToSvgZ(mark.z)}
              r={dotRadius}
              fill={performer.color}
              fill-opacity="0.9"
              stroke={editMode.selectedMarkId === mark.id ? 'white' : 'none'}
              stroke-width="2"
            />
            <text
              x={stageToSvgX(mark.x)}
              y={stageToSvgZ(mark.z) + 5}
              text-anchor="middle"
              fill="white"
              font-size="16"
              font-weight="700"
            >{performer.label}</text>
          </g>
        {:else}
          <!-- Numbered mark (smaller) -->
          <g
            onpointerdown={(e) => handleMarkPointerDown(e, mark.id, performer.id)}
            style="cursor: grab; touch-action: none;"
            role="button"
            tabindex="0"
            aria-label="Performer {performer.label} mark {i} at {mark.x.toFixed(1)}, {mark.z.toFixed(1)}"
          >
            <circle
              cx={stageToSvgX(mark.x)}
              cy={stageToSvgZ(mark.z)}
              r={markRadius}
              fill={performer.color}
              fill-opacity="0.7"
              stroke={editMode.selectedMarkId === mark.id ? 'white' : 'none'}
              stroke-width="2"
            />
            <text
              x={stageToSvgX(mark.x)}
              y={stageToSvgZ(mark.z) + 4}
              text-anchor="middle"
              fill="white"
              font-size="12"
              font-weight="600"
            >{i}</text>
          </g>
        {/if}
      {/each}
    {/each}

    <!-- AUDIENCE / BACKSTAGE labels -->
    <text
      x={svgWidth / 2}
      y={margin - 16}
      text-anchor="middle"
      fill="rgba(255, 255, 255, 0.35)"
      font-size="11"
      font-weight="600"
      letter-spacing="1"
    >AUDIENCE</text>
    <text
      x={svgWidth / 2}
      y={svgHeight - margin + 24}
      text-anchor="middle"
      fill="rgba(255, 255, 255, 0.35)"
      font-size="11"
      font-weight="600"
      letter-spacing="1"
    >BACKSTAGE</text>
  </svg>
</div>

<style>
  .formation-overlay {
    position: absolute;
    inset: 0;
    pointer-events: all;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    svg * {
      transition: none !important;
    }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json -- src/lib/features/stage/components/FormationOverlay.svelte 2>&1 | tail -10`
Expected: Clean or minor type issues to resolve.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/stage/components/FormationOverlay.svelte
git commit -m "feat(stage): add FormationOverlay SVG with draggable marks, paths, and dot grid

Per-performer marks displayed as colored numbered waypoints.
Drag via pointer capture. Click stage to place new marks.
Double-ring stage boundary, dot grid, center crosshair.
WCAG: 48px origin dots, focus-visible, aria labels, reduced-motion.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: StageTimeline (animation-timeline-js Wrapper)

**Files:**
- Create: `src/lib/features/stage/components/StageTimeline.svelte`

- [ ] **Step 1: Write StageTimeline wrapper**

```svelte
<!-- src/lib/features/stage/components/StageTimeline.svelte -->
<script lang="ts">
  import { Timeline } from 'animation-timeline-js';
  import { getStageChoreographyState } from '../state/stage-choreography-state.svelte';
  import type { StageEditMode } from '../state/stage-edit-mode.svelte';

  interface Props {
    editMode: StageEditMode;
  }

  let { editMode }: Props = $props();

  const stageState = getStageChoreographyState();
  const choreography = $derived(stageState.choreography);
  const isPlaying = $derived(stageState.isPlaying);
  const overallProgress = $derived(stageState.overallProgress);
  const duration = $derived(stageState.duration);

  let containerEl: HTMLDivElement | null = $state(null);
  let timeline: Timeline | null = null;

  $effect(() => {
    if (!containerEl) return;

    timeline = new Timeline({ id: containerEl });

    return () => {
      timeline?.dispose();
      timeline = null;
    };
  });

  $effect(() => {
    if (!timeline) return;

    const maxBeats = Math.max(
      16,
      ...choreography.performers.map((p) =>
        p.marks.reduce((sum, m) => sum + m.beats, 0)
      )
    );

    const rows = choreography.performers.map((performer) => {
      let accumulated = 0;
      const keyframes = performer.marks.slice(1).map((mark) => {
        accumulated += mark.beats;
        return { val: accumulated };
      });
      return { keyframes };
    });

    timeline.setModel({ rows });
    timeline.setOptions({
      min: 0,
      max: maxBeats,
      stepVal: 1,
      snapStep: 1,
    });
  });

  $effect(() => {
    if (!timeline || !isPlaying) return;
    const maxBeats = Math.max(
      1,
      ...choreography.performers.map((p) =>
        p.marks.reduce((sum, m) => sum + m.beats, 0)
      )
    );
    timeline.setTime(overallProgress * maxBeats);
  });
</script>

<div class="stage-timeline" bind:this={containerEl}></div>

<style>
  .stage-timeline {
    width: 100%;
    height: 80px;
    min-height: 60px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: color-mix(in srgb, var(--theme-panel-bg, rgba(18, 18, 28, 0.98)) 90%, black);
  }
</style>
```

**Note:** The exact `animation-timeline-js` API (constructor options, `setModel`, `setOptions`, `setTime`, `dispose`) should be verified against the package docs by the implementer. The library exports may differ — check `node_modules/animation-timeline-js/lib/index.d.ts` after install.

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json -- src/lib/features/stage/components/StageTimeline.svelte 2>&1 | tail -10`
Expected: May need adjustments based on actual animation-timeline-js type exports.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/stage/components/StageTimeline.svelte
git commit -m "feat(stage): add StageTimeline wrapper around animation-timeline-js

Per-performer rows with mark keyframes. Playhead driven by state.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: MarkProperties Sidebar Panel

**Files:**
- Create: `src/lib/features/stage/components/MarkProperties.svelte`

- [ ] **Step 1: Write MarkProperties component**

```svelte
<!-- src/lib/features/stage/components/MarkProperties.svelte -->
<script lang="ts">
  import { getStageChoreographyState } from '../state/stage-choreography-state.svelte';
  import type { StageEditMode } from '../state/stage-edit-mode.svelte';
  import type { Mark, Performer } from '../domain/stage-types';

  interface Props {
    editMode: StageEditMode;
  }

  let { editMode }: Props = $props();

  const stageState = getStageChoreographyState();
  const choreography = $derived(stageState.choreography);

  const selectedPerformer = $derived(
    editMode.selectedPerformerId
      ? choreography.performers.find((p) => p.id === editMode.selectedPerformerId)
      : undefined
  );

  const selectedMark = $derived.by((): Mark | undefined => {
    if (!editMode.selectedMarkId || !selectedPerformer) return undefined;
    return selectedPerformer.marks.find((m) => m.id === editMode.selectedMarkId);
  });

  const markIndex = $derived.by((): number => {
    if (!selectedMark || !selectedPerformer) return -1;
    return selectedPerformer.marks.findIndex((m) => m.id === selectedMark.id);
  });

  function incrementBeats() {
    if (!selectedMark) return;
    stageState.updateMarkBeats(selectedMark.id, selectedMark.beats + 1);
  }

  function decrementBeats() {
    if (!selectedMark) return;
    stageState.updateMarkBeats(selectedMark.id, selectedMark.beats - 1);
  }

  function setWalkStyle(style: 'direct' | 'crab') {
    if (!selectedMark) return;
    stageState.updateMarkWalkStyle(selectedMark.id, style);
  }

  function handleDelete() {
    if (!selectedMark) return;
    const id = selectedMark.id;
    editMode.clearSelection();
    stageState.deleteMark(id);
  }
</script>

{#if selectedPerformer && selectedMark && markIndex > 0}
  <div class="mark-properties" role="region" aria-label="Mark properties">
    <h4 class="mark-header">
      <span class="performer-badge" style="background: {selectedPerformer.color}">
        {selectedPerformer.label}
      </span>
      <span>Mark {markIndex}</span>
    </h4>

    <!-- Beats stepper -->
    <div class="property-row">
      <span class="property-label">Beats to arrive</span>
      <div class="stepper">
        <button
          type="button"
          class="stepper-btn"
          onclick={decrementBeats}
          disabled={selectedMark.beats <= 1}
          aria-label="Decrease beats"
        >
          <i class="fas fa-minus" aria-hidden="true"></i>
        </button>
        <span class="stepper-value" aria-live="polite">{selectedMark.beats}</span>
        <button
          type="button"
          class="stepper-btn"
          onclick={incrementBeats}
          disabled={selectedMark.beats >= 32}
          aria-label="Increase beats"
        >
          <i class="fas fa-plus" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <!-- Walk style toggle -->
    <div class="property-row">
      <span class="property-label">Walk style</span>
      <div class="toggle-group" role="group" aria-label="Walk style">
        <button
          type="button"
          class="toggle-btn"
          class:active={selectedMark.walkStyle === 'direct'}
          aria-pressed={selectedMark.walkStyle === 'direct'}
          onclick={() => setWalkStyle('direct')}
        >Direct</button>
        <button
          type="button"
          class="toggle-btn"
          class:active={selectedMark.walkStyle === 'crab'}
          aria-pressed={selectedMark.walkStyle === 'crab'}
          onclick={() => setWalkStyle('crab')}
        >Crab</button>
      </div>
    </div>

    <!-- Position (read-only) -->
    <div class="property-row">
      <span class="property-label">Position</span>
      <span class="position-value">
        {selectedMark.x.toFixed(1)}m, {selectedMark.z.toFixed(1)}m
      </span>
    </div>

    <!-- Delete -->
    <button
      type="button"
      class="delete-btn"
      onclick={handleDelete}
      aria-label="Delete mark {markIndex}"
    >
      <i class="fas fa-trash" aria-hidden="true"></i>
      Delete Mark
    </button>
  </div>
{/if}

<style>
  .mark-properties {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .mark-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-text, white);
    margin: 0;
  }

  .performer-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    font-size: 0.85rem;
    font-weight: 700;
    color: white;
  }

  .property-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .property-label {
    font-size: 0.875rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-weight: 500;
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .stepper-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all 150ms ease;
    font-size: 0.75rem;
  }

  .stepper-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .stepper-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .stepper-value {
    min-width: 2ch;
    text-align: center;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--theme-text);
    font-variant-numeric: tabular-nums;
  }

  .toggle-group {
    display: flex;
    gap: 4px;
  }

  .toggle-btn {
    min-width: 48px;
    min-height: 48px;
    padding: 8px 16px;
    border-radius: 8px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    color: var(--theme-text-dim);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .toggle-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    color: white;
  }

  .toggle-btn:hover:not(.active) {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .position-value {
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text);
  }

  .delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    padding: 10px 16px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
    border: 1.5px solid color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
    color: var(--semantic-error, #ef4444);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .delete-btn:hover {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 25%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 50%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .stepper-btn, .toggle-btn, .delete-btn {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json -- src/lib/features/stage/components/MarkProperties.svelte 2>&1 | tail -10`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/stage/components/MarkProperties.svelte
git commit -m "feat(stage): add MarkProperties panel (beats stepper, walk style toggle, delete)

48px touch targets, aria-pressed, aria-live on stepper value.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: StageSidebar (Reusing Shared Primitives)

**Files:**
- Create: `src/lib/features/stage/components/StageSidebar.svelte`

- [ ] **Step 1: Write StageSidebar**

```svelte
<!-- src/lib/features/stage/components/StageSidebar.svelte -->
<script lang="ts">
  import CollapsibleSection from '$lib/features/admin/components/feature-flags/shared/CollapsibleSection.svelte';
  import TransportControls from '$lib/shared/animation-engine/components/controls/TransportControls.svelte';
  import BpmChips from '$lib/shared/animation-engine/components/controls/BpmChips.svelte';
  import FormationSelector from '$lib/shared/3d/components/controls/FormationSelector.svelte';
  import MarkProperties from './MarkProperties.svelte';
  import { getStageChoreographyState } from '../state/stage-choreography-state.svelte';
  import type { StageEditMode } from '../state/stage-edit-mode.svelte';
  import type { FormationPreset } from '@austencloud/scene-3d';
  import type { FormationPresetId } from '../domain/stage-types';
  import { PERFORMER_LABELS } from '../domain/stage-types';

  interface Props {
    editMode: StageEditMode;
  }

  let { editMode }: Props = $props();

  const stageState = getStageChoreographyState();
  const choreography = $derived(stageState.choreography);
  const isPlaying = $derived(stageState.isPlaying);

  let bpm = $state(120);
  $effect(() => { bpm = choreography.bpm; });

  function handleBpmChange(newBpm: number) {
    stageState.setBpm(newBpm);
  }

  let activePreset = $state<FormationPreset>('line' as FormationPreset);

  function handlePresetChange(preset: FormationPreset) {
    activePreset = preset;
    stageState.applyPreset(preset as unknown as FormationPresetId);
  }

  function handlePerformerClick(e: MouseEvent, performerId: string) {
    editMode.selectPerformer(performerId, e.shiftKey);
  }
</script>

<aside class="stage-sidebar" aria-label="Stage controls">
  <CollapsibleSection title="Performers" icon="fa-users" defaultOpen={true}>
    <div class="performer-buttons" role="group" aria-label="Performer selection">
      {#each choreography.performers as performer, i}
        <button
          type="button"
          class="performer-btn"
          class:selected={editMode.multiSelectedPerformerIds.has(performer.id)}
          style="--performer-color: {performer.color}"
          onclick={(e) => handlePerformerClick(e, performer.id)}
          aria-pressed={editMode.multiSelectedPerformerIds.has(performer.id)}
          aria-label="Select performer {performer.label}"
        >
          {performer.label}
        </button>
      {/each}
    </div>
    <div class="performer-count-controls">
      <button
        type="button"
        class="count-btn"
        onclick={() => stageState.setPerformerCount(choreography.performers.length - 1)}
        disabled={choreography.performers.length <= 2}
        aria-label="Remove performer"
      >
        <i class="fas fa-minus" aria-hidden="true"></i>
      </button>
      <span class="count-display" aria-live="polite">{choreography.performers.length}</span>
      <button
        type="button"
        class="count-btn"
        onclick={() => stageState.setPerformerCount(choreography.performers.length + 1)}
        disabled={choreography.performers.length >= 8}
        aria-label="Add performer"
      >
        <i class="fas fa-plus" aria-hidden="true"></i>
      </button>
    </div>
  </CollapsibleSection>

  <CollapsibleSection title="Transport" icon="fa-play" defaultOpen={true}>
    <TransportControls
      {isPlaying}
      onPlaybackToggle={() => stageState.togglePlay()}
      onRestartToStart={() => stageState.seek(0)}
    />
    <div class="bpm-section">
      <BpmChips bind:bpm variant="compact" onBpmChange={handleBpmChange} />
    </div>
  </CollapsibleSection>

  <CollapsibleSection title="Formation Presets" icon="fa-shapes" defaultOpen={true}>
    <FormationSelector
      value={activePreset}
      performerCount={choreography.performers.length}
      onchange={handlePresetChange}
    />
  </CollapsibleSection>

  <CollapsibleSection title="Selected Mark" icon="fa-crosshairs" defaultOpen={true}>
    <MarkProperties {editMode} />
  </CollapsibleSection>
</aside>

<style>
  .stage-sidebar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    padding: 8px;
  }

  .performer-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .performer-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--performer-color) 20%, transparent);
    border: 2px solid color-mix(in srgb, var(--performer-color) 40%, transparent);
    color: var(--performer-color);
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .performer-btn.selected {
    background: color-mix(in srgb, var(--performer-color) 40%, transparent);
    border-color: var(--performer-color);
    box-shadow: 0 0 12px color-mix(in srgb, var(--performer-color) 40%, transparent);
  }

  .performer-btn:hover:not(.selected) {
    background: color-mix(in srgb, var(--performer-color) 30%, transparent);
    border-color: color-mix(in srgb, var(--performer-color) 60%, transparent);
  }

  .performer-count-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 8px;
  }

  .count-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 150ms ease;
  }

  .count-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .count-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .count-display {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--theme-text);
    font-variant-numeric: tabular-nums;
    min-width: 2ch;
    text-align: center;
  }

  .bpm-section {
    margin-top: 8px;
  }

  @media (prefers-reduced-motion: reduce) {
    .performer-btn, .count-btn {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json -- src/lib/features/stage/components/StageSidebar.svelte 2>&1 | tail -10`
Expected: Possible type mismatch on FormationSelector `value` prop — fix by casting or checking the FormationPreset type from @austencloud/scene-3d.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/stage/components/StageSidebar.svelte
git commit -m "feat(stage): add StageSidebar reusing TransportControls, BpmChips, FormationSelector, CollapsibleSection

Performer buttons with multi-select, count controls, mark properties panel.
All shared primitives reused directly — no new generic components.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 10: StageModule Assembly

**Files:**
- Rewrite: `src/lib/features/stage/StageModule.svelte`

- [ ] **Step 1: Rewrite StageModule with grid layout**

```svelte
<!-- src/lib/features/stage/StageModule.svelte -->
<script lang="ts">
  import StageViewer from './components/StageViewer.svelte';
  import FormationOverlay from './components/FormationOverlay.svelte';
  import StageTimeline from './components/StageTimeline.svelte';
  import StageSidebar from './components/StageSidebar.svelte';
  import { getStageChoreographyState } from './state/stage-choreography-state.svelte';
  import { createStageEditMode } from './state/stage-edit-mode.svelte';

  const stageState = getStageChoreographyState();
  const editMode = createStageEditMode();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 't' || e.key === 'T') {
      if (e.target === document.body || (e.target as HTMLElement)?.closest('.stage-module')) {
        editMode.toggleCameraMode();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="stage-module" role="main" aria-label="Stage choreography editor">
  <div class="canvas-area">
    <div class="viewer-container">
      {#if editMode.cameraMode === 'orbit'}
        <StageViewer />
      {:else}
        <div class="top-down-canvas">
          <FormationOverlay {editMode} />
        </div>
      {/if}
    </div>

    <!-- Camera mode toggle -->
    <div class="mode-toolbar">
      <button
        type="button"
        class="mode-toggle"
        class:active={editMode.cameraMode === 'top-down'}
        onclick={() => editMode.toggleCameraMode()}
        aria-pressed={editMode.cameraMode === 'top-down'}
        aria-label="Toggle formation edit mode (T)"
        title="Toggle formation edit mode (T)"
      >
        <i class="fas {editMode.cameraMode === 'top-down' ? 'fa-cube' : 'fa-border-all'}" aria-hidden="true"></i>
        <span>{editMode.cameraMode === 'top-down' ? '3D View' : 'Edit'}</span>
      </button>
    </div>

    <StageTimeline {editMode} />
  </div>

  <StageSidebar {editMode} />
</div>

<style>
  .stage-module {
    display: grid;
    grid-template-columns: 1fr clamp(340px, 25vw, 480px);
    height: 100%;
    overflow: hidden;
    background: var(--color-bg-primary, #0a0b10);
  }

  .canvas-area {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .viewer-container {
    flex: 1;
    position: relative;
    min-height: 0;
  }

  .top-down-canvas {
    width: 100%;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-radius: var(--border-radius-lg, 12px);
    overflow: hidden;
    position: relative;
  }

  .mode-toolbar {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 10;
  }

  .mode-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 48px;
    padding: 8px 16px;
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    color: var(--theme-text-dim);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: all 150ms ease;
  }

  .mode-toggle.active {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    color: white;
  }

  .mode-toggle:hover:not(.active) {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  @media (prefers-reduced-motion: reduce) {
    .mode-toggle {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Delete old components that are no longer used**

Delete:
- `src/lib/features/stage/components/StageEditorPanel.svelte`
- `src/lib/features/stage/components/StageCanvas.svelte`
- `src/lib/features/stage/components/BeatTimeline.svelte`
- `src/lib/features/stage/components/PerformerDot.svelte`
- `src/lib/features/stage/components/PathLine.svelte`
- `src/lib/features/stage/components/Stage3DPreview.svelte`
- `src/lib/features/stage/components/LocomotingPerformer.svelte`

- [ ] **Step 3: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep "Error" | head -20`
Expected: Clean — all old imports replaced.

- [ ] **Step 4: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/stage/
git commit -m "feat(stage): assemble StageModule with grid layout, camera mode toggle, timeline

Deletes old global-formation components (StageEditorPanel, StageCanvas,
BeatTimeline, PerformerDot, PathLine, Stage3DPreview, LocomotingPerformer).
Replaces with v2 architecture: FormationOverlay + StageViewer + StageTimeline + StageSidebar.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 11: Initialize Default Choreography + Integration Test

**Files:**
- Modify: `src/lib/features/stage/state/stage-choreography-state.svelte.ts` (add init with preset)
- Create test or verify via dev server

- [ ] **Step 1: Add default initialization**

In `createStageChoreographyState`, after creating performers, apply a default preset so the stage isn't empty on load:

Add after the `choreography` initialization:

```typescript
// Apply default line preset on creation
const defaultPositions = generatePresetPositions(
  'line',
  DEFAULT_PERFORMER_COUNT,
  DEFAULT_STAGE_WIDTH,
  DEFAULT_STAGE_DEPTH
);
choreography.performers.forEach((performer, i) => {
  const pos = defaultPositions[i];
  if (pos) {
    performer.marks = [createMark(pos.x, pos.z, 0)];
  }
});
```

- [ ] **Step 2: Run build to verify everything compiles**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Run typecheck**

Run: `npm run check 2>&1 | tail -10`
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/stage/state/stage-choreography-state.svelte.ts
git commit -m "feat(stage): initialize default line formation on choreography creation

Performers start with marks[0] in line preset positions so the overlay
isn't empty on first load.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 12: Route Registration + Navigation Entry

**Files:**
- Determine where stage module is mounted in the app routing

- [ ] **Step 1: Find where stage module is referenced in navigation/routing**

Run: `grep -r "StageModule\|stage" src/routes/ src/lib/shared/navigation/ --include="*.svelte" --include="*.ts" -l`

- [ ] **Step 2: Verify stage module is accessible in the app**

If not already routed, add a route or tab entry. The existing `StageModule` is already imported somewhere — find it and ensure the import path is correct after the rewrite.

- [ ] **Step 3: Navigate to the stage module in dev server and verify it renders**

Run: `curl -s http://localhost:5173/ | grep -c "stage"` or verify via the existing routing.

- [ ] **Step 4: Commit any routing changes**

```bash
git add <routing-files>
git commit -m "fix(stage): update routing imports for v2 stage module

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 13: Final Build Verification + Cleanup

**Files:**
- All stage module files

- [ ] **Step 1: Full typecheck**

Run: `npm run check 2>&1 | tail -20`
Expected: 0 errors.

- [ ] **Step 2: Full build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Verify no stale imports reference deleted files**

Run: `grep -r "StageEditorPanel\|StageCanvas\|BeatTimeline\|PerformerDot\|PathLine\|Stage3DPreview\|LocomotingPerformer" src/ --include="*.svelte" --include="*.ts" -l`
Expected: No results.

- [ ] **Step 4: Verify the formation-interpolator old exports aren't referenced**

Run: `grep -r "interpolateFormation\|InterpolatedPose\|computeRequiredSpeed" src/ --include="*.svelte" --include="*.ts" -l`
Expected: Only `formation-interpolator.ts` itself (no external consumers).

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore(stage): final cleanup — remove stale references to old stage components

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Self-Review Checklist

| Spec Requirement | Task | Status |
|---|---|---|
| Per-performer marks data model | Task 1 (types), Task 3 (state) | Covered |
| UnifiedPlaybackContext implementation | Task 3 | Covered |
| Camera flip (orbit ↔ top-down) | Task 10 (mode toggle) | Covered (SVG-only v1; 3D camera flip deferred to when StageViewer integration is solid) |
| FormationOverlay SVG (dots, marks, paths, drag) | Task 6 | Covered |
| animation-timeline-js timeline | Task 7 | Covered |
| TransportControls reuse | Task 9 | Covered |
| BpmChips reuse | Task 9 | Covered |
| FormationSelector reuse | Task 9 | Covered |
| CollapsibleSection reuse | Task 9 | Covered |
| Mark properties (beats, walk style, position, delete) | Task 8 | Covered |
| Performer selection + multi-select | Task 2, Task 9 | Covered |
| Sidebar grid layout clamp(340px, 25vw, 480px) | Task 10 | Covered |
| Beat-synced playback | Task 3 | Covered |
| Walk style interpolation (direct/crab) | Task 3 | Covered |
| WCAG AAA (48px targets, focus-visible, aria, reduced-motion) | Tasks 6, 8, 9, 10 | Covered |
| Keyboard T for mode toggle | Task 10 | Covered |

**Deferred to Phase 2:**
- Camera smooth transition (setLookAt/setState with camera-controls) — requires 3D viewer integration which depends on how Viewer3DScene exposes per-performer transforms
- Context menu on timeline (right-click marks)
- Alignment toolbar (top/mid/btm, left/ctr/right, distribute)
- Stage settings section (dimensions, environment picker)
- Walk style indicator (⇄ icon) on overlay marks
