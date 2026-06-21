# Codex Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the learn Codex drill UI and the lab Pictograph Explorer with one unified sidebar-model letter explorer, hosted as the learn Codex tab, with transform ops, a canonical color-coded letter map, jump-to-letter search, and view-state persistence across reloads.

**Architecture:** Promote `PictographExplorerLab.svelte` into `features/learn/codex/` as `CodexExplorer.svelte`, backed by a new persisted state factory. Salvage the codex's transform ops (`CodexControlPanel` + `codex` service) and canonical Type 1–6 row/color logic. Delete the drill husks (`CodexTab`, `CodexComponent`, `LetterDetailView`, `CodexPictographGrid`) and retire the lab tab. Keep the data layer (`letterQueryHandler`, `codex` service, `CodexLetterMappingRepo`, renderer, `pictographPreparer`).

**Tech Stack:** Svelte 5 runes, TypeScript, `Canvas2DDirectRenderer`, `pictographPreparer`, `letterQueryHandler`, `SegmentedControl`, `FilterChipBase`, Vitest.

**Project rules in force:** no worktrees / work on main; `never-hand-roll`, `chip-primitives` (visibility toggles → `FilterChipBase mode="toggle"`), `no-checkboxes`, `no-layout-shift`, `fast-iteration-loop` (use `check:watch`; one full `check` at the commit gate), `commit-only-your-own-changes` (explicit pathspec), `verification-protocol` (evidence before "done").

**Verification baseline:** spec at `docs/superpowers/specs/2026-06-19-codex-unification-design.md`.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/features/learn/codex/state/codex-explorer-state.svelte.ts` | View state + localStorage persistence (factory + getters) | Create |
| `src/lib/features/learn/codex/state/codex-explorer-persistence.ts` | Pure serialize/restore helpers (testable) | Create |
| `src/lib/features/learn/codex/state/codex-explorer-persistence.test.ts` | Unit tests for the helpers | Create |
| `src/lib/features/learn/codex/components/CodexExplorer.svelte` | The unified sidebar explorer | Create (promoted from `PictographExplorerLab`) |
| `src/lib/features/learn/codex/components/CodexControlPanel.svelte` | Transform ops; add optional `showOrientation` | Modify |
| `src/lib/features/learn/LearnTab.svelte` | Render `CodexExplorer` in "codex" mode | Modify (lines ~22, ~217) |
| `src/lib/features/lab/LabModule.svelte` | Remove `pictograph-explorer` lazy entry | Modify (line ~41) |
| `src/lib/shared/navigation/config/tab-definitions.ts` | Remove `pictograph-explorer` tab def | Modify (~line 1097) |
| `src/lib/features/lab/tabs/pictograph-explorer/` | Old lab explorer | Delete |
| `src/lib/features/learn/codex/components/CodexTab.svelte` | Drill shell | Delete |
| `src/lib/features/learn/codex/components/CodexComponent.svelte` | Drill overview | Delete |
| `src/lib/features/learn/codex/components/LetterDetailView.svelte` | Drill detail | Delete |
| `src/lib/features/learn/codex/components/CodexPictographGrid.svelte` | Drill grid (salvage colors first) | Delete |
| `src/routes/test/codex-ia/` | Throwaway IA harness | Delete |

**Canonical type colors** (salvaged from `CodexPictographGrid.letterTypeSections`, used by the new sidebar):
`T1 #36c3ff` · `T2 #6F2DA8` · `T3 #26e600` · `T4 #26e600` · `T5 #00b3ff` · `T6 #eb7d00`.

---

## Task 1: Persisted view-state helpers (pure, testable)

