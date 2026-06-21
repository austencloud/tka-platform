# Mandala Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify mandala generation, collection, meditation, and export into a single first-class module at `/app/mandala` with four tabs.

**Architecture:** Create `src/lib/features/mandala/` with tab-based lazy loading. Migrate existing code from `mandala-generator/`, `mandala-collection/`, and sequence-viewer meditation. Register as a top-level module in navigation. Revert sequence-viewer MandalaPane to lightweight viewer.

**Tech Stack:** Svelte 5 (runes), TypeScript, Web Audio API, Canvas API, Firebase/Firestore

---

## File Map

### New Files
- `src/lib/features/mandala/MandalaModule.svelte` — Tab shell with lazy loading
- `src/lib/features/mandala/tabs/studio/StudioTab.svelte` — Wrapper around existing generator
- `src/lib/features/mandala/tabs/collection/CollectionTab.svelte` — Enhanced gallery with cross-tab actions
- `src/lib/features/mandala/tabs/meditate/MeditateTab.svelte` — Full-viewport meditation experience
- `src/lib/features/mandala/tabs/meditate/components/MandalaSelector.svelte` — Picks from defaults + collection
- `src/lib/features/mandala/tabs/meditate/components/MeditationOverlay.svelte` — Moved from sequence-viewer
- `src/lib/features/mandala/tabs/meditate/components/MeditationControls.svelte` — Renamed from MeditationPanel
- `src/lib/features/mandala/tabs/meditate/domain/meditation-types.ts` — Moved from sequence-viewer
- `src/lib/features/mandala/tabs/meditate/domain/default-mandalas.ts` — Curated mandala StepData[]
- `src/lib/features/mandala/tabs/meditate/services/meditation-audio.ts` — Moved from sequence-viewer
- `src/lib/features/mandala/tabs/meditate/state/meditation-session.svelte.ts` — Moved from sequence-viewer
- `src/lib/features/mandala/tabs/export/ExportTab.svelte` — MVP PNG download
- `src/lib/features/mandala/tabs/export/services/mandala-export.ts` — Export logic

### Moved Files (mandala-generator → mandala/tabs/studio/)
- `components/canvas/MandalaCanvas.svelte`
- `components/canvas/MandalaElementView.svelte`
- `components/canvas/GridDotOverlay.svelte`
- `components/controls/SymmetryControls.svelte`
- `components/panels/AssetLibrary.svelte`
- `components/MandalaGeneratorModule.svelte` (kept as internal component, wrapped by StudioTab)
- `domain/constants/preset-definitions.ts`
- `domain/constants/symmetry-constants.ts`
- `domain/enums/mandala-enums.ts`
- `domain/models/mandala-config.ts`
- `domain/models/mandala-element.ts`
- `domain/models/mandala-preset.ts`
- `services/contracts/types.ts`
- `services/mandala-transformer.ts`
- `state/mandala-controller.ts`
- `state/mandala-state.svelte.ts`

### Moved Files (mandala-collection → mandala/tabs/collection/)
- `components/MandalaCollectionCard.svelte`
- `components/MandalaCollectionGallery.svelte`
- `domain/mandala-collection-types.ts`
- `services/LocalMandalaCollectionRepository.ts`
- `services/FirebaseMandalaCollectionRepository.ts`
- `data/firestore-paths.ts`
- `state/mandala-collection-state.svelte.ts`

### Modified Files
- `src/lib/shared/navigation/config/module-definitions.ts` — Add mandala module, update migrations
- `src/lib/shared/navigation/config/tab-definitions.ts` — Add MANDALA_TABS, remove from LAB_TABS
- `src/lib/shared/modules/ModuleRenderer.svelte` — Add mandala loader, remove old mandala→lab redirect
- `src/lib/shared/auth/state/authState.svelte.ts` — Update import path
- `src/lib/shared/auth/services/auth-boot-orchestrator.ts` — Update import path
- `src/lib/features/create/shared/workspace-panel/sequence-display/components/WorkspaceGrid.svelte` — Update import path
- `src/routes/test/tip-point-playground/+page.svelte` — Update import path
- `src/routes/test/mandala-paths/+page.svelte` — Update import path
- `src/lib/shared/sequence-viewer/components/MandalaPane.svelte` — Strip meditation, revert to lightweight
- `src/lib/shared/sequence-viewer/components/MandalaViewerControls.svelte` — Remove meditate button
- `src/lib/features/lab/LabModule.svelte` — Remove mandala and mandala-collection entries

### Deleted Directories
- `src/lib/features/mandala-generator/` (after migration)
- `src/lib/features/mandala-collection/` (after migration)
- `src/lib/shared/sequence-viewer/domain/meditation-types.ts` (moved)
- `src/lib/shared/sequence-viewer/state/meditation-session.svelte.ts` (moved)
- `src/lib/shared/sequence-viewer/services/meditation-audio.ts` (moved)
- `src/lib/shared/sequence-viewer/components/MeditationPanel.svelte` (moved)
- `src/lib/shared/sequence-viewer/components/MeditationOverlay.svelte` (moved)

---

### Task 1: Create Module Shell + Register in Navigation

