# Shared Card Primitives Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the four still-feature-local Generate card primitives (`BaseCard`, `ToggleCard`, `ToggleOption`, `TurnIntensityCard`) plus the `LOOPExpandedOverlay` loop selector into `$lib/shared/components/cards/`, give the three card text surfaces ONE shared type scale so font sizes stop drifting, and make the loop overlay SSR-safe via lazy load — so the Generate panel and the upcoming deck generator consume one card library with identical typography and no `ssr=false` escape hatch.

**Architecture:** The shared-card migration is already 80% done — `StepperCard`, `CardHeader`, `StepperButtonVisual`, and `card-colors` already live under `$lib/shared/` with deprecated re-export barrels left behind in `features/create/generate/`. This plan finishes that pattern for the remaining four components, then collapses the three divergent font-size formulas (`BaseCard` reads `var(--card-text-size)`; `ToggleOption` uses `clamp(11px,7cqi,28px)`; `StepperValue` uses `clamp(36px,12cqh,60px)`) onto one set of container-scoped CSS custom properties that every card consumes. The prototype's `:global !important` typography overrides exist only because `ToggleOption` and `StepperValue` ignore the parent's type-scale vars; once they read the shared vars, the overrides delete at the source.

**Tech Stack:** SvelteKit, Svelte 5 runes, container-query CSS (`cqi`/`cqh`/`vmin` clamps), `import()` dynamic component loading for SSR safety.

---

## Context the engineer needs

**Current locations (verified 2026-05-31):**

Already shared (do NOT move — they are done):
- `$lib/shared/components/stepper-card/StepperCard.svelte` (+ `components/`, `shared/`)
- `$lib/shared/components/stepper-card/shared/CardHeader.svelte`
- `$lib/shared/components/stepper-card/shared/StepperButtonVisual.svelte`
- `$lib/shared/create/domain/card-colors.ts` (the `features/create/generate/shared/domain/card-colors.ts` is already a `@deprecated` barrel re-exporting this)

Still feature-local — THIS PLAN moves them:
- `src/lib/features/create/generate/components/cards/BaseCard.svelte`
- `src/lib/features/create/generate/components/cards/ToggleCard.svelte`
- `src/lib/features/create/generate/components/cards/ToggleOption.svelte`
- `src/lib/features/create/generate/components/cards/TurnIntensityCard.svelte`
- `src/lib/features/create/generate/components/cards/LOOPExpandedOverlay.svelte`

**All consumers of the moved files (only 3 — verified by grep):**
- `src/routes/test/unified-generation/+page.svelte` (the prototype)
- `src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte`
- `src/lib/features/create/generate/components/modals/LOOPDrawer.svelte`

**The deprecated-barrel pattern** (how `StepperCard`/`CardHeader`/`card-colors` were already migrated): the file stays at its old path but its body becomes a thin re-export of the shared module. Existing imports keep working untouched; new code imports from `$lib/shared/`. We use the SAME pattern so we never have to chase down import sites.

**Production type-scale vars** are set on `.card-settings-container` in `CardBasedSettingsContainer.svelte:532-534`:
```css
--card-text-size: clamp(16px, 2.2vmin, 30px);
--card-text-weight: 700;
--card-text-spacing: 0.3px;
```
`BaseCard .card-value` (`BaseCard.svelte:282`) already reads `var(--card-text-size)`. `ToggleOption .option-label` (`ToggleOption.svelte:111`) and `StepperValue .value-number` (`stepper-card/components/StepperValue.svelte:17,31`) do NOT — they hardcode their own clamps. That divergence is the entire typography bug.

