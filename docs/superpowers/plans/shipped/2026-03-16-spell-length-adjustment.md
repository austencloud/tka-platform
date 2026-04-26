# Spell Mode Length Adjustment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users see bridge letter counts and adjust sequence length upward in spell mode, adding extra bridge letters at the end.

**Architecture:** Unlock the existing LengthCard in spell mode with constrained bounds (floor = natural expanded length, ceiling = 64). Pass bridge count as subtitle. In the generation pipeline, append extra bridge letters at the end of the expanded sequence before LOOP extension.

**Tech Stack:** Svelte 5, TypeScript, existing StepperCard subtitle infrastructure, transition graph for bridge selection.

**Spec:** `docs/superpowers/specs/2026-03-16-spell-length-adjustment-design.md`

---

## Chunk 1: Config, Bridge Info, and LengthCard

### Task 1: Add `spellTargetLength` to UIGenerationConfig

**Files:**
- Modify: `src/lib/features/create/generate/shared/utils/config-mapper.ts:60-78`
- Modify: `src/lib/features/create/generate/state/generate-config.svelte.ts:24-41` (SerializedConfig)
- Modify: `src/lib/features/create/generate/state/generate-config.svelte.ts:46-69` (saveConfig)
- Modify: `src/lib/features/create/generate/state/generate-config.svelte.ts:95-138` (loadConfig)
- Modify: `src/lib/features/create/generate/state/generate-config.svelte.ts:158-173` (DEFAULT_CONFIG)

- [ ] **Step 1: Add `spellTargetLength` to `UIGenerationConfig` interface**

In `config-mapper.ts`, add to the interface at line 78:

```typescript
// Spell mode length override (null = use natural expanded length)
spellTargetLength: number | null;
```

- [ ] **Step 2: Add to `SerializedConfig`, `saveConfig`, `loadConfig`, and `DEFAULT_CONFIG`**

In `generate-config.svelte.ts`:

Add to `SerializedConfig` (after `durationTemplateId`):
```typescript
spellTargetLength?: number | null;
```

Add to `saveConfig` serialization (after `durationTemplateId` line):
```typescript
spellTargetLength: config.spellTargetLength,
```

Add to `loadConfig` deserialization (after the `durationTemplateId` block):
```typescript
if (data.spellTargetLength !== undefined) {
  result.spellTargetLength = data.spellTargetLength;
}
```

Add to `DEFAULT_CONFIG`:
```typescript
spellTargetLength: null,
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run check`
Expected: No new errors related to `spellTargetLength`

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/create/generate/shared/utils/config-mapper.ts src/lib/features/create/generate/state/generate-config.svelte.ts
git commit -m "feat(generate): add spellTargetLength to generation config"
```

---

### Task 2: Compute bridge info and expose to LengthCard

**Files:**
- Modify: `src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte:105-171` (computeWordLength effect)
- Modify: `src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte:275-295` (handlers passed to CardConfigurator)
- Modify: `src/lib/features/create/generate/shared/services/contracts/ICardConfigurator.ts:50-58` (CardHandlers)
- Modify: `src/lib/features/create/generate/shared/services/implementations/CardConfigurator.ts:54-69` (length card config)

- [ ] **Step 1: Add bridge info state and update `computeWordLength`**

In `CardBasedSettingsContainer.svelte`, add alongside `computedWordLength`:

```typescript
let requiredBridgeCount = $state<number>(0);
let naturalLength = $state<number>(0); // pre-LOOP natural length
```

Update the `computeWordLength` function to also track these values. After the bridge counting loop (around line 148), add:

```typescript
requiredBridgeCount = bridgeCount; // already computed in existing loop
naturalLength = originalLetters.length + bridgeCount; // pre-LOOP
```

These get set alongside `computedWordLength`. When word is cleared, reset both to 0.

- [ ] **Step 2: Add spell length change handler and reset logic**

In `CardBasedSettingsContainer.svelte`, add a handler function:

```typescript
function handleSpellLengthChange(newLength: number) {
  // Store as spellTargetLength in config
  // If newLength equals the computed natural length (with LOOP), clear the override
  if (computedWordLength !== undefined && newLength === computedWordLength) {
    updateConfig({ spellTargetLength: null });
  } else {
    updateConfig({ spellTargetLength: newLength });
  }
}
```

In the `$effect` that watches `wordInputValue` (around line 108-115), add reset logic:

```typescript
// When word changes, reset spell target length since natural length changed
updateConfig({ spellTargetLength: null });
```

- [ ] **Step 3: Pass new data through CardHandlers**

In `ICardConfigurator.ts`, add to `CardHandlers`:

```typescript
// Bridge info for spell mode length card
bridgeInfo?: {
  requiredBridges: number;
  extraBridges: number;
  totalBridges: number;
  naturalLength: number;
};
// Spell mode length change (separate from freeform)
handleSpellLengthChange?: (length: number) => void;
```

In `CardBasedSettingsContainer.svelte`, pass these in the handlers object (around line 275-295):

```typescript
bridgeInfo: wordInputValue?.trim() ? {
  requiredBridges: requiredBridgeCount,
  extraBridges: Math.max(0, (config.spellTargetLength ?? 0) - naturalLength),
  totalBridges: requiredBridgeCount + Math.max(0, (config.spellTargetLength ?? 0) - naturalLength),
  naturalLength,
} : undefined,
handleSpellLengthChange,
```

- [ ] **Step 4: Update CardConfigurator to build unlocked spell LengthCard**

In `CardConfigurator.ts`, replace the length card block (lines 54-69):

```typescript
// Length card — interactive in both modes, with different bounds in spell mode
const hasWord = !!(handlers.wordInputValue?.trim());
const spellTargetLength = config.spellTargetLength;

