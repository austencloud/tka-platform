# Yoga Sequence Builder - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a yoga sequence composition app with a browsable pose database and a two-pane flow builder, from empty directory to working prototype.

**Architecture:** SvelteKit + TypeScript + ITI (DI) + Svelte 5 runes. Clean-room implementation following TKA Composer's patterns (state factories, contracts/implementations, DI containers, scoped CSS) but in a separate repo with its own visual identity. Static JSON seed data, local storage for saving flows.

**Tech Stack:** SvelteKit, TypeScript (strict), ITI, pnpm, Svelte 5 runes ($state, $derived, $effect)

**Spec:** `docs/superpowers/specs/2026-03-22-yoga-sequence-builder-design.md`

---

## File Map

### Scaffolding & Config

| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies, scripts |
| `svelte.config.js` | SvelteKit adapter config |
| `vite.config.ts` | Vite build config |
| `tsconfig.json` | TypeScript strict mode |
| `src/app.html` | HTML shell |
| `src/app.css` | Design tokens, typography, CSS custom properties |
| `CLAUDE.md` | Project-specific Claude Code rules |

### Domain Types

| File | Responsibility |
|------|---------------|
| `src/lib/shared/domain/types/pose.ts` | Pose, Variation interfaces |
| `src/lib/shared/domain/types/flow.ts` | Flow, FlowStep interfaces |
| `src/lib/shared/domain/types/session.ts` | Session, Phase, FlowReference interfaces |
| `src/lib/shared/domain/types/transition.ts` | Transition interface |
| `src/lib/shared/domain/enums/pose-category.ts` | PoseCategory type |
| `src/lib/shared/domain/enums/yoga-style.ts` | YogaStyle type |

### Seed Data

| File | Responsibility |
|------|---------------|
| `scripts/ingest/fetch-yoga-apis.ts` | Pull from open APIs, merge, output raw JSON |
| `scripts/ingest/enrich-poses.ts` | AI enrichment script (fills gaps in raw data) |
| `src/lib/shared/data/poses/seed-poses.json` | Final validated pose seed data |
| `src/lib/shared/data/poses/seed-variations.json` | Validated variation seed data |
| `src/lib/shared/data/poses/seed-transitions.json` | Hand-curated transition data |

### DI System

| File | Responsibility |
|------|---------------|
| `src/lib/shared/di/index.ts` | Composition root, buildAppContainer() |
| `src/lib/shared/di/container-types.ts` | IAppContainerItems intersection type |
| `src/lib/shared/di/containers/data-container.ts` | PoseLoader, TransitionResolver registration |
| `src/lib/shared/di/containers/library-container.ts` | PoseFilter, PoseSearcher registration |
| `src/lib/shared/di/containers/compose-container.ts` | FlowComposer, FlowPersister registration |

### Data Services

| File | Responsibility |
|------|---------------|
| `src/lib/shared/data/services/contracts/IPoseLoader.ts` | Interface: load all poses, get by id |
| `src/lib/shared/data/services/implementations/PoseLoader.ts` | Load from seed JSON |
| `src/lib/shared/data/services/contracts/ITransitionResolver.ts` | Interface: get transitions for a pose |
| `src/lib/shared/data/services/implementations/TransitionResolver.ts` | Lookup from seed transitions |

### Navigation

| File | Responsibility |
|------|---------------|
| `src/lib/shared/navigation/config/module-definitions.ts` | Module metadata (Library, Compose) |
| `src/lib/shared/navigation/state/navigation-state.svelte.ts` | Active module/tab tracking |
| `src/lib/shared/navigation/context/navigation-context.ts` | Context provider/consumer |
| `src/lib/shared/navigation/components/BottomNav.svelte` | Mobile bottom navigation |
| `src/lib/shared/navigation/components/Sidebar.svelte` | Desktop sidebar navigation |

### App Shell

| File | Responsibility |
|------|---------------|
| `src/routes/+layout.svelte` | App shell, navigation, DI initialization |
| `src/routes/+page.svelte` | Module renderer |
| `src/lib/shared/modules/ModuleRenderer.svelte` | Lazy module loading |

### Library Module