**Verification commands** (this codebase):
- Type check: `npm run check > /tmp/check.log 2>&1` then `grep -niE "error" /tmp/check.log` (cold, ~2-3 min — run ONCE per task max, per fast-iteration-loop rule)
- Build: `npm run build:fast`
- Prototype renders: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/test/unified-generation` (dev server already on :5173 — the user's, never restart it)
- Generate panel route for visual check: the Create module's Generate tab

---

### Task 1: Move BaseCard to shared, leave deprecated barrel

`BaseCard` deps: `ripple-effect` + `get-haptic-feedback` (both already `$lib/shared/application/...`), and `./shared/CardHeader.svelte` (already shared — repoint to `$lib/shared/components/stepper-card/shared/CardHeader.svelte`).

**Files:**
- Create: `src/lib/shared/components/cards/BaseCard.svelte` (the real component)
- Modify: `src/lib/features/create/generate/components/cards/BaseCard.svelte` (becomes barrel)

- [ ] **Step 1: Copy BaseCard to shared, repoint its CardHeader import**

Copy the full current contents of `src/lib/features/create/generate/components/cards/BaseCard.svelte` to `src/lib/shared/components/cards/BaseCard.svelte`. Change line 10:
```svelte
import CardHeader from "./shared/CardHeader.svelte";
```
to:
```svelte
import CardHeader from "$lib/shared/components/stepper-card/shared/CardHeader.svelte";
```
Leave everything else (props, `.card-value` reading `var(--card-text-size)`, ripple/haptic imports which are already `$lib/shared/...`) unchanged.

- [ ] **Step 2: Replace the feature file with a barrel**

Overwrite `src/lib/features/create/generate/components/cards/BaseCard.svelte` with:
```svelte
<!--
BaseCard.svelte — Re-exports from shared for backwards compatibility.
@deprecated Import from $lib/shared/components/cards/BaseCard.svelte instead.
-->
<script lang="ts">
  import SharedBaseCard from "$lib/shared/components/cards/BaseCard.svelte";
  let props = $props();
</script>

