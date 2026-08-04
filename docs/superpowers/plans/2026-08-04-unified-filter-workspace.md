# Unified Filter Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Smart Collection builder's filter interaction layer becomes THE filter workspace for the main gallery and every browse surface, per the approved spec [2026-08-04-unified-filter-workspace-design.md](../specs/2026-08-04-unified-filter-workspace-design.md).

**Architecture:** `BrowseModule`'s drill adopts the builder flags (`unifiedFilterChooser`, `adaptiveValueLayout`, `persistentDesktopCatalog`) and the toggle/connective wiring the builder sheet already uses. The gallery gains the shared `FilterRuleStrip` (grouped sentence, landed in `a0c9b8376a`) pinned above the drill and the grid. Each converted screen's page-mode CSS fork is **deleted in the same phase** — no phase ends with both layouts alive. Desktop `GalleryFilterSheet` retires; phone keeps it pending a real-phone feel test.

**Tech Stack:** Svelte 5 runes, existing `createBrowseEngine`, `FilterRuleStrip` + `filter-rule-groups`, `GalleryDrill` mode flags, vitest.

**Ground rules that bind every task:**

- Work on `main` in the primary checkout. Commit with explicit pathspec only (`git commit -m "..." -- <paths>`).
- Stage-1 connectives are LANDED (`a0c9b8376a`): engine `connectives`/`setConnective`, `FilterRuleStrip`, `filter-rule-groups`, Match any/all controls in GalleryDrill. Reuse; do not rebuild.
- Every visual task ends with the DevTools loop: `pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank`, task-owned page, `emulate` at width×1.1 (localhost runs 110% zoom — verify `window.innerWidth` matches the target), `take_screenshot format:"webp" quality:70`. Required viewports: 1920/2560/3840/1440 (desktop ×1.1 → 2112×1188, 2816×1584, 4224×2376, 1584×990) + 902×1298 tablet, 1056×453 fold-landscape, 412×734 SE.
- GalleryDrill gotchas (from the 2026-08-03/04 sessions): base `.value-list` is a flex COLUMN — any `display:flex` override must also set `flex-flow: row wrap`; the tall-phone `!important` block is scoped `:not(.dense)`; the `dense` CSS section sits at the very END of `<style>` and must stay last; `:global()` takes exactly one selector; :5173 is Austen's server — never restart it.
- A pre-existing failure set exists and is NOT yours to fix: `tests/unit/browse/founding-collections.test.ts` and `canonical-tnd-author.test.ts` (protobufjs import), `tests/unit/browse-engine-solo-load-race.test.ts` (fails on HEAD). Judge your work by the other suites.

---

### Task 1: Persisted-filter migration test (bare-type keys → per-value keys)

The spec's migration check: gallery filters persisted under the OLD one-per-type key scheme (`"startPosition"`) must still load and apply under the current per-value scheme (`"startPosition:alpha"`). `buildInitialFilters` copies persisted keys verbatim, so old keys flow straight into the map — the test proves `applyFilters` and `removeFilter` still behave.