| File | Responsibility |
|------|---------------|
| `src/lib/features/library/components/LibraryModule.svelte` | Module root, sets context |
| `src/lib/features/library/components/PoseGrid.svelte` | Grid of pose cards |
| `src/lib/features/library/components/PoseCard.svelte` | Single pose card (name, difficulty, category, muscles) |
| `src/lib/features/library/components/PoseDetail.svelte` | Full pose detail view (drawer) |
| `src/lib/features/library/components/FilterBar.svelte` | Filter controls (category, difficulty, body region, style) |
| `src/lib/features/library/components/SearchBar.svelte` | Text search input |
| `src/lib/features/library/services/contracts/IPoseFilter.ts` | Interface: filter poses by criteria |
| `src/lib/features/library/services/implementations/PoseFilter.ts` | Filter logic |
| `src/lib/features/library/services/contracts/IPoseSearcher.ts` | Interface: search by name |
| `src/lib/features/library/services/implementations/PoseSearcher.ts` | Fuzzy search logic |
| `src/lib/features/library/state/library-state.svelte.ts` | State factory: filters, search, selected pose |
| `src/lib/features/library/context/library-context.ts` | Context provider/consumer |

### Compose Module

| File | Responsibility |
|------|---------------|
| `src/lib/features/compose/components/ComposeModule.svelte` | Module root, two-pane layout, sets context |
| `src/lib/features/compose/components/FlowWorkspace.svelte` | Left pane: flow strip showing added poses |
| `src/lib/features/compose/components/FlowStepCard.svelte` | Single step in the flow strip |
| `src/lib/features/compose/components/PosePicker.svelte` | Right pane: pose browser for picking next pose |
| `src/lib/features/compose/components/StepEditor.svelte` | Edit hold time, breath cue, side for a step |
| `src/lib/features/compose/services/contracts/IFlowComposer.ts` | Interface: add/remove/reorder steps |
| `src/lib/features/compose/services/implementations/FlowComposer.ts` | Flow composition logic |
| `src/lib/features/compose/services/contracts/IFlowPersister.ts` | Interface: save/load flows |
| `src/lib/features/compose/services/implementations/FlowPersister.ts` | localStorage persistence |
| `src/lib/features/compose/state/compose-state.svelte.ts` | State factory: current flow, selected step |
| `src/lib/features/compose/context/compose-context.ts` | Context provider/consumer |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `src/app.html`, `src/app.css`, `CLAUDE.md`, `.gitignore`

- [ ] **Step 1: Create project directory and initialize**

Choose a directory location for the new project (e.g. `F:/yoga-app/`). Initialize with pnpm.

```bash
mkdir F:/yoga-app && cd F:/yoga-app
pnpm init
```

- [ ] **Step 2: Install core dependencies**

```bash
pnpm add -D svelte @sveltejs/kit @sveltejs/adapter-auto vite typescript @sveltejs/vite-plugin-svelte
pnpm add iti
```

- [ ] **Step 3: Create SvelteKit config files**

Create `svelte.config.js`:
```javascript
import adapter from "@sveltejs/adapter-auto";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    alias: {
      "$lib": "./src/lib",
      "$lib/*": "./src/lib/*"
    }
  }
};

export default config;
```

Create `vite.config.ts`:
```typescript
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()]
});
```

Create `tsconfig.json`:
```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "moduleResolution": "bundler"
  }
}
```

- [ ] **Step 4: Create app shell files**

Create `src/app.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="%sveltekit.assets%/favicon.png" />
    <title>Yoga Composer</title>
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

Create `src/app.css` with design tokens (colors, typography, spacing). Use a warm, grounding palette distinct from TKA's dark/neon aesthetic. Earth tones, natural greens, warm neutrals.

- [ ] **Step 5: Create .gitignore and CLAUDE.md**

`.gitignore`: standard SvelteKit ignores (node_modules, .svelte-kit, build, .env).

`CLAUDE.md`: project-specific rules referencing the same conventions as TKA Composer (DI patterns, no barrel exports, no utils, service naming, earned tests, scoped CSS) but tailored to this project.

- [ ] **Step 6: Initialize git and commit**

```bash
git init
git add -A
git commit -m "chore: scaffold SvelteKit project with TypeScript and ITI"
```

- [ ] **Step 7: Verify dev server starts**

```bash
pnpm dev --port 5175
```

Verify the default SvelteKit page loads at `localhost:5175`. Use port 5175 to avoid conflict with TKA's 5173/5174.

---

## Task 2: Domain Types

**Files:**
- Create: `src/lib/shared/domain/types/pose.ts`, `src/lib/shared/domain/types/flow.ts`, `src/lib/shared/domain/types/session.ts`, `src/lib/shared/domain/types/transition.ts`, `src/lib/shared/domain/enums/pose-category.ts`, `src/lib/shared/domain/enums/yoga-style.ts`

- [ ] **Step 1: Create enum types**

`src/lib/shared/domain/enums/pose-category.ts`:
```typescript
export type PoseCategory =
  | "standing"
  | "seated"
  | "supine"
  | "prone"
  | "inverted"
  | "arm-balance"
  | "kneeling";