<SharedBaseCard {...props}>
  {#snippet children()}{@render props.children?.()}{/snippet}
</SharedBaseCard>
```
Note: if the live `BaseCard.svelte` does not accept a `children` snippet, drop the `{#snippet children}` line and use `<SharedBaseCard {...props} />`. Confirm against the real props block at the top of the original file before writing.

- [ ] **Step 3: Type check**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log`
Expected: no errors referencing `BaseCard`.

- [ ] **Step 4: Verify both consumers still resolve**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/test/unified-generation`
Expected: `200`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/components/cards/BaseCard.svelte src/lib/features/create/generate/components/cards/BaseCard.svelte
git commit -m "refactor(cards): extract BaseCard to shared, leave deprecated barrel" -- src/lib/shared/components/cards/BaseCard.svelte src/lib/features/create/generate/components/cards/BaseCard.svelte
```

---

### Task 2: Move ToggleOption + ToggleCard to shared, leave barrels

`ToggleCard` deps: `createToggleCardState` (`../../state/toggle-card-state.svelte`), `CardHeader` (shared), `ToggleOption` (sibling — moves with it). `ToggleOption` is leaf (no cross-feature deps).

**Files:**
- Create: `src/lib/shared/components/cards/ToggleOption.svelte`
- Create: `src/lib/shared/components/cards/ToggleCard.svelte`
- Modify: both feature files → barrels

- [ ] **Step 1: Copy ToggleOption to shared (leaf, no import changes)**

Copy full contents of `src/lib/features/create/generate/components/cards/ToggleOption.svelte` to `src/lib/shared/components/cards/ToggleOption.svelte` verbatim.

- [ ] **Step 2: Copy ToggleCard to shared, repoint imports**

Copy `src/lib/features/create/generate/components/cards/ToggleCard.svelte` to `src/lib/shared/components/cards/ToggleCard.svelte`. Repoint its three relative imports:
```svelte
import { createToggleCardState } from "$lib/features/create/generate/state/toggle-card-state.svelte";
import CardHeader from "$lib/shared/components/stepper-card/shared/CardHeader.svelte";
import ToggleOption from "./ToggleOption.svelte";
```
(`toggle-card-state` stays in the generate feature for now — it is generate-internal state logic, not a primitive; the shared card imports it by absolute path. If a later phase shows the deck needs its own toggle state, extract it then, not now — YAGNI.)

- [ ] **Step 3: Replace both feature files with barrels**

`src/lib/features/create/generate/components/cards/ToggleOption.svelte`:
```svelte
<!-- @deprecated Import from $lib/shared/components/cards/ToggleOption.svelte -->
<script lang="ts">
  import Shared from "$lib/shared/components/cards/ToggleOption.svelte";
  let props = $props();
</script>
<Shared {...props} />
```
`src/lib/features/create/generate/components/cards/ToggleCard.svelte`:
```svelte
<!-- @deprecated Import from $lib/shared/components/cards/ToggleCard.svelte -->
<script lang="ts">
  import Shared from "$lib/shared/components/cards/ToggleCard.svelte";
  let props = $props();
</script>
<Shared {...props} />
```

- [ ] **Step 4: Type check**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log`
Expected: no errors referencing `ToggleCard`/`ToggleOption`.

- [ ] **Step 5: Prototype renders**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/test/unified-generation`
Expected: `200`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/components/cards/ToggleOption.svelte src/lib/shared/components/cards/ToggleCard.svelte src/lib/features/create/generate/components/cards/ToggleOption.svelte src/lib/features/create/generate/components/cards/ToggleCard.svelte
git commit -m "refactor(cards): extract ToggleCard + ToggleOption to shared, leave barrels" -- src/lib/shared/components/cards/ToggleOption.svelte src/lib/shared/components/cards/ToggleCard.svelte src/lib/features/create/generate/components/cards/ToggleOption.svelte src/lib/features/create/generate/components/cards/ToggleCard.svelte
```

---

### Task 3: Move TurnIntensityCard to shared, leave barrel

`TurnIntensityCard` deps: `BackgroundType` (`@austencloud/backgrounds`), `settingsService` (`$lib/shared/settings/...`), `isBrightBackground` (`../../shared/domain/card-colors` → already shared), `t` (i18n), `StepperCard` (shared). All app-global or already shared.

**Files:**
- Create: `src/lib/shared/components/cards/TurnIntensityCard.svelte`
- Modify: feature file → barrel

- [ ] **Step 1: Copy to shared, repoint imports**

Copy `src/lib/features/create/generate/components/cards/TurnIntensityCard.svelte` to `src/lib/shared/components/cards/TurnIntensityCard.svelte`. Repoint:
```svelte
import { isBrightBackground } from "$lib/shared/create/domain/card-colors";
import StepperCard from "$lib/shared/components/stepper-card/StepperCard.svelte";
```
Leave `BackgroundType`, `settingsService`, `t` imports as-is (already absolute/package).

- [ ] **Step 2: Replace feature file with barrel**

```svelte
<!-- @deprecated Import from $lib/shared/components/cards/TurnIntensityCard.svelte -->
<script lang="ts">
  import Shared from "$lib/shared/components/cards/TurnIntensityCard.svelte";
  let props = $props();
</script>
<Shared {...props} />
```

- [ ] **Step 3: Type check + render**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log` (expect no `TurnIntensity` errors), then `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/test/unified-generation` (expect `200`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/components/cards/TurnIntensityCard.svelte src/lib/features/create/generate/components/cards/TurnIntensityCard.svelte
git commit -m "refactor(cards): extract TurnIntensityCard to shared, leave barrel" -- src/lib/shared/components/cards/TurnIntensityCard.svelte src/lib/features/create/generate/components/cards/TurnIntensityCard.svelte
```

---

### Task 4: Move LOOPExpandedOverlay to shared and make it SSR-safe via lazy load

The overlay transitively imports `@tka/sequence-engine/loop`, which is not SSR-safe — that is why the prototype needs `ssr = false`. Moving it does not fix SSR; lazy-loading it at the call site does. After this task the prototype can drop `ssr = false`.

**Files:**
- Create: `src/lib/shared/components/cards/LOOPExpandedOverlay.svelte`
- Modify: feature file → barrel
- Modify: `src/routes/test/unified-generation/+page.svelte` (lazy import) and `src/routes/test/unified-generation/+page.ts` (drop `ssr=false`)

- [ ] **Step 1: Copy overlay to shared, repoint any relative imports to absolute**

Copy `src/lib/features/create/generate/components/cards/LOOPExpandedOverlay.svelte` to `src/lib/shared/components/cards/LOOPExpandedOverlay.svelte`. For each relative import in its `<script>`, convert to the equivalent `$lib/...` absolute path (read the originals; do not guess paths). Keep the `@tka/sequence-engine/loop` import as-is — it will be guarded by lazy loading at the call site, not here.

- [ ] **Step 2: Replace feature file with barrel**

```svelte
<!-- @deprecated Import from $lib/shared/components/cards/LOOPExpandedOverlay.svelte -->
<script lang="ts">
  import Shared from "$lib/shared/components/cards/LOOPExpandedOverlay.svelte";
  let props = $props();
</script>
<Shared {...props} />
```

- [ ] **Step 3: Lazy-load the overlay in the prototype**

In `src/routes/test/unified-generation/+page.svelte`, remove the static top-of-file import of `LOOPExpandedOverlay`. Replace with a client-only dynamic load gated on `showLoop`:
```svelte
<script lang="ts">
  import { onMount } from "svelte";
  // ...existing imports (without LOOPExpandedOverlay)...
  let LoopOverlay = $state<any>(null);
  $effect(() => {
    if (showLoop && !LoopOverlay) {
      import("$lib/shared/components/cards/LOOPExpandedOverlay.svelte")
        .then((m) => (LoopOverlay = m.default));
    }
  });
</script>
```
At the overlay's render site, guard on the loaded component:
```svelte
{#if showLoop && LoopOverlay}
  <LoopOverlay
    currentType={loopType}
    selectedComponents={loopComponents}
    onChange={/* existing handler */}
    onClose={() => (showLoop = false)}
    onLoopDisable={/* existing handler */}
  />
{/if}
```
Preserve the existing handler bodies — only the import mechanism changes.

- [ ] **Step 4: Drop the SSR escape hatch**

Delete the body of `src/routes/test/unified-generation/+page.ts` so it no longer forces `ssr = false`. If the route needs no other load config, delete the file entirely. (The dynamic `import()` only runs in the browser, so SSR of the page shell is now safe.)

- [ ] **Step 5: Verify SSR no longer 500s and the overlay still opens**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/test/unified-generation`
Expected: `200` (this now exercises the SSR path, which previously 500'd without `ssr=false`).
Then ask the user (or, with permission, use Chrome DevTools MCP) to open the route, tap the Loop card, confirm the component selector overlay appears. Record evidence per verification-protocol — do not claim the overlay works without it.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/components/cards/LOOPExpandedOverlay.svelte src/lib/features/create/generate/components/cards/LOOPExpandedOverlay.svelte src/routes/test/unified-generation/+page.svelte
git rm src/routes/test/unified-generation/+page.ts  # only if deleted in Step 4
git commit -m "refactor(cards): extract LOOPExpandedOverlay to shared + lazy-load for SSR safety" -- src/lib/shared/components/cards/LOOPExpandedOverlay.svelte src/lib/features/create/generate/components/cards/LOOPExpandedOverlay.svelte src/routes/test/unified-generation/+page.svelte src/routes/test/unified-generation/+page.ts
```

---

### Task 5: Unify the type scale — three card text surfaces read shared vars

Define the card type scale once, on the shared grid surface, and make `ToggleOption` and `StepperValue` consume it (they currently hardcode divergent clamps). `BaseCard .card-value` already reads `var(--card-text-size)`, so it needs no change beyond confirming the var name.

The shared vars (single source of truth — keep names identical to what `CardBasedSettingsContainer` already sets so production is unaffected):
```css
--card-text-size      /* the big value number / base card value */
--card-option-size    /* toggle option label */
--card-title-size     /* header — already wired via --header-font-size */
```

**Files:**
- Modify: `src/lib/shared/components/cards/ToggleOption.svelte` (option-label font)
- Modify: `src/lib/shared/components/stepper-card/components/StepperValue.svelte` (value-number font, portrait)
- Modify: `src/lib/shared/components/stepper-card/components/LandscapeStepperValue.svelte` (value-number font, landscape)
- Modify: `src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte` (add `--card-option-size` next to the existing vars so production keeps its current sizes)

- [ ] **Step 1: Add the option-size var to production container (no visual change to generate)**

In `CardBasedSettingsContainer.svelte`, in the `.card-settings-container` rule near line 532, add a var equal to the toggle option's CURRENT effective size so the Generate panel renders identically:
```css
--card-text-size: clamp(16px, 2.2vmin, 30px);
--card-text-weight: 700;
--card-text-spacing: 0.3px;
--card-option-size: clamp(11px, 7cqi, 28px); /* was hardcoded in ToggleOption */
```

- [ ] **Step 2: Make ToggleOption consume the var, with its old clamp as fallback**

In `src/lib/shared/components/cards/ToggleOption.svelte`, change `.option-label` (line ~111) from:
```css
font-size: clamp(11px, 7cqi, 28px);
```
to:
```css
font-size: var(--card-option-size, clamp(11px, 7cqi, 28px));
```
The fallback preserves behavior for any consumer that has not set the var.

- [ ] **Step 3: Make StepperValue consume the var, with its old clamp as fallback**

In `src/lib/shared/components/stepper-card/components/StepperValue.svelte`, change `.value-number`:
```css
font-size: var(--card-text-size, clamp(36px, 12cqh, 60px));
```
(Apply to both the base rule at line 17 and the container-query override at line 31 — each gets `var(--card-text-size, <its-original-clamp>)`.)
In `LandscapeStepperValue.svelte`, do the same with that file's original clamps as the fallbacks (`clamp(18px,5cqh,28px)` base, `clamp(32px,8cqh,48px)` override).

- [ ] **Step 4: Type check + build**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log` (expect none), then `npm run build:fast` (expect success).

- [ ] **Step 5: Confirm Generate panel is visually unchanged**

Generate panel sets all the vars, so cards must look identical to before. Ask the user to open the Create → Generate tab and confirm the card text sizes are unchanged, OR capture a before/after with Chrome DevTools MCP (with permission). Record evidence — this is the regression-risk step.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/components/cards/ToggleOption.svelte src/lib/shared/components/stepper-card/components/StepperValue.svelte src/lib/shared/components/stepper-card/components/LandscapeStepperValue.svelte src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte
git commit -m "refactor(cards): unify type scale on shared CSS vars (text/option/title)" -- src/lib/shared/components/cards/ToggleOption.svelte src/lib/shared/components/stepper-card/components/StepperValue.svelte src/lib/shared/components/stepper-card/components/LandscapeStepperValue.svelte src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte
```

---

### Task 6: Point the prototype at shared cards, set the type-scale vars, delete the `!important` overrides

Now the prototype gets identical typography by setting the same three vars on its `.card-grid` — no per-class `!important` hacks.

**Files:**
- Modify: `src/routes/test/unified-generation/+page.svelte`

- [ ] **Step 1: Repoint card imports to shared**

Change the prototype's card imports from `$lib/features/create/generate/components/cards/...` to `$lib/shared/components/cards/...` for `BaseCard`, `ToggleCard`, `TurnIntensityCard` (the loop overlay is already lazy-loaded from shared per Task 4). `StepperCard`/`card-colors` imports were already pointing at shared — leave them.

- [ ] **Step 2: Set the type-scale vars on `.card-grid`, delete the overrides**

In the prototype `<style>`, add to the `.card-grid` rule:
```css
.card-grid {
  /* ...existing grid props... */
  --card-text-size: 24px;
  --card-option-size: 17px;
  --header-font-size: 11px;
  --card-text-weight: 700;
  --card-text-spacing: 0.3px;
}
```
Then DELETE the entire `:global` override block (the `.value-number`/`.card-value`/`.option-label`/`.card-title` `!important` rules). Those values now flow through the vars above.

- [ ] **Step 3: Build + render**

Run: `npm run build:fast` (expect success), then `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/test/unified-generation` (expect `200`).

- [ ] **Step 4: Confirm typography is uniform WITHOUT the overrides**

Ask the user to reload the prototype and confirm the Smooth/Diamond/Radial/value text are all consistent size, OR screenshot via Chrome DevTools MCP (with permission). This is the proof the user asked for — that the proper fix replaced the band-aid. Record evidence.

- [ ] **Step 5: Commit**

```bash
git add src/routes/test/unified-generation/+page.svelte
git commit -m "feat(prototype): consume shared cards + type-scale vars, drop !important overrides" -- src/routes/test/unified-generation/+page.svelte
```

---

### Task 7: Full regression gate

- [ ] **Step 1: One full check**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log`
Expected: zero errors. (Full pass catches cross-file breakage the per-task renders miss — required after a cross-cutting move per fast-iteration-loop.)

- [ ] **Step 2: Full build**

Run: `npm run build:fast`
Expected: success.

- [ ] **Step 3: Verify all three consumers of the moved cards still render**

- Prototype: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/test/unified-generation` → `200`
- Generate panel (CardBasedSettingsContainer): user opens Create → Generate, confirms cards render + sizes unchanged.
- LOOPDrawer (the modal consumer): user opens the loop drawer in Generate, confirms it renders.
Record evidence for each. Do not claim done without it.

---

## Self-review notes

- **Spec coverage:** This plan implements Phase 1 of `docs/superpowers/specs/active/2026-05-31-unified-generation-vocabulary-design.md` — "shared axis-control surface." It extracts the card primitives and unifies typography; it does NOT yet build the deck generator (Phase 2) or migrate sequence-actions (Phase 4). Scope is intentionally just the shared-surface extraction so the deck can consume it next.
- **No new components created** — every file is a move + barrel or a CSS-var refactor. Nothing hand-rolled (never-hand-roll satisfied: the cards already exist; we relocate them).
- **No checkboxes / no layout shift / clickable-links** rules untouched by this plan (pure relocation + font-var work).
- **Risk:** the only regression surface is Task 5 (production type scale) — mitigated by keeping var NAMES identical to what production already sets and giving every refactored rule its original clamp as the `var()` fallback. Generate panel must look pixel-identical; Task 5 Step 5 + Task 7 Step 3 gate that.
- **Barrels left in place** means CardBasedSettingsContainer and LOOPDrawer need NO import changes — they keep importing the old paths, which now re-export shared. Only the prototype repoints (Task 6) since it is ours and we want it off the deprecated paths.
