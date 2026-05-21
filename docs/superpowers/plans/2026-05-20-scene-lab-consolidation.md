# Scene Lab Consolidation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the Scene Lab picker from 9 variant-based flat buttons to 10 category-based icon buttons with toggle-first controls, rename "Night Sky" to "Cosmic", and integrate all missing scenes.

**Architecture:** Update the SceneId union and SCENE_OPTIONS array, then propagate changes outward: persistence layer → state → controls → preview → picker UI. ParamPanel gets an `enabled`/`onToggle` prop so each element group has a header toggle instead of a slider hack. New control components for Ember, Cherry Blossom, Celestial, and Autumn scenes.

**Tech Stack:** Svelte 5 (runes), TypeScript, Threlte, FontAwesome icons

---

### Task 1: Update SceneId Type and SCENE_OPTIONS

**Files:**
- Modify: `src/lib/features/lab/tabs/scene-lab/domain/scene-lab-types.ts`

- [ ] **Step 1: Replace SceneId union and SCENE_OPTIONS**

```ts
export type SceneId =
  | "winter"
  | "forest"
  | "autumn"
  | "cosmic"
  | "ocean"
  | "ember"
  | "cherry-blossom"
  | "rainbow"
  | "celestial"
  | "pure-black";

export interface SceneOption {
  id: SceneId;
  label: string;
  icon: string;
  description: string;
}

export const SCENE_OPTIONS: SceneOption[] = [
  {
    id: "winter",
    label: "Winter",
    icon: "fa-snowflake",
    description: "Snowy forest clearing with frozen pond and campfire",
  },
  {
    id: "forest",
    label: "Forest",
    icon: "fa-tree",
    description: "Moonlit forest with fireflies and warm campfire",
  },
  {
    id: "autumn",
    label: "Autumn",
    icon: "fa-leaf",
    description: "Golden-hour forest clearing with falling leaves",
  },
  {
    id: "cosmic",
    label: "Cosmic",
    icon: "fa-moon",
    description: "Deep space with lunar surface, station platform, and Earth rise",
  },
  {
    id: "ocean",
    label: "Ocean",
    icon: "fa-water",
    description: "Sun-drenched coral reef with warm golden caustics and colorful fish",
  },
  {
    id: "ember",
    label: "Ember",
    icon: "fa-fire",
    description: "Volcanic landscape with lava cracks, obsidian pillars, and rising embers",
  },
  {
    id: "cherry-blossom",
    label: "Blossom",
    icon: "fa-spa",
    description: "Moonlit cherry blossom grove with falling petals and stone lanterns",
  },
  {
    id: "rainbow",
    label: "Rainbow",
    icon: "fa-rainbow",
    description: "Pride celebration with rainbow aurora and colorful particles",
  },
  {
    id: "celestial",
    label: "Celestial",
    icon: "fa-star",
    description: "Heavenly cloudscape with golden god rays and floating islands",
  },
  {
    id: "pure-black",
    label: "Black",
    icon: "fa-square",
    description: "Pure black void — isolated performer view",
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/lab/tabs/scene-lab/domain/scene-lab-types.ts
git commit -m "refactor(scene-lab): consolidate SceneId to 10 category-based IDs with icons"
```

---

### Task 2: Update Persistence Layer

**Files:**
- Modify: `src/lib/features/lab/tabs/scene-lab/services/scene-lab-persistence.ts`

- [ ] **Step 1: Update PersistedSceneLabConfigs and add migration**

