# Theme Lab Unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the 2D Background Builder and 3D Scene Lab into a single "Themes" lab tab with a unified theme picker, 2D/3D mode toggle, and adaptive controls panel.

**Architecture:** A thin mapping layer translates between the new `ThemeId` type and existing `BackgroundType` (npm enum) + `SceneId` (scene-lab type). ThemesLab provides `SceneLabContext` for 3D preview reuse. 2D mode routes to existing `*Lab.svelte` components unchanged. Tab registration replaces both old tabs with one "themes" tab.

**Tech Stack:** Svelte 5 (runes), `@austencloud/backgrounds` v0.3.0 (npm), `@austencloud/chip-toggle`, Threlte, settingsService for persistence.

**Dependency Note:** Tasks 1–8 (Stream A) build the full UI shell — functional for 8/10 themes in 2D and 10/10 in 3D. Tasks 9–12 (Stream B) depend on publishing a new version of `@austencloud/backgrounds` with `PURE_BLACK` enum + two new canvas systems. Stream B is blocked until that npm publish happens. Stream A ships independently.

---

## File Structure

```
src/lib/features/themes-lab/
├── ThemesLab.svelte                    # Main shell — strip + header + content routing
├── domain/
│   └── theme-types.ts                  # ThemeId, ThemeOption, THEME_OPTIONS
├── state/
│   └── themes-lab-state.svelte.ts      # Reactive state (selected theme, mode, 3D config context)
└── components/
    ├── ThemeStrip.svelte               # Horizontal scrolling chip strip
    ├── ThemeHeader.svelte              # Name + color dot + mode badge + pill toggle
    └── ThemeControlsPanel.svelte       # Progressive disclosure wrapper for 3D controls

Tests:
tests/unit/themes-lab/
├── theme-types.test.ts                 # THEME_OPTIONS coverage + mapping correctness
└── themes-lab-state.test.ts            # State transitions, mode switching, context shape

Modified:
src/lib/shared/navigation/config/tab-definitions.ts    # Remove 2 tabs, add 1
src/lib/features/lab/LabModule.svelte                   # Remove 2 imports, add 1
```

---

## Stream A: UI Shell (no npm dependency)

### Task 1: Theme Domain Types

**Files:**
- Create: `src/lib/features/themes-lab/domain/theme-types.ts`
- Test: `tests/unit/themes-lab/theme-types.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/themes-lab/theme-types.test.ts
import { describe, it, expect } from "vitest";
import { BackgroundType } from "@austencloud/backgrounds";
import {
  THEME_OPTIONS,
  getThemeOption,
  type ThemeId,
} from "$lib/features/themes-lab/domain/theme-types";

describe("THEME_OPTIONS", () => {
  it("has exactly 10 themes", () => {
    expect(THEME_OPTIONS).toHaveLength(10);
  });

  it("every theme has unique id", () => {
    const ids = THEME_OPTIONS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every theme has both backgroundType and sceneId", () => {
    for (const theme of THEME_OPTIONS) {
      expect(theme.backgroundType).toBeTruthy();
      expect(theme.sceneId).toBeTruthy();
    }
  });

  it("maps ocean ThemeId to DEEP_OCEAN BackgroundType and ocean SceneId", () => {
    const ocean = getThemeOption("ocean");
    expect(ocean?.backgroundType).toBe("deepOcean" as BackgroundType);
    expect(ocean?.sceneId).toBe("ocean");
  });

  it("maps cosmic ThemeId to NIGHT_SKY BackgroundType and cosmic SceneId", () => {
    const cosmic = getThemeOption("cosmic");
    expect(cosmic?.backgroundType).toBe("nightSky" as BackgroundType);
    expect(cosmic?.sceneId).toBe("cosmic");
  });

  it("returns undefined for invalid ThemeId", () => {
    expect(getThemeOption("invalid" as ThemeId)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/themes-lab/theme-types.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/features/themes-lab/domain/theme-types.ts
import type { BackgroundType } from "@austencloud/backgrounds";
import type { SceneId } from "$lib/features/lab/tabs/scene-lab/domain/scene-lab-types";

export type ThemeId =
  | "ocean"
  | "cosmic"
  | "forest"
  | "blossom"
  | "pride"
  | "ember"
  | "winter"
  | "autumn"
  | "celestial"
  | "pure-black";

export interface ThemeOption {
  id: ThemeId;
  label: string;
  icon: string;
  color: string;
  backgroundType: BackgroundType;
  sceneId: SceneId;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "ocean",
    label: "Ocean",
    icon: "fa-water",
    color: "#0ea5e9",
    backgroundType: "deepOcean" as BackgroundType,
    sceneId: "ocean",
  },
  {
    id: "cosmic",
    label: "Cosmic",
    icon: "fa-moon",
    color: "#8b5cf6",
    backgroundType: "nightSky" as BackgroundType,
    sceneId: "cosmic",
  },
  {
    id: "forest",
    label: "Forest",
    icon: "fa-tree",
    color: "#22c55e",
    backgroundType: "fireflyForest" as BackgroundType,
    sceneId: "forest",
  },
  {
    id: "blossom",
    label: "Blossom",
    icon: "fa-spa",
    color: "#f472b6",
    backgroundType: "cherryBlossom" as BackgroundType,
    sceneId: "cherry-blossom",
  },
  {
    id: "pride",
    label: "Pride",
    icon: "fa-rainbow",
    color: "#f59e0b",
    backgroundType: "pride" as BackgroundType,
    sceneId: "rainbow",
  },
  {
    id: "ember",
    label: "Ember",
    icon: "fa-fire",
    color: "#ef4444",
    backgroundType: "emberGlow" as BackgroundType,
    sceneId: "ember",
  },
  {
    id: "winter",
    label: "Winter",
    icon: "fa-snowflake",
    color: "#67e8f9",
    backgroundType: "snowfall" as BackgroundType,
    sceneId: "winter",
  },
  {
    id: "autumn",
    label: "Autumn",
    icon: "fa-leaf",
    color: "#d97706",
    backgroundType: "autumnDrift" as BackgroundType,
    sceneId: "autumn",
  },
  {
    id: "celestial",
    label: "Celestial",
    icon: "fa-star",
    color: "#e2e8f0",
    backgroundType: "celestial" as BackgroundType,
    sceneId: "celestial",
  },
  {
    id: "pure-black",
    label: "Pure Black",
    icon: "fa-square",
    color: "#6b7280",
    backgroundType: "pureBlack" as BackgroundType,
    sceneId: "pure-black",
  },
];

export function getThemeOption(id: ThemeId): ThemeOption | undefined {
  return THEME_OPTIONS.find((t) => t.id === id);
}
```