```

`src/lib/shared/domain/enums/yoga-style.ts`:
```typescript
export type YogaStyle =
  | "vinyasa"
  | "hatha"
  | "yin"
  | "ashtanga"
  | "iyengar"
  | "kundalini"
  | "restorative"
  | "power"
  | "bikram"
  | "hot"
  | "aerial"
  | "prenatal"
  | "chair"
  | "forrest"
  | "jivamukti"
  | "anusara"
  | "viniyoga"
  | "sivananda";
```

- [ ] **Step 2: Create core type interfaces**

Create `pose.ts`, `flow.ts`, `session.ts`, `transition.ts` with the exact interfaces from the spec. Include JSDoc comments explaining the dual hold time fields and variation constraint.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/domain/
git commit -m "feat: add domain types for poses, flows, sessions, and transitions"
```

---

## Task 3: DI Container System

**Files:**
- Create: `src/lib/shared/di/index.ts`, `src/lib/shared/di/container-types.ts`, `src/lib/shared/di/containers/data-container.ts`

- [ ] **Step 1: Install ITI**

Already installed in Task 1. Verify: `pnpm list iti`

- [ ] **Step 2: Create data container (empty registrations for now)**

`src/lib/shared/di/containers/data-container.ts`:
```typescript
import { createContainer } from "iti";

export function createDataContainer() {
  return createContainer();
  // Services will be registered as they're implemented
}

export type DataContainer = ReturnType<typeof createDataContainer>;
```

- [ ] **Step 3: Create composition root**

`src/lib/shared/di/index.ts`:
```typescript
import { createDataContainer } from "./containers/data-container";

function buildAppContainer() {
  const dataContainer = createDataContainer();
  return { ...dataContainer.items };
}

export const container = { items: buildAppContainer() };
```

- [ ] **Step 4: Create container types**

`src/lib/shared/di/container-types.ts`:
```typescript
import type { DataContainer } from "./containers/data-container";

type ItemsOf<T> = T extends { items: infer I } ? I : never;
type DataItems = ItemsOf<DataContainer>;

export type IAppContainerItems = DataItems;
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/di/
git commit -m "feat: add ITI dependency injection container system"
```

---

## Task 4: Seed Data Ingestion

**Files:**
- Create: `scripts/ingest/fetch-yoga-apis.ts`, `src/lib/shared/data/poses/seed-poses.json`, `src/lib/shared/data/poses/seed-variations.json`

- [ ] **Step 1: Create API ingestion script**

`scripts/ingest/fetch-yoga-apis.ts`: Node script that:
1. Fetches poses from `https://yoga-api-nzy4.onrender.com/v1/poses` (alexcumplido)
2. Fetches poses from LunaticPrakash's API (check current URL)
3. Merges by matching Sanskrit/English names
4. Maps to our Pose interface schema (leaving fields like muscleGroups empty for AI enrichment)
5. Outputs `raw-poses.json`

```bash
npx tsx scripts/ingest/fetch-yoga-apis.ts
```

- [ ] **Step 2: Run ingestion and inspect output**

Run the script. Inspect `raw-poses.json` for completeness. Note which fields are populated vs empty.

- [ ] **Step 3: Create AI enrichment script**

`scripts/ingest/enrich-poses.ts`: Script that reads `raw-poses.json` and generates a complete `seed-poses.json` with all fields populated.

**Approach:** Use the Anthropic SDK (`@anthropic-ai/sdk`) to batch-enrich poses. The script:
1. Reads `raw-poses.json`
2. Groups poses into batches of 10
3. For each batch, sends a structured prompt to Claude asking for JSON output with: muscleGroups, bodyRegion, category, difficulty (1-5), defaultHoldBreaths, defaultHoldSeconds, sides, contraindications
4. Merges AI responses with existing data (API data takes precedence where it exists)
5. Writes `seed-poses.json`

The prompt should include context: "You are a certified yoga instructor. For each pose, provide accurate anatomical data."

**API key:** Use `ANTHROPIC_API_KEY` env var. Add `.env` to `.gitignore`.

**Fallback if no API key:** The script can also output a CSV template for manual enrichment.

Install: `pnpm add -D @anthropic-ai/sdk`

Output: `seed-poses.json` with all fields populated. User reviews before committing.

- [ ] **Step 4: Generate variations data**

Either in the enrichment script or manually, create `seed-variations.json` with common variations for well-known poses (e.g., Warrior I with different arm positions, Up Dog toes vs tops of feet, Tree pose with hands at heart vs overhead).