```ts
import type { SceneId } from "../domain/scene-lab-types";
import type {
  WinterSceneConfig,
  ForestSceneConfig,
  AutumnSceneConfig,
  CosmicSceneConfig,
  OceanSceneConfig,
  EmberSceneConfig,
  CherryBlossomSceneConfig,
  CelestialSceneConfig,
} from "$lib/shared/3d/environments/domain/models/scene-configs";

const STORAGE_KEY = "scene-lab-state";
const CURRENT_VERSION = 2;

export interface PersistedSceneLabConfigs {
  winter: WinterSceneConfig;
  forest: ForestSceneConfig;
  autumn: AutumnSceneConfig;
  cosmicNight: CosmicSceneConfig;
  cosmicAurora: CosmicSceneConfig;
  ocean: OceanSceneConfig;
  ember: EmberSceneConfig;
  cherryBlossom: CherryBlossomSceneConfig;
  celestial: CelestialSceneConfig;
}

export type CosmicVariant = "night" | "aurora";

export interface PersistedSceneLabState {
  version: number;
  sceneId: SceneId;
  cosmicVariant: CosmicVariant;
  configs: PersistedSceneLabConfigs;
}

const SCENE_ID_MIGRATION: Record<string, SceneId> = {
  "forest-firefly": "forest",
  "forest-autumn": "autumn",
  "cosmic-night": "cosmic",
  "cosmic-aurora": "cosmic",
  "ocean-abyss": "ocean",
  "ocean-reef": "ocean",
  "ocean-mystical": "ocean",
  "ocean-cinematic": "ocean",
};

function migrateV1(raw: Record<string, unknown>): PersistedSceneLabState | null {
  const oldSceneId = raw.sceneId as string;
  const configs = raw.configs as Record<string, unknown> | undefined;
  if (!configs) return null;

  const migratedSceneId: SceneId = (SCENE_ID_MIGRATION[oldSceneId] ?? oldSceneId) as SceneId;

  let cosmicVariant: CosmicVariant = "night";
  if (oldSceneId === "cosmic-aurora") cosmicVariant = "aurora";

  return {
    version: CURRENT_VERSION,
    sceneId: migratedSceneId,
    cosmicVariant,
    configs: {
      winter: configs.winter as WinterSceneConfig,
      forest: (configs.forestFirefly ?? configs.forest) as ForestSceneConfig,
      autumn: (configs.forestAutumn ?? configs.autumn) as AutumnSceneConfig,
      cosmicNight: (configs.cosmicNight ?? configs.cosmic) as CosmicSceneConfig,
      cosmicAurora: configs.cosmicAurora as CosmicSceneConfig,
      ocean: (configs.oceanReef ?? configs.ocean) as OceanSceneConfig,
      ember: configs.ember as EmberSceneConfig,
      cherryBlossom: configs.cherryBlossom as CherryBlossomSceneConfig,
      celestial: configs.celestial as CelestialSceneConfig,
    },
  };
}

export function saveSceneLabState(data: PersistedSceneLabState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save scene lab state:", e);
  }
}

export function loadSceneLabState(): PersistedSceneLabState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, unknown>;

    if (data.version === CURRENT_VERSION) return data as unknown as PersistedSceneLabState;
    if (data.version === 1) return migrateV1(data);

    return null;
  } catch {
    return null;
  }
}

export function clearSceneLabState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/lab/tabs/scene-lab/services/scene-lab-persistence.ts
git commit -m "refactor(scene-lab): update persistence to v2 with migration from v1 scene IDs"
```

---

### Task 3: Update Scene Lab State

**Files:**
- Modify: `src/lib/features/lab/tabs/scene-lab/state/scene-lab-state.svelte.ts`

- [ ] **Step 1: Rewrite state factory with new config shape**

