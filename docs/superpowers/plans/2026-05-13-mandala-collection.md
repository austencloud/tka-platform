# Mandala Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Right-click mandala cells in the step grid to save to a browsable mandala collection in Lab.

**Architecture:** localStorage-persisted collection with a simple repository + reactive state layer. Context menu on mandala cells dispatches save action. Gallery tab in Lab renders saved mandalas via SequenceMandala component.

**Tech Stack:** Svelte 5, localStorage, bits-ui ContextMenu (via existing ContextMenu component), SequenceMandala renderer

---

### File Structure

**Create:**
- `src/lib/features/mandala-collection/domain/mandala-collection-types.ts` — CollectedMandala interface + constants
- `src/lib/features/mandala-collection/services/LocalMandalaCollectionRepository.ts` — localStorage CRUD
- `src/lib/features/mandala-collection/state/mandala-collection-state.svelte.ts` — reactive state + actions
- `src/lib/features/mandala-collection/components/MandalaCollectionGallery.svelte` — gallery grid UI
- `src/lib/features/mandala-collection/components/MandalaCollectionCard.svelte` — individual card in gallery

**Modify:**
- `src/lib/features/create/shared/workspace-panel/sequence-display/components/TimelineGrid.svelte` — add context menu to mandala cells
- `src/lib/features/create/shared/workspace-panel/sequence-display/components/StandardGrid.svelte` — add context menu to mandala cells
- `src/lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte` — pass sequenceWord down
- `src/lib/features/create/shared/workspace-panel/sequence-display/components/SequenceDisplay.svelte` — pass currentDisplayWord to StepGrid
- `src/lib/features/lab/LabModule.svelte` — register mandala-collection tab
- `src/lib/shared/navigation/config/tab-definitions.ts` — add mandala-collection tab definition

---

### Task 1: Domain Types + Constants

**Files:**
- Create: `src/lib/features/mandala-collection/domain/mandala-collection-types.ts`

- [ ] **Step 1: Create types file**

```ts
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";

export interface CollectedMandala {
  id: string;
  name: string;
  steps: StepData[];
  variant: "blue" | "red" | "both";
  bluePropType: string;
  redPropType: string;
  createdAt: number;
}

export const MANDALA_COLLECTION_STORAGE_KEY = "tka:mandala-collection";
export const MANDALA_COLLECTION_SCHEMA_VERSION = 1;
```

- [ ] **Step 2: Commit**

```
git add src/lib/features/mandala-collection/domain/mandala-collection-types.ts
git commit -m "feat(mandala-collection): add domain types and constants"
```

---

### Task 2: localStorage Repository

**Files:**
- Create: `src/lib/features/mandala-collection/services/LocalMandalaCollectionRepository.ts`

- [ ] **Step 1: Create repository**

```ts
import type { CollectedMandala } from "../domain/mandala-collection-types";
import {
  MANDALA_COLLECTION_STORAGE_KEY,
  MANDALA_COLLECTION_SCHEMA_VERSION,
} from "../domain/mandala-collection-types";

interface StoredPayload {
  version: number;
  collection: CollectedMandala[];
}

export class LocalMandalaCollectionRepository {
  constructor(private readonly storage: Storage = globalThis.localStorage) {}

  load(): CollectedMandala[] {
    const raw = this.storage.getItem(MANDALA_COLLECTION_STORAGE_KEY);
    if (!raw) return [];

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isStoredPayload(parsed)) return [];
      if (parsed.version !== MANDALA_COLLECTION_SCHEMA_VERSION) return [];
      return parsed.collection;
    } catch {
      return [];
    }
  }

  save(collection: CollectedMandala[]): void {
    const payload: StoredPayload = {
      version: MANDALA_COLLECTION_SCHEMA_VERSION,
      collection,
    };
    this.storage.setItem(MANDALA_COLLECTION_STORAGE_KEY, JSON.stringify(payload));
  }

  clear(): void {
    this.storage.removeItem(MANDALA_COLLECTION_STORAGE_KEY);
  }
}

function isStoredPayload(value: unknown): value is StoredPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    "collection" in value &&
    typeof (value as Record<string, unknown>).version === "number" &&
    Array.isArray((value as Record<string, unknown>).collection)
  );
}
```