- [ ] **Step 5: Create initial transition data**

`src/lib/shared/data/poses/seed-transitions.json`: Hand-curate transitions for Sun Salutation A as the first set:
- Mountain → Standing Forward Fold (exhale, smoothness 5)
- Forward Fold → Halfway Lift (inhale, smoothness 5)
- Halfway Lift → Chaturanga (exhale, smoothness 4, bridge: [plank])
- Chaturanga → Upward-Facing Dog (inhale, smoothness 5)
- Up Dog → Downward-Facing Dog (exhale, smoothness 5)
- Down Dog → Forward Fold (exhale, smoothness 4, bridge: [step/jump forward])
- Forward Fold → Mountain (inhale, smoothness 5)

- [ ] **Step 6: Validate all seed data**

Review `seed-poses.json` manually. Check:
- Sanskrit names are spelled correctly
- Difficulty ratings are reasonable
- Muscle groups are accurate
- No duplicate poses

- [ ] **Step 7: Commit**

```bash
git add scripts/ingest/ src/lib/shared/data/
git commit -m "feat: add pose seed data from API ingest and AI enrichment"
```

---

## Task 5: Data Services (PoseLoader + TransitionResolver)

**Files:**
- Create: `src/lib/shared/data/services/contracts/IPoseLoader.ts`, `src/lib/shared/data/services/implementations/PoseLoader.ts`, `src/lib/shared/data/services/contracts/ITransitionResolver.ts`, `src/lib/shared/data/services/implementations/TransitionResolver.ts`
- Modify: `src/lib/shared/di/containers/data-container.ts`

- [ ] **Step 1: Create IPoseLoader interface**

```typescript
import type { Pose } from "$lib/shared/domain/types/pose";
import type { Variation } from "$lib/shared/domain/types/pose";

export interface IPoseLoader {
  getAllPoses(): Pose[];
  getPoseById(id: string): Pose | undefined;
  getVariationsForPose(poseId: string): Variation[];
}
```

- [ ] **Step 2: Implement PoseLoader**

Loads from static JSON imports. Builds lookup maps on construction for O(1) access.

```typescript
import type { IPoseLoader } from "../contracts/IPoseLoader";
import type { Pose, Variation } from "$lib/shared/domain/types/pose";
import seedPoses from "$lib/shared/data/poses/seed-poses.json";
import seedVariations from "$lib/shared/data/poses/seed-variations.json";

export class PoseLoader implements IPoseLoader {
  private poses: Pose[];
  private poseMap: Map<string, Pose>;
  private variationsByPose: Map<string, Variation[]>;

  constructor() {
    this.poses = seedPoses as Pose[];
    this.poseMap = new Map(this.poses.map((p) => [p.id, p]));

    this.variationsByPose = new Map();
    for (const v of seedVariations as Variation[]) {
      const existing = this.variationsByPose.get(v.parentPoseId) ?? [];
      existing.push(v);
      this.variationsByPose.set(v.parentPoseId, existing);
    }
  }

  getAllPoses(): Pose[] {
    return this.poses;
  }

  getPoseById(id: string): Pose | undefined {
    return this.poseMap.get(id);
  }

  getVariationsForPose(poseId: string): Variation[] {
    return this.variationsByPose.get(poseId) ?? [];
  }
}
```

- [ ] **Step 3: Create ITransitionResolver and implementation**

Similar pattern. Loads from `seed-transitions.json`, builds lookup by fromPoseId.

- [ ] **Step 4: Register in data container**

Update `data-container.ts` to register both services:
```typescript
import { PoseLoader } from "$lib/shared/data/services/implementations/PoseLoader";
import { TransitionResolver } from "$lib/shared/data/services/implementations/TransitionResolver";

export function createDataContainer() {
  return createContainer()
    .add({ poseLoader: () => new PoseLoader() })
    .add({ transitionResolver: () => new TransitionResolver() });
}
```

- [ ] **Step 5: Update container types**