```ts
import {
  type ForestSceneConfig,
  type AutumnSceneConfig,
  type WinterSceneConfig,
  type CosmicSceneConfig,
  type OceanSceneConfig,
  type EmberSceneConfig,
  type CherryBlossomSceneConfig,
  type CelestialSceneConfig,
  createDefaultAutumnConfig,
  createDefaultForestFireflyConfig,
  createDefaultWinterConfig,
  createDefaultCosmicNightConfig,
  createDefaultCosmicAuroraConfig,
  createDefaultOceanReefConfig,
  createDefaultEmberGlowConfig,
  createDefaultCherryBlossomConfig,
  createDefaultCelestialConfig,
} from "$lib/shared/3d/environments/domain/models/scene-configs";
import type { SceneId } from "../domain/scene-lab-types";
import type { CosmicVariant } from "../services/scene-lab-persistence";
import { loadSceneLabState } from "../services/scene-lab-persistence";

export function createSceneLabState() {
  const persisted = loadSceneLabState();

  let sceneId = $state<SceneId>(persisted?.sceneId ?? "winter");
  let cosmicVariant = $state<CosmicVariant>(persisted?.cosmicVariant ?? "night");

  let winterConfig = $state<WinterSceneConfig>(
    persisted?.configs.winter ?? createDefaultWinterConfig()
  );
  let forestConfig = $state<ForestSceneConfig>(
    persisted?.configs.forest ?? createDefaultForestFireflyConfig()
  );
  let autumnConfig = $state<AutumnSceneConfig>(
    persisted?.configs.autumn ?? createDefaultAutumnConfig()
  );
  let cosmicNightConfig = $state<CosmicSceneConfig>(
    persisted?.configs.cosmicNight ?? createDefaultCosmicNightConfig()
  );
  let cosmicAuroraConfig = $state<CosmicSceneConfig>(
    persisted?.configs.cosmicAurora ?? createDefaultCosmicAuroraConfig()
  );
  let oceanConfig = $state<OceanSceneConfig>(
    persisted?.configs.ocean ?? createDefaultOceanReefConfig()
  );
  let emberConfig = $state<EmberSceneConfig>(
    persisted?.configs.ember ?? createDefaultEmberGlowConfig()
  );
  let cherryBlossomConfig = $state<CherryBlossomSceneConfig>(
    persisted?.configs.cherryBlossom ?? createDefaultCherryBlossomConfig()
  );
  let celestialConfig = $state<CelestialSceneConfig>(
    persisted?.configs.celestial ?? createDefaultCelestialConfig()
  );

  $effect(() => {
    const serialized = JSON.stringify({
      version: 2,
      sceneId,
      cosmicVariant,
      configs: {
        winter: winterConfig,
        forest: forestConfig,
        autumn: autumnConfig,
        cosmicNight: cosmicNightConfig,
        cosmicAurora: cosmicAuroraConfig,
        ocean: oceanConfig,
        ember: emberConfig,
        cherryBlossom: cherryBlossomConfig,
        celestial: celestialConfig,
      },
    });
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("scene-lab-state", serialized);
      } catch {
        // noop
      }
    }, 500);
    return () => clearTimeout(timer);
  });

  function resetCurrent() {
    switch (sceneId) {
      case "winter": winterConfig = createDefaultWinterConfig(); break;
      case "forest": forestConfig = createDefaultForestFireflyConfig(); break;
      case "autumn": autumnConfig = createDefaultAutumnConfig(); break;
      case "cosmic":
        if (cosmicVariant === "night") cosmicNightConfig = createDefaultCosmicNightConfig();
        else cosmicAuroraConfig = createDefaultCosmicAuroraConfig();
        break;
      case "ocean": oceanConfig = createDefaultOceanReefConfig(); break;
      case "ember": emberConfig = createDefaultEmberGlowConfig(); break;
      case "cherry-blossom": cherryBlossomConfig = createDefaultCherryBlossomConfig(); break;
      case "celestial": celestialConfig = createDefaultCelestialConfig(); break;
    }
  }

  function currentConfigSnapshot(): unknown {
    switch (sceneId) {
      case "winter": return $state.snapshot(winterConfig);
      case "forest": return $state.snapshot(forestConfig);
      case "autumn": return $state.snapshot(autumnConfig);
      case "cosmic": return $state.snapshot(cosmicVariant === "night" ? cosmicNightConfig : cosmicAuroraConfig);
      case "ocean": return $state.snapshot(oceanConfig);
      case "ember": return $state.snapshot(emberConfig);
      case "cherry-blossom": return $state.snapshot(cherryBlossomConfig);
      case "celestial": return $state.snapshot(celestialConfig);
      default: return {};
    }
  }

  function currentDefaultFnName(): string {
    switch (sceneId) {
      case "winter": return "createDefaultWinterConfig";
      case "forest": return "createDefaultForestFireflyConfig";
      case "autumn": return "createDefaultAutumnConfig";
      case "cosmic": return cosmicVariant === "night" ? "createDefaultCosmicNightConfig" : "createDefaultCosmicAuroraConfig";
      case "ocean": return "createDefaultOceanReefConfig";
      case "ember": return "createDefaultEmberGlowConfig";
      case "cherry-blossom": return "createDefaultCherryBlossomConfig";
      case "celestial": return "createDefaultCelestialConfig";
      default: return "createDefaultWinterConfig";
    }
  }

  function currentConfigTypeName(): string {
    switch (sceneId) {
      case "winter": return "WinterSceneConfig";
      case "forest": return "ForestSceneConfig";
      case "autumn": return "AutumnSceneConfig";
      case "cosmic": return "CosmicSceneConfig";
      case "ocean": return "OceanSceneConfig";
      case "ember": return "EmberSceneConfig";
      case "cherry-blossom": return "CherryBlossomSceneConfig";
      case "celestial": return "CelestialSceneConfig";
      default: return "unknown";
    }
  }

  async function copyCurrentToClipboard(): Promise<void> {
    const snapshot = currentConfigSnapshot();
    const tsCode = `export function ${currentDefaultFnName()}(): ${currentConfigTypeName()} {\n  return ${JSON.stringify(snapshot, null, 2)};\n}\n`;
    await navigator.clipboard.writeText(tsCode);
  }

  return {
    get sceneId() { return sceneId; },
    setSceneId(id: SceneId) { sceneId = id; },
    get cosmicVariant() { return cosmicVariant; },
    setCosmicVariant(v: CosmicVariant) { cosmicVariant = v; },
    get winterConfig() { return winterConfig; },
    get forestConfig() { return forestConfig; },
    get autumnConfig() { return autumnConfig; },
    get cosmicNightConfig() { return cosmicNightConfig; },
    get cosmicAuroraConfig() { return cosmicAuroraConfig; },
    get oceanConfig() { return oceanConfig; },
    get emberConfig() { return emberConfig; },
    get cherryBlossomConfig() { return cherryBlossomConfig; },
    get celestialConfig() { return celestialConfig; },
    resetCurrent,
    copyCurrentToClipboard,
  };
}

export type SceneLabState = ReturnType<typeof createSceneLabState>;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/lab/tabs/scene-lab/state/scene-lab-state.svelte.ts
git commit -m "refactor(scene-lab): update state factory for consolidated scene IDs"
```