- [ ] **Step 2: Commit**

```
git add src/lib/features/mandala-collection/services/LocalMandalaCollectionRepository.ts
git commit -m "feat(mandala-collection): add localStorage repository"
```

---

### Task 3: Reactive State

**Files:**
- Create: `src/lib/features/mandala-collection/state/mandala-collection-state.svelte.ts`

- [ ] **Step 1: Create state**

```ts
import type { CollectedMandala } from "../domain/mandala-collection-types";
import { LocalMandalaCollectionRepository } from "../services/LocalMandalaCollectionRepository";

const repo = new LocalMandalaCollectionRepository();

class MandalaCollectionState {
  collection = $state<CollectedMandala[]>([]);

  constructor() {
    this.collection = repo.load();
  }

  add(mandala: Omit<CollectedMandala, "id" | "createdAt">): CollectedMandala {
    const entry: CollectedMandala = {
      ...mandala,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    this.collection.push(entry);
    repo.save(this.collection);
    return entry;
  }

  remove(id: string): void {
    const idx = this.collection.findIndex((m) => m.id === id);
    if (idx !== -1) {
      this.collection.splice(idx, 1);
      repo.save(this.collection);
    }
  }

  get count(): number {
    return this.collection.length;
  }
}

export const mandalaCollectionState = new MandalaCollectionState();
```

- [ ] **Step 2: Commit**

```
git add src/lib/features/mandala-collection/state/mandala-collection-state.svelte.ts
git commit -m "feat(mandala-collection): add reactive state with localStorage persistence"
```

---

### Task 4: Thread sequenceWord to Grid Components

**Files:**
- Modify: `src/lib/features/create/shared/workspace-panel/sequence-display/components/SequenceDisplay.svelte`
- Modify: `src/lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte`
- Modify: `src/lib/features/create/shared/workspace-panel/sequence-display/components/TimelineGrid.svelte`
- Modify: `src/lib/features/create/shared/workspace-panel/sequence-display/components/StandardGrid.svelte`

- [ ] **Step 1: Pass `currentDisplayWord` from SequenceDisplay to StepGrid**

In `SequenceDisplay.svelte`, find the `<StepGrid>` instantiation and add:
```svelte
sequenceWord={currentDisplayWord}
```

- [ ] **Step 2: Accept `sequenceWord` prop in StepGrid.svelte**

Add to props:
```ts
sequenceWord = "",
```
And to the props type:
```ts
sequenceWord?: string;
```

Pass it to both `<StandardGrid>` and `<TimelineGrid>`:
```svelte
{sequenceWord}
```

- [ ] **Step 3: Accept `sequenceWord` prop in StandardGrid.svelte**

Add to props:
```ts
sequenceWord = "",
```
And to props type:
```ts
sequenceWord?: string;
```

- [ ] **Step 4: Accept `sequenceWord` prop in TimelineGrid.svelte**

Add to props:
```ts
sequenceWord = "",
```
And to props type:
```ts
sequenceWord?: string;
```

- [ ] **Step 5: Run typecheck**

```
npx svelte-check --threshold error
```

- [ ] **Step 6: Commit**

```
git add src/lib/features/create/shared/workspace-panel/sequence-display/components/SequenceDisplay.svelte src/lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte src/lib/features/create/shared/workspace-panel/sequence-display/components/StandardGrid.svelte src/lib/features/create/shared/workspace-panel/sequence-display/components/TimelineGrid.svelte
git commit -m "feat(mandala-collection): thread sequenceWord to grid components"
```

---

### Task 5: Context Menu on TimelineGrid Mandala Cells

**Files:**
- Modify: `src/lib/features/create/shared/workspace-panel/sequence-display/components/TimelineGrid.svelte`

- [ ] **Step 1: Add imports and context menu state**