**Files:**
- Create: `src/lib/features/mandala/MandalaModule.svelte`
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts`
- Modify: `src/lib/shared/navigation/config/module-definitions.ts`
- Modify: `src/lib/shared/modules/ModuleRenderer.svelte`

- [ ] **Step 1: Create MANDALA_TABS in tab-definitions.ts**

Add after the existing imports at the top of the file, and export the new array. Find the end of existing tab arrays (after `STAGE_TABS`) and add:

```ts
export const MANDALA_TABS: Section[] = [
  {
    id: "studio",
    label: "Studio",
    icon: '<i class="fas fa-palette" aria-hidden="true"></i>',
    description: "Create and customize mandalas",
    color: "#f472b6",
    gradient: "linear-gradient(135deg, #f9a8d4 0%, #f472b6 100%)",
  },
  {
    id: "collection",
    label: "Collection",
    icon: '<i class="fas fa-layer-group" aria-hidden="true"></i>',
    description: "Your saved mandala library",
    color: "#e879f9",
    gradient: "linear-gradient(135deg, #e879f9 0%, #c084fc 100%)",
  },
  {
    id: "meditate",
    label: "Meditate",
    icon: '<i class="fas fa-spa" aria-hidden="true"></i>',
    description: "Guided breathing with mandalas",
    color: "#818cf8",
    gradient: "linear-gradient(135deg, #a5b4fc 0%, #818cf8 100%)",
  },
  {
    id: "export",
    label: "Export",
    icon: '<i class="fas fa-download" aria-hidden="true"></i>',
    description: "Download and print mandalas",
    color: "#34d399",
    gradient: "linear-gradient(135deg, #6ee7b7 0%, #34d399 100%)",
  },
];
```

Also **remove** the `mandala` and `mandala-collection` entries from `LAB_TABS` (lines 874-888 in current file).

- [ ] **Step 2: Add module definition in module-definitions.ts**

Import `MANDALA_TABS` in the import block at line 10 (add to existing imports from `"./tab-definitions"`).

In `MODULE_ID_MIGRATIONS` (line 37-57):
- **Remove** `mandala: "lab"` (line 51)
- **Add** `"mandala-generator": "mandala"` and `"mandala-collection": "mandala"`

In `MODULE_DEFINITIONS` array, add after the `compose` entry (before `watch`):

```ts
{
  id: "mandala",
  label: "Mandala",
  icon: '<i class="fas fa-dharmachakra" style="color: #f472b6;" aria-hidden="true"></i>',
  color: "#f472b6",
  description: "Create, collect, and meditate with mandalas",
  isMain: true,
  sections: MANDALA_TABS,
},
```

- [ ] **Step 3: Create MandalaModule.svelte**

```svelte
<script lang="ts">
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { MANDALA_TABS } from "$lib/shared/navigation/config/tab-definitions";

  const tabComponents: Record<string, () => Promise<{ default: any }>> = {
    studio: () => import("./tabs/studio/StudioTab.svelte"),
    collection: () => import("./tabs/collection/CollectionTab.svelte"),
    meditate: () => import("./tabs/meditate/MeditateTab.svelte"),
    export: () => import("./tabs/export/ExportTab.svelte"),
  };

  const activeTab = $derived(navigationState.activeTab || MANDALA_TABS[0]?.id || "studio");

  let TabComponent = $state<any>(null);
  let loadError = $state<string | null>(null);

  $effect(() => {
    const loader = tabComponents[activeTab];
    if (loader) {
      loadError = null;
      loader()
        .then((mod) => { TabComponent = mod.default; })
        .catch((err) => { loadError = err.message; });
    } else {
      TabComponent = null;
      loadError = `Unknown tab: ${activeTab}`;
    }
  });
</script>

<div class="mandala-module">
  {#if loadError}
    <div class="error-state">
      <p>Failed to load tab: {loadError}</p>
    </div>
  {:else if TabComponent}
    <TabComponent />
  {:else}
    <div class="loading-state">
      <div class="loading-spinner"></div>
    </div>
  {/if}
</div>

<style>
  .mandala-module {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: #f472b6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .error-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(255, 255, 255, 0.6);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
```

- [ ] **Step 4: Update ModuleRenderer.svelte**

In the `moduleLoaders` record (~line 159):
- **Change** `mandala: () => import("../../features/lab/LabModule.svelte"),` to:
  ```ts
  mandala: () => import("../../features/mandala/MandalaModule.svelte"),
  ```

- [ ] **Step 5: Create placeholder StudioTab.svelte**

Create `src/lib/features/mandala/tabs/studio/StudioTab.svelte`:

```svelte
<script lang="ts">
  import MandalaGeneratorModule from "$lib/features/mandala-generator/components/MandalaGeneratorModule.svelte";
</script>

<MandalaGeneratorModule />
```

(Temporary — imports from old path until Task 3 moves the files)

- [ ] **Step 6: Create placeholder CollectionTab.svelte**

Create `src/lib/features/mandala/tabs/collection/CollectionTab.svelte`:

```svelte
<script lang="ts">
  import MandalaCollectionGallery from "$lib/features/mandala-collection/components/MandalaCollectionGallery.svelte";
</script>

<MandalaCollectionGallery />
```

(Temporary — imports from old path until Task 4 moves the files)

- [ ] **Step 7: Create placeholder MeditateTab.svelte**

Create `src/lib/features/mandala/tabs/meditate/MeditateTab.svelte`:

```svelte
<div class="meditate-placeholder">
  <p>Meditate tab — coming in Task 6</p>
</div>

<style>
  .meditate-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(255, 255, 255, 0.5);
  }
</style>
```

- [ ] **Step 8: Create placeholder ExportTab.svelte**

Create `src/lib/features/mandala/tabs/export/ExportTab.svelte`:

```svelte
<div class="export-placeholder">
  <p>Export tab — coming in Task 7</p>
</div>

<style>
  .export-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(255, 255, 255, 0.5);
  }
</style>
```

- [ ] **Step 9: Remove mandala entries from Lab**

In `src/lib/features/lab/LabModule.svelte`, remove these two entries from `tabComponents`:
```ts
mandala: () =>
  import("$lib/features/mandala-generator/components/MandalaGeneratorModule.svelte"),
"mandala-collection": () =>
  import("$lib/features/mandala-collection/components/MandalaCollectionGallery.svelte"),
```

- [ ] **Step 10: Verify build**

Run: `npm run check`
Expected: No new type errors related to mandala module registration.

- [ ] **Step 11: Commit**

```bash
git add src/lib/features/mandala/MandalaModule.svelte src/lib/features/mandala/tabs/ src/lib/shared/navigation/config/module-definitions.ts src/lib/shared/navigation/config/tab-definitions.ts src/lib/shared/modules/ModuleRenderer.svelte src/lib/features/lab/LabModule.svelte
git commit -m "feat(mandala): create module shell with 4-tab navigation and register in nav system"
```

---

### Task 2: Migrate Studio Files (mandala-generator → mandala/tabs/studio/)

**Files:**
- Move: All files from `src/lib/features/mandala-generator/` → `src/lib/features/mandala/tabs/studio/`
- Modify: `src/lib/features/mandala/tabs/studio/StudioTab.svelte` — update import path

- [ ] **Step 1: Move all mandala-generator files**

```bash
# Move components
cp -r src/lib/features/mandala-generator/components/canvas src/lib/features/mandala/tabs/studio/components/
cp -r src/lib/features/mandala-generator/components/controls src/lib/features/mandala/tabs/studio/components/
cp -r src/lib/features/mandala-generator/components/panels src/lib/features/mandala/tabs/studio/components/
cp src/lib/features/mandala-generator/components/MandalaGeneratorModule.svelte src/lib/features/mandala/tabs/studio/components/

# Move domain
cp -r src/lib/features/mandala-generator/domain src/lib/features/mandala/tabs/studio/

# Move services
cp -r src/lib/features/mandala-generator/services src/lib/features/mandala/tabs/studio/