---

### Task 4: Add Toggle Support to ParamPanel

**Files:**
- Modify: `src/lib/features/lab/tabs/scene-lab/components/ParamPanel.svelte`

- [ ] **Step 1: Add enabled/onToggle props and pill-switch toggle**

```svelte
<script lang="ts">
  import { untrack, type Snippet } from "svelte";

  interface Props {
    title: string;
    defaultOpen?: boolean;
    enabled?: boolean;
    onToggle?: (v: boolean) => void;
    children: Snippet;
  }

  let { title, defaultOpen = true, enabled = undefined, onToggle, children }: Props = $props();

  let open = $state(untrack(() => defaultOpen));

  const hasToggle = $derived(enabled !== undefined);
  const isEnabled = $derived(enabled ?? true);
</script>

<div class="param-panel" class:open={open && isEnabled} class:disabled={!isEnabled}>
  <div class="panel-header">
    <button
      class="header-label"
      onclick={() => {
        if (isEnabled) open = !open;
      }}
      disabled={!isEnabled}
    >
      {#if isEnabled}
        <span class="chevron" class:rotated={open}>▸</span>
      {/if}
      <span class="title">{title}</span>
    </button>

    {#if hasToggle}
      <button
        class="toggle-pill"
        class:on={isEnabled}
        aria-pressed={isEnabled}
        onclick={() => onToggle?.(!isEnabled)}
      >
        <span class="toggle-knob"></span>
      </button>
    {/if}
  </div>
  {#if open && isEnabled}
    <div class="panel-body">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .param-panel {
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .param-panel.disabled {
    opacity: 0.4;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 0;
  }

  .header-label {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    background: none;
    border: none;
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    text-align: left;
    padding: 0;
  }

  .header-label:disabled {
    cursor: default;
  }

  .header-label:not(:disabled):hover .title {
    color: var(--theme-accent, #38bdf8);
  }

  .chevron {
    display: inline-block;
    font-size: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    transition: transform 150ms ease;
  }

  .chevron.rotated {
    transform: rotate(90deg);
  }

  .title {
    flex: 1;
    transition: color 150ms ease;
  }

  .toggle-pill {
    position: relative;
    width: 32px;
    height: 18px;
    border-radius: 9px;
    border: none;
    background: rgba(255, 255, 255, 0.12);
    cursor: pointer;
    transition: background 150ms ease;
    flex-shrink: 0;
    padding: 0;
  }

  .toggle-pill.on {
    background: var(--theme-accent, #38bdf8);
  }

  .toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    transition: transform 150ms ease;
  }

  .toggle-pill.on .toggle-knob {
    transform: translateX(14px);
  }

  .toggle-pill:focus-visible {
    outline: 2px solid var(--theme-accent, #38bdf8);
    outline-offset: 2px;
  }

  .panel-body {
    padding: 4px 0 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/lab/tabs/scene-lab/components/ParamPanel.svelte
git commit -m "feat(scene-lab): add toggle-pill to ParamPanel for element enable/disable"
```