**Files:**
- Create: `tests/unit/browse/persisted-filter-key-migration.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, expect, it, vi } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

vi.mock("$lib/shared/browse/get-browse-loader", () => ({
  getBrowseLoader: () => ({
    loadSequenceMetadata: vi.fn(async () => []),
    refreshFromFirestore: vi.fn(async () => []),
    removeFromCache: vi.fn(),
  }),
}));
vi.mock("$lib/shared/library/get-library-repository", () => ({
  getLibraryRepository: () => null,
}));
vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
  authState: { isAuthenticated: false, isFullAccount: false },
}));
vi.mock("$lib/shared/settings/state/settings-state.svelte", () => ({
  settingsService: { settings: { gridZoomByBucket: {} }, updateSetting: vi.fn() },
}));
vi.mock("$lib/shared/library/library-events", () => ({
  onLibraryMutated: () => () => {},
  onLibrarySequenceAdded: () => () => {},
}));
vi.mock("$lib/shared/library/services/collection-manager", () => ({
  toggleFavorite: vi.fn(),
}));
vi.mock("$lib/shared/toast/state/toast-state.svelte", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { createBrowseEngineForTest } from "../browse-engine-test-helpers.svelte";

const PERSIST_KEY = "test-migration-gallery";

function seedLegacyPersistedState() {
  // The OLD scheme: one-per-type bare keys, no connectives field.
  localStorage.setItem(
    PERSIST_KEY,
    JSON.stringify({
      source: "community",
      sortMethod: "alphabetical",
      sortDirection: "asc",
      activeFilters: [
        ["startPosition", {
          type: "startPosition", value: "alpha",
          label: "Alpha", chipColor: "#fff", locked: false,
        }],
        ["cap_type:component:mirrored", {
          type: "cap_type", value: "component:mirrored",
          label: "Mirrored", chipColor: "#fff", locked: false,
        }],
        ["cap_type:component:swapped", {
          type: "cap_type", value: "component:swapped",
          label: "Swapped", chipColor: "#fff", locked: false,
        }],
      ],
      columns: 4,
    })
  );
}

function seq(id: string, startPos: string, components: string[]): SequenceData {
  return {
    id, word: id, startPosition: startPos, components,
  } as unknown as SequenceData;
}

describe("persisted filter key migration", () => {
  it("loads bare-type keys, applies them, and legacy stacked LOOPs keep AND", () => {
    seedLegacyPersistedState();
    const { engine, dispose } = createBrowseEngineForTest({
      persistKey: PERSIST_KEY,
    });
    try {
      // Bare-type key restored as an active filter.
      expect(engine.activeFilters.has("startPosition")).toBe(true);
      // Legacy state had 2 stacked LOOPs and no stored connective →
      // buildInitialConnectives resolves cap_type to "all".
      expect(engine.connectives["cap_type"]).toBe("all");
      // removeFilter by bare type still clears it.
      engine.removeFilter("startPosition");
      expect(engine.activeFilters.has("startPosition")).toBe(false);
    } finally {
      dispose();
      localStorage.removeItem(PERSIST_KEY);
    }
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/unit/browse/persisted-filter-key-migration.test.ts`
Expected: PASS (this documents current behavior; if it FAILS, the migration gap is real — fix `buildInitialFilters`/`buildInitialConnectives` in `create-browse-engine.svelte.ts`, not the test, and surface what you found in the commit message).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/browse/persisted-filter-key-migration.test.ts
git commit -m "test(browse): persisted bare-type filter keys load under the per-value scheme" -- tests/unit/browse/persisted-filter-key-migration.test.ts
```

---

### Task 2: Gallery adopts the workspace (BrowseModule wiring + rule strip + no bounce)

The heart of the conversion. The drill stays mounted while values toggle in place; the `FilterRuleStrip` + live count + "View N results" + Save sit above it. Taps no longer eject to the grid.

**Files:**
- Modify: `src/lib/features/browse/shared/components/BrowseModule.svelte` (drill block ~lines 547–589, script ~lines 118–152)

- [ ] **Step 1: Add strip imports and helper state to BrowseModule's script**

```svelte
import FilterRuleStrip from "$lib/shared/browse/components/FilterRuleStrip.svelte";
import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
```

Add the same derived maps the builder sheet uses (copy from `SmartCollectionBuilderSheet.svelte` — `loopKeyByValue`, `activeLoopValues`, `familyKeyByValue`, `activeFamilyValues`, `appliedValueKeys`). They read only `engine.activeFilters`, so they paste unchanged.

- [ ] **Step 2: Replace the GalleryDrill block's wiring**

The drill keeps `pool`, `getCount`, `onSearch`, `onShowAll` (both still `applyToGrid`, unchanged), and GAINS the builder-mode props. `onApply` no longer clears or navigates — the workspace model is toggle-in-place:

```svelte
<div class="gallery-workspace">
  {#if engine.hasActiveFilters}
    <div class="gallery-rule-strip">
      <span class="strip-count" aria-live="polite">
        {engine.resultCount} {engine.resultCount === 1 ? "match" : "matches"}
      </span>
      <FilterRuleStrip
        filters={engine.allFilterChips.filter((c) => !c.locked)}
        connectives={engine.connectives}
        onEditFilter={(type) => drillSeed = { section: SECTION_FOR_FILTER_TYPE[type] }}
        onRemoveFilter={(key) => engine.removeFilter(key)}
      />
      <div class="strip-actions">
        <PanelButton variant="primary" onclick={() => applyToGrid(() => {})}>
          View {engine.resultCount} results
        </PanelButton>
        <PanelButton variant="secondary" onclick={() => (smartSaveOpen = true)}>
          <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
          Save
        </PanelButton>
      </div>
    </div>
  {/if}
  {#key drillSeed}
    <GalleryDrill
      pool={engine.allSequences}
      unifiedFilterChooser
      adaptiveValueLayout
      persistentDesktopCatalog
      fluidWideCanvas
      initialSection={drillSeed.section}
      getCount={(type, value) => engine.getFilteredCount(type, value)}
      isValueApplied={(type, value) => appliedValueKeys.has(`${type}:${String(value)}`)}
      onApply={(type, value, label, color) =>
        engine.addFilter(type, value, label, color ?? "#6aa0ff")}
      onToggleValue={(type, value, label, color, nowActive) => {
        if (nowActive) engine.addFilter(type, value, label, color ?? "#6aa0ff");
        else engine.removeFilter(`${type}:${String(value)}`);
      }}
      {activeLoopValues}
      loopConnective={engine.connectives["cap_type"] ?? "any"}
      onLoopConnectiveChange={(c) => engine.setConnective(BrowseFilterType.LOOP_TYPE, c)}
      onToggleLoop={(value, label, color, nowActive) => {
        if (nowActive) engine.addFilter(BrowseFilterType.LOOP_TYPE, value, label, color);
        else { const k = loopKeyByValue.get(value); if (k) engine.removeFilter(k); }
      }}
      {activeFamilyValues}
      familyConnective={engine.connectives["tnd_family"] ?? "any"}
      onFamilyConnectiveChange={(c) => engine.setConnective(BrowseFilterType.TND_FAMILY, c)}
      onToggleFamily={(familyId, label, color, nowActive) => {
        if (nowActive) engine.addFilter(BrowseFilterType.TND_FAMILY, familyId, label, color);
        else { const k = familyKeyByValue.get(familyId); if (k) engine.removeFilter(k); }
      }}
      onShowAll={() => applyToGrid(() => engine.clearUserFilters())}
      onSearch={(q) => applyToGrid(() => { engine.clearUserFilters(); engine.setSearch(q); })}
    />
  {/key}
</div>
```

`drillSeed` is a `$state<{ section?: FilterPickerSection }>({})`; copy `SECTION_FOR_FILTER_TYPE` from the builder sheet. Add `.gallery-workspace { display:flex; flex-direction:column; min-height:0; flex:1 }` and a `.gallery-rule-strip` row (flex, wrap, gap, padding) to the module's `<style>`.

Decision recorded in the spec that this implements: landing stays editorial (hero doors, mini tiles, show-all untouched); `onBackToStart` NO LONGER clears filters — the workspace keeps the rule when returning from the grid (the strip must show it). Delete the `engine.clearUserFilters()`/`engine.setSearch("")` lines from `onBackToStart` and from the mount-time reset (lines ~103–108) so a persisted rule survives into the workspace; keep the search reset.

- [ ] **Step 3: Typecheck + drill smoke**

Run: `npm run check:fast` → 0 new errors in touched files.
Then the DevTools loop against `https://localhost:5173` → Browse module → gallery: tap a hero door, verify the editor opens IN PLACE, values toggle, strip appears with grouped sentence + live count, "View N results" lands on the grid, Back returns WITH the rule intact.

- [ ] **Step 4: Full viewport sweep + commit**

All 7 viewports on: chooser, one value screen with strip visible, grid with strip.

```bash
git add src/lib/features/browse/shared/components/BrowseModule.svelte
git commit -m "feat(gallery): drill becomes the in-page filter workspace with rule strip + save bridge" -- src/lib/features/browse/shared/components/BrowseModule.svelte
```

---

### Task 3: Complete option sets in page mode (noise floors die)

**Files:**
- Modify: `src/lib/features/browse/gallery-home/GalleryDrill.svelte:400` (levelValues) and `:422` (lengthValues)

- [ ] **Step 1: Make the catalogs unconditional**

Line 400: `})).filter((v) => Boolean(onToggleValue) || v.count > 0)` → keep every value; zero-count options render dimmed (the `disabled={... && v.count === 0 && !isOn}` treatment already exists in builder mode and now applies in the gallery since Task 2 passes `onToggleValue`). Delete the filter clause:

```typescript
}))
```

Line 422: delete `.filter((v) => (onToggleValue ? true : v.count >= 3))` and the comment above it. The `dense` class already handles the grown catalog (`0d5cf46069`).

- [ ] **Step 2: Verify + commit**

Run: `npm run check:fast`, then screenshot the Length and Level screens at 1584×990 and 412×734 — the full catalog renders, no overflow (the dense probes from 2026-08-03 cover ≤19 values).

```bash
git add src/lib/features/browse/gallery-home/GalleryDrill.svelte
git commit -m "feat(gallery): complete option sets — level/length noise floors removed" -- src/lib/features/browse/gallery-home/GalleryDrill.svelte
```

---

### Task 4: Delete the page-mode CSS forks + the `progressive-secondary-choices` path

The architecture rule: converted screens keep ONE layout system. With BrowseModule on the builder flags, nothing renders the page-mode compositions.

**Files:**
- Modify: `src/lib/features/browse/gallery-home/GalleryDrill.svelte`

- [ ] **Step 1: Confirm no host still uses page mode**

```bash
grep -rn "progressiveSecondaryChoices" src --include="*.svelte" | grep -v GalleryDrill.svelte
```
Expected: no output (only the drill defines it). If a host passes it, STOP and reconcile first.

- [ ] **Step 2: Remove the `progressiveSecondaryChoices` prop and its markup branch**

Delete the prop from the interface + destructuring, the `class:progressive-secondary-choices` binding (~line 1172), the "more" section markup it gates, and every `.progressive-secondary-choices` CSS block:

```bash
grep -n "progressive" src/lib/features/browse/gallery-home/GalleryDrill.svelte
```
Work through every hit (~94). The "more" Section id stays in the `Section` type only if `unifiedFilterChooser` still routes through it — check `openSection`/chooser markup; if the unified chooser never emits "more", delete it from the type, `SECTIONS`, and the persister's accepted values.

- [ ] **Step 3: Collapse the flag-conditional CSS for converted screens**

For each of the value screens (level, length, letter, position, gridmode, author, loop, family, max_turn_intensity): the builder-mode selectors (`.adaptive-value-layout ...`, `.unified-filter-chooser ...`, `.persistent-desktop-catalog ...`) become the ONLY layout — but do NOT flatten them into unscoped rules yet if `GalleryFilterSheet` (phone) still mounts the drill WITHOUT those flags (it does, until Task 5 settles the phone fate). Instead, this step deletes only rules that are now dead: page-mode-only compositions that no mounted host reaches. Identify them per screen:

```bash
grep -n "screen-level\|screen-length\|screen-letter\|screen-position\|screen-gridmode\|screen-author\|screen-loop\|screen-family\|screen-max" src/lib/features/browse/gallery-home/GalleryDrill.svelte
```

A rule is dead when it is scoped to a screen class AND `:not(.adaptive-value-layout)` semantics (i.e., NOT nested under a builder flag) AND its only non-builder host after this plan is the phone sheet — check each against what the phone sheet actually renders before deleting. Keep a deletion list in the commit message.

- [ ] **Step 4: Grep-proof + visual sweep + commit**

```bash
grep -c "progressive" src/lib/features/browse/gallery-home/GalleryDrill.svelte
```
Expected: 0. Full `npm run check` (0 errors), 7-viewport sweep of chooser + 2 value screens.

```bash
git add src/lib/features/browse/gallery-home/GalleryDrill.svelte src/lib/features/browse/shared/services/gallery-view-persister.ts
git commit -m "refactor(gallery-drill): delete progressive-secondary-choices fork and dead page-mode CSS" -- src/lib/features/browse/gallery-home/GalleryDrill.svelte src/lib/features/browse/shared/services/gallery-view-persister.ts
```

---

### Task 5: GalleryFilterSheet — desktop retires, phone stays (for now)

**Files:**
- Modify: `src/lib/features/browse/shared/components/GalleryTab.svelte:99`
- Modify: `src/lib/features/browse/collections/components/AllLibraryView.svelte:214`
- Read first: `src/lib/features/browse/gallery-home/GalleryFilterSheet.svelte`

- [ ] **Step 1: Desktop path routes to the workspace instead of the sheet**

In `GalleryTab.svelte`, the Filters pill currently opens `GalleryFilterSheet` on all form factors. Change the pill's handler: on `!isMobile`, call the host's new `onOpenWorkspace` callback (BrowseModule passes `() => (galleryView = "start-here")` — the workspace with the strip IS the edit surface); on mobile keep `isFilterSheetOpen = true`. Wrap the `<GalleryFilterSheet>` mount in `{#if isMobile}`:

```svelte
{#if isMobile}
  <GalleryFilterSheet {engine} bind:isOpen={isFilterSheetOpen} {isMobile} />
{/if}
```

Same treatment in `AllLibraryView.svelte`. The phone sheet's final fate is settled BY FEEL on a real phone during verification (spec decision 3) — leave a `TODO(phone-sheet-feel)` marker comment at both mounts.

- [ ] **Step 2: Verify + commit**

`npm run check:fast`; DevTools at 2112×1188: Filters pill from the grid lands in the workspace with the current rule editable in the strip. At 412×734: pill still opens the bottom sheet.

```bash
git add src/lib/features/browse/shared/components/GalleryTab.svelte src/lib/features/browse/collections/components/AllLibraryView.svelte
git commit -m "feat(gallery): desktop Filters pill routes to the workspace; sheet stays phone-only" -- src/lib/features/browse/shared/components/GalleryTab.svelte src/lib/features/browse/collections/components/AllLibraryView.svelte
```

---

### Task 6: AddSequencesSheet inherits the shared path

**Files:**
- Modify: `src/lib/features/browse/collections/components/AddSequencesSheet.svelte` (drill/sheet usage ~line 190)

- [ ] **Step 1: Convert its GalleryFilterSheet usage the same way as Task 5**

It already passes `allowSearch={false}`-style builder props through the sheet. Keep the sheet on mobile; on desktop route its Filters affordance to an inline drill panel with the same flag set as Task 2 (`unifiedFilterChooser adaptiveValueLayout persistentDesktopCatalog`), plus `FilterRuleStrip` above its results. Its selection chrome (checkbox-free select-on-tap cells) sits over the workspace unchanged — that is the surface's own verification item.

- [ ] **Step 2: Selection walk + commit**

DevTools: open a collection → Add sequences → filter by a level + a LOOP → select 3 sequences → confirm added. Screenshot at 2112×1188 and 412×734.

```bash
git add src/lib/features/browse/collections/components/AddSequencesSheet.svelte
git commit -m "feat(collections): AddSequencesSheet adopts the unified filter workspace" -- src/lib/features/browse/collections/components/AddSequencesSheet.svelte
```

---

### Task 7: Flag collapse + final verification

- [ ] **Step 1: Collapse the flag surface**

If after Tasks 4–6 every mounted host passes the same three builder flags (check: `grep -rn "unifiedFilterChooser\|adaptiveValueLayout\|persistentDesktopCatalog" src --include="*.svelte" | grep -v GalleryDrill.svelte`), make them the drill's defaults (`= true`) or remove the props entirely and unscope the CSS. The phone sheet is the likely holdout — if it still mounts flagless, KEEP the flags and record that in the plan ledger; do not force it.

- [ ] **Step 2: Whole-project verification**

- `npx vitest run tests/unit/browse tests/unit/browse-engine-solo-load-race.test.ts` — same failure set as the pre-existing baseline, nothing new.
- Full `npm run check` — 0 errors.
- Production interaction walk: gallery → workspace → stack Level 2 + two LOOPs on Match any → View results → strip → Save → name → confirm the Smart Collection appears in the library rail. This is the spec's "real save from the gallery rule strip".
- Ten-viewport sweep of: chooser, level, length, loop (with connective control), grid-with-strip.

- [ ] **Step 3: Ledger + handoff**

Mark this plan's checkboxes, update `docs/superpowers/specs/2026-08-04-unified-filter-workspace-handoff.md`'s successor (write a fresh handoff via the `handoff` skill if scope remains: phone-sheet feel test, BrowsePanel sparse-results fast-follow, file split fast-follow).

---

## Ledger

- [x] Stage 1 — connective work (`a0c9b8376a`)
- [x] Task 1 — migration test (`48f95de304`)
- [x] Task 2 — BrowseModule workspace conversion (`ca5f763618`)
- [x] Task 3 — noise floors removed (`b842e34efc`)
- [x] Task 4 — progressive-secondary-choices fork + More hub deleted, ~600
      lines of CSS (`c2165ac19e`). The adaptive/unified/persistent-catalog
      CSS stays scoped: the phone GalleryFilterSheet still mounts flagless.
- [x] Task 5 — desktop Filters pill → workspace; sheet phone-only
      (`4c36bccc5b`). AllLibraryView keeps its sheet (no workspace surface).
- [x] Task 6 — AddSequencesSheet conversion (`bcb10e9430`). Selection tap
      itself not exercised (writes real data); code path unchanged.
- [x] Task 7 — verification: browse suite = pre-existing baseline failures
      only (68 pass); full `npm run check` 0 errors 0 warnings; workspace
      verified at 2112/2816/4224/1584/902/1056/412 (×1.1); production save
      walk landed — Smart Collection "Level 2" created from the gallery
      strip (toast captured).
- [~] Flag collapse deferred: flags stay while the phone sheet mounts the
      drill flagless (phone-sheet fate = feel test, spec decision 3).