# Move state
cp -r src/lib/features/mandala-generator/state src/lib/features/mandala/tabs/studio/
```

- [ ] **Step 2: Update internal imports in MandalaGeneratorModule.svelte**

The moved `MandalaGeneratorModule.svelte` at `src/lib/features/mandala/tabs/studio/components/MandalaGeneratorModule.svelte` has these imports:

```ts
import { mandalaState } from "../state/mandala-state.svelte";
import { MandalaController } from "../state/mandala-controller";
import type { Point } from "../domain/models/mandala-element";
import { CANVAS_CENTER } from "../domain/constants/symmetry-constants";
import MandalaCanvas from "./canvas/MandalaCanvas.svelte";
import AssetLibrary from "./panels/AssetLibrary.svelte";
import SymmetryControls from "./controls/SymmetryControls.svelte";
```

These are all relative paths. Since the file moves from `mandala-generator/components/` to `mandala/tabs/studio/components/`, and sibling directories (state/, domain/) also move to `mandala/tabs/studio/`, the relative paths `../state/`, `../domain/`, `./canvas/`, `./panels/`, `./controls/` remain valid. **No import changes needed.**

- [ ] **Step 3: Update StudioTab.svelte**

Replace the placeholder content of `src/lib/features/mandala/tabs/studio/StudioTab.svelte`:

```svelte
<script lang="ts">
  import MandalaGeneratorModule from "./components/MandalaGeneratorModule.svelte";
</script>

<MandalaGeneratorModule />
```

- [ ] **Step 4: Verify build**

Run: `npm run check`
Expected: No new type errors. Studio tab loads the generator.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/mandala/tabs/studio/
git commit -m "feat(mandala): migrate studio tab from mandala-generator"
```

---

### Task 3: Migrate Collection Files (mandala-collection → mandala/tabs/collection/)

**Files:**
- Move: All files from `src/lib/features/mandala-collection/` → `src/lib/features/mandala/tabs/collection/`
- Modify: `src/lib/features/mandala/tabs/collection/CollectionTab.svelte`
- Modify: External consumers (4 files)

- [ ] **Step 1: Move all mandala-collection files**

```bash
# Move components
cp src/lib/features/mandala-collection/components/MandalaCollectionCard.svelte src/lib/features/mandala/tabs/collection/components/
cp src/lib/features/mandala-collection/components/MandalaCollectionGallery.svelte src/lib/features/mandala/tabs/collection/components/

# Move domain
mkdir -p src/lib/features/mandala/tabs/collection/domain
cp src/lib/features/mandala-collection/domain/mandala-collection-types.ts src/lib/features/mandala/tabs/collection/domain/

# Move services
mkdir -p src/lib/features/mandala/tabs/collection/services
cp src/lib/features/mandala-collection/services/LocalMandalaCollectionRepository.ts src/lib/features/mandala/tabs/collection/services/
cp src/lib/features/mandala-collection/services/FirebaseMandalaCollectionRepository.ts src/lib/features/mandala/tabs/collection/services/
cp src/lib/features/mandala-collection/data/firestore-paths.ts src/lib/features/mandala/tabs/collection/services/

# Move state
mkdir -p src/lib/features/mandala/tabs/collection/state
cp src/lib/features/mandala-collection/state/mandala-collection-state.svelte.ts src/lib/features/mandala/tabs/collection/state/
```

- [ ] **Step 2: Update internal imports within moved collection files**

In `src/lib/features/mandala/tabs/collection/state/mandala-collection-state.svelte.ts`:
```ts
// Change:
import type { CollectedMandala } from "../domain/mandala-collection-types";
// To: (same relative path — still valid after move)
```
The relative paths between files in the collection subtree are preserved. Internal imports don't change.

In `src/lib/features/mandala/tabs/collection/services/LocalMandalaCollectionRepository.ts`, check its import of `firestore-paths.ts`. Previously this was at `../data/firestore-paths.ts`. Now `firestore-paths.ts` is in the same `services/` directory, so update:
```ts
// Change:
import { FIRESTORE_PATHS } from "../data/firestore-paths";
// To:
import { FIRESTORE_PATHS } from "./firestore-paths";
```

Same fix in `FirebaseMandalaCollectionRepository.ts`:
```ts
// Change:
import { FIRESTORE_PATHS } from "../data/firestore-paths";
// To:
import { FIRESTORE_PATHS } from "./firestore-paths";
```

- [ ] **Step 3: Update CollectionTab.svelte**

Replace the placeholder:

```svelte
<script lang="ts">
  import MandalaCollectionGallery from "./components/MandalaCollectionGallery.svelte";
</script>

<MandalaCollectionGallery />
```

- [ ] **Step 4: Update external consumers**

**File: `src/lib/shared/auth/state/authState.svelte.ts` (line 567-568):**
```ts
// Change:
const { mandalaCollectionState } =
  await import("$lib/features/mandala-collection/state/mandala-collection-state.svelte");
// To:
const { mandalaCollectionState } =
  await import("$lib/features/mandala/tabs/collection/state/mandala-collection-state.svelte");
```

**File: `src/lib/shared/auth/services/auth-boot-orchestrator.ts` (line 107):**
```ts
// Change:
import("$lib/features/mandala-collection/state/mandala-collection-state.svelte")
// To:
import("$lib/features/mandala/tabs/collection/state/mandala-collection-state.svelte")
```

**File: `src/lib/features/create/shared/workspace-panel/sequence-display/components/WorkspaceGrid.svelte` (line 29):**
```ts
// Change:
import { mandalaCollectionState } from "$lib/features/mandala-collection/state/mandala-collection-state.svelte";
// To:
import { mandalaCollectionState } from "$lib/features/mandala/tabs/collection/state/mandala-collection-state.svelte";
```

**File: `src/routes/test/tip-point-playground/+page.svelte` (line 7):**
```ts
// Change:
import { mandalaCollectionState } from "$lib/features/mandala-collection/state/mandala-collection-state.svelte";
// To:
import { mandalaCollectionState } from "$lib/features/mandala/tabs/collection/state/mandala-collection-state.svelte";
```

**File: `src/routes/test/mandala-paths/+page.svelte` (line 6):**
```ts
// Change:
import { mandalaCollectionState } from "$lib/features/mandala-collection/state/mandala-collection-state.svelte";
// To:
import { mandalaCollectionState } from "$lib/features/mandala/tabs/collection/state/mandala-collection-state.svelte";
```

- [ ] **Step 5: Verify build**