**Files:**
- Create: `src/lib/features/learn/codex/state/codex-explorer-persistence.ts`
- Test: `src/lib/features/learn/codex/state/codex-explorer-persistence.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// codex-explorer-persistence.test.ts
import { describe, it, expect } from "vitest";
import {
  serializeCodexExplorerPrefs,
  restoreCodexExplorerPrefs,
  defaultCodexExplorerPrefs,
  type CodexExplorerPrefs,
} from "./codex-explorer-persistence";

describe("codex explorer persistence", () => {
  const sample: CodexExplorerPrefs = {
    version: 1,
    selectedLetter: "Σ-",
    gridMode: "box",
    isDarkMode: true,
    blueTurnsOverride: 1,
    redTurnsOverride: null,
    visibility: {
      showGrid: true,
      showTKA: false,
      showTnD: true,
      showElemental: true,
      showPositions: false,
      showReversals: false,
      showNonRadialPoints: false,
    },
  };

  it("round-trips a full prefs object", () => {
    const restored = restoreCodexExplorerPrefs(serializeCodexExplorerPrefs(sample));
    expect(restored).toEqual(sample);
  });

  it("returns defaults for null / empty input", () => {
    expect(restoreCodexExplorerPrefs(null)).toEqual(defaultCodexExplorerPrefs());
    expect(restoreCodexExplorerPrefs("")).toEqual(defaultCodexExplorerPrefs());
  });

  it("returns defaults for corrupt JSON", () => {
    expect(restoreCodexExplorerPrefs("{not json")).toEqual(defaultCodexExplorerPrefs());
  });

  it("returns defaults when the version mismatches", () => {
    const stale = JSON.stringify({ ...sample, version: 0 });
    expect(restoreCodexExplorerPrefs(stale)).toEqual(defaultCodexExplorerPrefs());
  });

  it("fills missing visibility keys from defaults", () => {
    const partial = JSON.stringify({ ...sample, visibility: { showGrid: false } });
    const restored = restoreCodexExplorerPrefs(partial);
    expect(restored.visibility.showGrid).toBe(false);
    expect(restored.visibility.showTKA).toBe(defaultCodexExplorerPrefs().visibility.showTKA);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/features/learn/codex/state/codex-explorer-persistence.test.ts`
Expected: FAIL — module not found / exports undefined.

- [ ] **Step 3: Write the helpers**

```ts
// codex-explorer-persistence.ts
// Pure serialize/restore for the Codex Explorer's durable view prefs.
// Kept separate from the rune state factory so it is unit-testable without a
// Svelte runtime. The factory below (codex-explorer-state.svelte.ts) owns the
// $effect that calls these and touches localStorage.

export const CODEX_EXPLORER_STORAGE_KEY = "codex-explorer-prefs";
const CODEX_EXPLORER_PREFS_VERSION = 1;

export type CodexExplorerGridMode = "diamond" | "box";

export interface CodexExplorerVisibility {
  showGrid: boolean;
  showTKA: boolean;
  showTnD: boolean;
  showElemental: boolean;
  showPositions: boolean;
  showReversals: boolean;
  showNonRadialPoints: boolean;
}

export interface CodexExplorerPrefs {
  version: number;
  selectedLetter: string;
  gridMode: CodexExplorerGridMode;
  isDarkMode: boolean;
  blueTurnsOverride: number | null;
  redTurnsOverride: number | null;
  visibility: CodexExplorerVisibility;
}

export function defaultCodexExplorerVisibility(): CodexExplorerVisibility {
  return {
    showGrid: true,
    showTKA: true,
    showTnD: false,
    showElemental: true,
    showPositions: false,
    showReversals: false,
    showNonRadialPoints: false,
  };
}

export function defaultCodexExplorerPrefs(): CodexExplorerPrefs {
  return {
    version: CODEX_EXPLORER_PREFS_VERSION,
    selectedLetter: "W",
    gridMode: "diamond",
    isDarkMode: false,
    blueTurnsOverride: null,
    redTurnsOverride: null,
    visibility: defaultCodexExplorerVisibility(),
  };
}

export function serializeCodexExplorerPrefs(prefs: CodexExplorerPrefs): string {
  return JSON.stringify({ ...prefs, version: CODEX_EXPLORER_PREFS_VERSION });
}

export function restoreCodexExplorerPrefs(raw: string | null): CodexExplorerPrefs {
  if (!raw) return defaultCodexExplorerPrefs();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaultCodexExplorerPrefs();
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== CODEX_EXPLORER_PREFS_VERSION
  ) {
    return defaultCodexExplorerPrefs();
  }
  const p = parsed as Partial<CodexExplorerPrefs>;
  const d = defaultCodexExplorerPrefs();
  return {
    version: CODEX_EXPLORER_PREFS_VERSION,
    selectedLetter: typeof p.selectedLetter === "string" ? p.selectedLetter : d.selectedLetter,
    gridMode: p.gridMode === "box" ? "box" : "diamond",
    isDarkMode: typeof p.isDarkMode === "boolean" ? p.isDarkMode : d.isDarkMode,
    blueTurnsOverride:
      typeof p.blueTurnsOverride === "number" ? p.blueTurnsOverride : null,
    redTurnsOverride:
      typeof p.redTurnsOverride === "number" ? p.redTurnsOverride : null,
    visibility: { ...d.visibility, ...(p.visibility ?? {}) },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/features/learn/codex/state/codex-explorer-persistence.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/learn/codex/state/codex-explorer-persistence.ts src/lib/features/learn/codex/state/codex-explorer-persistence.test.ts
git commit -m "feat(codex): persistable view-pref helpers for unified explorer" -- src/lib/features/learn/codex/state/codex-explorer-persistence.ts src/lib/features/learn/codex/state/codex-explorer-persistence.test.ts
```