Add the new service types to `IAppContainerItems`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/data/services/ src/lib/shared/di/
git commit -m "feat: add PoseLoader and TransitionResolver data services"
```

---

## Task 6: Navigation System

**Files:**
- Create: `src/lib/shared/navigation/config/module-definitions.ts`, `src/lib/shared/navigation/state/navigation-state.svelte.ts`, `src/lib/shared/navigation/context/navigation-context.ts`, `src/lib/shared/navigation/components/BottomNav.svelte`, `src/lib/shared/navigation/components/Sidebar.svelte`

- [ ] **Step 1: Define modules**

`module-definitions.ts`:
```typescript
export interface ModuleDefinition {
  id: string;
  label: string;
  icon: string;
  color: string;
  description: string;
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    id: "library",
    label: "Library",
    icon: "book-open",
    color: "#7c9a6e",
    description: "Browse and search the pose database"
  },
  {
    id: "compose",
    label: "Compose",
    icon: "layers",
    color: "#c4956a",
    description: "Build flows from poses"
  }
];
```

- [ ] **Step 2: Create navigation state factory**

```typescript
export function createNavigationState() {
  let activeModuleId = $state("library");

  return {
    get activeModuleId() { return activeModuleId; },
    setActiveModule(id: string) { activeModuleId = id; }
  };
}
```

- [ ] **Step 3: Create navigation context**

Standard `setContext`/`getContext` pair with Symbol key.

- [ ] **Step 4: Create BottomNav component**

Renders module icons as tabs at the bottom on mobile. Highlights active module. Calls `setActiveModule` on tap.

- [ ] **Step 5: Create Sidebar component**

Desktop equivalent. Vertical list of module icons with labels.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/navigation/
git commit -m "feat: add navigation system with module definitions and responsive nav"
```

---

## Task 7: App Shell & Module Renderer

**Files:**
- Create: `src/lib/shared/modules/ModuleRenderer.svelte`
- Modify: `src/routes/+layout.svelte`, `src/routes/+page.svelte`

- [ ] **Step 1: Create ModuleRenderer**

Lazy-loads module components based on active module ID:
```typescript
const moduleLoaders: Record<string, () => Promise<{ default: typeof SvelteComponent }>> = {
  library: () => import("$lib/features/library/components/LibraryModule.svelte"),
  compose: () => import("$lib/features/compose/components/ComposeModule.svelte")
};
```

Uses `{#await}` block for loading state. Caches loaded modules.

- [ ] **Step 2: Create +layout.svelte**

Initializes DI container. Sets navigation context. Renders responsive layout:
- Desktop: Sidebar + main content area
- Mobile: main content area + BottomNav

Imports `app.css`.

- [ ] **Step 3: Create +page.svelte**

Renders `<ModuleRenderer />` which loads the active module.

- [ ] **Step 4: Verify navigation works**

Start dev server. Confirm:
- Default loads Library module (placeholder)
- Clicking Compose switches modules
- Responsive layout works (sidebar on desktop, bottom nav on mobile)

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/modules/ src/routes/
git commit -m "feat: add app shell with module renderer and responsive navigation"
```

---

## Task 8: Library Module - Services

**Files:**
- Create: `src/lib/features/library/services/contracts/IPoseFilter.ts`, `src/lib/features/library/services/implementations/PoseFilter.ts`, `src/lib/features/library/services/contracts/IPoseSearcher.ts`, `src/lib/features/library/services/implementations/PoseSearcher.ts`
- Create: `src/lib/shared/di/containers/library-container.ts`
- Modify: `src/lib/shared/di/index.ts`, `src/lib/shared/di/container-types.ts`

- [ ] **Step 1: Create IPoseFilter**

```typescript
import type { Pose } from "$lib/shared/domain/types/pose";
import type { PoseCategory } from "$lib/shared/domain/enums/pose-category";
import type { YogaStyle } from "$lib/shared/domain/enums/yoga-style";

export interface PoseFilterCriteria {
  category?: PoseCategory;
  difficulty?: number;
  bodyRegion?: string;
  muscleGroup?: string;
  style?: YogaStyle;
}

export interface IPoseFilter {
  filter(poses: Pose[], criteria: PoseFilterCriteria): Pose[];
}
```

- [ ] **Step 2: Implement PoseFilter**

Filters by all criteria (AND logic). Each criterion is optional.

- [ ] **Step 3: Create IPoseSearcher and implement**

Searches by Sanskrit name and English name. Case-insensitive substring match. Returns matches sorted by relevance (exact match first, then starts-with, then contains).

- [ ] **Step 4: Register in library container and wire into composition root**

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/library/services/ src/lib/shared/di/
git commit -m "feat: add PoseFilter and PoseSearcher services"
```

---

## Task 9: Library Module - State & UI

**Files:**
- Create: `src/lib/features/library/state/library-state.svelte.ts`, `src/lib/features/library/context/library-context.ts`, `src/lib/features/library/components/LibraryModule.svelte`, `PoseGrid.svelte`, `PoseCard.svelte`, `PoseDetail.svelte`, `FilterBar.svelte`, `SearchBar.svelte`

- [ ] **Step 1: Create library state factory**