Run: `npm run check`
Expected: No type errors from the import changes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/mandala/tabs/collection/ src/lib/shared/auth/ src/lib/features/create/ src/routes/test/
git commit -m "feat(mandala): migrate collection tab from mandala-collection + update consumers"
```

---

### Task 4: Migrate Meditation Files (sequence-viewer → mandala/tabs/meditate/)

**Files:**
- Move: `src/lib/shared/sequence-viewer/domain/meditation-types.ts` → `src/lib/features/mandala/tabs/meditate/domain/`
- Move: `src/lib/shared/sequence-viewer/state/meditation-session.svelte.ts` → `src/lib/features/mandala/tabs/meditate/state/`
- Move: `src/lib/shared/sequence-viewer/services/meditation-audio.ts` → `src/lib/features/mandala/tabs/meditate/services/`
- Move: `src/lib/shared/sequence-viewer/components/MeditationOverlay.svelte` → `src/lib/features/mandala/tabs/meditate/components/`
- Move: `src/lib/shared/sequence-viewer/components/MeditationPanel.svelte` → `src/lib/features/mandala/tabs/meditate/components/MeditationControls.svelte`

- [ ] **Step 1: Copy meditation files to new locations**

```bash
cp src/lib/shared/sequence-viewer/domain/meditation-types.ts src/lib/features/mandala/tabs/meditate/domain/
cp src/lib/shared/sequence-viewer/state/meditation-session.svelte.ts src/lib/features/mandala/tabs/meditate/state/
cp src/lib/shared/sequence-viewer/services/meditation-audio.ts src/lib/features/mandala/tabs/meditate/services/
cp src/lib/shared/sequence-viewer/components/MeditationOverlay.svelte src/lib/features/mandala/tabs/meditate/components/
cp src/lib/shared/sequence-viewer/components/MeditationPanel.svelte src/lib/features/mandala/tabs/meditate/components/MeditationControls.svelte
```

- [ ] **Step 2: Fix import paths in moved files**

**`meditation-session.svelte.ts`** — currently imports from `"$lib/shared/sequence-viewer/domain/meditation-types"`. Update:
```ts
// Change:
import type { ... } from "$lib/shared/sequence-viewer/domain/meditation-types";
import { getPatternCycleTime } from "$lib/shared/sequence-viewer/domain/meditation-types";
// To:
import type { ... } from "../domain/meditation-types";
import { getPatternCycleTime } from "../domain/meditation-types";
```

**`MeditationControls.svelte`** (was MeditationPanel) — currently imports from `"../domain/meditation-types"`. Since it moved from `sequence-viewer/components/` to `mandala/tabs/meditate/components/`, the relative path to the new domain location is still `"../domain/meditation-types"`. **No change needed.**

**`MeditationOverlay.svelte`** — imports from `"../domain/meditation-types"`. Same situation as above. **No change needed.**

**`meditation-audio.ts`** — imports from `"$lib/shared/sequence-viewer/domain/meditation-types"`. Update:
```ts
// Change:
import type { AmbientTrack } from "$lib/shared/sequence-viewer/domain/meditation-types";
// To:
import type { AmbientTrack } from "../domain/meditation-types";
```

**`meditation-types.ts`** — imports from `"$lib/shared/mandala/components/SequenceMandala.svelte"`. This path is still valid (it references shared infra). **No change needed.**

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No new type errors. Old sequence-viewer files still exist at this point (cleaned up in Task 8).

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/mandala/tabs/meditate/
git commit -m "feat(mandala): migrate meditation domain/state/services from sequence-viewer"
```

---

### Task 5: Create Default Mandalas Data

**Files:**
- Create: `src/lib/features/mandala/tabs/meditate/domain/default-mandalas.ts`

- [ ] **Step 1: Create curated default mandalas**

These are pre-built `StepData[]` arrays that produce high-symmetry, visually pleasing mandalas for meditation. We use simple letter sequences with even radial distribution.

```ts
import type { StepData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface DefaultMandala {
  id: string;
  name: string;
  steps: StepData[];
  variant: "blue" | "red" | "both";
  bluePropType: string;
  redPropType: string;
}

/**
 * Curated mandalas designed for breathing meditation:
 * high symmetry, smooth paths, calming visual rhythm.
 *
 * These are minimal StepData arrays — the mandala renderer
 * computes geometry from positions and orientations.
 */
export const DEFAULT_MANDALAS: DefaultMandala[] = [
  {
    id: "default-radial-8",
    name: "Radial Bloom",
    steps: generateRadialSteps(8),
    variant: "both",
    bluePropType: "staff",
    redPropType: "staff",
  },
  {
    id: "default-spiral-6",
    name: "Spiral Flow",
    steps: generateSpiralSteps(6),
    variant: "both",
    bluePropType: "staff",
    redPropType: "staff",
  },
  {
    id: "default-lotus-12",
    name: "Lotus",
    steps: generateRadialSteps(12),
    variant: "both",
    bluePropType: "staff",
    redPropType: "staff",
  },
  {
    id: "default-wave-4",
    name: "Wave",
    steps: generateWaveSteps(4),
    variant: "both",
    bluePropType: "staff",
    redPropType: "staff",
  },
  {
    id: "default-star-16",
    name: "Star",
    steps: generateRadialSteps(16),
    variant: "both",
    bluePropType: "staff",
    redPropType: "staff",
  },
];

function generateRadialSteps(count: number): StepData[] {
  const positions = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
  const orientations = ["in", "out", "cw", "ccw"];
  const steps: StepData[] = [];

  for (let i = 0; i < count; i++) {
    const posIdx = i % positions.length;
    const oriIdx = i % orientations.length;
    steps.push({
      beat: i + 1,
      letter: "A",
      startPosition: positions[posIdx],
      endPosition: positions[(posIdx + 1) % positions.length],
      blueStartOri: orientations[oriIdx],
      blueEndOri: orientations[(oriIdx + 1) % orientations.length],
      redStartOri: orientations[(oriIdx + 2) % orientations.length],
      redEndOri: orientations[(oriIdx + 3) % orientations.length],
      blueStartLoc: positions[posIdx],
      blueEndLoc: positions[(posIdx + 2) % positions.length],
      redStartLoc: positions[(posIdx + 4) % positions.length],
      redEndLoc: positions[(posIdx + 6) % positions.length],
    } as unknown as StepData);
  }
  return steps;
}

function generateSpiralSteps(count: number): StepData[] {
  const positions = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
  const steps: StepData[] = [];

  for (let i = 0; i < count; i++) {
    const posIdx = i % positions.length;
    steps.push({
      beat: i + 1,
      letter: "B",
      startPosition: positions[posIdx],
      endPosition: positions[(posIdx + 3) % positions.length],
      blueStartOri: "cw",
      blueEndOri: "cw",
      redStartOri: "ccw",
      redEndOri: "ccw",
      blueStartLoc: positions[posIdx],
      blueEndLoc: positions[(posIdx + 3) % positions.length],
      redStartLoc: positions[(posIdx + 4) % positions.length],
      redEndLoc: positions[(posIdx + 7) % positions.length],
    } as unknown as StepData);
  }
  return steps;
}

function generateWaveSteps(count: number): StepData[] {
  const positions = ["n", "e", "s", "w"];
  const steps: StepData[] = [];

  for (let i = 0; i < count; i++) {
    steps.push({
      beat: i + 1,
      letter: "C",
      startPosition: positions[i % positions.length],
      endPosition: positions[(i + 1) % positions.length],
      blueStartOri: i % 2 === 0 ? "in" : "out",
      blueEndOri: i % 2 === 0 ? "out" : "in",
      redStartOri: i % 2 === 0 ? "out" : "in",
      redEndOri: i % 2 === 0 ? "in" : "out",
      blueStartLoc: positions[i % positions.length],
      blueEndLoc: positions[(i + 1) % positions.length],
      redStartLoc: positions[(i + 2) % positions.length],
      redEndLoc: positions[(i + 3) % positions.length],
    } as unknown as StepData);
  }
  return steps;
}
```

