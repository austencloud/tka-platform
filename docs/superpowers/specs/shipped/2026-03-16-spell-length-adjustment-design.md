# Spell Mode Length Adjustment + Bridge Visibility

**Date:** 2026-03-16
**Status:** Approved

## Problem

When a user types a word in spell mode, the LengthCard locks and shows the computed total length (original letters + required bridges + LOOP multiplication). The user has no way to:

1. See how many bridge letters were inserted
2. Elongate the sequence beyond the natural length (e.g., 18 → 20 to hit a rounder number)

## Design

### LengthCard Unlocked in Spell Mode

The LengthCard becomes interactive in spell mode with constrained bounds:

- **Floor** = natural expanded length (original letters + required bridges, with LOOP multiplication if enabled)
- **Ceiling** = 64 (same max as freeform)
- **Step** = 2 when LOOP is on, 1 when off (existing logic, unchanged)
- **Title** = "Length" (same label regardless of mode)
- **Subtitle** = "+N bridges" shown below the number, where N = total bridge count (required + extra)

The stepper down button disables at the floor. Up button disables at 64.

### Bridge Info State

A `bridgeInfo` object is computed alongside the existing `computedWordLength` in `CardBasedSettingsContainer.svelte`:

```typescript
interface BridgeInfo {
  requiredBridges: number;   // bridges needed for valid transitions
  extraBridges: number;      // user-added bridges from length adjustment
  totalBridges: number;      // required + extra
  naturalLength: number;     // original letters + required bridges (pre-LOOP)
}
```

This is derived from:
- The existing `computeWordLength` logic (already counts bridges)
- The user's `spellTargetLength` config value vs. the natural length

### Extra Bridge Insertion

When the user increases length beyond the natural expanded length, extra bridge letters are appended at the **end** of the expanded letter sequence, before LOOP extension.

For each extra bridge:
1. Take the current last letter in the expanded sequence
2. Find valid bridge options from that letter using the transition graph
3. Pick one (respecting the user's dash preference from constraint config)
4. Append it to the expanded letters array
5. Track it in `letterSources` as `isOriginal: false`

This happens in `onSpellGenerate` between word parsing and sequence generation.

### Config Persistence

Add `spellTargetLength: number | null` to `UIGenerationConfig`:
- `null` = use natural length (default)
- Any number = user's desired total length

Reset to `null` when:
- User clears the word input
- User types a different word (natural length changes, target may no longer be valid)

Persisted to localStorage with the rest of the generation config.

### LOOP Interaction

When LOOP is enabled:
- The natural length already includes LOOP multiplication (existing logic in `computeWordLength`)
- Extra bridges are added **before** LOOP extension in the generation pipeline
- Length increments by 2 (existing LOOP constraint)
- The floor is the LOOP-multiplied natural length

### Data Flow

```
User types word → computeWordLength() runs
  → bridgeInfo computed (requiredBridges, naturalLength)
  → LengthCard shows total with "+N bridges" subtitle
  → User can bump length up via stepper

User clicks Generate → onSpellGenerate()
  → parseWord() returns natural expanded letters
  → if spellTargetLength > naturalLength:
      → compute extraBridgeCount
      → append extra bridge letters at end
  → pass full letter array to RandomSequenceGenerator
  → apply turns
  → apply LOOP extension (if enabled)
  → done
```

## Files to Modify

1. **`LengthCard.svelte`** — Remove locked wrapper, add subtitle prop for bridge count
2. **`StepperCard.svelte`** — Add optional subtitle display
3. **`CardConfigurator.ts`** — Pass bridge info and new min/max bounds instead of `locked: true`
4. **`CardBasedSettingsContainer.svelte`** — Compute `bridgeInfo`, handle `spellTargetLength` changes, reset on word change
5. **`generate-config.svelte.ts`** — Add `spellTargetLength` to config with null default
6. **`generate-actions.svelte.ts`** — In `onSpellGenerate`, insert extra bridges when target > natural length
7. **`VariationExplorationOrchestrator.ts`** — No changes needed (bridge insertion for extras uses same graph/logic but is done in the generation action)

## Edge Cases

- **Word has no bridges needed** (all letters can follow each other directly): subtitle shows "+0 bridges" or is hidden. User can still add extra bridges.
- **User bumps length, then changes word**: `spellTargetLength` resets to null. New word gets its own natural length.
- **Extra bridge has no valid options**: Stop appending at the last successful bridge. The sequence is shorter than requested but still valid. Show actual length.
- **Single-letter word**: Natural length = 1, no required bridges. User can add bridges (transitions from that letter to random bridge letters).