```typescript
export function createLibraryState(poseLoader: IPoseLoader, poseFilter: IPoseFilter, poseSearcher: IPoseSearcher) {
  let searchQuery = $state("");
  let filterCriteria = $state<PoseFilterCriteria>({});
  let selectedPoseId = $state<string | null>(null);

  const allPoses = poseLoader.getAllPoses();

  const filteredPoses = $derived.by(() => {
    let result = allPoses;
    if (searchQuery) {
      result = poseSearcher.search(result, searchQuery);
    }
    if (Object.keys(filterCriteria).length > 0) {
      result = poseFilter.filter(result, filterCriteria);
    }
    return result;
  });

  const selectedPose = $derived(
    selectedPoseId ? poseLoader.getPoseById(selectedPoseId) : undefined
  );

  return {
    get searchQuery() { return searchQuery; },
    setSearchQuery(q: string) { searchQuery = q; },
    get filterCriteria() { return filterCriteria; },
    setFilterCriteria(c: PoseFilterCriteria) { filterCriteria = c; },
    get filteredPoses() { return filteredPoses; },
    get selectedPose() { return selectedPose; },
    get selectedPoseId() { return selectedPoseId; },
    selectPose(id: string | null) { selectedPoseId = id; }
  };
}
```

- [ ] **Step 2: Create library context**

Standard `setContext`/`getContext` pair.

- [ ] **Step 3: Create SearchBar component**

Text input with debounced search. Calls `setSearchQuery` on input. Styled with CSS custom properties. Shows result count.

- [ ] **Step 4: Create FilterBar component**

Row of filter controls:
- Category: button group (Standing, Seated, Supine, etc.)
- Difficulty: 1-5 selector
- Body Region: dropdown
- Style: dropdown

Each filter calls `setFilterCriteria`. Active filters are visually highlighted. Clear all button.

- [ ] **Step 5: Create PoseCard component**

Card showing:
- English name (primary, larger)
- Sanskrit name (secondary, italic)
- Difficulty indicator (1-5 dots or similar)
- Category badge
- Top 3 muscle groups as small tags

On click: calls `selectPose(id)`.

Use component-scoped CSS. Earth-tone color palette. Card should feel tactile and warm.

- [ ] **Step 6: Create PoseGrid component**

CSS grid layout of PoseCards. Responsive: 1 column on small mobile, 2 on large mobile, 3 on tablet, 4 on desktop. Uses `filteredPoses` from state.

- [ ] **Step 7: Create PoseDetail component**

Drawer/modal that shows when `selectedPose` is set:
- Full Sanskrit name with pronunciation guide
- English name
- Description
- All muscle groups
- Body regions
- Category
- Styles it belongs to
- Contraindications
- Difficulty
- Default hold times (breaths and seconds)
- Bilateral/unilateral/neutral
- Variations list (from PoseLoader.getVariationsForPose)
- "Add to Flow" button (wired in Task 11)

Close on backdrop click or X button.

- [ ] **Step 8: Create LibraryModule component**

Module root. Creates state factory, sets context. Layout:
```
SearchBar
FilterBar
PoseGrid
{#if selectedPose}
  <PoseDetail />
{/if}
```

- [ ] **Step 9: Verify Library module works end-to-end**

Start dev server. Confirm:
- All seed poses render in the grid
- Search filters by name in real time
- Category/difficulty/region filters work
- Clicking a pose opens the detail view
- Detail view shows all metadata
- Responsive layout works

- [ ] **Step 10: Commit**

```bash
git add src/lib/features/library/
git commit -m "feat: add Library module with pose browser, search, filter, and detail view"
```

---

## Task 10: Compose Module - Services

**Files:**
- Create: `src/lib/features/compose/services/contracts/IFlowComposer.ts`, `src/lib/features/compose/services/implementations/FlowComposer.ts`, `src/lib/features/compose/services/contracts/IFlowPersister.ts`, `src/lib/features/compose/services/implementations/FlowPersister.ts`
- Create: `src/lib/shared/di/containers/compose-container.ts`
- Modify: `src/lib/shared/di/index.ts`, `src/lib/shared/di/container-types.ts`

- [ ] **Step 1: Create IFlowComposer**

```typescript
import type { Flow, FlowStep } from "$lib/shared/domain/types/flow";

export interface IFlowComposer {
  createFlow(name: string): Flow;
  addStep(flow: Flow, step: FlowStep): Flow;
  removeStep(flow: Flow, index: number): Flow;
  moveStep(flow: Flow, fromIndex: number, toIndex: number): Flow;
  updateStep(flow: Flow, index: number, updates: Partial<FlowStep>): Flow;
}
```