**Note:** These generate minimal StepData structures that the MandalaGeometryCalculator can process. The `as unknown as StepData` casts are needed because we only populate the fields the mandala renderer uses. The actual `StepData` interface has many more optional fields for animation. This approach avoids importing the full sequence generation pipeline.

- [ ] **Step 2: Verify build**

Run: `npm run check`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/mandala/tabs/meditate/domain/default-mandalas.ts
git commit -m "feat(mandala): add curated default mandalas for meditation"
```

---

### Task 6: Create MeditateTab (Full-Viewport Experience)

**Files:**
- Replace: `src/lib/features/mandala/tabs/meditate/MeditateTab.svelte`
- Create: `src/lib/features/mandala/tabs/meditate/components/MandalaSelector.svelte`

- [ ] **Step 1: Create MandalaSelector.svelte**

```svelte
<script lang="ts">
  import { mandalaCollectionState } from "$lib/features/mandala/tabs/collection/state/mandala-collection-state.svelte";
  import { DEFAULT_MANDALAS, type DefaultMandala } from "../domain/default-mandalas";
  import type { CollectedMandala } from "$lib/features/mandala/tabs/collection/domain/mandala-collection-types";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";

  interface Props {
    onSelect: (steps: any[], name: string, bluePropType: string, redPropType: string) => void;
  }

  let { onSelect }: Props = $props();

  const collectionMandalas = $derived(mandalaCollectionState.collection);

  function selectDefault(m: DefaultMandala) {
    onSelect(m.steps, m.name, m.bluePropType, m.redPropType);
  }

  function selectCollection(m: CollectedMandala) {
    onSelect(m.steps, m.name, m.bluePropType, m.redPropType);
  }

  function selectRandom() {
    const all = [...DEFAULT_MANDALAS];
    const pick = all[Math.floor(Math.random() * all.length)];
    if (pick) selectDefault(pick);
  }
</script>

<div class="mandala-selector">
  <div class="selector-header">
    <h3>Choose a Mandala</h3>
    <button type="button" class="random-btn" onclick={selectRandom}>
      <i class="fas fa-random" aria-hidden="true"></i>
      Random
    </button>
  </div>

  <section class="selector-section">
    <h4>Curated</h4>
    <div class="selector-grid">
      {#each DEFAULT_MANDALAS as mandala (mandala.id)}
        <button
          type="button"
          class="selector-card"
          onclick={() => selectDefault(mandala)}
          aria-label="Select {mandala.name}"
        >
          <div class="card-preview">
            <SequenceMandala
              sequence={{ steps: mandala.steps, word: mandala.name }}
              size={80}
              bluePropType={mandala.bluePropType}
              redPropType={mandala.redPropType}
              mode="card-back"
              style="stroke"
              show={mandala.variant}
            />
          </div>
          <span class="card-name">{mandala.name}</span>
        </button>
      {/each}
    </div>
  </section>

  {#if collectionMandalas.length > 0}
    <section class="selector-section">
      <h4>Your Collection</h4>
      <div class="selector-grid">
        {#each collectionMandalas as mandala (mandala.id)}
          <button
            type="button"
            class="selector-card"
            onclick={() => selectCollection(mandala)}
            aria-label="Select {mandala.name}"
          >
            <div class="card-preview">
              <SequenceMandala
                sequence={{ steps: mandala.steps, word: mandala.name }}
                size={80}
                bluePropType={mandala.bluePropType}
                redPropType={mandala.redPropType}
                mode="card-back"
                style="stroke"
                show={mandala.variant}
              />
            </div>
            <span class="card-name">{mandala.name}</span>
          </button>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .mandala-selector {
    padding: 24px;
    overflow-y: auto;
    max-height: 100%;
  }

  .selector-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .selector-header h3 {
    font-size: 18px;
    font-weight: 600;
    color: white;
    margin: 0;
  }

  .random-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    cursor: pointer;
    min-height: 44px;
  }

  .random-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .selector-section {
    margin-bottom: 24px;
  }

  .selector-section h4 {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 12px;
  }

  .selector-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
  }

  .selector-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: 44px;
  }

  .selector-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(244, 114, 182, 0.4);
  }

  .selector-card:focus-visible {
    outline: 2px solid #f472b6;
    outline-offset: 2px;
  }

  .card-preview {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-name {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    text-align: center;
  }
</style>
```

- [ ] **Step 2: Create MeditateTab.svelte**

Replace the placeholder with the full implementation:

```svelte
<script lang="ts">
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import MandalaSelector from "./components/MandalaSelector.svelte";
  import MeditationControls from "./components/MeditationControls.svelte";
  import MeditationOverlay from "./components/MeditationOverlay.svelte";
  import { createMeditationSession } from "./state/meditation-session.svelte";
  import { createMeditationAudioService } from "./services/meditation-audio";
  import { getPatternCycleTime, type BreathingPattern, type AmbientTrack } from "./domain/meditation-types";
  import type { UndulationEasing } from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import { onMount } from "svelte";

  type MeditatePhase = "select" | "configure" | "session";

  let phase: MeditatePhase = $state("select");

  // Selected mandala
  let selectedSteps: any[] = $state([]);
  let selectedName: string = $state("");
  let selectedBlueProp: string = $state("staff");
  let selectedRedProp: string = $state("staff");

  // Session
  const meditationSession = createMeditationSession();
  let audioService: ReturnType<typeof createMeditationAudioService> | null = null;

  onMount(() => {
    audioService = createMeditationAudioService();
    return () => {
      audioService?.dispose();
      meditationSession.dispose();
    };
  });

  const reducedMotion = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  // Animation params
  const ANIMATE_MIN = 0;
  const ANIMATE_MAX = 250;
  const BASE_PERIOD = 5;

  const effectiveAnimatePeriod = $derived.by((): number => {
    if (meditationSession.status === "running" && meditationSession.pattern) {
      return getPatternCycleTime(meditationSession.pattern);
    }
    return BASE_PERIOD;
  });

  const effectiveAnimateEasing = $derived.by((): UndulationEasing => {
    if (meditationSession.status === "running" && meditationSession.pattern) {
      return meditationSession.pattern.defaultEasing;
    }
    return "breathe";
  });

  const effectiveRotation = $derived.by((): number => {
    if (reducedMotion) return 0;
    return 90;
  });

  const effectiveTipDx = $derived.by((): number | undefined => {
    if (meditationSession.holdPulseDx !== undefined) {
      return meditationSession.holdPulseDx;
    }
    return undefined;
  });

  // Handlers
  function handleMandalaSelect(steps: any[], name: string, blueProp: string, redProp: string) {
    selectedSteps = steps;
    selectedName = name;
    selectedBlueProp = blueProp;
    selectedRedProp = redProp;
    phase = "configure";
  }

  function handleStart(pattern: BreathingPattern, durationMinutes: number) {
    phase = "session";
    meditationSession.start(
      pattern,
      durationMinutes,
      ANIMATE_MIN,
      ANIMATE_MAX,
      handleSessionComplete,
    );
  }

  function handleSessionComplete() {
    audioService?.playCompletionBell();
    audioService?.stopAmbient();
  }

  function handleStop() {
    meditationSession.stop();
    audioService?.stopAmbient();
    phase = "configure";
  }

  function handleExit() {
    if (meditationSession.status === "running") {
      meditationSession.stop();
    }
    audioService?.stopAmbient();
    phase = "select";
  }

  function handleAmbientChange(track: AmbientTrack) {
    if (track === "none") {
      audioService?.stopAmbient();
    } else {
      audioService?.startAmbient(track);
    }
  }

  function handleVolumeChange(vol: number) {
    audioService?.setVolume(vol);
  }

  function handleMeditateAgain() {
    if (meditationSession.pattern) {
      handleStart(meditationSession.pattern, meditationSession.durationMinutes);
    }
  }

  function handleNewMandala() {
    meditationSession.stop();
    audioService?.stopAmbient();
    phase = "select";
  }

  function handleBackToCollection() {
    handleExit();
  }

  let containerSize: number = $state(600);
  let stageEl: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (!stageEl) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      containerSize = Math.floor(Math.min(width, height));
    });
    observer.observe(stageEl);
    return () => observer.disconnect();
  });