**Note on BackgroundType casts:** `BackgroundType` is a string enum in the npm package. The values are camelCase strings like `"deepOcean"`, `"nightSky"`. The `as BackgroundType` casts are needed because TypeScript won't auto-narrow string literals to the enum. `"pureBlack"` won't exist in the enum until the npm package is updated — the cast lets the code compile now. When `PURE_BLACK` is added to the enum (Task 9), this cast becomes valid.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/themes-lab/theme-types.test.ts`
Expected: PASS (all 6 tests).

**Important:** The `pureBlack` cast will compile but `BackgroundType.PURE_BLACK` doesn't exist yet. The test for `pure-black` theme will pass because we're testing the mapping layer, not the enum value. This is correct — the mapping layer works ahead of the enum.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/themes-lab/domain/theme-types.ts tests/unit/themes-lab/theme-types.test.ts
git commit -m "feat(themes-lab): add ThemeId type and THEME_OPTIONS mapping layer"
```

---

### Task 2: ThemesLab State Management

**Files:**
- Create: `src/lib/features/themes-lab/state/themes-lab-state.svelte.ts`
- Test: `tests/unit/themes-lab/themes-lab-state.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/themes-lab/themes-lab-state.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStorage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
});

// Mock settingsService — we test that the state calls it, not its internals
const mockUpdateSetting = vi.fn();
vi.mock("$lib/shared/settings/state/SettingsState.svelte", () => ({
  settingsService: {
    settings: { backgroundType: "deepOcean" },
    updateSetting: (...args: unknown[]) => mockUpdateSetting(...args),
  },
}));

import { createThemesLabState } from "$lib/features/themes-lab/state/themes-lab-state.svelte";

describe("createThemesLabState", () => {
  beforeEach(() => {
    mockStorage.clear();
    mockUpdateSetting.mockClear();
  });

  it("defaults to ocean theme in 2d mode", () => {
    const state = createThemesLabState();
    expect(state.themeId).toBe("ocean");
    expect(state.mode).toBe("2d");
  });

  it("setTheme updates themeId and fires settingsService", () => {
    const state = createThemesLabState();
    state.setTheme("cosmic");
    expect(state.themeId).toBe("cosmic");
    expect(mockUpdateSetting).toHaveBeenCalledWith(
      "backgroundType",
      expect.any(String)
    );
  });

  it("setMode toggles between 2d and 3d", () => {
    const state = createThemesLabState();
    state.setMode("3d");
    expect(state.mode).toBe("3d");
    state.setMode("2d");
    expect(state.mode).toBe("2d");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/themes-lab/themes-lab-state.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/features/themes-lab/state/themes-lab-state.svelte.ts
import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
import { createSceneLabState } from "$lib/features/lab/tabs/scene-lab/state/scene-lab-state.svelte";
import { createComposerEditorState } from "$lib/shared/3d/scene-composer/composer-editor-state.svelte";
import {
  THEME_OPTIONS,
  getThemeOption,
  type ThemeId,
} from "../domain/theme-types";
import type { SceneLabContext } from "$lib/features/lab/tabs/scene-lab/context/scene-lab-context";

export type ThemeMode = "2d" | "3d";

export function createThemesLabState() {
  let themeId = $state<ThemeId>("ocean");
  let mode = $state<ThemeMode>("2d");

  const sceneState = createSceneLabState();
  const composerState = createComposerEditorState();

  function setTheme(id: ThemeId) {
    themeId = id;

    const option = getThemeOption(id);
    if (!option) return;

    // Sync scene-lab state so ScenePreview renders the right scene
    sceneState.setSceneId(option.sceneId);

    // Update the production background setting
    void settingsService.updateSetting("backgroundCategory", "animated");
    void settingsService.updateSetting("backgroundType", option.backgroundType);
  }

  function setMode(m: ThemeMode) {
    mode = m;
  }

  // Context object compatible with ScenePreview's getSceneLabContext()
  const sceneLabContext: SceneLabContext = {
    get state() { return sceneState; },
    get composerState() { return composerState; },
  };

  return {
    get themeId() { return themeId; },
    get mode() { return mode; },
    get sceneState() { return sceneState; },
    get composerState() { return composerState; },
    get sceneLabContext() { return sceneLabContext; },
    get currentTheme() { return getThemeOption(themeId); },
    setTheme,
    setMode,
    themeOptions: THEME_OPTIONS,
  };
}

export type ThemesLabState = ReturnType<typeof createThemesLabState>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/themes-lab/themes-lab-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/themes-lab/state/themes-lab-state.svelte.ts tests/unit/themes-lab/themes-lab-state.test.ts
git commit -m "feat(themes-lab): add themes-lab-state with scene-lab context bridge"
```

---

### Task 3: ThemeStrip Component

**Files:**
- Create: `src/lib/features/themes-lab/components/ThemeStrip.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/features/themes-lab/components/ThemeStrip.svelte -->
<script lang="ts">
  import type { ThemeId, ThemeOption } from "../domain/theme-types";

  interface Props {
    themes: ThemeOption[];
    activeId: ThemeId;
    onSelect: (id: ThemeId) => void;
  }

  let { themes, activeId, onSelect }: Props = $props();
</script>

<nav class="theme-strip" role="tablist" aria-label="Theme selection">
  {#each themes as theme (theme.id)}
    <button
      role="tab"
      aria-selected={activeId === theme.id}
      class:active={activeId === theme.id}
      style:--chip-color={theme.color}
      onclick={() => onSelect(theme.id)}
    >
      <span class="dot" style:background={theme.color}></span>
      <span class="label">{theme.label}</span>
    </button>
  {/each}
</nav>

<style>
  .theme-strip {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: rgba(10, 14, 26, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .theme-strip::-webkit-scrollbar {
    display: none;
  }

  button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    background: transparent;
    border: none;
    border-radius: 9px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: all 180ms cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
  }

  button:hover {
    color: rgba(255, 255, 255, 0.92);
    background: rgba(255, 255, 255, 0.06);
  }

  button:active {
    transform: scale(0.97);
    transition: transform 80ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  button.active {
    background: color-mix(in srgb, var(--chip-color) 22%, transparent);
    color: white;
    box-shadow:
      0 0 12px color-mix(in srgb, var(--chip-color) 18%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  button:focus-visible {
    outline: 2px solid var(--chip-color, var(--theme-accent, #38bdf8));
    outline-offset: 2px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .label {
    line-height: 1;
  }
</style>
```