---

### Task 5: Update Existing Controls to Use Toggles

**Files:**
- Modify: `src/lib/features/lab/tabs/scene-lab/components/OceanControls.svelte`
- Modify: `src/lib/features/lab/tabs/scene-lab/components/CosmicControls.svelte`
- Modify: `src/lib/features/lab/tabs/scene-lab/components/WinterControls.svelte`
- Modify: `src/lib/features/lab/tabs/scene-lab/components/ForestControls.svelte`

- [ ] **Step 1: Rewrite OceanControls — reef-only, toggle-first**

Remove the `OCEAN_CONFIGS` map. Read/write `state.oceanConfig` directly. Replace every `<ParamSlider label="Enabled" value={cfg.X.enabled ? 1 : 0} min={0} max={1} step={1}>` with `<ParamPanel title="X" enabled={cfg.X.enabled} onToggle={(v) => (mutate().X.enabled = v)}>`.

The `script` block becomes:

```svelte
<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  const { state } = getSceneLabContext();
  const cfg = $derived(state.oceanConfig);
  function mut() { return state.oceanConfig; }
</script>
```

For every section with an `enabled` property, change from:

```svelte
<ParamPanel title="Coral">
  <ParamSlider label="Enabled" value={cfg.coral.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => (mut().coral.enabled = v > 0.5)} />
  <!-- sliders -->
</ParamPanel>
```

To:

```svelte
<ParamPanel title="Coral" enabled={cfg.coral.enabled} onToggle={(v) => (mut().coral.enabled = v)}>
  <!-- sliders only, no Enabled hack -->
</ParamPanel>
```

Apply the same transformation for: Coral, Kelp, Fish, Decorations, Jellyfish, Caustics, God Rays.

Sections without `.enabled` (Sky, Fog, Ground, Bubbles, Dust, Plankton, Rocks, Hemisphere Light) keep the current ParamPanel (no toggle).

- [ ] **Step 2: Update CosmicControls — remove variant prop, add variant segmented control**

Remove the `variant` prop. Read cosmicVariant from state. Add a segmented control at the top:

```svelte
<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  const { state } = getSceneLabContext();
  const cfg = $derived(
    state.cosmicVariant === "night" ? state.cosmicNightConfig : state.cosmicAuroraConfig
  );

  function mut() {
    return state.cosmicVariant === "night"
      ? state.cosmicNightConfig
      : state.cosmicAuroraConfig;
  }
</script>

<div class="variant-strip">
  <button
    class:active={state.cosmicVariant === "night"}
    onclick={() => state.setCosmicVariant("night")}
  >Night</button>
  <button
    class:active={state.cosmicVariant === "aurora"}
    onclick={() => state.setCosmicVariant("aurora")}
  >Aurora</button>
</div>
```