</script>

<div class="meditate-tab">
  {#if phase === "select"}
    <MandalaSelector onSelect={handleMandalaSelect} />
  {:else if phase === "configure"}
    <div class="configure-layout">
      <div class="configure-preview" bind:this={stageEl}>
        <SequenceMandala
          sequence={{ steps: selectedSteps, word: selectedName }}
          animate={true}
          animateMin={ANIMATE_MIN}
          animateMax={ANIMATE_MAX}
          animatePeriod={BASE_PERIOD}
          animateEasing="breathe"
          animateRotation={reducedMotion ? 0 : 90}
          size={containerSize}
          bluePropType={selectedBlueProp}
          redPropType={selectedRedProp}
          mode="card-back"
          style="stroke"
          show="both"
        />
      </div>
      <aside class="configure-controls">
        <MeditationControls
          status={meditationSession.status}
          onStart={handleStart}
          onStop={handleStop}
          onExit={handleExit}
          onAmbientChange={handleAmbientChange}
          onVolumeChange={handleVolumeChange}
        />
      </aside>
    </div>
  {:else}
    <div class="session-viewport" bind:this={stageEl}>
      <SequenceMandala
        sequence={{ steps: selectedSteps, word: selectedName }}
        animate={true}
        animateMin={ANIMATE_MIN}
        animateMax={ANIMATE_MAX}
        animatePeriod={effectiveAnimatePeriod}
        animateEasing={effectiveAnimateEasing}
        animateRotation={effectiveRotation}
        size={containerSize}
        bluePropType={selectedBlueProp}
        redPropType={selectedRedProp}
        mode="card-back"
        style="stroke"
        show="both"
        tipDx={effectiveTipDx}
      />

      <MeditationOverlay
        status={meditationSession.status}
        currentPhase={meditationSession.currentPhase}
        phaseElapsed={meditationSession.phaseElapsed}
        phaseDuration={meditationSession.phaseDuration}
        pattern={meditationSession.pattern}
        elapsedSeconds={meditationSession.elapsedSeconds}
        durationMinutes={meditationSession.durationMinutes}
        breathCount={meditationSession.breathCount}
        onMeditateAgain={handleMeditateAgain}
        onBackToMandala={handleBackToCollection}
      />
    </div>
  {/if}
</div>

<style>
  .meditate-tab {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000;
  }

  .configure-layout {
    display: flex;
    width: 100%;
    height: 100%;
  }

  .configure-preview {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }

  .configure-controls {
    flex-shrink: 0;
    width: fit-content;
    height: 100%;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    backdrop-filter: blur(12px);
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .session-viewport {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  @media (max-width: 640px) {
    .configure-layout {
      flex-direction: column;
    }

    .configure-controls {
      width: 100%;
      height: auto;
      max-height: 50%;
      border-left: none;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }
  }
</style>
```

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/mandala/tabs/meditate/MeditateTab.svelte src/lib/features/mandala/tabs/meditate/components/MandalaSelector.svelte
git commit -m "feat(mandala): implement full-viewport MeditateTab with mandala selector"
```

---

### Task 7: Create Export Tab (MVP PNG)

**Files:**
- Create: `src/lib/features/mandala/tabs/export/services/mandala-export.ts`
- Replace: `src/lib/features/mandala/tabs/export/ExportTab.svelte`

- [ ] **Step 1: Create mandala-export.ts**

```ts
import { getMandalaGeometryCalculator } from "$lib/shared/mandala/getMandalaGeometryCalculator";
import { renderMandalaSVG } from "$lib/shared/mandala/services/mandala-renderer";

export interface ExportOptions {
  size: number;
  background: "transparent" | "black" | "white";
  strokeWidth: number;
}

export async function exportMandalaPNG(
  steps: any[],
  bluePropType: string,
  redPropType: string,
  options: ExportOptions,
): Promise<Blob> {
  const { size, background, strokeWidth } = options;

  const calculator = getMandalaGeometryCalculator();
  const paths = calculator.calculate(steps, bluePropType, redPropType);

  const svgStr = renderMandalaSVG(paths, {
    size,
    style: "stroke",
    show: "both",
    showGridDots: false,
    transparentBackground: background === "transparent",
    strokeWidth,
  });

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  if (background !== "transparent") {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
  }

  const img = new Image();
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG render failed"));
    };
    img.src = url;
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas toBlob failed"));
      },
      "image/png",
    );
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Create ExportTab.svelte**

Replace the placeholder:

```svelte
<script lang="ts">
  import { mandalaCollectionState } from "$lib/features/mandala/tabs/collection/state/mandala-collection-state.svelte";
  import { DEFAULT_MANDALAS } from "$lib/features/mandala/tabs/meditate/domain/default-mandalas";
  import { exportMandalaPNG, downloadBlob, type ExportOptions } from "./services/mandala-export";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";

  // Source selection
  type SourceItem = { id: string; name: string; steps: any[]; bluePropType: string; redPropType: string };

  const sources = $derived.by((): SourceItem[] => {
    const items: SourceItem[] = DEFAULT_MANDALAS.map((m) => ({
      id: m.id, name: m.name, steps: m.steps,
      bluePropType: m.bluePropType, redPropType: m.redPropType,
    }));
    for (const m of mandalaCollectionState.collection) {
      items.push({
        id: m.id, name: m.name, steps: m.steps,
        bluePropType: m.bluePropType, redPropType: m.redPropType,
      });
    }
    return items;
  });

  let selectedId: string = $state(DEFAULT_MANDALAS[0]?.id ?? "");
  const selected = $derived(sources.find((s) => s.id === selectedId) ?? sources[0]);

  // Options
  let resolution: number = $state(2);
  let background: "transparent" | "black" | "white" = $state("black");
  let strokeWidth: number = $state(2.5);

  const exportSize = $derived(540 * resolution);
  let exporting: boolean = $state(false);

  async function handleExport() {
    if (!selected || exporting) return;
    exporting = true;
    try {
      const opts: ExportOptions = { size: exportSize, background, strokeWidth };
      const blob = await exportMandalaPNG(
        selected.steps, selected.bluePropType, selected.redPropType, opts,
      );
      downloadBlob(blob, `mandala-${selected.name.toLowerCase().replace(/\s+/g, "-")}-${exportSize}px.png`);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      exporting = false;
    }
  }
</script>

<div class="export-tab">
  <aside class="export-controls">
    <h3>Export Mandala</h3>

    <div class="control-group">
      <label for="export-source">Source</label>
      <select id="export-source" bind:value={selectedId}>
        {#each sources as source (source.id)}
          <option value={source.id}>{source.name}</option>
        {/each}
      </select>
    </div>

    <div class="control-group">
      <label>Resolution</label>
      <div class="chip-row">
        {#each [1, 2, 4] as mult}
          <button
            type="button"
            class="chip"
            class:active={resolution === mult}
            onclick={() => { resolution = mult; }}
          >{mult}x ({540 * mult}px)</button>
        {/each}
      </div>
    </div>

    <div class="control-group">
      <label>Background</label>
      <div class="chip-row">
        {#each ["transparent", "black", "white"] as bg}
          <button
            type="button"
            class="chip"
            class:active={background === bg}
            onclick={() => { background = bg as typeof background; }}
          >{bg}</button>
        {/each}
      </div>
    </div>

    <div class="control-group">
      <label for="export-stroke">Stroke Width: {strokeWidth}</label>
      <input
        id="export-stroke"
        type="range"
        min="0.5"
        max="5"
        step="0.5"
        bind:value={strokeWidth}
      />
    </div>

    <button
      type="button"
      class="export-btn"
      onclick={handleExport}
      disabled={exporting || !selected}
    >
      {exporting ? "Exporting..." : "Download PNG"}
    </button>
  </aside>

  <div class="export-preview">
    {#if selected}
      <SequenceMandala
        sequence={{ steps: selected.steps, word: selected.name }}
        size={400}
        bluePropType={selected.bluePropType}
        redPropType={selected.redPropType}
        mode="card-back"
        style="stroke"
        show="both"
        strokeWidth={strokeWidth}
      />
    {/if}
    <p class="preview-label">{exportSize} x {exportSize} px</p>
  </div>
</div>

<style>
  .export-tab {
    display: flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .export-controls {
    width: 280px;
    flex-shrink: 0;
    padding: 24px;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .export-controls h3 {
    font-size: 16px;
    font-weight: 600;
    color: white;
    margin: 0;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .control-group label {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .control-group select {
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: white;
    font-size: 14px;
    min-height: 44px;
  }

  .chip-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .chip {
    padding: 6px 12px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    cursor: pointer;
    min-height: 32px;
  }

  .chip.active {
    background: color-mix(in srgb, #f472b6 25%, rgba(0, 0, 0, 0.4));
    border-color: #f472b6;
    color: white;
  }

  .control-group input[type="range"] {
    width: 100%;
    accent-color: #f472b6;
  }

  .export-btn {
    padding: 12px 20px;
    border-radius: 10px;
    background: color-mix(in srgb, #34d399 35%, rgba(0, 0, 0, 0.4));
    border: 1px solid color-mix(in srgb, #34d399 60%, transparent);
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    min-height: 44px;
    margin-top: auto;
  }

  .export-btn:hover:not(:disabled) {
    background: color-mix(in srgb, #34d399 50%, rgba(0, 0, 0, 0.4));
  }

  .export-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .export-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: #000;
  }

  .preview-label {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.4);
    margin: 0;
  }

  @media (max-width: 640px) {
    .export-tab {
      flex-direction: column-reverse;
    }

    .export-controls {
      width: 100%;
      max-height: 50%;
      border-right: none;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }
  }
</style>
```

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/mandala/tabs/export/
git commit -m "feat(mandala): implement Export tab with PNG download"
```

---

### Task 8: Revert Sequence Viewer MandalaPane (Strip Meditation)

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/MandalaPane.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/MandalaViewerControls.svelte`

- [ ] **Step 1: Revert MandalaPane.svelte**

Remove all meditation imports, state, and handlers. Keep the pure viewer functionality. The script section should be:

```svelte
<script lang="ts">
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import MandalaViewerControls from "./MandalaViewerControls.svelte";
  import type { MandalaColorMode, MandalaPresetId } from "./MandalaViewerControls.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { MandalaPathShape, UndulationEasing } from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import type { MandalaPalette } from "$lib/shared/mandala/domain/mandala-types";
  import { getMandalaGeometryCalculator } from "$lib/shared/mandala/getMandalaGeometryCalculator";
  import { renderMandalaSVG } from "$lib/shared/mandala/services/mandala-renderer";
  import type { MandalaPathOptions } from "$lib/shared/mandala/services/contracts/types";

  interface Props {
    sequence: SequenceData;
    bluePropType?: string;
    redPropType?: string;
  }

  let { sequence, bluePropType, redPropType }: Props = $props();

  let stageEl: HTMLDivElement | undefined = $state();
  let containerSize: number = $state(400);

  let paused: boolean = $state(false);
  let pathShape: MandalaPathShape = $state("arc");
  let rotation: number = $state(90);
  let speed: number = $state(1);
  let depth: number = $state(100);
  let colorMode: MandalaColorMode = $state("flow");
  let preset: MandalaPresetId = $state("aurora");
  let customBlue: string = $state("#4fc3f7");
  let customRed: string = $state("#ef5350");
  let lineWeight: number = $state(2.5);
  const bgColor = "#000000";
  let exporting: boolean = $state(false);

  const BASE_PERIOD = 5;
  const period = $derived(BASE_PERIOD / speed);
  const rangeMax = $derived(depth * 2.5);
```

Remove these deleted items:
- All `meditation*` imports (`createMeditationSession`, `createMeditationAudioService`, `getPatternCycleTime`, `BreathingPattern`, `AmbientTrack`)
- `import { onMount } from "svelte"` (only if nothing else needs it — the download logic doesn't need onMount)
- `meditationMode` state
- `meditationSession` creation
- `audioService` and `onMount` block
- `effectiveAnimatePeriod`, `effectiveAnimateEasing`, `effectiveRotation`, `effectiveTipDx` deriveds
- All meditation handlers (`enterMeditationMode`, `exitMeditationMode`, `handleMeditationStart`, `handleSessionComplete`, `handleMeditationStop`, `handleAmbientChange`, `handleVolumeChange`, `handleMeditateAgain`, `handleBackToMandala`)
- In the template: the `{#if meditationMode}` / `MeditationOverlay` block, and the `{#if meditationMode}` / `MeditationPanel` / `{:else}` wrapping in the controls rail

The template should be simplified to just:
```svelte
<div class="mandala-pane" style:background={bgColor}>
  <div class="mandala-stage" bind:this={stageEl}>
    <SequenceMandala
      {sequence}
      animate={!paused}
      animateMin={0}
      animateMax={rangeMax}
      animatePeriod={period}
      animateEasing="breathe"
      animateRotation={rotation}
      {pathShape}
      size={containerSize}
      {bluePropType}
      {redPropType}
      mode="card-back"
      style="stroke"
      show="both"
      {palette}
      strokeWidth={lineWeight}
      gradient={gradientColors}
    />
  </div>

  <aside class="controls-rail">
    <MandalaViewerControls
      {paused}
      {pathShape}
      {rotation}
      {speed}
      {depth}
      {colorMode}
      {preset}
      {customBlue}
      {customRed}
      strokeWidth={lineWeight}
      onPausedChange={(v) => { paused = v; }}
      onPathShapeChange={(v) => { pathShape = v; }}
      onRotationChange={(v) => { rotation = v; }}
      onSpeedChange={(v) => { speed = v; }}
      onDepthChange={(v) => { depth = v; }}
      onColorModeChange={(v) => { colorMode = v; }}
      onPresetChange={(v) => { preset = v; }}
      onCustomBlueChange={(v) => { customBlue = v; }}
      onCustomRedChange={(v) => { customRed = v; }}
      onStrokeWidthChange={(v) => { lineWeight = v; }}
      onDownload={exporting ? undefined : handleDownload}
    />
  </aside>
</div>
```

Keep all the color palette logic (PRESET_COLORS, getPresetPair, getPresetMorph, color helpers, the flow effect, `palette` derived, `gradientColors` derived, the ResizeObserver, the `handleDownload` function, `svgToCanvas`, etc.)

- [ ] **Step 2: Remove meditate button from MandalaViewerControls**

In `src/lib/shared/sequence-viewer/components/MandalaViewerControls.svelte`:
- Remove `onMeditateClick?: () => void` from the Props interface
- Remove the destructuring of `onMeditateClick` from props
- Remove the meditate button from the template (the `<button class="meditate-btn">` element)
- Remove `.meditate-btn` CSS styles

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No type errors. The sequence viewer's mandala pane is back to a pure viewer.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/MandalaPane.svelte src/lib/shared/sequence-viewer/components/MandalaViewerControls.svelte
git commit -m "refactor(viewer): revert MandalaPane to lightweight viewer, remove meditation"
```

---

### Task 9: Delete Old Directories + Orphaned Meditation Files

**Files:**
- Delete: `src/lib/features/mandala-generator/` (entire directory)
- Delete: `src/lib/features/mandala-collection/` (entire directory)
- Delete: `src/lib/shared/sequence-viewer/domain/meditation-types.ts`
- Delete: `src/lib/shared/sequence-viewer/state/meditation-session.svelte.ts`
- Delete: `src/lib/shared/sequence-viewer/services/meditation-audio.ts`
- Delete: `src/lib/shared/sequence-viewer/components/MeditationPanel.svelte`
- Delete: `src/lib/shared/sequence-viewer/components/MeditationOverlay.svelte`
- Delete: `static/audio/meditation/AUDIO_FILES_NEEDED.md` (move to new location)

- [ ] **Step 1: Move audio doc**

```bash
mv static/audio/meditation/AUDIO_FILES_NEEDED.md src/lib/features/mandala/tabs/meditate/AUDIO_FILES_NEEDED.md
```

- [ ] **Step 2: Delete old mandala-generator directory**

```bash
rm -rf src/lib/features/mandala-generator
```

- [ ] **Step 3: Delete old mandala-collection directory**

```bash
rm -rf src/lib/features/mandala-collection
```

- [ ] **Step 4: Delete orphaned meditation files from sequence-viewer**

```bash
rm src/lib/shared/sequence-viewer/domain/meditation-types.ts
rm src/lib/shared/sequence-viewer/state/meditation-session.svelte.ts
rm src/lib/shared/sequence-viewer/services/meditation-audio.ts
rm src/lib/shared/sequence-viewer/components/MeditationPanel.svelte
rm src/lib/shared/sequence-viewer/components/MeditationOverlay.svelte
```

- [ ] **Step 5: Verify build**

Run: `npm run check`
Expected: No type errors. All imports now resolve to new paths.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(mandala): delete old mandala-generator, mandala-collection, and orphaned meditation files"
```

---

### Task 10: Final Verification + Add source Field to Collection Types

**Files:**
- Modify: `src/lib/features/mandala/tabs/collection/domain/mandala-collection-types.ts`

- [ ] **Step 1: Add source field to CollectedMandala**

In `src/lib/features/mandala/tabs/collection/domain/mandala-collection-types.ts`, add to the `CollectedMandala` interface:

```ts
source?: "studio" | "sequence" | "default";
```

And update the Zod schema if it validates the shape:

```ts
// Add to schema:
source: z.enum(["studio", "sequence", "default"]).optional(),
```

- [ ] **Step 2: Full build verification**

Run: `npm run check`
Expected: Zero new type errors.

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/mandala/tabs/collection/domain/mandala-collection-types.ts
git commit -m "feat(mandala): add source field to CollectedMandala type"
```

---

## Post-Implementation Notes

- **Audio files** still need sourcing (ocean, forest, chimes, singing-bowl, bell-complete in .ogg + .mp3). The service gracefully degrades without them.
- **Default mandalas** use synthetic StepData. After integration, verify they produce visually pleasing results in the mandala renderer. If they don't look good, replace with real sequences from the database.
- **Path Mandala Lab** (`src/lib/features/lab/tabs/PathMandalaLab.svelte`) remains in Lab — it's a separate experimental tool for tuning tip-path overlap, not part of the mandala creation workflow.
- **sticker-lab** remains independent — it's a separate export workflow.