- [ ] **Step 2: Verify typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json` (or `npm run check`)
Expected: No new errors from ThemeStrip.svelte.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/themes-lab/components/ThemeStrip.svelte
git commit -m "feat(themes-lab): add ThemeStrip scrolling chip selector"
```

---

### Task 4: ThemeHeader Component

**Files:**
- Create: `src/lib/features/themes-lab/components/ThemeHeader.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/features/themes-lab/components/ThemeHeader.svelte -->
<script lang="ts">
  import type { ThemeMode } from "../state/themes-lab-state.svelte";

  interface Props {
    label: string;
    color: string;
    mode: ThemeMode;
    onModeChange: (mode: ThemeMode) => void;
  }

  let { label, color, mode, onModeChange }: Props = $props();
</script>

<div class="theme-header">
  <div class="left">
    <span class="dot" style:background={color}></span>
    <span class="name">{label}</span>
    <span class="mode-badge" class:is-3d={mode === "3d"}>
      {mode === "2d" ? "2D" : "3D"}
    </span>
  </div>

  <div class="toggle" role="radiogroup" aria-label="Display mode">
    <button
      role="radio"
      aria-checked={mode === "2d"}
      class:active={mode === "2d"}
      onclick={() => onModeChange("2d")}
    >2D</button>
    <button
      role="radio"
      aria-checked={mode === "3d"}
      class:active={mode === "3d"}
      onclick={() => onModeChange("3d")}
    >3D</button>
  </div>
</div>

<style>
  .theme-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
  }

  .left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .name {
    font-size: 1rem;
    font-weight: 700;
    color: var(--theme-text, white);
  }

  .mode-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    background: rgba(56, 189, 248, 0.15);
    color: #7dd3fc;
  }

  .mode-badge.is-3d {
    background: rgba(168, 85, 247, 0.15);
    color: #c4b5fd;
  }

  .toggle {
    display: flex;
    padding: 2px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
  }

  .toggle button {
    padding: 5px 16px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.45);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .toggle button:hover {
    color: rgba(255, 255, 255, 0.75);
  }

  .toggle button.active {
    background: rgba(255, 255, 255, 0.12);
    color: white;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  }

  .toggle button:focus-visible {
    outline: 2px solid var(--theme-accent, #38bdf8);
    outline-offset: -2px;
  }
</style>
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/themes-lab/components/ThemeHeader.svelte
git commit -m "feat(themes-lab): add ThemeHeader with pill toggle and mode badge"
```

---

### Task 5: ThemeControlsPanel (3D Progressive Disclosure)

**Files:**
- Create: `src/lib/features/themes-lab/components/ThemeControlsPanel.svelte`

This wraps the existing `*Controls.svelte` components from scene-lab inside a panel with Reset/Copy actions.

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/features/themes-lab/components/ThemeControlsPanel.svelte -->
<script lang="ts">
  import type { SceneLabState } from "$lib/features/lab/tabs/scene-lab/state/scene-lab-state.svelte";
  import type { ThemeId } from "../domain/theme-types";
  import WinterControls from "$lib/features/lab/tabs/scene-lab/components/WinterControls.svelte";
  import ForestControls from "$lib/features/lab/tabs/scene-lab/components/ForestControls.svelte";
  import CosmicControls from "$lib/features/lab/tabs/scene-lab/components/CosmicControls.svelte";
  import OceanControls from "$lib/features/lab/tabs/scene-lab/components/OceanControls.svelte";
  import AutumnControls from "$lib/features/lab/tabs/scene-lab/components/AutumnControls.svelte";
  import EmberControls from "$lib/features/lab/tabs/scene-lab/components/EmberControls.svelte";
  import CherryBlossomControls from "$lib/features/lab/tabs/scene-lab/components/CherryBlossomControls.svelte";
  import CelestialControls from "$lib/features/lab/tabs/scene-lab/components/CelestialControls.svelte";
  import RainbowControls from "$lib/features/lab/tabs/scene-lab/components/RainbowControls.svelte";
  import PureBlackControls from "$lib/features/lab/tabs/scene-lab/components/PureBlackControls.svelte";

  interface Props {
    themeId: ThemeId;
    sceneState: SceneLabState;
  }

  let { themeId, sceneState }: Props = $props();

  let copyStatus = $state<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    try {
      await sceneState.copyCurrentToClipboard();
      copyStatus = "copied";
      setTimeout(() => (copyStatus = "idle"), 1500);
    } catch {
      copyStatus = "error";
      setTimeout(() => (copyStatus = "idle"), 2000);
    }
  }

  function handleReset() {
    if (confirm("Reset this scene's config to defaults?")) {
      sceneState.resetCurrent();
    }
  }
</script>

