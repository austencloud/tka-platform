# Fuse Tab: Hand Path / Solo Prop Renderer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Fuse tab's ChoreoCard rendering so solo prop paths hide dual-prop metadata (word, letters, difficulty, LOOP) and hand path mode renders simplified trajectory visualization.

**Architecture:** ChoreoCard already accepts `browseViewMode` and `handPathMode` props. The renderer (`PreviewCellRenderer`) already strips one color's motions via `filterSoloMotions()` and swaps prop types to HAND when `handPathMode` is true. The work is: (1) hide irrelevant header/label UI in ChoreoCard when in solo mode, (2) replace step number labels with location labels, (3) verify the renderer handles single-color data correctly.

**Tech Stack:** Svelte 5, TypeScript, PreviewCellRenderer (off-thread via WorkerRenderPool), PictographPreparer

---

### Task 1: Hide Dual-Prop Metadata in Solo Mode Header

ChoreoCard shows the sequence word, difficulty badge, and LOOP glyph in the header. These are meaningless for single-prop rendering. When `browseViewMode?.granularity === "solo"`, suppress them.

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`

- [ ] **Step 1: Read the header rendering section**

Read ChoreoCard.svelte lines 1660-1720 to understand the header template. The header contains:
- Difficulty badge (line 1678-1694)
- Word title (line 1696-1704)
- LOOP glyph (line 1706-1719)

All wrapped in `{#if showHeader}` at line 1672.

- [ ] **Step 2: Add isSoloMode derived**

After line 151 (`browseViewMode,`), add a derived that checks for solo mode:

```typescript
// Solo mode: hide dual-prop metadata (word, letters, difficulty, LOOP)
const isSoloMode = $derived(browseViewMode?.granularity === "solo");
const soloColor = $derived(browseViewMode?.color);
```

- [ ] **Step 3: Modify header visibility**

The `showHeader` derived at line 406 currently shows when word/difficulty/LOOP are enabled. In solo mode, show a simpler header with just the prop color label.

Replace the `showHeader` derived:

```typescript
const showHeader = $derived(
  isSoloMode ||
  showDifficultyLevel || (showLoopGlyph && loopComponents) || (showWord && sequence.word)
);
```

- [ ] **Step 4: Update the header template**

In the header section (around line 1672-1720), wrap the existing content in `{#if !isSoloMode}` and add a solo mode header:

```svelte
{#if showHeader}
  <div
    class="header-section"
    style="height: {scaledHeaderHeight}px;"
    transition:fly|local={{ y: -20, duration: 250, easing: cubicOut }}
  >
    {#if isSoloMode}
      <!-- Solo mode: show color label instead of word/difficulty/LOOP -->
      <span
        class="word-title"
        style="font-size: {wordTitleFontSize}px; color: {soloColor === 'blue' ? 'var(--prop-blue, #2196f3)' : 'var(--prop-red, #f44336)'};"
      >
        {soloColor === "blue" ? "Blue" : "Red"} {browseViewMode?.subject === "hands" ? "Hand Path" : "Prop Path"}
      </span>
    {:else}
      {#if showDifficultyLevel}
        <!-- existing difficulty badge -->
      {/if}
      {#if showWord && sequence.word}
        <!-- existing word title -->
      {/if}
      {#if showLoopGlyph && loopComponents}
        <!-- existing LOOP glyph -->
      {/if}
    {/if}
  </div>
{/if}
```

- [ ] **Step 5: Build and verify**

Run: `npm run build`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ChoreoCard.svelte
git commit -m "feat: hide dual-prop metadata in ChoreoCard solo mode header"
```

---

### Task 2: Replace Step Number Labels with Location Labels in Solo Mode

In solo mode, the step number overlay (`cell.label`) shows "1", "2", "3" etc. These should show the hand's end location for that beat (N, S, E, W, NE, etc.) instead, giving spatial context.

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`

- [ ] **Step 1: Understand cell label assignment**

Cell labels are set at line 890: `label: String(i + 1)`. The label is used in the step-number-overlay at line 1610. In solo mode, we want to show the end location of the kept color's motion instead.

- [ ] **Step 2: Create a helper to extract solo location label**

After the `buildRenderOptions()` function (line ~620), add:

```typescript
/**
 * For solo mode, extract the end location of the kept color's motion
 * for a given step. Falls back to step number if no motion data.
 */
function getSoloLocationLabel(stepIndex: number): string {
  if (!isSoloMode || !sequence.steps) return String(stepIndex + 1);
  const step = sequence.steps[stepIndex];
  if (!step?.motions) return String(stepIndex + 1);
  const motion = soloColor === "blue" ? step.motions.blue : step.motions.red;
  if (!motion?.endLocation) return String(stepIndex + 1);
  // Capitalize location abbreviation: "n" → "N", "ne" → "NE"
  return motion.endLocation.toUpperCase();
}
```

- [ ] **Step 3: Update cell label in renderAllCells**

At line 890 where step placeholders are created:
```typescript
index: i, label: String(i + 1),
```

Change to:
```typescript
index: i, label: isSoloMode ? getSoloLocationLabel(i) : String(i + 1),
```

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ChoreoCard.svelte
git commit -m "feat: show location labels instead of step numbers in solo mode"
```

---

### Task 3: Fix Arrow Rendering for Solo Props (Known Bug)

The spec documents that arrow rotations are incorrect when one color is stripped via `filterSoloMotions()`. The renderer expects paired motion context — when one color is deleted, the remaining color's arrows may render with wrong rotation. This is a confirmed rendering bug, not a speculative issue.

**Files:**
- Read: `src/lib/shared/sequence-viewer/services/implementations/PreviewCellRenderer.ts`
- Read: `src/lib/shared/pictograph/shared/services/implementations/PictographPreparer.ts`
- Read: `src/lib/shared/render/services/implementations/WorkerRenderPool.ts` (or its worker)
- Read: Arrow rotation calculation code in `src/lib/shared/render/` or `src/lib/shared/pictograph/`

- [ ] **Step 1: Trace the rendering pipeline for solo mode**

In `PreviewCellRenderer.renderCell()` (line 42-124):
1. Line 78-80: `filterSoloMotions()` deletes `motions.red` or `motions.blue`
2. Line 83: `pictographPreparer.prepareSingle(dataForRender, ...)` processes the filtered data
3. Line 110: `pool.render(prepared, ...)` renders via worker

Read `PictographPreparer.prepareSingle()` to understand how it handles missing motion data. The arrow rotation calculation is the known failure point — find where it references paired motion data.

- [ ] **Step 2: Search for paired motion dependencies in arrow rotation**

Search the render pipeline for code that accesses both blue and red motions together, especially in arrow rotation/angle calculation:

```bash
grep -rn "motions\.blue.*motions\.red\|motions\.red.*motions\.blue" src/lib/shared/render/ src/lib/shared/pictograph/
grep -rn "rotation\|angle\|arrow.*orient" src/lib/shared/render/ src/lib/shared/pictograph/
```

Find the specific code that calculates arrow rotation and check if it assumes both colors exist.

- [ ] **Step 3: Fix paired motion dependencies**

For each location where both motions are accessed (especially arrow rotation):
- Add null guards for the missing color
- When one color is absent, the remaining color should render its arrow based only on its own motion data (startLocation → endLocation, orientation)
- Do NOT try to infer the missing color's contribution

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add <changed files>
git commit -m "fix: handle single-color motion data in arrow rotation pipeline"
```

---

### Task 4: Verify FuseSequenceBrowser Passes Correct Props

The Fuse tab's shuffle card (`FuseSequenceBrowser.svelte`) already passes `browseViewMode` and `handPathMode` to ChoreoCard. Verify all the right props are set.

**Files:**
- Read: `src/lib/features/fuse/components/FuseSequenceBrowser.svelte`

- [ ] **Step 1: Check FuseSequenceBrowser ChoreoCard props**

At line 135-147, ChoreoCard is rendered with:
```svelte
<ChoreoCard
  sequence={currentItem}
  browseViewMode={viewMode}
  handPathMode={mode === "handPaths"}
  showWord={true}
  showStepNumbers={true}
  showDifficultyLevel={false}
  showCreatorName={false}
  showNotes={false}
  showBirthday={false}
  showLoopGlyph={false}
  darkMode={true}
/>
```

These are already correct:
- `browseViewMode` passes `{ subject: "hands"|"props", granularity: "solo", color: "blue"|"red" }`
- `handPathMode` is true when mode is "handPaths"
- `showDifficultyLevel={false}` and `showLoopGlyph={false}` are already off

But `showWord={true}` should be false in solo mode since we're now handling it in the header with the color label. Change to:

```svelte
showWord={false}
```

Since our Task 1 header now shows "Blue Prop Path" / "Red Hand Path" instead.

- [ ] **Step 2: Also hide the card-info-row word**

At line 158, the info row below the card shows `{currentItem.word || currentItem.name || "—"}`. In solo mode this should show the color label instead:

```svelte
<span class="card-word">
  {mode === "soloProps"
    ? `${propColor === "blue" ? "Blue" : "Red"} Prop`
    : `${propColor === "blue" ? "Blue" : "Red"} Hand`}
</span>
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/fuse/components/FuseSequenceBrowser.svelte
git commit -m "feat: show color/mode label instead of word in fuse shuffle card"
```

---

### Task 5: Fix Refresh Navigation (/create/fuse → /create/construct bounce)

Refreshing on `/create/fuse` redirects to construct. The tab definition exists in `CREATE_TABS` and `TAB_ORDERS`, but `module-state.ts` line 144-160 runs `canAccessTab()` on the active tab during initialization. If PostHog flags aren't loaded yet, this might fail.

**Files:**
- Modify: `src/lib/shared/application/state/ui/module-state.ts:144-160`
- Read: `src/lib/shared/auth/services/PostHogFeatureFlagService.svelte.ts:559-575`

- [ ] **Step 1: Analyze the canAccessTab flow**

At `module-state.ts` line 144-160:
```typescript
if (currentModule === "create") {
  const currentSection = navigationState.activeTab;
  if (currentSection && !featureFlagService.canAccessTab("create", currentSection)) {
    navigationState.setActiveTab("construct");
  }
}
```

`canAccessTab` checks:
1. `canAccessModule("create")` — should pass
2. `tabIdToFeatureId("create", "fuse")` → looks for a feature flag config
3. `getDefaultFeatureConfig(featureId)` → if no config, returns `true` (line 571)

So if "fuse" has no explicit feature flag (it shouldn't), `canAccessTab` should return `true`. The issue might be in `navigation-state.svelte.ts` — check if `activeTab` is actually set to "fuse" before `module-state.ts` runs.

- [ ] **Step 2: Structured diagnosis — confirm the exact failure point**

Add temporary console.log at THREE locations to identify where the redirect happens:

1. `navigation-state.svelte.ts` line 285 (URL parsing):
```typescript
console.log("[NavState] URL parsed tab:", urlTab, "validTab:", validTab?.id);
```

2. `module-state.ts` line 149 (access check):
```typescript
console.log("[module-state] Checking tab:", currentSection, "canAccess:", featureFlagService.canAccessTab("create", currentSection));
```

3. `navigation-state.svelte.ts` inside `setActiveTab` (line 483):
Already has debug logging — check if it shows "fuse" → "construct" transition.

Then refresh on `/create/fuse` and check console output to identify which of these three locations causes the redirect:
- **If URL parsing fails**: "fuse" isn't recognized → falls through to DEFAULT_CREATE_TAB
- **If canAccessTab fails**: PostHog flags not loaded → returns false → redirects
- **If setActiveTab is called externally**: some other code path overrides the tab

- [ ] **Step 3: Fix based on diagnosis**

**If URL parsing fails** (shouldn't, since "fuse" is in CREATE_TABS):
- Check that `urlModuleDefinition.sections` includes the fuse tab at parse time

**If canAccessTab fails** (likely timing — PostHog not loaded):
- `canAccessTab` for unknown tabs returns `true` (line 571), so this shouldn't fail
- If PostHog state isn't initialized yet, `canAccessModule("create")` might return false
- Fix: skip the access check if PostHog hasn't loaded yet, or defer the check

**If external code overrides**:
- Search for other calls to `setActiveTab("construct")` that might fire during init
- `grep -rn 'setActiveTab.*construct' src/`

- [ ] **Step 4: Remove debug logging after diagnosis**

- [ ] **Step 4: Remove debug logging, build and verify**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add <changed files>
git commit -m "fix: prevent /create/fuse refresh from bouncing to construct"
```

---

### Task 6: Verify Animation Preview Single-Prop Rendering

`FuseAnimationPreview.svelte` already passes `propColor` and nulls out one prop in AnimatorCanvas. Verify this works without console warnings.

**Files:**
- Read: `src/lib/features/fuse/components/FuseAnimationPreview.svelte`

- [ ] **Step 1: Confirm AnimatorCanvas prop nulling**

At line 135-136:
```svelte
blueProp={propColor === "red" ? null : bluePropState}
redProp={propColor === "blue" ? null : redPropState}
```

This is correct:
- Left panel (propColor="blue"): shows blueProp, hides redProp
- Right panel (propColor="red"): shows redProp, hides blueProp

- [ ] **Step 2: Check for console warnings during animation**

The previous session noted "skipping beat without motion data" warnings when feeding SoloPropData. Since we now feed full SequenceData (with both colors intact), the AnimatorCanvas should have complete motion data for both props — it just hides one visually. No code changes needed if the animation controller receives full SequenceData.

- [ ] **Step 3: No changes needed (verification only)**

This task is verification. If the animation preview works correctly when a sequence is picked in the shuffle card, no code changes are required.

---

### Task 7: Investigate Hand Path Mode Visual Output

The `handPathMode` flag already exists and swaps props to `PropType.HAND` in PreviewCellRenderer. But we need to verify the visual output matches the spec: colored dot at grid location, direction arrow, no orientation arrows, no turn indicators. The flag may just show HAND props but still render all the motion detail.

**Files:**
- Read: `src/lib/shared/sequence-viewer/services/implementations/PreviewCellRenderer.ts:64-105`
- Read: `src/lib/shared/pictograph/shared/services/implementations/PictographPreparer.ts`
- Read: Arrow/prop rendering code for PropType.HAND

- [ ] **Step 1: Check what PropType.HAND renders**

Search for how `PropType.HAND` is handled in the rendering pipeline. Does it render as a simple dot? Or does it still draw full prop geometry?

```bash
grep -rn "HAND\|hand.*prop" src/lib/shared/render/ src/lib/shared/pictograph/prop/
```

- [ ] **Step 2: Check what handPathMode suppresses**

In PreviewCellRenderer lines 103-105:
```typescript
showTKA: isHandPath ? false : (options.showTKA ?? true),
showReversals: isHandPath ? false : (options.showReversals ?? true),
```

This already suppresses TKA glyphs and reversal indicators. But the spec also wants:
- No orientation arrows (in/out/cw/ccw)
- No turn values

Check if these are also suppressed when `handPathMode` is true. If not, add suppression.

- [ ] **Step 3: Fix if hand path rendering is too detailed**

If `PropType.HAND` still renders orientation/turn data:
- Add `showOrientations: isHandPath ? false : true` to the visibility settings
- Or modify the HAND prop renderer to skip orientation arrows

- [ ] **Step 4: Build and verify**

Run: `npm run build`

- [ ] **Step 5: Commit if changes needed**

```bash
git add <changed files>
git commit -m "feat: simplify hand path mode rendering to show only trajectory"
```

---

### Task 8: Individual LOOP Detection for Hand Paths

Some individual hand paths form LOOPs on their own — visiting all grid points and returning to start. Add detection so we can surface this in the Fuse tab.

**Files:**
- Create: `src/lib/features/fuse/services/implementations/HandPathLoopDetector.ts`
- Create: `src/lib/features/fuse/services/contracts/IHandPathLoopDetector.ts`

- [ ] **Step 1: Define the interface**

A hand path is a solo LOOP if:
- Diamond grid: visits all 4 cardinal locations (N, E, S, W) and returns to start
- Box grid: visits all 4 intercardinal locations (NE, SE, SW, NW) and returns to start

```typescript
// src/lib/features/fuse/services/contracts/IHandPathLoopDetector.ts
export interface IHandPathLoopDetector {
  /** Check if a location sequence forms a LOOP (visits all grid points and returns to start) */
  isLoop(locations: string[], gridMode: "diamond" | "box"): boolean;
}
```

- [ ] **Step 2: Implement the detector**

```typescript
// src/lib/features/fuse/services/implementations/HandPathLoopDetector.ts
import type { IHandPathLoopDetector } from "../contracts/IHandPathLoopDetector";

const DIAMOND_POINTS = new Set(["n", "e", "s", "w"]);
const BOX_POINTS = new Set(["ne", "se", "sw", "nw"]);

export class HandPathLoopDetector implements IHandPathLoopDetector {
  isLoop(locations: string[], gridMode: "diamond" | "box"): boolean {
    if (locations.length < 2) return false;

    // Must return to start
    const start = locations[0]?.toLowerCase();
    const end = locations[locations.length - 1]?.toLowerCase();
    if (start !== end) return false;

    // Must visit all required points
    const requiredPoints = gridMode === "diamond" ? DIAMOND_POINTS : BOX_POINTS;
    const visited = new Set(locations.map(l => l.toLowerCase()));

    for (const point of requiredPoints) {
      if (!visited.has(point)) return false;
    }

    return true;
  }
}
```

- [ ] **Step 3: Register in DI container**

Add to the fuse container (or create one if it doesn't exist).

- [ ] **Step 4: Build and verify**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/fuse/services/contracts/IHandPathLoopDetector.ts src/lib/features/fuse/services/implementations/HandPathLoopDetector.ts
git commit -m "feat: add hand path LOOP detection for individual trajectories"
```

---

### Task 9: End-to-End Visual Verification

After all tasks are complete, verify the full Fuse tab UX visually.

- [ ] **Step 1: Build the project**

Run: `npm run build`
Expected: Clean build, no errors.

- [ ] **Step 2: Verify in browser (ask user)**

Ask the user to check these scenarios:
1. **Solo Prop mode**: Header shows "Blue Prop Path" / "Red Prop Path" instead of sequence word
2. **Solo Prop mode**: Step labels show location (N, S, E, W) instead of numbers
3. **Hand Path mode**: Header shows "Blue Hand Path" / "Red Hand Path"
4. **Hand Path mode**: Rendered cells show HAND prop type (dot) instead of staff/fan
5. **Shuffle card info row**: Shows color/mode label instead of source word
6. **Animation preview**: Shows only one prop when selected
7. **Refresh on /create/fuse**: Stays on fuse tab (doesn't bounce to construct)

- [ ] **Step 3: Commit any final adjustments**