Then convert all `<ParamSlider label="Enabled" ...>` hacks to ParamPanel toggles for: Platform, Earth, Nebula, Energy Particles, Meteor Streaks, Cold Directional Light, Warm Station Glow, Accent Emissive.

Add `.variant-strip` styles matching the existing `.cam-toggle` pattern from ScenePreview.

- [ ] **Step 3: Update WinterControls — toggle-first**

Replace slider-enabled hacks for Frozen Pond, Campfire, and Moon Light with ParamPanel toggles:

```svelte
<!-- Before -->
<ParamPanel title="Frozen pond" defaultOpen={false}>
  <ParamSlider label="Enabled" value={cfg.pond.enabled ? 1 : 0} .../>

<!-- After -->
{#if cfg.pond}
  <ParamPanel title="Frozen pond" defaultOpen={false} enabled={cfg.pond.enabled} onToggle={(v) => { if (state.winterConfig.pond) state.winterConfig.pond.enabled = v; }}>
```

Same pattern for campfire and moonLight sections.

- [ ] **Step 4: Update ForestControls — use forestConfig**

Change `state.forestFireflyConfig` → `state.forestConfig` throughout:

```svelte
const cfg = $derived(state.forestConfig);
function mutable() { return state.forestConfig; }
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/lab/tabs/scene-lab/components/OceanControls.svelte src/lib/features/lab/tabs/scene-lab/components/CosmicControls.svelte src/lib/features/lab/tabs/scene-lab/components/WinterControls.svelte src/lib/features/lab/tabs/scene-lab/components/ForestControls.svelte
git commit -m "refactor(scene-lab): migrate controls to toggle-first ParamPanel, simplify ocean to reef"
```

---

### Task 6: Create New Control Components

**Files:**
- Create: `src/lib/features/lab/tabs/scene-lab/components/AutumnControls.svelte`
- Create: `src/lib/features/lab/tabs/scene-lab/components/EmberControls.svelte`
- Create: `src/lib/features/lab/tabs/scene-lab/components/CherryBlossomControls.svelte`
- Create: `src/lib/features/lab/tabs/scene-lab/components/CelestialControls.svelte`

- [ ] **Step 1: Create AutumnControls.svelte**

Pattern matches WinterControls. Read `state.autumnConfig`. The AutumnSceneConfig has: sky, fog, ground, treeRings, clearing, campfire (nullable, toggleable), hemisphereLight, directionalLight (nullable, toggleable), leaves (FallingParticlesConfig), fireflies (nullable).

```svelte
<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  const { state } = getSceneLabContext();
  const cfg = $derived(state.autumnConfig);
  function mut() { return state.autumnConfig; }
</script>
```

Add ParamPanel sections for each config group. Use `enabled`/`onToggle` for sections with `.enabled` fields. Check the AutumnSceneConfig interface in `scene-configs.ts` (around line 619) for exact field names and structure.

- [ ] **Step 2: Create EmberControls.svelte**

Read `state.emberConfig`. EmberSceneConfig groups: sky, fog, ground, lavaCracks (toggleable), lavaPool (toggleable), obsidianPillars (toggleable), fireWisps (nullable+toggleable), emberFountains (nullable+toggleable), volcanicHaze (nullable+toggleable), embers (particles), ash (nullable particles), smoke (nullable particles), rocks, hemisphereLight, skyLight (nullable+toggleable).

```svelte
<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  const { state } = getSceneLabContext();
  const cfg = $derived(state.emberConfig);
  function mut() { return state.emberConfig; }
</script>
```

For each nullable section (fireWisps, emberFountains, etc.), gate with `{#if cfg.fireWisps}` and use ParamPanel toggle. For sections with explicit `.enabled` field (lavaCracks, lavaPool, obsidianPillars), use ParamPanel `enabled` prop.

- [ ] **Step 3: Create CherryBlossomControls.svelte**