if (hasWord) {
  // Spell mode: floor is natural expanded length, user can go up
  const naturalDisplayLength = handlers.computedWordLength ?? handlers.wordInputValue!.trim().length;
  const displayLength = spellTargetLength ?? naturalDisplayLength;
  const bridgeInfo = handlers.bridgeInfo;
  const bridgeSubtitle = bridgeInfo && bridgeInfo.totalBridges > 0
    ? `+${bridgeInfo.totalBridges} bridge${bridgeInfo.totalBridges !== 1 ? "s" : ""}`
    : "";

  cardList.push({
    id: "length",
    props: {
      currentLength: displayLength,
      currentMode: config.mode,
      loopEnabled,
      onLengthChange: handlers.handleSpellLengthChange ?? handlers.handleLengthChange,
      locked: false,
      minOverride: naturalDisplayLength,
      subtitle: bridgeSubtitle,
      cardIndex: cardIndex++,
    },
    gridColumnSpan: 2,
  });
} else {
  // Freeform mode: existing behavior
  cardList.push({
    id: "length",
    props: {
      currentLength: config.length,
      currentMode: config.mode,
      loopEnabled,
      onLengthChange: handlers.handleLengthChange,
      locked: false,
      cardIndex: cardIndex++,
    },
    gridColumnSpan: 2,
  });
}
```

- [ ] **Step 5: Update LengthCard to accept `minOverride` and `subtitle`**

In `LengthCard.svelte`, add the new props and remove the locked wrapper:

```typescript
let {
  currentLength,
  currentMode,
  loopEnabled = false,
  locked = false,
  minOverride,
  onLengthChange,
  subtitle = "",
  color = "radial-gradient(ellipse at top left, var(--card-blue, #3b82f6) 0%, var(--card-blue, #3b82f6) 40%, var(--card-blue-end, #1d4ed8) 100%)",
  shadowColor = "220deg 80% 55%",
  gridColumnSpan = 2,
  headerFontSize = "9px",
} = $props<{
  currentLength: number;
  currentMode: GenerationMode;
  loopEnabled?: boolean;
  locked?: boolean;
  /** Override minimum length (used in spell mode where floor = natural word length) */
  minOverride?: number;
  onLengthChange: (length: number) => void;
  subtitle?: string;
  color?: string;
  shadowColor?: string;
  gridColumnSpan?: number;
  headerFontSize?: string;
}>();