Add imports at top of `<script>`:
```ts
import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
import type { ContextMenuEntry, ContextMenuState } from "$lib/shared/components/context-menu/context-menu-types";
import { mandalaCollectionState } from "$lib/features/mandala-collection/state/mandala-collection-state.svelte";
import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
```

Add state after existing state declarations:
```ts
let mandalaMenuState = $state<ContextMenuState>({ open: false });
let mandalaMenuVariant = $state<"blue" | "red" | "both">("both");

function handleMandalaContextMenu(event: MouseEvent, variant: "blue" | "red" | "both") {
  event.preventDefault();
  mandalaMenuVariant = variant;
  mandalaMenuState = { open: true, x: event.clientX, y: event.clientY };
}

const mandalaMenuItems = $derived<ContextMenuEntry[]>([
  {
    id: "save-to-collection",
    label: "Save to Collection",
    icon: "fa-bookmark",
    action: () => {
      const name = sequenceWord || `Mandala #${mandalaCollectionState.count + 1}`;
      mandalaCollectionState.add({
        name,
        steps: [...steps] as any,
        variant: mandalaMenuVariant,
        bluePropType: settingsService.settings.bluePropType,
        redPropType: settingsService.settings.redPropType,
      });
      toast.success(`Saved "${name}" to collection`);
    },
  },
]);
```

- [ ] **Step 2: Update mandala cell template — remove pointer-events: none, add context menu handler**

Change the mandala cell rendering from:
```svelte
{#each startColumnMandalas as cell (cell.index)}
  <div class="timeline-cell mandala-cell" style:--duration-multiplier={1}>
```
to:
```svelte
{#each startColumnMandalas as cell (cell.index)}
  <div
    class="timeline-cell mandala-cell"
    style:--duration-multiplier={1}
    oncontextmenu={(e) => handleMandalaContextMenu(e, cell.show)}
  >
```

- [ ] **Step 3: Add ContextMenu component at bottom of template (before closing `</div>` of scroll container)**

Add just before the closing `</div>` of `step-grid-scroll`:
```svelte
<ContextMenu
  menuState={mandalaMenuState}
  items={mandalaMenuItems}
  onClose={() => (mandalaMenuState = { open: false })}
/>
```

- [ ] **Step 4: Update mandala-cell CSS — remove pointer-events: none**

Change:
```css
.mandala-cell {
  pointer-events: none;
  background: color-mix(in srgb, var(--dm-pictograph-bg, #0a0a0f) 50%, transparent);
}
```
to:
```css
.mandala-cell {
  cursor: context-menu;
  background: color-mix(in srgb, var(--dm-pictograph-bg, #0a0a0f) 50%, transparent);
}
```

- [ ] **Step 5: Run typecheck**

```
npx svelte-check --threshold error
```

- [ ] **Step 6: Commit**

```
git add src/lib/features/create/shared/workspace-panel/sequence-display/components/TimelineGrid.svelte
git commit -m "feat(mandala-collection): add right-click save on timeline mandala cells"
```

---

### Task 6: Context Menu on StandardGrid Mandala Cells

**Files:**
- Modify: `src/lib/features/create/shared/workspace-panel/sequence-display/components/StandardGrid.svelte`

- [ ] **Step 1: Add imports and context menu state**

Same pattern as TimelineGrid — add imports:
```ts
import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
import type { ContextMenuEntry, ContextMenuState } from "$lib/shared/components/context-menu/context-menu-types";
import { mandalaCollectionState } from "$lib/features/mandala-collection/state/mandala-collection-state.svelte";
import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
```

Add state:
```ts
let mandalaMenuState = $state<ContextMenuState>({ open: false });
let mandalaMenuVariant = $state<"blue" | "red" | "both">("both");

function handleMandalaContextMenu(event: MouseEvent, variant: "blue" | "red" | "both") {
  event.preventDefault();
  mandalaMenuVariant = variant;
  mandalaMenuState = { open: true, x: event.clientX, y: event.clientY };
}

const mandalaMenuItems = $derived<ContextMenuEntry[]>([
  {
    id: "save-to-collection",
    label: "Save to Collection",
    icon: "fa-bookmark",
    action: () => {
      const name = sequenceWord || `Mandala #${mandalaCollectionState.count + 1}`;
      mandalaCollectionState.add({
        name,
        steps: [...steps] as any,
        variant: mandalaMenuVariant,
        bluePropType: bluePropTypeOverride ?? settingsService.settings.bluePropType,
        redPropType: redPropTypeOverride ?? settingsService.settings.redPropType,
      });
      toast.success(`Saved "${name}" to collection`);
    },
  },
]);
```

- [ ] **Step 2: Update mandala cell template**

Change from:
```svelte
{#each emptyCells as cell (cell.row + "-" + cell.column)}
  <div
    class="mandala-cell-wrapper"
    style:grid-row={cell.row}
    style:grid-column={cell.column}
  >
```
to:
```svelte
{#each emptyCells as cell (cell.row + "-" + cell.column)}
  <div
    class="mandala-cell-wrapper"
    style:grid-row={cell.row}
    style:grid-column={cell.column}
    oncontextmenu={(e) => handleMandalaContextMenu(e, cell.show)}
  >
```

- [ ] **Step 3: Add ContextMenu component before closing `</div>` of step-grid-scroll**

```svelte
<ContextMenu
  menuState={mandalaMenuState}
  items={mandalaMenuItems}
  onClose={() => (mandalaMenuState = { open: false })}
/>
```

- [ ] **Step 4: Update mandala-cell-wrapper CSS — remove pointer-events: none**

Change:
```css
.mandala-cell-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  background: color-mix(in srgb, var(--dm-pictograph-bg, #0a0a0f) 50%, transparent);
  border-radius: 4px;
}
```
to:
```css
.mandala-cell-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: context-menu;
  background: color-mix(in srgb, var(--dm-pictograph-bg, #0a0a0f) 50%, transparent);
  border-radius: 4px;
}
```

- [ ] **Step 5: Run typecheck**

```
npx svelte-check --threshold error
```

- [ ] **Step 6: Commit**

```
git add src/lib/features/create/shared/workspace-panel/sequence-display/components/StandardGrid.svelte
git commit -m "feat(mandala-collection): add right-click save on standard grid mandala cells"
```

---

### Task 7: Gallery Card Component

**Files:**
- Create: `src/lib/features/mandala-collection/components/MandalaCollectionCard.svelte`

- [ ] **Step 1: Create card component**

```svelte
<script lang="ts">
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import type { CollectedMandala } from "../domain/mandala-collection-types";

  let {
    mandala,
    onDelete,
  }: {
    mandala: CollectedMandala;
    onDelete: (id: string) => void;
  } = $props();

  const dateLabel = $derived(
    new Date(mandala.createdAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })
  );
</script>

<div class="collection-card">
  <div class="card-mandala">
    <SequenceMandala
      sequence={{ steps: mandala.steps }}
      mode="card-back"
      style="stroke"
      show={mandala.variant}
      size={160}
      bluePropType={mandala.bluePropType}
      redPropType={mandala.redPropType}
    />
  </div>
  <div class="card-info">
    <span class="card-name">{mandala.name}</span>
    <span class="card-date">{dateLabel}</span>
  </div>
  <button
    class="card-delete"
    onclick={() => onDelete(mandala.id)}
    type="button"
    aria-label="Delete {mandala.name}"
  >
    <i class="fas fa-trash-alt" aria-hidden="true"></i>
  </button>
</div>

<style>
  .collection-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 12px;
    transition: border-color 200ms ease;
  }

  .collection-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .card-mandala {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .card-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--theme-text, #fff);
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 140px;
  }

  .card-date {
    font-size: 11px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .card-delete {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    cursor: pointer;
    opacity: 0;
    transition: opacity 150ms ease, color 150ms ease, background 150ms ease;
    font-size: 12px;
  }

  .collection-card:hover .card-delete {
    opacity: 1;
  }

  .card-delete:hover {
    color: var(--semantic-error, #ef4444);
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 12%, transparent);
  }
</style>
```

- [ ] **Step 2: Commit**

```
git add src/lib/features/mandala-collection/components/MandalaCollectionCard.svelte
git commit -m "feat(mandala-collection): add gallery card component"
```

---

### Task 8: Gallery Component

**Files:**
- Create: `src/lib/features/mandala-collection/components/MandalaCollectionGallery.svelte`

- [ ] **Step 1: Create gallery component**

```svelte
<script lang="ts">
  import { mandalaCollectionState } from "../state/mandala-collection-state.svelte";
  import MandalaCollectionCard from "./MandalaCollectionCard.svelte";

  function handleDelete(id: string) {
    mandalaCollectionState.remove(id);
  }
</script>

<div class="gallery-container">
  {#if mandalaCollectionState.collection.length === 0}
    <div class="empty-state">
      <i class="fas fa-dharmachakra empty-icon" aria-hidden="true"></i>
      <p class="empty-text">No mandalas saved yet</p>
      <p class="empty-hint">Right-click a mandala in the step grid to add one</p>
    </div>
  {:else}
    <div class="gallery-grid">
      {#each mandalaCollectionState.collection as mandala (mandala.id)}
        <MandalaCollectionCard {mandala} onDelete={handleDelete} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .gallery-container {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding: 16px;
    box-sizing: border-box;
  }

  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .empty-icon {
    font-size: 48px;
    opacity: 0.3;
  }

  .empty-text {
    font-size: 16px;
    font-weight: 500;
    margin: 0;
  }

  .empty-hint {
    font-size: 13px;
    margin: 0;
    opacity: 0.7;
  }
</style>
```

- [ ] **Step 2: Commit**

```
git add src/lib/features/mandala-collection/components/MandalaCollectionGallery.svelte
git commit -m "feat(mandala-collection): add gallery grid component"
```

---

### Task 9: Register Lab Tab

**Files:**
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts`
- Modify: `src/lib/features/lab/LabModule.svelte`

- [ ] **Step 1: Add tab definition in tab-definitions.ts**

Find the `mandala` entry in `LAB_TABS` and add a new entry after it:
```ts
{
  id: "mandala-collection",
  label: "Mandala Collection",
  icon: '<i class="fas fa-layer-group" aria-hidden="true"></i>',
  description: "Saved sequence mandalas",
  color: "#e879f9",
  gradient: "linear-gradient(135deg, #e879f9 0%, #c084fc 100%)",
},
```

- [ ] **Step 2: Register component loader in LabModule.svelte**

In the `tabComponents` record, add after the `mandala` entry:
```ts
"mandala-collection": () => import("$lib/features/mandala-collection/components/MandalaCollectionGallery.svelte"),
```

- [ ] **Step 3: Run typecheck**

```
npx svelte-check --threshold error
```

- [ ] **Step 4: Run build**

```
npm run build
```

- [ ] **Step 5: Commit**

```
git add src/lib/shared/navigation/config/tab-definitions.ts src/lib/features/lab/LabModule.svelte
git commit -m "feat(mandala-collection): register gallery as Lab tab"
```

---

### Task 10: Verify End-to-End

- [ ] **Step 1: Verify right-click on mandala cell in step grid shows context menu**

Navigate to `localhost:5173/create/generate`, generate a sequence, right-click a mandala cell in the start column. Expect context menu with "Save to Collection" item.

- [ ] **Step 2: Verify saving works**

Click "Save to Collection". Expect success toast. Check `localStorage.getItem("tka:mandala-collection")` in DevTools — should contain the serialized entry.

- [ ] **Step 3: Verify gallery displays saved mandalas**

Navigate to Lab → Mandala Collection tab. Expect the saved mandala to appear as a card with the mandala visual, name, and date.

- [ ] **Step 4: Verify delete works**

Hover over a card, click the trash icon. Card should disappear. localStorage should update.

- [ ] **Step 5: Verify empty state**

Delete all mandalas. Gallery should show "No mandalas saved yet" empty state.