Read `state.cherryBlossomConfig`. CherryBlossomSceneConfig groups: sky, fog, ground, petals (particles), distantPetals (nullable), fireflies (nullable), treeRings, pond (nullable+toggleable), toriiGate (toggleable), hangingLanterns (toggleable), hemisphereLight, moonLight (nullable+toggleable).

```svelte
<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  const { state } = getSceneLabContext();
  const cfg = $derived(state.cherryBlossomConfig);
  function mut() { return state.cherryBlossomConfig; }
</script>
```

- [ ] **Step 4: Create CelestialControls.svelte**

Read `state.celestialConfig`. CelestialSceneConfig groups: sky, fog, ground, cloudDome (toggleable), godRays (toggleable), cloudPlatform (toggleable), cloudIslands (toggleable), celestialPillars (toggleable), motes (particles), wisps (nullable particles), hemisphereLight, sunLight (nullable+toggleable).

```svelte
<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  const { state } = getSceneLabContext();
  const cfg = $derived(state.celestialConfig);
  function mut() { return state.celestialConfig; }
</script>
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/lab/tabs/scene-lab/components/AutumnControls.svelte src/lib/features/lab/tabs/scene-lab/components/EmberControls.svelte src/lib/features/lab/tabs/scene-lab/components/CherryBlossomControls.svelte src/lib/features/lab/tabs/scene-lab/components/CelestialControls.svelte
git commit -m "feat(scene-lab): add control panels for Autumn, Ember, Cherry Blossom, Celestial"
```

---

### Task 7: Update ScenePreview

**Files:**
- Modify: `src/lib/features/lab/tabs/scene-lab/components/ScenePreview.svelte`

- [ ] **Step 1: Add missing scene imports and update conditionals**

Add imports at the top:

```ts
import EmberScene from "$lib/shared/3d/environments/scenes/EmberScene.svelte";
import CherryBlossomScene from "$lib/shared/3d/environments/scenes/CherryBlossomScene.svelte";
import RainbowScene from "$lib/shared/3d/environments/scenes/RainbowScene.svelte";
import CelestialScene from "$lib/shared/3d/environments/scenes/CelestialScene.svelte";
```

Replace the scene-rendering block (lines 273-291) with:

```svelte
{#if labState.sceneId === "winter"}
  <WinterScene config={labState.winterConfig} />
{:else if labState.sceneId === "forest"}
  <ForestScene variant="firefly" config={labState.forestConfig} />
{:else if labState.sceneId === "autumn"}
  <AutumnScene config={labState.autumnConfig} />
{:else if labState.sceneId === "cosmic"}
  <CosmicScene variant={labState.cosmicVariant} config={labState.cosmicVariant === "night" ? labState.cosmicNightConfig : labState.cosmicAuroraConfig} />
{:else if labState.sceneId === "ocean"}
  <OceanScene variant="reef" config={labState.oceanConfig} />
{:else if labState.sceneId === "ember"}
  <EmberScene config={labState.emberConfig} />
{:else if labState.sceneId === "cherry-blossom"}
  <CherryBlossomScene config={labState.cherryBlossomConfig} />
{:else if labState.sceneId === "rainbow"}
  <RainbowScene />
{:else if labState.sceneId === "celestial"}
  <CelestialScene config={labState.celestialConfig} />
{/if}
```

Note: `pure-black` renders nothing (no scene component). `rainbow` passes no config prop (it has no config factory).

- [ ] **Step 2: Verify scene components accept config prop**