- [ ] **Step 2: Implement FlowComposer**

Pure functions that return new Flow objects (immutable updates). Generates UUIDs for new flows.

- [ ] **Step 3: Create IFlowPersister and implement**

```typescript
export interface IFlowPersister {
  saveFlow(flow: Flow): void;
  loadFlows(): Flow[];
  deleteFlow(id: string): void;
}
```

Implementation: `localStorage` with JSON serialization. Key: `yoga-composer-flows`.

- [ ] **Step 4: Register in compose container and wire into composition root**

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/compose/services/ src/lib/shared/di/
git commit -m "feat: add FlowComposer and FlowPersister services"
```

---

## Task 11: Compose Module - State & UI

**Files:**
- Create: `src/lib/features/compose/state/compose-state.svelte.ts`, `src/lib/features/compose/context/compose-context.ts`, `src/lib/features/compose/components/ComposeModule.svelte`, `FlowWorkspace.svelte`, `FlowStepCard.svelte`, `PosePicker.svelte`, `StepEditor.svelte`

- [ ] **Step 1: Create compose state factory**

```typescript
export function createComposeState(
  flowComposer: IFlowComposer,
  flowPersister: IFlowPersister,
  poseLoader: IPoseLoader
) {
  let currentFlow = $state<Flow>(flowComposer.createFlow("New Flow"));
  let selectedStepIndex = $state<number | null>(null);
  let undoStack = $state<Flow[]>([]);
  let redoStack = $state<Flow[]>([]);

  function pushUndo() {
    undoStack = [...undoStack, structuredClone(currentFlow)];
    redoStack = [];
  }

  return {
    get currentFlow() { return currentFlow; },
    get selectedStepIndex() { return selectedStepIndex; },
    get canUndo() { return undoStack.length > 0; },
    get canRedo() { return redoStack.length > 0; },

    addPose(poseId: string) {
      pushUndo();
      const pose = poseLoader.getPoseById(poseId);
      if (!pose) return;
      currentFlow = flowComposer.addStep(currentFlow, {
        poseId,
        holdBreaths: pose.defaultHoldBreaths,
        holdSeconds: pose.defaultHoldSeconds
      });
    },

    removeStep(index: number) {
      pushUndo();
      currentFlow = flowComposer.removeStep(currentFlow, index);
      selectedStepIndex = null;
    },

    selectStep(index: number | null) { selectedStepIndex = index; },

    updateStep(index: number, updates: Partial<FlowStep>) {
      pushUndo();
      currentFlow = flowComposer.updateStep(currentFlow, index, updates);
    },

    undo() {
      if (undoStack.length === 0) return;
      const previous = undoStack[undoStack.length - 1];
      undoStack = undoStack.slice(0, -1);
      redoStack = [...redoStack, structuredClone(currentFlow)];
      currentFlow = previous;
    },

    redo() {
      if (redoStack.length === 0) return;
      const next = redoStack[redoStack.length - 1];
      redoStack = redoStack.slice(0, -1);
      undoStack = [...undoStack, structuredClone(currentFlow)];
      currentFlow = next;
    },

    saveFlow() { flowPersister.saveFlow(currentFlow); },
    clearFlow() {
      pushUndo();
      currentFlow = flowComposer.createFlow("New Flow");
    }
  };
}
```

- [ ] **Step 2: Create compose context**

Standard `setContext`/`getContext` pair.

- [ ] **Step 3: Create FlowStepCard component**

Compact card showing:
- Step number
- Pose English name
- Hold time (breaths or seconds)
- Side indicator (L/R) if unilateral
- Breath cue icon (inhale ↑ / exhale ↓)
- Click to select for editing
- Active/selected state styling

- [ ] **Step 4: Create FlowWorkspace component**

Left pane. Horizontal or vertical strip of FlowStepCards.
- Shows empty state when no steps added ("Pick a starting pose")
- Flow name at top (editable)
- Action buttons: Undo, Redo, Clear, Save
- Steps animate in when added

- [ ] **Step 5: Create PosePicker component**

Right pane. Reuses filter/search pattern from Library but in a compact form:
- Search input at top
- Category filter chips
- Scrollable pose list (compact cards, not full PoseCards)
- Click a pose → calls `addPose(id)` on compose state

- [ ] **Step 6: Create StepEditor component**

Appears when a step is selected in the workspace:
- Hold breaths: number stepper
- Hold seconds: number stepper
- Side: left/right/none toggle (only for unilateral poses)
- Breath cue: inhale/exhale/hold selector
- Remove step button
- Close editor button

Can be a small panel below the workspace or a drawer.

- [ ] **Step 7: Create ComposeModule component**

Module root. Creates state factory, sets context. Two-pane layout:
```
┌──────────────────┬──────────────────┐
│  FlowWorkspace   │  PosePicker      │
│  (current flow)  │  (browse & add)  │
│                  │                  │
│  [Step 1]        │  [Search...]     │
│  [Step 2]        │  [Standing ▼]    │
│  [Step 3]        │  [Mountain Pose] │
│                  │  [Warrior I]     │
│  [Undo][Clear]   │  [Triangle]      │
│  [Save]          │  [Down Dog]      │
└──────────────────┴──────────────────┘
```

On mobile: stacked vertically. Workspace at top (collapsible), picker below.

- [ ] **Step 8: Wire "Add to Flow" from Library PoseDetail**

The "Add to Flow" button in PoseDetail should:
1. Switch to Compose module
2. Add the selected pose to the current flow

This requires cross-module communication. Approach: add an `addPoseIntent` field to the navigation state factory:

```typescript
// In navigation-state.svelte.ts
let pendingPoseId = $state<string | null>(null);