---

## Task 2: View-state factory (runes + persistence)

**Files:**
- Create: `src/lib/features/learn/codex/state/codex-explorer-state.svelte.ts`

This factory owns the reactive view state, maps `gridMode` string ↔ the
`GridMode` enum the renderer needs, and runs the debounced `$effect` that writes
prefs to localStorage (pattern mirrored from
`features/lab/tabs/scene-lab/state/scene-lab-state.svelte.ts`).

- [ ] **Step 1: Write the factory**

```ts
// codex-explorer-state.svelte.ts
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  CODEX_EXPLORER_STORAGE_KEY,
  defaultCodexExplorerPrefs,
  restoreCodexExplorerPrefs,
  serializeCodexExplorerPrefs,
  type CodexExplorerGridMode,
  type CodexExplorerPrefs,
  type CodexExplorerVisibility,
} from "./codex-explorer-persistence";

function readStored(): CodexExplorerPrefs {
  if (typeof localStorage === "undefined") return defaultCodexExplorerPrefs();
  return restoreCodexExplorerPrefs(localStorage.getItem(CODEX_EXPLORER_STORAGE_KEY));
}

export function gridModeEnum(mode: CodexExplorerGridMode): GridMode {
  return mode === "box" ? GridMode.BOX : GridMode.DIAMOND;
}

export function createCodexExplorerState() {
  const initial = readStored();

  let selectedLetter = $state(initial.selectedLetter);
  let gridMode = $state<CodexExplorerGridMode>(initial.gridMode);
  let isDarkMode = $state(initial.isDarkMode);
  let blueTurnsOverride = $state<number | null>(initial.blueTurnsOverride);
  let redTurnsOverride = $state<number | null>(initial.redTurnsOverride);
  let visibility = $state<CodexExplorerVisibility>({ ...initial.visibility });
  // Session-only, never persisted.
  let searchTerm = $state("");

  // Debounced persistence of the durable subset.
  $effect(() => {
    const serialized = serializeCodexExplorerPrefs({
      version: 1,
      selectedLetter,
      gridMode,
      isDarkMode,
      blueTurnsOverride,
      redTurnsOverride,
      visibility: $state.snapshot(visibility),
    });
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(CODEX_EXPLORER_STORAGE_KEY, serialized);
      } catch {
        // noop — private mode / quota
      }
    }, 400);
    return () => clearTimeout(timer);
  });

  return {
    get selectedLetter() { return selectedLetter; },
    set selectedLetter(v: string) { selectedLetter = v; },
    get gridMode() { return gridMode; },
    set gridMode(v: CodexExplorerGridMode) { gridMode = v; },
    get gridModeEnum() { return gridModeEnum(gridMode); },
    get isDarkMode() { return isDarkMode; },
    set isDarkMode(v: boolean) { isDarkMode = v; },
    get blueTurnsOverride() { return blueTurnsOverride; },
    set blueTurnsOverride(v: number | null) { blueTurnsOverride = v; },
    get redTurnsOverride() { return redTurnsOverride; },
    set redTurnsOverride(v: number | null) { redTurnsOverride = v; },
    get visibility() { return visibility; },
    get searchTerm() { return searchTerm; },
    set searchTerm(v: string) { searchTerm = v; },
    toggleVisibility(key: keyof CodexExplorerVisibility) {
      visibility = { ...visibility, [key]: !visibility[key] };
    },
  };
}

export type CodexExplorerState = ReturnType<typeof createCodexExplorerState>;
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx svelte-check --threshold error --tsconfig ./tsconfig.json 2>&1 | grep -i codex-explorer-state || echo "clean"`
Expected: `clean` (no errors referencing the new file).

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/learn/codex/state/codex-explorer-state.svelte.ts
git commit -m "feat(codex): runes view-state factory with persistence for explorer" -- src/lib/features/learn/codex/state/codex-explorer-state.svelte.ts
```

---

## Task 3: Extend CodexControlPanel with optional orientation

The unified explorer already owns the Diamond/Box axis via its grid-mode
`SegmentedControl`, so the control panel must be able to render JUST the
transform buttons (rotate / mirror / colorswap) without its own
orientation selector.

**Files:**
- Modify: `src/lib/features/learn/codex/components/CodexControlPanel.svelte`

- [ ] **Step 1: Add the `showOrientation` prop**

In the `$props` block (lines ~13–25), add `showOrientation`:

```ts
  let {
    onRotate,
    onMirror,
    onColorSwap,
    onOrientationChange,
    currentOrientation = "Diamond",
    showOrientation = true,
  } = $props<{
    onRotate?: () => void;
    onMirror?: () => void;
    onColorSwap?: () => void;
    onOrientationChange?: (orientation: string) => void;
    currentOrientation?: string;
    showOrientation?: boolean;
  }>();