Check that EmberScene, CherryBlossomScene, and CelestialScene accept an optional `config` prop. If not, verify the prop names by reading their `<script>` blocks. The forest/winter/cosmic/ocean scenes already accept `config` — the new scenes may use a different pattern. Read the first 20 lines of each scene file to confirm the prop name before wiring.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/lab/tabs/scene-lab/components/ScenePreview.svelte
git commit -m "feat(scene-lab): update ScenePreview for all 10 scene types"
```

---

### Task 8: Update SceneLab Picker UI and Controls Routing

**Files:**
- Modify: `src/lib/features/lab/tabs/scene-lab/SceneLab.svelte`

- [ ] **Step 1: Add icon to scene-strip buttons**

Update the button template in the `{#each SCENE_OPTIONS}` block:

```svelte
<div class="scene-strip">
  {#each SCENE_OPTIONS as option}
    <button
      class:active={sceneState.sceneId === option.id}
      onclick={() => sceneState.setSceneId(option.id)}
      title={option.description}
    >
      <i class="fas {option.icon}"></i>
      {option.label}
    </button>
  {/each}
</div>
```

Add `gap: 5px` to `.scene-strip button` so the icon and label have breathing room. Add `font-size: 11px` to the icon `i` tag.

- [ ] **Step 2: Update controls routing**

Add imports for new controls:

```ts
import AutumnControls from "./components/AutumnControls.svelte";
import EmberControls from "./components/EmberControls.svelte";
import CherryBlossomControls from "./components/CherryBlossomControls.svelte";
import CelestialControls from "./components/CelestialControls.svelte";
```

Replace the control routing block (lines 126-136):

```svelte
{:else if sceneState.sceneId === "winter"}
  <WinterControls />
{:else if sceneState.sceneId === "cosmic"}
  <CosmicControls />
{:else if sceneState.sceneId === "ocean"}
  <OceanControls />
{:else if sceneState.sceneId === "forest"}
  <ForestControls />
{:else if sceneState.sceneId === "autumn"}
  <AutumnControls />
{:else if sceneState.sceneId === "ember"}
  <EmberControls />
{:else if sceneState.sceneId === "cherry-blossom"}
  <CherryBlossomControls />
{:else if sceneState.sceneId === "celestial"}
  <CelestialControls />
{:else}
  <p class="no-controls">No tunable parameters</p>
{/if}
```

Note: CosmicControls no longer takes a `variant` prop (it reads from state internally).

- [ ] **Step 3: Add .no-controls style**

```css
.no-controls {
  padding: 24px 12px;
  text-align: center;
  color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  font-size: var(--font-size-compact, 12px);
  font-style: italic;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/lab/tabs/scene-lab/SceneLab.svelte
git commit -m "feat(scene-lab): icon picker with 10 scenes, updated controls routing"
```

---

### Task 9: Rename Night Sky → Cosmic in EnvironmentSettingsPanel

**Files:**
- Modify: `src/lib/shared/3d/components/controls/EnvironmentSettingsPanel.svelte`

- [ ] **Step 1: Change label**

On line 42, change:

```ts
name: "Night Sky",
```

To:

```ts
name: "Cosmic",
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/components/controls/EnvironmentSettingsPanel.svelte
git commit -m "fix(ui): rename Night Sky → Cosmic in environment settings panel"
```

---

### Task 10: Build and Typecheck

- [ ] **Step 1: Run typecheck**

```bash
npm run check
```

Fix any type errors that surface from the SceneId changes propagating through the codebase. Common places: any file that imports `SceneId` and switches on old values like `"forest-firefly"`, `"ocean-reef"`, etc.

- [ ] **Step 2: Run build**

```bash
npm run build
```

- [ ] **Step 3: Fix any remaining errors and commit**

```bash
git add -u
git commit -m "fix: resolve typecheck errors from scene lab consolidation"
```

---

### Task 11: Verify in Browser

- [ ] **Step 1: Start dev server on port 5174**

```bash
npx vite --port 5174
```

- [ ] **Step 2: Open Scene Lab, verify:**

1. All 10 scene buttons appear with icons
2. Clicking each scene switches the preview
3. Toggle pills on ParamPanel sections work (enable/disable elements)
4. Cosmic variant toggle (Night/Aurora) works inside CosmicControls
5. Ocean shows reef scene only
6. Ember, Cherry Blossom, Celestial controls render with sliders
7. Rainbow and Black show "No tunable parameters"
8. EnvironmentSettingsPanel shows "Cosmic" not "Night Sky"

- [ ] **Step 3: Report verification result**

Either provide screenshot evidence or state: "I cannot verify this visually. Please check [specific things] and tell me what you see."