const MAX_LENGTH = 64;
const MIN_LENGTH = $derived(minOverride ?? (loopEnabled ? 2 : 1));
const STEP = $derived(loopEnabled ? 2 : 1);
```

Remove the `{#if locked}` / `{:else}` branching. Always render the StepperCard directly, passing `subtitle`:

```svelte
<StepperCard
  title={t("generator_length")}
  currentValue={currentLength}
  minValue={MIN_LENGTH}
  maxValue={MAX_LENGTH}
  onIncrement={handleIncrement}
  onDecrement={handleDecrement}
  {formatValue}
  {subtitle}
  {color}
  {shadowColor}
  {gridColumnSpan}
  {headerFontSize}
/>
```

Remove the `.locked-wrapper` style block entirely.

- [ ] **Step 6: Verify TypeScript compiles and build succeeds**

Run: `npm run check && npm run build`
Expected: Clean compilation

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte src/lib/features/create/generate/shared/services/contracts/ICardConfigurator.ts src/lib/features/create/generate/shared/services/implementations/CardConfigurator.ts src/lib/features/create/generate/components/cards/LengthCard.svelte
git commit -m "feat(generate): unlock LengthCard in spell mode with bridge count subtitle"
```

---

## Chunk 2: Extra Bridge Insertion in Generation Pipeline

### Task 3: Insert extra bridges in `onSpellGenerate`

**Files:**
- Modify: `src/lib/features/create/generate/state/generate-actions.svelte.ts:141-190` (onSpellGenerate, between parseWord and sequence generation)

- [ ] **Step 1: Add extra bridge insertion after word parsing**

In `onSpellGenerate`, after the `parseWord` call and `letterSources` assignment (around line 189), add:

```typescript
// Check if user wants a longer sequence than the natural expanded length
const spellTarget = config?.spellTargetLength;
let finalLetters = letters;
let finalLetterSources = parseResult.letterSources ?? [];

if (spellTarget !== null && spellTarget !== undefined) {
  // Calculate pre-LOOP natural length
  const preLoopNatural = letters.length;

  // For LOOP sequences, the target length includes LOOP multiplication.
  // We need to figure out how many extra bridges to add to the pre-LOOP base.
  // The LOOP multiplier is applied after bridge insertion.
  let extraBridgesNeeded: number;

  if (config?.loopEnabled) {
    // Reverse-engineer pre-LOOP target from the multiplied target
    // computeWordLength applies: (base + 1 bridge) * multiplier = total
    // So pre-LOOP base = (total / multiplier) - 1
    // But we only control base length, not the +1 LOOP bridge
    // Simpler: extra = target - computedWordLength (the natural LOOP total)
    // Each extra beat in the LOOP total = 1 extra pre-LOOP bridge * multiplier
    // So extraBridgesNeeded = (target - naturalLoopTotal) / multiplier
    // For now, just add bridges to hit the pre-LOOP target
    // The LOOP multiplication will be handled by applySpellLoopExtension

    // Actually, the simplest approach: the spellTargetLength IS the final display length.
    // The computedWordLength already factors in LOOP multiplication.
    // Extra bridges = (spellTargetLength - computedWordLength) pre-LOOP bridges,
    // but we need to account for the multiplier.
    // Since LOOP step = 2 in the UI, and halved LOOP doubles, adding 2 to display = 1 pre-LOOP bridge.
    // For quartered (4x), adding 4 to display = 1 pre-LOOP bridge.
    // Let's compute the multiplier:
    const multiplier = getLoopMultiplier(config);
    extraBridgesNeeded = Math.max(0, Math.round((spellTarget - (parseResult.expandedLetters?.length ?? 0) * multiplier) / multiplier));
  } else {
    extraBridgesNeeded = Math.max(0, spellTarget - preLoopNatural);
  }

  if (extraBridgesNeeded > 0) {
    const graph = await (container.items.spellServiceLoader as ISpellServiceLoader).getTransitionGraph();
    const preferDash = config?.motionTypeFilter === "prefer-dash";
    const avoidDash = config?.motionTypeFilter === "no-dash";

    const extendedLetters = [...letters];
    const extendedSources = [...finalLetterSources];

    for (let i = 0; i < extraBridgesNeeded; i++) {
      const lastLetter = extendedLetters[extendedLetters.length - 1];
      if (!lastLetter) break;

      let bridgeOptions = graph.findAllBridgeOptions(lastLetter, lastLetter);
      // If no self-bridges, try finding any valid transition from last letter
      if (bridgeOptions.length === 0) {
        // Get all letters that can follow the last letter
        bridgeOptions = graph.getSuccessors?.(lastLetter) ?? [];
      }
      if (bridgeOptions.length === 0) break; // Can't extend further

      // Apply dash preference
      let bridgeLetter: Letter;
      if (preferDash) {
        const dashOpts = bridgeOptions.filter(b => DASH_LETTERS.has(b));
        const pool = dashOpts.length > 0 ? dashOpts : bridgeOptions;
        bridgeLetter = pool[Math.floor(Math.random() * pool.length)]!;
      } else if (avoidDash) {
        const nonDashOpts = bridgeOptions.filter(b => !DASH_LETTERS.has(b));
        const pool = nonDashOpts.length > 0 ? nonDashOpts : bridgeOptions;
        bridgeLetter = pool[Math.floor(Math.random() * pool.length)]!;
      } else {
        bridgeLetter = bridgeOptions[Math.floor(Math.random() * bridgeOptions.length)]!;
      }

      extendedLetters.push(bridgeLetter);
      extendedSources.push({
        letter: bridgeLetter,
        isOriginal: false,
        stepIndex: extendedLetters.length,
      });
    }

    finalLetters = extendedLetters;
    finalLetterSources = extendedSources;
  }
}
```

Then update the subsequent code to use `finalLetters` and `finalLetterSources` instead of `letters` and `parseResult.letterSources`.

- [ ] **Step 2: Add DASH_LETTERS constant and helper**

At the top of `generate-actions.svelte.ts`, add (or import from VariationExplorationOrchestrator):

```typescript
// Letters with dash motions (Type 3, 4, and 5) — same set as VariationExplorationOrchestrator
const DASH_LETTERS: Set<string> = new Set([
  "W-", "X-", "Y-", "Z-", "Σ-", "Δ-", "Θ-", "Ω-",
  "Φ", "Ψ", "Λ",
  "Φ-", "Ψ-", "Λ-",
]);

function getLoopMultiplier(config: UIGenerationConfig): number {
  if (!config.loopEnabled) return 1;
  const isRotatedType = ROTATED_LOOP_TYPES.has(config.loopType as LOOPType);
  if (isRotatedType) {
    return config.sliceSize === SliceSize.QUARTERED ? 4 : 2;
  }
  return 2; // Non-rotated LOOPs always double
}
```

- [ ] **Step 3: Verify the bridge finding approach works with the transition graph**

The transition graph's `findAllBridgeOptions(from, to)` finds letters that can sit between `from` and `to`. For extra bridges at the end, we need letters that can follow the last letter. Two approaches:

1. `findAllBridgeOptions(lastLetter, lastLetter)` — finds letters that bridge back to the same letter type
2. If the graph has a `getSuccessors` method, use that directly

Check which method the transition graph supports. If `getSuccessors` doesn't exist, use `findAllBridgeOptions` with a dummy target and fall back gracefully. The implementation should handle this — the key is that we pick any valid letter that can follow the last one.

- [ ] **Step 4: Update references from `letters` to `finalLetters`**

In the `generateRandomSequence` call (around line 212), change:
- `letters` → `finalLetters`
- `parseResult.letterSources` → `finalLetterSources`

In the spell metadata (around line 302-315), update `expandedWord` to use `finalLetters`:
```typescript
const finalExpandedWord = finalLetters.map(l => l).join("") || spellState.inputWord;
```

And update `letterSources` in spellData to `finalLetterSources`.

- [ ] **Step 5: Verify TypeScript compiles and build succeeds**

Run: `npm run check && npm run build`
Expected: Clean compilation

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/create/generate/state/generate-actions.svelte.ts
git commit -m "feat(generate): insert extra bridge letters when spell target exceeds natural length"
```

---

## Chunk 3: Edge Cases and Polish

### Task 4: Handle edge cases

**Files:**
- Modify: `src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte`
- Modify: `src/lib/features/create/generate/state/generate-actions.svelte.ts`

- [ ] **Step 1: Reset spellTargetLength when word changes**

Verify the reset logic added in Task 2 Step 2 fires correctly. The `$effect` watching `wordInputValue` should call `updateConfig({ spellTargetLength: null })` before recomputing word length. This ensures:
- Changing the word resets to natural length
- Clearing the word resets the config
- The LengthCard immediately reflects the new natural length

- [ ] **Step 2: Ensure LOOP step size applies to spell length changes**

In `LengthCard.svelte`, the existing `STEP` derived value already handles this:
```typescript
const STEP = $derived(loopEnabled ? 2 : 1);
```

The `handleIncrement` and `handleDecrement` functions use `STEP`. When the user is in spell mode with LOOP enabled, bumping length adds/removes 2 beats at a time. No change needed — verify this works.

- [ ] **Step 3: Handle "no valid bridge found" gracefully**

In the extra bridge insertion loop (Task 3), the loop already breaks if `bridgeOptions.length === 0`. The sequence will be shorter than the requested target. The LengthCard will show the actual generated length after generation completes (since the workbench updates with the real sequence).

No additional error handling needed — the sequence is still valid, just shorter than ideal.

- [ ] **Step 4: Verify full flow end-to-end**

Run: `npm run check && npm run build`
Expected: Clean build

Manual verification steps (for the user):
1. Type a word (e.g., "BOOK") → LengthCard shows natural length with "+N bridges" subtitle
2. Tap + on LengthCard → length increases, bridge count updates
3. Tap - → length decreases back to natural minimum, can't go lower
4. Hit Generate → sequence has the correct number of beats
5. Enable LOOP → length jumps to LOOP-multiplied value, stepper increments by 2
6. Change the word → length resets to new word's natural length
7. Clear the word → back to freeform mode with normal length controls

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(generate): spell length adjustment with bridge visibility - edge cases"
```