<div class="controls-panel">
  <div class="actions">
    <button class="action-btn" onclick={handleReset} title="Reset to defaults">
      <i class="fas fa-undo"></i> Reset
    </button>
    <button
      class="action-btn primary"
      class:success={copyStatus === "copied"}
      class:error={copyStatus === "error"}
      onclick={handleCopy}
      title="Copy TypeScript config to clipboard"
    >
      {#if copyStatus === "copied"}
        <i class="fas fa-check"></i> Copied
      {:else if copyStatus === "error"}
        <i class="fas fa-xmark"></i> Failed
      {:else}
        <i class="fas fa-copy"></i> Copy config
      {/if}
    </button>
  </div>

  <div class="controls-scroll">
    {#if themeId === "winter"}
      <WinterControls />
    {:else if themeId === "forest"}
      <ForestControls />
    {:else if themeId === "cosmic"}
      <CosmicControls />
    {:else if themeId === "ocean"}
      <OceanControls />
    {:else if themeId === "autumn"}
      <AutumnControls />
    {:else if themeId === "ember"}
      <EmberControls />
    {:else if themeId === "blossom"}
      <CherryBlossomControls />
    {:else if themeId === "celestial"}
      <CelestialControls />
    {:else if themeId === "pride"}
      <RainbowControls />
    {:else if themeId === "pure-black"}
      <PureBlackControls />
    {/if}
  </div>
</div>

<style>
  .controls-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-bottom: 6px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 34px;
    padding: 0 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, white);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .action-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .action-btn.primary {
    background: color-mix(in srgb, var(--theme-accent, #38bdf8) 18%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #38bdf8) 35%, transparent);
    color: var(--theme-accent, #38bdf8);
  }

  .action-btn.primary:hover {
    background: color-mix(in srgb, var(--theme-accent, #38bdf8) 28%, transparent);
  }

  .action-btn.success {
    background: color-mix(in srgb, #10b981 22%, transparent);
    border-color: color-mix(in srgb, #10b981 40%, transparent);
    color: #34d399;
  }

  .action-btn.error {
    background: color-mix(in srgb, #ef4444 22%, transparent);
    border-color: color-mix(in srgb, #ef4444 40%, transparent);
    color: #f87171;
  }

  .controls-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-right: 4px;
  }
</style>
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/themes-lab/components/ThemeControlsPanel.svelte
git commit -m "feat(themes-lab): add ThemeControlsPanel with 3D scene controls routing"
```

---

### Task 6: ThemesLab Main Component

**Files:**
- Create: `src/lib/features/themes-lab/ThemesLab.svelte`

This is the root component that wires strip, header, content routing, and context.

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/features/themes-lab/ThemesLab.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { setSceneLabContext } from "$lib/features/lab/tabs/scene-lab/context/scene-lab-context";
  import { applyThemeForBackground } from "$lib/shared/settings/utils/background-theme-calculator";
  import { createThemesLabState } from "./state/themes-lab-state.svelte";
  import ThemeStrip from "./components/ThemeStrip.svelte";
  import ThemeHeader from "./components/ThemeHeader.svelte";
  import ThemeControlsPanel from "./components/ThemeControlsPanel.svelte";
  import ScenePreview from "$lib/features/lab/tabs/scene-lab/components/ScenePreview.svelte";
  import type { ThemeId } from "./domain/theme-types";

  // 2D lab imports (each is self-contained: canvas + controls)
  import DeepOceanLab from "$lib/features/background-builder/components/DeepOceanLab.svelte";
  import NightSkyLab from "$lib/features/background-builder/components/NightSkyLab.svelte";
  import FireflyForestLab from "$lib/features/background-builder/components/FireflyForestLab.svelte";
  import CherryBlossomLab from "$lib/features/background-builder/components/CherryBlossomLab.svelte";
  import PrideLab from "$lib/features/background-builder/components/PrideLab.svelte";
  import EmberGlowLab from "$lib/features/background-builder/components/EmberGlowLab.svelte";
  import SnowfallLab from "$lib/features/background-builder/components/SnowfallLab.svelte";
  import AutumnDriftLab from "$lib/features/background-builder/components/AutumnDriftLab.svelte";

  const state = createThemesLabState();

  // Provide SceneLabContext so ScenePreview works (it reads context, takes no props)
  setSceneLabContext(state.sceneLabContext);

  // Map ThemeId → 2D lab component
  const labComponents: Record<string, any> = {
    ocean: DeepOceanLab,
    cosmic: NightSkyLab,
    forest: FireflyForestLab,
    blossom: CherryBlossomLab,
    pride: PrideLab,
    ember: EmberGlowLab,
    winter: SnowfallLab,
    autumn: AutumnDriftLab,
    // celestial and pure-black: 2D labs added in Stream B (after npm publish)
  };

  const currentLabComponent = $derived(labComponents[state.themeId] ?? null);

  function handleThemeSelect(id: ThemeId) {
    state.setTheme(id);
    const option = state.currentTheme;
    if (option) {
      applyThemeForBackground(option.backgroundType);
    }
  }

  onMount(() => {
    const option = state.currentTheme;
    if (option) {
      applyThemeForBackground(option.backgroundType);
    }
  });
</script>

<div class="themes-lab">
  <ThemeStrip
    themes={state.themeOptions}
    activeId={state.themeId}
    onSelect={handleThemeSelect}
  />

  <ThemeHeader
    label={state.currentTheme?.label ?? ""}
    color={state.currentTheme?.color ?? "#888"}
    mode={state.mode}
    onModeChange={(m) => state.setMode(m)}
  />

  <div class="content" class:mode-3d={state.mode === "3d"}>
    {#if state.mode === "2d"}
      {#if currentLabComponent}
        <svelte:component this={currentLabComponent} />
      {:else}
        <div class="placeholder">
          <i class="fas fa-paint-brush"></i>
          <p>2D background coming soon for {state.currentTheme?.label ?? "this theme"}</p>
        </div>
      {/if}
    {:else}
      <div class="preview-pane">
        <ScenePreview />
      </div>
      <aside class="controls-pane">
        <ThemeControlsPanel
          themeId={state.themeId}
          sceneState={state.sceneState}
        />
      </aside>
    {/if}
  </div>
</div>

<style>
  .themes-lab {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px 20px 20px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    gap: 8px;
  }

  .content {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .content.mode-3d {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 16px;
    overflow: hidden;
  }

  .preview-pane {
    position: relative;
    min-height: 0;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .controls-pane {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 12px;
    padding: 14px;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.35);
  }

  .placeholder i {
    font-size: 3rem;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .placeholder p {
    font-size: 0.875rem;
  }

  @media (max-width: 900px) {
    .content.mode-3d {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(300px, 1fr) auto;
    }

    .controls-pane {
      max-height: 50vh;
    }
  }
</style>
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/themes-lab/ThemesLab.svelte
git commit -m "feat(themes-lab): add ThemesLab root component with 2D/3D content routing"
```

---

### Task 7: Tab Registration

**Files:**
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts:812-819` (remove `2d-backgrounds`)
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts:971-977` (remove `scene-lab`)
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts` (add `themes` entry)
- Modify: `src/lib/features/lab/LabModule.svelte:24` (remove `2d-backgrounds` import)
- Modify: `src/lib/features/lab/LabModule.svelte:43` (remove `scene-lab` import)
- Modify: `src/lib/features/lab/LabModule.svelte` (add `themes` import)

- [ ] **Step 1: Replace `2d-backgrounds` tab with `themes` in tab-definitions.ts**

In `src/lib/shared/navigation/config/tab-definitions.ts`, find the `2d-backgrounds` entry (around line 812) and replace it with:

```typescript
  {
    id: "themes",
    label: "Themes",
    icon: '<i class="fas fa-palette" aria-hidden="true"></i>',
    description: "Unified theme designer — 2D backgrounds and 3D scenes",
    color: "#a78bfa",
    gradient: "linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)",
  },
```

- [ ] **Step 2: Remove `scene-lab` tab from tab-definitions.ts**

Delete the `scene-lab` entry (around line 971–977):

```typescript
  // DELETE THIS BLOCK:
  {
    id: "scene-lab",
    label: "Scene Lab",
    icon: '<i class="fas fa-snowflake" style="color: #38bdf8;" aria-hidden="true"></i>',
    description: "Tune 3D environment scenes with live sliders",
    color: "#38bdf8",
    gradient: "linear-gradient(135deg, #7dd3fc 0%, #38bdf8 100%)",
  },
```

- [ ] **Step 3: Update LabModule.svelte tab component map**

In `src/lib/features/lab/LabModule.svelte`, in the `tabComponents` record:

Remove:
```typescript
    "2d-backgrounds": () => import("$lib/features/background-builder/BackgroundBuilder.svelte"),
```
and:
```typescript
    "scene-lab": () => import("./tabs/scene-lab/SceneLab.svelte"),
```

Add:
```typescript
    themes: () => import("$lib/features/themes-lab/ThemesLab.svelte"),
```

- [ ] **Step 4: Verify typecheck + build**

Run: `npm run check && npm run build`
Expected: PASS — no references to removed tab IDs.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/navigation/config/tab-definitions.ts src/lib/features/lab/LabModule.svelte
git commit -m "feat(themes-lab): register Themes tab, remove 2d-backgrounds and scene-lab tabs"
```

---

### Task 8: localStorage Migration

**Files:**
- Modify: `src/lib/features/themes-lab/state/themes-lab-state.svelte.ts` (add migration call)

The existing scene-lab state persists to `localStorage.getItem("scene-lab-state")`. The ThemesLab uses the same `createSceneLabState()` which already reads from this key. So the migration is automatically handled — the scene lab state continues to read/write the same localStorage key.

Future Phase 2 work will migrate this into `settingsService.sceneLabSettings`. For Phase 1, keeping the existing localStorage path means zero data loss and the simplest possible migration.

- [ ] **Step 1: Verify scene-lab-state reads localStorage on init**

Read `src/lib/features/lab/tabs/scene-lab/state/scene-lab-state.svelte.ts` and confirm `loadSceneLabState()` is called on line 29 and reads from localStorage. Confirmed — the `createSceneLabState()` function already handles this.

- [ ] **Step 2: Verify the old background-builder tab key gets cleaned up**

The old `tka-background-builder-active-tab` localStorage key is harmless — it's only read by `BackgroundBuilder.svelte` which is no longer mounted. No cleanup needed.

- [ ] **Step 3: Commit (no-op — document the decision)**

No code change. The migration is automatic because `createSceneLabState()` already reads the `"scene-lab-state"` localStorage key. Document this in the commit:

```bash
git commit --allow-empty -m "docs(themes-lab): scene-lab localStorage migration is automatic via shared state factory"
```

---

## Stream B: NPM Package + New 2D Labs (blocked on npm publish)

> **Blocker:** Tasks 9–12 require publishing a new version of `@austencloud/backgrounds` with `BackgroundType.PURE_BLACK` and two new canvas system classes. Austen must run `npm publish` from the backgrounds package repo.

### Task 9: NPM Package Updates (External Repo)

**Files in `@austencloud/backgrounds` repo (NOT this repo):**
- Modify: `src/core/domain/enums.ts` (add `PURE_BLACK = "pureBlack"` to BackgroundType)
- Create: `src/systems/CelestialBackgroundSystem.ts`
- Create: `src/systems/PureBlackBackgroundSystem.ts`
- Modify: `src/core/BackgroundFactory.ts` (add cases for CELESTIAL + PURE_BLACK)
- Modify: `package.json` (bump version to 0.4.0)

This task is a separate implementation cycle in the backgrounds package repo. High-level requirements:

**CelestialBackgroundSystem** — implements `IBackgroundSystem`:
- Layered cloud fields at multiple depth planes
- Animated god rays (golden warm light, slow sweep)
- Floating island silhouettes (distant, parallax-offset)
- Warm golden-to-cream gradient base
- `setLayerVisibility()` for: clouds, godRays, islands, pillars

**PureBlackBackgroundSystem** — implements `IBackgroundSystem`:
- Solid `#000000` fill
- Optional subtle grid lines (configurable opacity + spacing)
- Optional vignette overlay
- `setLayerVisibility()` for: grid, vignette

**After building + testing in the backgrounds repo:**

- [ ] **Step 1: Austen runs `npm publish` from the backgrounds repo**
- [ ] **Step 2: In tka-platform, update the dependency**

Run: `pnpm update @austencloud/backgrounds`

- [ ] **Step 3: Verify the new enum value is accessible**

```typescript
import { BackgroundType } from "@austencloud/backgrounds";
console.log(BackgroundType.PURE_BLACK); // should print "pureBlack"
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: update @austencloud/backgrounds to v0.4.0 (PURE_BLACK + Celestial/PureBlack canvas)"
```

---

### Task 10: PURE_BLACK Integration Points

**Files (7 files, ~10 entries):**
- Modify: `src/lib/shared/settings/utils/background-theme-calculator.ts:44-57`
- Modify: `src/lib/shared/settings/domain/avatar-gradients.ts:151-163` (THEME_TO_FAMILY)
- Modify: `src/lib/shared/settings/domain/avatar-gradients.ts:165-177` (THEME_TO_GRADIENT)
- Modify: `src/lib/shared/settings/utils/public-page-backgrounds.ts:15-25`
- Modify: `src/lib/shared/settings/utils/background-preloader.ts:12-24` (BACKGROUND_GRADIENTS)
- Modify: `src/lib/shared/settings/utils/background-preloader.ts:26-38` (BACKGROUND_ANIMATIONS)
- Modify: `src/lib/shared/3d/environments/components/Environment3D.svelte:50-74`
- Modify: `src/lib/shared/3d/components/Viewer3DScene.svelte:53-75`
- Modify: `src/lib/shared/theme/config/tka-theme-config.ts:25-38`

Also add a `"pureBlack"` gradient option to ALL_GRADIENTS in `avatar-gradients.ts` since `THEME_TO_GRADIENT` maps to `"pureBlack"` but no gradient with that id exists (same gap exists for `"celestial"` — fix both).

- [ ] **Step 1: Add PURE_BLACK to BACKGROUND_THEME_COLORS in background-theme-calculator.ts**

After the `[BackgroundType.CELESTIAL]` line (~line 56), add:

```typescript
  [BackgroundType.PURE_BLACK]: ["#000000", "#1a1a1a", "#6b7280"],
```

- [ ] **Step 2: Add PURE_BLACK to tka-theme-config.ts**

After the `[BackgroundType.CELESTIAL]` line (~line 37), add:

```typescript
  [BackgroundType.PURE_BLACK]: ["#000000", "#1a1a1a", "#6b7280"],
```

- [ ] **Step 3: Add PURE_BLACK to avatar-gradients.ts THEME_TO_FAMILY and THEME_TO_GRADIENT**

In `THEME_TO_FAMILY`, add:
```typescript
  [BackgroundType.PURE_BLACK]: "dark",
```

In `THEME_TO_GRADIENT`, add:
```typescript
  [BackgroundType.PURE_BLACK]: "void",
```

- [ ] **Step 4: Add PURE_BLACK to ALL_GRADIENTS (avatar-gradients.ts)**

Add a `"celestial"` gradient option (currently referenced by THEME_TO_GRADIENT but missing from ALL_GRADIENTS). Add after the last "warm" family entry:

```typescript
  {
    id: "celestial",
    name: "Celestial",
    gradient: "linear-gradient(135deg, #0a1a4a 0%, #b89050 40%, #e8dcc8 100%)",
    family: "warm",
  },
```

No separate `"pureBlack"` gradient needed — THEME_TO_GRADIENT maps it to `"void"` which already exists.

- [ ] **Step 5: Add PURE_BLACK to public-page-backgrounds.ts**

Add to the `ANIMATED_BACKGROUNDS` array:

```typescript
  { type: BackgroundType.PURE_BLACK, icon: "fa-square", label: "Pure Black" },
```

- [ ] **Step 6: Add PURE_BLACK to background-preloader.ts**

In `BACKGROUND_GRADIENTS`, add:
```typescript
  pureBlack: "#000000",
```

In `BACKGROUND_ANIMATIONS`, add:
```typescript
  pureBlack: "",
```

- [ ] **Step 7: Add PURE_BLACK case to Environment3D.svelte**

In the `getSceneConfig()` switch statement, add before the `default:` case:

```typescript
      case BackgroundType.PURE_BLACK:
        return { scene: "none" };
```

Pure Black has no 3D environment scene (the scene-lab has a PureBlackScene, but the production viewer uses a void). If a 3D pure-black scene is desired in production later, change `"none"` to a scene import.

- [ ] **Step 8: Add PURE_BLACK case to Viewer3DScene.svelte**

In the `getStageGroundOffset()` switch, add:

```typescript
      case BackgroundType.PURE_BLACK:
        return 0;
```

- [ ] **Step 9: Verify typecheck + build**

Run: `npm run check && npm run build`
Expected: PASS — all `Record<BackgroundType, ...>` maps now include PURE_BLACK.

- [ ] **Step 10: Commit**

```bash
git add src/lib/shared/settings/utils/background-theme-calculator.ts \
        src/lib/shared/settings/domain/avatar-gradients.ts \
        src/lib/shared/settings/utils/public-page-backgrounds.ts \
        src/lib/shared/settings/utils/background-preloader.ts \
        src/lib/shared/3d/environments/components/Environment3D.svelte \
        src/lib/shared/3d/components/Viewer3DScene.svelte \
        src/lib/shared/theme/config/tka-theme-config.ts
git commit -m "feat(themes): add PURE_BLACK entries to all background-type maps and scene routing"
```

---

### Task 11: Lab Settings Types for Celestial + Pure Black

**Files:**
- Modify: `src/lib/shared/background-builder/domain/lab-settings-types.ts`
- Modify: `src/lib/features/background-builder/state/background-builder-state.svelte.ts`

- [ ] **Step 1: Add Celestial and PureBlack settings types to lab-settings-types.ts**

After the EmberGlow section (~line 300), add:

```typescript
// ============================================================================
// Celestial Lab
// ============================================================================

export interface CelestialLabLayers {
  clouds: boolean;
  godRays: boolean;
  islands: boolean;
  pillars: boolean;
}

export interface CelestialLabSettings {
  quality: QualityLevel;
  layers: CelestialLabLayers;
}

export const DEFAULT_CELESTIAL_LAB_SETTINGS: CelestialLabSettings = {
  quality: "high",
  layers: {
    clouds: true,
    godRays: true,
    islands: true,
    pillars: false,
  },
};

// ============================================================================
// Pure Black Lab
// ============================================================================

export interface PureBlackLabLayers {
  grid: boolean;
  vignette: boolean;
}

export interface PureBlackLabSettings {
  quality: QualityLevel;
  layers: PureBlackLabLayers;
  gridOpacity: number;
  gridSpacing: number;
}

export const DEFAULT_PURE_BLACK_LAB_SETTINGS: PureBlackLabSettings = {
  quality: "high",
  layers: {
    grid: false,
    vignette: false,
  },
  gridOpacity: 0.15,
  gridSpacing: 40,
};
```

- [ ] **Step 2: Add celestial + pureBlack to BackgroundLabSettings interface**

Update the `BackgroundLabSettings` interface:

```typescript
export interface BackgroundLabSettings {
  nightSky?: NightSkyLabSettings;
  fireflyForest?: FireflyForestLabSettings;
  cherryBlossom?: CherryBlossomLabSettings;
  rainbow?: RainbowLabSettings;
  emberGlow?: EmberGlowLabSettings;
  deepOcean?: DeepOceanLabSettings;
  celestial?: CelestialLabSettings;
  pureBlack?: PureBlackLabSettings;
}
```

- [ ] **Step 3: Add getter/updater functions in background-builder-state.svelte.ts**

At the end of `background-builder-state.svelte.ts`, add:

```typescript
// ============================================================================
// Celestial Lab Settings
// ============================================================================

export function getCelestialLabSettings(): CelestialLabSettings {
  const labSettings = getLabSettings();
  return labSettings.celestial ?? { ...DEFAULT_CELESTIAL_LAB_SETTINGS };
}

export function updateCelestialLabSettings(settings: Partial<CelestialLabSettings>): void {
  const current = getCelestialLabSettings();
  const updated = { ...current, ...settings };
  const labSettings = getLabSettings();
  saveLabSettings({ ...labSettings, celestial: updated });
}

// ============================================================================
// Pure Black Lab Settings
// ============================================================================

export function getPureBlackLabSettings(): PureBlackLabSettings {
  const labSettings = getLabSettings();
  return labSettings.pureBlack ?? { ...DEFAULT_PURE_BLACK_LAB_SETTINGS };
}

export function updatePureBlackLabSettings(settings: Partial<PureBlackLabSettings>): void {
  const current = getPureBlackLabSettings();
  const updated = { ...current, ...settings };
  const labSettings = getLabSettings();
  saveLabSettings({ ...labSettings, pureBlack: updated });
}
```

Add the missing imports at the top of background-builder-state.svelte.ts:

```typescript
import {
  // ... existing imports ...
  DEFAULT_CELESTIAL_LAB_SETTINGS,
  DEFAULT_PURE_BLACK_LAB_SETTINGS,
  type CelestialLabSettings,
  type PureBlackLabSettings,
} from "$lib/shared/background-builder/domain/lab-settings-types";
```

- [ ] **Step 4: Verify typecheck**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/background-builder/domain/lab-settings-types.ts \
        src/lib/features/background-builder/state/background-builder-state.svelte.ts
git commit -m "feat(themes): add Celestial and PureBlack lab settings types and persistence"
```

---

### Task 12: CelestialLab.svelte + PureBlackLab.svelte (2D Lab Components)

**Files:**
- Create: `src/lib/features/background-builder/components/CelestialLab.svelte`
- Create: `src/lib/features/background-builder/components/PureBlackLab.svelte`
- Modify: `src/lib/features/themes-lab/ThemesLab.svelte` (add to labComponents map)

These follow the same pattern as existing labs (e.g., `SnowfallLab.svelte`): instantiate an `IBackgroundSystem` from the npm package, bind to `LabPreviewCanvas`, and provide controls.

- [ ] **Step 1: Create CelestialLab.svelte**

```svelte
<!-- src/lib/features/background-builder/components/CelestialLab.svelte -->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { CelestialBackgroundSystem, type QualityLevel } from "@austencloud/backgrounds";
  import { ChipToggle, ChipGroup } from "@austencloud/chip-toggle";
  import LabPreviewCanvas from "./LabPreviewCanvas.svelte";
  import CollapsibleLabSection from "$lib/shared/components/lab/CollapsibleLabSection.svelte";
  import {
    getCelestialLabSettings,
    updateCelestialLabSettings,
  } from "../state/background-builder-state.svelte";

  let backgroundSystem: CelestialBackgroundSystem | null = $state(null);
  let canvasDimensions = $state({ width: 800, height: 600 });
  let isLoading = $state(true);

  const savedSettings = getCelestialLabSettings();
  let quality: QualityLevel = $state(savedSettings.quality);
  let layers = $state({ ...savedSettings.layers });

  function handleCanvasReady(dimensions: { width: number; height: number }) {
    canvasDimensions = dimensions;
    try {
      backgroundSystem = new CelestialBackgroundSystem();
      backgroundSystem.initialize(dimensions, quality);
      if (backgroundSystem.setLayerVisibility) {
        backgroundSystem.setLayerVisibility(layers);
      }
      isLoading = false;
    } catch (error) {
      isLoading = false;
      console.error("Failed to initialize Celestial Lab:", error);
    }
  }

  function handleFrame() {
    // no-op stats for now
  }

  function toggleLayer(key: keyof typeof layers) {
    layers[key] = !layers[key];
    if (backgroundSystem?.setLayerVisibility) {
      backgroundSystem.setLayerVisibility(layers);
    }
    updateCelestialLabSettings({ layers: { ...layers } });
  }

  function setQuality(q: QualityLevel) {
    quality = q;
    backgroundSystem?.setQuality(q);
    updateCelestialLabSettings({ quality: q });
  }

  onDestroy(() => {
    backgroundSystem?.cleanup();
  });
</script>

<div class="celestial-lab">
  <LabPreviewCanvas
    {backgroundSystem}
    onCanvasReady={handleCanvasReady}
    onFrame={handleFrame}
  />

  <CollapsibleLabSection title="Layers" icon="fa-layer-group" defaultOpen={true} accentColor="amber">
    <ChipGroup>
      <ChipToggle icon="cloud" label="Clouds" color="default" active={layers.clouds} onclick={() => toggleLayer("clouds")} />
      <ChipToggle icon="sun" label="God Rays" color="amber" active={layers.godRays} onclick={() => toggleLayer("godRays")} />
      <ChipToggle icon="mountain" label="Islands" color="default" active={layers.islands} onclick={() => toggleLayer("islands")} />
      <ChipToggle icon="monument" label="Pillars" color="default" active={layers.pillars} onclick={() => toggleLayer("pillars")} />
    </ChipGroup>
  </CollapsibleLabSection>

  <CollapsibleLabSection title="Quality" icon="fa-sliders" defaultOpen={false} accentColor="amber">
    <ChipGroup>
      <ChipToggle label="Low" color="default" active={quality === "low"} onclick={() => setQuality("low")} />
      <ChipToggle label="Medium" color="default" active={quality === "medium"} onclick={() => setQuality("medium")} />
      <ChipToggle label="High" color="amber" active={quality === "high"} onclick={() => setQuality("high")} />
    </ChipGroup>
  </CollapsibleLabSection>
</div>

<style>
  .celestial-lab {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
</style>
```

- [ ] **Step 2: Create PureBlackLab.svelte**

```svelte
<!-- src/lib/features/background-builder/components/PureBlackLab.svelte -->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { PureBlackBackgroundSystem, type QualityLevel } from "@austencloud/backgrounds";
  import { ChipToggle, ChipGroup } from "@austencloud/chip-toggle";
  import LabPreviewCanvas from "./LabPreviewCanvas.svelte";
  import CollapsibleLabSection from "$lib/shared/components/lab/CollapsibleLabSection.svelte";
  import {
    getPureBlackLabSettings,
    updatePureBlackLabSettings,
  } from "../state/background-builder-state.svelte";

  let backgroundSystem: PureBlackBackgroundSystem | null = $state(null);
  let canvasDimensions = $state({ width: 800, height: 600 });
  let isLoading = $state(true);

  const savedSettings = getPureBlackLabSettings();
  let quality: QualityLevel = $state(savedSettings.quality);
  let layers = $state({ ...savedSettings.layers });
  let gridOpacity = $state(savedSettings.gridOpacity);
  let gridSpacing = $state(savedSettings.gridSpacing);

  function handleCanvasReady(dimensions: { width: number; height: number }) {
    canvasDimensions = dimensions;
    try {
      backgroundSystem = new PureBlackBackgroundSystem();
      backgroundSystem.initialize(dimensions, quality);
      if (backgroundSystem.setLayerVisibility) {
        backgroundSystem.setLayerVisibility(layers);
      }
      isLoading = false;
    } catch (error) {
      isLoading = false;
      console.error("Failed to initialize Pure Black Lab:", error);
    }
  }

  function handleFrame() {
    // no-op
  }

  function toggleLayer(key: keyof typeof layers) {
    layers[key] = !layers[key];
    if (backgroundSystem?.setLayerVisibility) {
      backgroundSystem.setLayerVisibility(layers);
    }
    updatePureBlackLabSettings({ layers: { ...layers } });
  }

  onDestroy(() => {
    backgroundSystem?.cleanup();
  });
</script>

<div class="pure-black-lab">
  <LabPreviewCanvas
    {backgroundSystem}
    onCanvasReady={handleCanvasReady}
    onFrame={handleFrame}
  />

  <CollapsibleLabSection title="Overlays" icon="fa-layer-group" defaultOpen={true} accentColor="gray">
    <ChipGroup>
      <ChipToggle icon="th" label="Grid" color="default" active={layers.grid} onclick={() => toggleLayer("grid")} />
      <ChipToggle icon="circle" label="Vignette" color="default" active={layers.vignette} onclick={() => toggleLayer("vignette")} />
    </ChipGroup>
  </CollapsibleLabSection>

  {#if layers.grid}
    <CollapsibleLabSection title="Grid Settings" icon="fa-sliders" defaultOpen={true} accentColor="gray">
      <div class="slider-row">
        <label>Opacity</label>
        <input
          type="range"
          min="0.05"
          max="0.5"
          step="0.05"
          bind:value={gridOpacity}
          oninput={() => updatePureBlackLabSettings({ gridOpacity })}
        />
        <span class="value">{(gridOpacity * 100).toFixed(0)}%</span>
      </div>
      <div class="slider-row">
        <label>Spacing</label>
        <input
          type="range"
          min="20"
          max="80"
          step="5"
          bind:value={gridSpacing}
          oninput={() => updatePureBlackLabSettings({ gridSpacing })}
        />
        <span class="value">{gridSpacing}px</span>
      </div>
    </CollapsibleLabSection>
  {/if}
</div>

<style>
  .pure-black-lab {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 0;
  }

  .slider-row label {
    width: 60px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
  }

  .slider-row input[type="range"] {
    flex: 1;
  }

  .slider-row .value {
    width: 36px;
    text-align: right;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    font-variant-numeric: tabular-nums;
  }
</style>
```

- [ ] **Step 3: Add to ThemesLab.svelte labComponents map**

In `src/lib/features/themes-lab/ThemesLab.svelte`, add the imports and map entries:

```typescript
  import CelestialLab from "$lib/features/background-builder/components/CelestialLab.svelte";
  import PureBlackLab from "$lib/features/background-builder/components/PureBlackLab.svelte";

  const labComponents: Record<string, any> = {
    ocean: DeepOceanLab,
    cosmic: NightSkyLab,
    forest: FireflyForestLab,
    blossom: CherryBlossomLab,
    pride: PrideLab,
    ember: EmberGlowLab,
    winter: SnowfallLab,
    autumn: AutumnDriftLab,
    celestial: CelestialLab,
    "pure-black": PureBlackLab,
  };
```

- [ ] **Step 4: Verify typecheck + build**

Run: `npm run check && npm run build`
Expected: PASS — all 10 themes now have 2D lab components.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/background-builder/components/CelestialLab.svelte \
        src/lib/features/background-builder/components/PureBlackLab.svelte \
        src/lib/features/themes-lab/ThemesLab.svelte
git commit -m "feat(themes-lab): add CelestialLab + PureBlackLab 2D components, complete 10/10 theme coverage"
```

---

## Summary

| Task | Stream | Description | Blocked? |
|------|--------|-------------|----------|
| 1 | A | Theme types + THEME_OPTIONS | No |
| 2 | A | ThemesLab state management | No |
| 3 | A | ThemeStrip component | No |
| 4 | A | ThemeHeader component | No |
| 5 | A | ThemeControlsPanel | No |
| 6 | A | ThemesLab main component | No |
| 7 | A | Tab registration (remove old, add new) | No |
| 8 | A | localStorage migration (automatic) | No |
| 9 | B | npm package (PURE_BLACK + canvas systems) | **Austen publishes** |
| 10 | B | PURE_BLACK integration (7 files) | Task 9 |
| 11 | B | Lab settings types (Celestial + PureBlack) | No |
| 12 | B | CelestialLab + PureBlackLab components | Task 9 |

**Stream A ships a functional ThemesLab** with 8/10 themes in 2D and 10/10 in 3D. Celestial and Pure Black show a "coming soon" placeholder in 2D mode.

**Stream B completes 10/10 2D coverage** after the npm package is updated with the new canvas systems.

**Task 11 (lab settings types) has no npm dependency** and can run in either stream. It's placed in Stream B because the types are only consumed by the lab components in Task 12.