```

- [ ] **Step 2: Gate the orientation selector in the template**

Wrap the `.orientation-wrapper` block (lines ~63–72) in `{#if showOrientation}`:

```svelte
    {#if showOrientation}
      <div class="orientation-wrapper">
        <SegmentedControl
          options={orientationOptions}
          value={currentOrientation}
          onchange={handleOrientationChange}
          color="accent"
          size="sm"
        />
      </div>
    {/if}
```

- [ ] **Step 3: Verify type-check is clean**

Run: `npx svelte-check --threshold error 2>&1 | grep -i CodexControlPanel || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/learn/codex/components/CodexControlPanel.svelte
git commit -m "feat(codex): optional showOrientation on CodexControlPanel" -- src/lib/features/learn/codex/components/CodexControlPanel.svelte
```

---

## Task 4: Scaffold CodexExplorer with persistence parity

Create `CodexExplorer.svelte` by promoting the existing
`PictographExplorerLab.svelte`, rewiring local `$state` to the new state factory.
At this task's end it renders identically to the lab explorer but persists prefs
across reloads. (Later tasks add chips, the colored map, search, transforms.)

**Files:**
- Create: `src/lib/features/learn/codex/components/CodexExplorer.svelte`
- Reference (read, do not modify): `src/lib/features/lab/tabs/pictograph-explorer/PictographExplorerLab.svelte`

- [ ] **Step 1: Copy the lab explorer to the new path**

```bash
cp src/lib/features/lab/tabs/pictograph-explorer/PictographExplorerLab.svelte \
   src/lib/features/learn/codex/components/CodexExplorer.svelte
```

- [ ] **Step 2: Replace the local view `$state` + `LETTER_GROUPS` block with the factory**

In `CodexExplorer.svelte`, replace the imports + the local state declarations
(the `LETTER_GROUPS` const through the `isDarkMode` state and the
`VISIBILITY_TOGGLES` const) so the component reads/writes the factory. Add:

```ts
  import { createCodexExplorerState } from "../state/codex-explorer-state.svelte";

  const view = createCodexExplorerState();
```

Then delete the local `let selectedLetter`, `let blueTurnsOverride`,
`let redTurnsOverride`, the seven `show*` states, `let gridMode`, and
`let isDarkMode`. Replace every read/write of those identifiers with the `view`
getters/setters (`view.selectedLetter`, `view.gridModeEnum`,
`view.visibility.showGrid`, `view.toggleVisibility("grid")`, etc.). Keep
`isLoading`, `renderer`, `allPictographs`, `canvasRefs`, `variations` local.

`gridMode` comparisons that used the `GridMode` enum now use `view.gridModeEnum`;
`setGridMode(mode)` sets `view.gridMode = mode === GridMode.BOX ? "box" : "diamond"`
then reloads the dataframe with `view.gridModeEnum`.

Keep `LETTER_GROUPS` (the canonical alphabet) — it stays in this component as the
sidebar's data; it is not persisted.

- [ ] **Step 3: Point `renderAll` / `init` at the factory values**

`init()` and `setGridMode()` call
`letterQueryHandler.getAllPictographVariations(view.gridModeEnum)`.
`renderAll()` reads `view.visibility.*`, `view.isDarkMode`,
`view.blueTurnsOverride`, `view.redTurnsOverride`.

- [ ] **Step 4: Temporarily mount it in the IA harness to view it**

In `src/routes/test/codex-ia/+page.svelte`, change the `inline` branch import to
render `CodexExplorer` instead of `CodexInlineExpand` (temporary, for visual
parity check; reverted when the harness is deleted in Task 9):

```svelte
  import CodexExplorer from "$lib/features/learn/codex/components/CodexExplorer.svelte";
```
```svelte
    {:else}
      <CodexExplorer />
    {/if}
```

- [ ] **Step 5: Verify type-check + runtime**

Run: `npx svelte-check --threshold error 2>&1 | grep -iE "CodexExplorer|codex-ia" || echo "clean"`
Expected: `clean`.
Runtime: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/test/codex-ia` → `200`.
Visual: open the "C · Inline" tab; confirm parity with "B · Sidebar"; change grid mode + a toggle, reload the page, confirm the change persists.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/learn/codex/components/CodexExplorer.svelte src/routes/test/codex-ia/+page.svelte
git commit -m "feat(codex): CodexExplorer scaffolded from lab explorer with persistence" -- src/lib/features/learn/codex/components/CodexExplorer.svelte src/routes/test/codex-ia/+page.svelte
```

---

## Task 5: Visibility toggles → FilterChipBase

Per `chip-primitives.md`, the seven visibility toggles are independent booleans
(many-on) → `FilterChipBase mode="toggle"`. Replace the raw `<button class="toggle-btn">`
row.

**Files:**
- Modify: `src/lib/features/learn/codex/components/CodexExplorer.svelte`

- [ ] **Step 1: Import the primitive + define the chip list**

```ts
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";

  const VISIBILITY_CHIPS = [
    { key: "showGrid", label: "Grid", icon: "fas fa-border-all" },
    { key: "showTKA", label: "TKA", icon: "fas fa-font" },
    { key: "showTnD", label: "TnD", icon: "fas fa-arrows-rotate" },
    { key: "showElemental", label: "Elemental", icon: "fas fa-fire" },
    { key: "showPositions", label: "Positions", icon: "fas fa-location-dot" },
    { key: "showReversals", label: "Reversals", icon: "fas fa-left-right" },
    { key: "showNonRadialPoints", label: "Non-Radial", icon: "fas fa-circle-dot" },
  ] as const;
```

- [ ] **Step 2: Replace the `.toggle-grid` markup**

```svelte
      <div class="toggle-grid">
        {#each VISIBILITY_CHIPS as chip}
          <FilterChipBase
            mode="toggle"
            size="sm"
            label={chip.label}
            icon={chip.icon}
            active={view.visibility[chip.key]}
            onclick={() => { view.toggleVisibility(chip.key); renderAll(); }}
          />
        {/each}
      </div>
```

Remove the old `.toggle-btn` CSS rules (the chip owns its styling). Keep
`.toggle-grid` as a 2-col grid container.

- [ ] **Step 3: Verify type-check + runtime**

Run: `npx svelte-check --threshold error 2>&1 | grep -i CodexExplorer || echo "clean"`
Expected: `clean`.
Visual: toggles still flip visibility and re-render; no `type="checkbox"` introduced (`grep -n "checkbox" src/lib/features/learn/codex/components/CodexExplorer.svelte` → no output).

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/learn/codex/components/CodexExplorer.svelte
git commit -m "refactor(codex): visibility toggles use FilterChipBase" -- src/lib/features/learn/codex/components/CodexExplorer.svelte
```

---

## Task 6: Color-coded canonical letter map + type labels

Give each `LETTER_GROUPS` section its canonical type color and a type-name label,
so the sidebar reads as the alphabet map.

**Files:**
- Modify: `src/lib/features/learn/codex/components/CodexExplorer.svelte`

- [ ] **Step 1: Add color metadata to the groups**

Extend `LETTER_GROUPS` entries with a `color` (canonical type colors):

```ts
  const LETTER_GROUPS = [
    { label: "Type 1 · Dual-Shift", color: "#36c3ff", letters: "ABCDEFGHIJKLMNOPQRSTUV".split("") },
    { label: "Type 2 · Shift", color: "#6F2DA8", letters: ["W", "X", "Y", "Z", "Σ", "Δ", "Θ", "Ω"] },
    { label: "Type 3 · Cross-Shift", color: "#26e600", letters: ["W-", "X-", "Y-", "Z-", "Σ-", "Δ-", "Θ-", "Ω-"] },
    { label: "Type 4 · Dash", color: "#26e600", letters: ["Φ", "Ψ", "Λ"] },
    { label: "Type 5 · Dual-Dash", color: "#00b3ff", letters: ["Φ-", "Ψ-", "Λ-"] },
    { label: "Type 6 · Static", color: "#eb7d00", letters: ["α", "β", "γ"] },
  ];
```

- [ ] **Step 2: Apply the color to the group label + active letter accent**

In the group `{#each}`, set a CSS var on the group and use it for the label dot
and the active letter button:

```svelte
        {#each LETTER_GROUPS as group}
          <div class="letter-group" style="--type-color: {group.color};">
            <span class="group-label">{group.label}</span>
            <div class="letter-grid">
              {#each group.letters as letter}
                <button
                  type="button"
                  class="letter-btn"
                  class:active={view.selectedLetter === letter}
                  aria-pressed={view.selectedLetter === letter}
                  onclick={() => selectLetter(letter)}
                >{letter}</button>
              {/each}
            </div>
          </div>
        {/each}
```

Add CSS: `.group-label` gets a leading dot in `--type-color`; `.letter-btn.active`
uses `background: var(--type-color)` (replace the previous accent-green active
rule). Example:

```css
  .group-label::before {
    content: "";
    display: inline-block;
    width: 8px; height: 8px;
    margin-right: 6px;
    border-radius: 50%;
    background: var(--type-color, var(--theme-accent));
    vertical-align: middle;
  }
  .letter-btn.active {
    background: var(--type-color, var(--theme-accent));
    color: #06120b;
    font-weight: 700;
    box-shadow: 0 0 0 1px var(--type-color, var(--theme-accent));
  }
```

- [ ] **Step 3: Verify type-check + visual**

Run: `npx svelte-check --threshold error 2>&1 | grep -i CodexExplorer || echo "clean"`
Expected: `clean`.
Visual: six type sections, each with its colored dot; active letter takes its
type color; dash letters (`Σ-` etc.) fit their buttons.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/learn/codex/components/CodexExplorer.svelte
git commit -m "feat(codex): color-coded canonical type sections in sidebar" -- src/lib/features/learn/codex/components/CodexExplorer.svelte
```

---

## Task 7: Jump-to-letter search

A search box at the top of the sidebar filters which letters are shown (matches
the glyph, case-insensitive). Empty sections hide.

**Files:**
- Modify: `src/lib/features/learn/codex/components/CodexExplorer.svelte`

- [ ] **Step 1: Add the derived filtered groups**

```ts
  let filteredGroups = $derived(
    LETTER_GROUPS
      .map((g) => ({
        ...g,
        letters: view.searchTerm
          ? g.letters.filter((l) => l.toLowerCase().includes(view.searchTerm.toLowerCase()))
          : g.letters,
      }))
      .filter((g) => g.letters.length > 0)
  );
```

- [ ] **Step 2: Add the search input above the letter groups**

```svelte
    <section class="panel">
      <h2 class="panel-title">Letter</h2>
      <input
        class="letter-search"
        type="search"
        placeholder="Jump to letter…"
        aria-label="Search letters"
        bind:value={view.searchTerm}
      />
      <div class="letter-groups">
        {#each filteredGroups as group (group.label)}
          ...
        {/each}
      </div>
    </section>
```

(Swap the `{#each LETTER_GROUPS …}` to `{#each filteredGroups …}`.)

Add `.letter-search` CSS: full-width, themed input, `min-height: var(--min-touch-target)`,
`margin-bottom: 10px`. This is a text input, not a chip — `type="search"` is not a checkbox.

- [ ] **Step 3: Verify type-check + visual**

Run: `npx svelte-check --threshold error 2>&1 | grep -i CodexExplorer || echo "clean"`
Expected: `clean`.
Visual: typing `Σ` narrows to the Σ letters; clearing restores all six sections.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/learn/codex/components/CodexExplorer.svelte
git commit -m "feat(codex): jump-to-letter sidebar search" -- src/lib/features/learn/codex/components/CodexExplorer.svelte
```

---

## Task 8: Transform ops (rotate / mirror / colorswap)

Salvage the transform ops via `CodexControlPanel` (orientation hidden) +
the `codex` service. Transforms apply to the currently-shown variations and
reset when the letter or grid mode changes.

**Files:**
- Modify: `src/lib/features/learn/codex/components/CodexExplorer.svelte`
- Reference (read): `src/lib/features/learn/codex/services/codex.ts` (methods
  `rotateAllPictographs`, `mirrorAllPictographs`, `colorSwapAllPictographs`),
  `src/lib/features/learn/codex/get-codex.ts` (the `getCodex` getter).

- [ ] **Step 1: Hold a transformed-variations layer**

Add state + derivation so render uses transformed variations when present:

```ts
  import { getCodex } from "../get-codex";

  // Transformed copy of the selected letter's variations; null = show raw.
  let transformed = $state<PictographData[] | null>(null);

  // The variations actually rendered: transformed if a transform is active.
  let renderVariations = $derived(transformed ?? variations);
```

Change `renderAll()` to iterate `renderVariations` instead of `variations`, and
`canvasRefs`/`variations.length` checks to use `renderVariations`.

- [ ] **Step 2: Reset transforms on letter / grid-mode change**

In `selectLetter()` and `setGridMode()` add `transformed = null;`.

- [ ] **Step 3: Wire the transform handlers**

```ts
  async function applyTransform(op: "rotate" | "mirror" | "colorswap") {
    const codex = getCodex();
    const base = transformed ?? variations;
    if (base.length === 0) return;
    if (op === "rotate") transformed = await codex.rotateAllPictographs(base);
    else if (op === "mirror") transformed = await codex.mirrorAllPictographs(base);
    else transformed = await codex.colorSwapAllPictographs(base);
    await tick();
    renderAll();
  }
```

- [ ] **Step 4: Render the control panel in the sidebar (orientation hidden)**

```svelte
    <section class="panel">
      <h2 class="panel-title">Transform</h2>
      <CodexControlPanel
        showOrientation={false}
        onRotate={() => applyTransform("rotate")}
        onMirror={() => applyTransform("mirror")}
        onColorSwap={() => applyTransform("colorswap")}
      />
    </section>
```

Add the import: `import CodexControlPanel from "./CodexControlPanel.svelte";`

- [ ] **Step 5: Verify type-check + runtime**

Run: `npx svelte-check --threshold error 2>&1 | grep -iE "CodexExplorer|codex\.ts" || echo "clean"`
Expected: `clean`.
Visual: rotate/mirror/colorswap visibly transform the shown variations; selecting
a different letter resets to raw; grid-mode flip resets.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/learn/codex/components/CodexExplorer.svelte
git commit -m "feat(codex): rotate/mirror/colorswap transform ops in explorer" -- src/lib/features/learn/codex/components/CodexExplorer.svelte
```

---

## Task 9: Rewire LearnTab, retire lab tab, delete husks + harness

Swap the learn Codex tab to `CodexExplorer`, remove the lab Pictograph Explorer
tab, and delete all now-unused drill components and the throwaway harness.

**Files:**
- Modify: `src/lib/features/learn/LearnTab.svelte`
- Modify: `src/lib/features/lab/LabModule.svelte`
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts`
- Delete: `src/lib/features/lab/tabs/pictograph-explorer/` (dir)
- Delete: `src/lib/features/learn/codex/components/CodexTab.svelte`
- Delete: `src/lib/features/learn/codex/components/CodexComponent.svelte`
- Delete: `src/lib/features/learn/codex/components/LetterDetailView.svelte`
- Delete: `src/lib/features/learn/codex/components/CodexPictographGrid.svelte`
- Delete: `src/routes/test/codex-ia/` (dir)

- [ ] **Step 1: Point LearnTab at CodexExplorer**

In `LearnTab.svelte` line ~22 replace the import:

```ts
  import CodexExplorer from "./codex/components/CodexExplorer.svelte";
```

And the render (line ~217):

```svelte
        {:else if isModeActive("codex")}
          <CodexExplorer />
```

- [ ] **Step 2: Remove the lab tab lazy entry**

In `LabModule.svelte` delete line ~41:

```ts
    "pictograph-explorer": () => import("./tabs/pictograph-explorer/PictographExplorerLab.svelte"),
```

- [ ] **Step 3: Remove the lab tab definition**

In `tab-definitions.ts` delete the whole `{ id: "pictograph-explorer", … }`
object (the entry beginning ~line 1097 through its closing `},`).

- [ ] **Step 4: Confirm no remaining consumers of the husks**

Run:
```bash
grep -rn "CodexTab\|CodexComponent\|LetterDetailView\|CodexPictographGrid\|createCodexState\|PictographExplorerLab\|codex-ia" src --include=*.svelte --include=*.ts
```
Expected: only matches inside the files being deleted. If `createCodexState`
(from `codex-state.svelte.ts`) has no remaining consumers, add
`src/lib/features/learn/codex/state/codex-state.svelte.ts` to the delete list.
If any OTHER file references a husk, STOP and reconcile before deleting.

- [ ] **Step 5: Delete the husks + harness + dead lab dir**

```bash
git rm src/lib/features/learn/codex/components/CodexTab.svelte \
       src/lib/features/learn/codex/components/CodexComponent.svelte \
       src/lib/features/learn/codex/components/LetterDetailView.svelte \
       src/lib/features/learn/codex/components/CodexPictographGrid.svelte
git rm -r src/lib/features/lab/tabs/pictograph-explorer src/routes/test/codex-ia
```
(Plus `git rm src/lib/features/learn/codex/state/codex-state.svelte.ts` only if
Step 4 proved it unused.)

- [ ] **Step 6: Remove now-orphaned i18n keys**

Search for the lab tab's label/desc keys and remove their entries from every
locale file:
```bash
grep -rln "tab_lab_pictograph_explorer\|tab_desc_lab_pictograph_explorer" src
```
Delete those key lines in each file found. (If none found, skip.)

- [ ] **Step 7: Full type-check (cross-file — refactor touched shared symbols)**

Run: `npm run check > /tmp/codex-check.log 2>&1; grep -niE "error" /tmp/codex-check.log | grep -iE "codex|learn|lab" || echo "no codex/learn/lab errors"`
Expected: `no codex/learn/lab errors` (and no NEW errors elsewhere vs the
pre-existing baseline).

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/learn/LearnTab.svelte src/lib/features/lab/LabModule.svelte src/lib/shared/navigation/config/tab-definitions.ts
git commit -m "feat(codex): host unified explorer in learn Codex tab; retire lab tab + drill husks" -- src/lib/features/learn/LearnTab.svelte src/lib/features/lab/LabModule.svelte src/lib/shared/navigation/config/tab-definitions.ts
# the git rm deletions are already staged; commit them with their own pathspec:
git commit -m "chore(codex): delete drill husks, lab explorer, IA harness" -- \
  src/lib/features/learn/codex/components/CodexTab.svelte \
  src/lib/features/learn/codex/components/CodexComponent.svelte \
  src/lib/features/learn/codex/components/LetterDetailView.svelte \
  src/lib/features/learn/codex/components/CodexPictographGrid.svelte \
  src/lib/features/lab/tabs/pictograph-explorer src/routes/test/codex-ia
```

---

## Task 10: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full check green (no NEW errors vs baseline)**

Run: `npm run check > /tmp/codex-final.log 2>&1; tail -5 /tmp/codex-final.log`
Compare error count to the pre-work baseline; no new errors attributable to this work.

- [ ] **Step 2: Unit tests pass**

Run: `npx vitest run src/lib/features/learn/codex/state/codex-explorer-persistence.test.ts`
Expected: PASS.

- [ ] **Step 3: Runtime — learn Codex tab**

Confirm the learn module's Codex tab renders `CodexExplorer`: every canonical
letter across all six types (incl. `-` cross-variants) selects and renders its
variations; transform ops work; toggles/turns/grid-mode work; reload restores
persisted prefs. Capture evidence (runtime query or screenshot) per
`verification-protocol.md`.

- [ ] **Step 4: Runtime — lab tab gone**

Confirm the lab nav no longer lists "Pictograph Explorer" and navigating to its
old id does not error.

- [ ] **Step 5: No regressions / dead refs**

Run: `grep -rn "pictograph-explorer\|CodexTab\|LetterDetailView" src --include=*.ts --include=*.svelte || echo "clean"`
Expected: `clean`.

---

## Self-Review (completed by plan author)

- **Spec coverage:** sidebar IA (Tasks 4–7), transform ops (Task 8), persistence
  (Tasks 1–2, 4), canonical color map (Task 6), search (Task 7), salvage
  CodexControlPanel (Task 3), delete husks + retire lab tab + rewire LearnTab
  (Task 9), FilterChipBase + no-checkbox compliance (Task 5), no-layout-shift
  (carried from the existing explorer's reserved header/`tabular-nums`).
  Variation filter is explicitly out of scope per the spec. All spec sections map
  to a task.
- **Placeholder scan:** none — every code step shows full code.
- **Type consistency:** `CodexExplorerPrefs` / `CodexExplorerVisibility` /
  `gridModeEnum` used consistently across Tasks 1, 2, 4; `view.*` getter/setter
  names match the factory in Task 2; `showOrientation` matches Tasks 3 and 8;
  `applyTransform` op names match the `codex` service methods.