return {
  // ...existing fields...
  get pendingPoseId() { return pendingPoseId; },
  navigateToComposeWithPose(poseId: string) {
    pendingPoseId = poseId;
    activeModuleId = "compose";
  },
  consumePendingPose() {
    const id = pendingPoseId;
    pendingPoseId = null;
    return id;
  }
};
```

ComposeModule checks `consumePendingPose()` on mount via `$effect` and adds the pose if present.

- [ ] **Step 9: Verify Compose module works end-to-end**

Start dev server. Confirm:
- Can browse poses in the picker
- Clicking a pose adds it to the flow strip
- Flow strip shows steps in order
- Can click a step to edit hold time, breath cue, side
- Undo/redo works
- Save persists to localStorage
- Clearing the flow works
- Responsive layout works (stacked on mobile, side-by-side on desktop)

- [ ] **Step 10: Commit**

```bash
git add src/lib/features/compose/
git commit -m "feat: add Compose module with two-pane flow builder"
```

---

## Task 12: Design System & Visual Polish

**Files:**
- Modify: `src/app.css`
- Modify: All component files (styling pass)

- [ ] **Step 1: Define the visual identity**

Use @superpowers:frontend-design to create a distinctive visual identity. The app should feel:
- Warm and grounding (earth tones, natural greens, soft browns)
- Clean and minimal (lots of breathing room, not cluttered)
- Distinct from TKA's dark/neon/tech aesthetic
- Inviting -- makes you want to get on your mat, not stay at the computer

Color palette direction:
- Primary: warm sage green or terracotta
- Background: warm off-white or very light warm gray
- Text: dark brown or charcoal (not pure black)
- Accent: gold or copper
- Cards: white or very light cream with subtle shadows

- [ ] **Step 2: Apply design tokens to app.css**

Set up the CSS custom property system:
- `--color-primary`, `--color-bg`, `--color-text`, `--color-card`, `--color-accent`
- `--font-size-*` scale (following WCAG AAA minimums: 14px body, 12px supplementary)
- `--spacing-*` scale
- `--radius-*` scale
- Typography: choose a warm, readable font pairing

- [ ] **Step 3: Polish all components**

Go through each component and ensure:
- Consistent use of design tokens
- Proper spacing and alignment
- Hover/active states on interactive elements
- Focus indicators for accessibility
- Smooth transitions (respect prefers-reduced-motion)

- [ ] **Step 4: Verify visual quality**

Review the app on desktop and mobile. Everything should feel cohesive and intentional.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add design system and visual polish"
```

---

## Task 13: Final Integration & Smoke Test

**Files:**
- No new files. Verification only.

- [ ] **Step 1: Run TypeScript check**

```bash
pnpm check
```

Expected: 0 errors.

- [ ] **Step 2: Run build**

```bash
pnpm build
```

Expected: successful build.

- [ ] **Step 3: Full smoke test**

Manual walkthrough:
1. Load app → Library module shows with all poses
2. Search "warrior" → filters to warrior poses
3. Filter by "standing" category → shows standing poses only
4. Click a pose → detail view opens with full metadata
5. Click "Add to Flow" → switches to Compose, pose appears in flow
6. In Compose, search and add 4 more poses
7. Click a step → editor shows, change hold time
8. Click Save → refresh page → flow is preserved
9. Undo → last addition is reverted
10. Clear → flow is emptied
11. Test on mobile viewport → responsive layout works

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final integration verification"
```
