# Preset Card Design

**Date:** 2026-03-20
**Status:** Draft

## Problem

The generate panel's Row 1 has an imbalanced layout: Word (span 4) + Length (span 2). The word card takes double the space of every other card. Users also lack a way to quickly apply saved configurations without manually setting 8+ cards.

## Solution

Add a **Preset card** (span 2) to Row 1, rebalancing it to: Word (2) + Preset (2) + Length (2) = 6. The card opens a drawer for browsing and selecting presets. Selecting a preset fills all cards with that configuration. Tapping any individual card deselects the active preset and returns to freeform editing.

## Design Decisions (from brainstorming)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Selection UI | Drawer (not inline picker) | Room to browse presets from self and others |
| Active preset behavior | Binary: active or not | Selecting locks all cards to preset values |
| Deselection trigger | Tap any other card | Natural "I want to change this" gesture; no separate deselect action needed |
| Card locked appearance | Normal + tappable | Tapping deselects preset and opens card. No dimming or lock icons. |
| Row 1 layout | Word(2) + Preset(2) + Length(2) | All three equal width, balanced row |

## Architecture

### State Changes

#### 1. Extend `GenerationPreset` with StartEndOptions

The existing `GenerationPreset` interface stores `UIGenerationConfig` but not start/end position constraints. The "Austen's Favorite" preset needs Classic 3 start positions.

```typescript
// preset.svelte.ts
export interface GenerationPreset {
  id: string;
  name: string;
  icon?: string;
  config: UIGenerationConfig;
  startEndOptions?: StartEndOptions | null;  // NEW
  author?: string;                           // NEW - for future multi-user presets
  createdAt: number;
  updatedAt: number;
}
```

#### 2. Add `activePresetId` to preset state

Track which preset is currently active. When active, all card changes are blocked until deselection.

```typescript
// In createPresetState():
let activePresetId = $state<string | null>(null);
const activePreset = $derived(
  activePresetId ? presets.find(p => p.id === activePresetId) ?? null : null
);

function activatePreset(id: string): void { ... }
function deactivatePreset(): void { activePresetId = null; }
```

#### 3. Preset activation flow

When a preset is activated:
1. `activePresetId` is set
2. Parent calls `updateConfig(preset.config)` to fill all cards
3. If the preset has `startEndOptions`, those are applied too
4. All cards display the preset's values

When any card is tapped while a preset is active:
1. `deactivatePreset()` is called
2. The card opens normally for editing
3. The preset card shows "None" or empty state

### Component Changes

#### PresetCard (new)

**File:** `src/lib/features/create/generate/components/cards/PresetCard.svelte`

A BaseCard-derived component showing the active preset name or a placeholder.

- **Display when no preset active:** "Presets" with a subtle icon
- **Display when preset active:** Preset name + icon (e.g. "Austen's Fav" with star icon)
- **Click action:** Opens the preset drawer

#### PresetDrawer (new)

**File:** `src/lib/features/create/generate/components/presets/PresetDrawer.svelte`

A bottom drawer listing available presets. Each preset shows:
- Name and icon
- Brief summary of key settings (e.g. "L2 Diamond 16ct LOOP")
- Author name (for future multi-user support)
- Active indicator if currently selected

Tapping a preset activates it and closes the drawer. Tapping the active preset deactivates it.

For now, the drawer is read-only (no create/edit/delete UI). Presets are seeded programmatically.

#### CardConfigurator changes

Update Row 1 layout:

```typescript
// Row 1: Word(2) + Preset(2) + Length(2) = 6
cardList.push({
  id: "word-input",
  props: { ... },
  gridColumnSpan: 2,  // was 4
});

cardList.push({
  id: "preset",
  props: {
    activePreset: handlers.activePreset,
    onOpenPresetDrawer: handlers.handleOpenPresetDrawer,
    cardIndex: cardIndex++,
  },
  gridColumnSpan: 2,
});

// Length card stays at span 2
```

#### CardBasedSettingsContainer changes

- Add PresetCard to the component map
- Add preset drawer rendering (similar to how CustomizeCard opens its overlay)
- Wire card tap interception: when a preset is active and any card is tapped, call `deactivatePreset()` first, then proceed with the card's normal action

### Deselection Mechanism

The cleanest approach: wrap each card's `onClick` handler. In `CardBasedSettingsContainer`, when building handlers for `CardConfigurator`, if `activePresetId` is non-null, each handler first calls `deactivatePreset()` before executing the original handler. This keeps deselection logic centralized rather than scattered across every card.

```typescript
// In CardBasedSettingsContainer, when building handlers:
function wrapWithPresetDeselect<T extends (...args: any[]) => any>(handler: T): T {
  return ((...args: any[]) => {
    if (presetState.activePreset) {
      presetState.deactivatePreset();
    }
    return handler(...args);
  }) as T;
}
```

This means opening the Word input, changing Length, toggling LOOP, etc. all deselect the preset naturally.

### Seed Data: "Austen's Favorite"

Replace the current "Diamond 16" default preset with "Austen's Favorite":

```typescript
{
  id: "austens-favorite",
  name: "Austen's Fav",
  icon: "⭐",
  author: "austen",
  config: {
    mode: GenerationMode.FREEFORM,
    loopEnabled: true,
    length: 16,
    level: 2,
    turnIntensity: 1,
    gridMode: GridMode.DIAMOND,
    propContinuity: PropContinuity.CONTINUOUS,
    sliceSize: SliceSize.QUARTERED,
    loopType: LOOPType.STRICT_ROTATED,
    constraintPreset: "smooth",
    handPathMode: "mixed",
    motionTypeFilter: null,         // "mixed dashes" = no filter
    durationTemplateId: null,
    spellTargetLength: null,
  },
  startEndOptions: {
    blockedStartPositions: getBlockedPositionsForPreset(
      StartPositionPreset.CLASSIC,
      GridMode.DIAMOND
    ),
    startPosition: null,
    endPosition: null,
    mustContainLetters: [],
    mustNotContainLetters: [],
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
}
```

Key config notes:
- **Level 2, turn intensity 1** = whole turns, max 1 turn per beat
- **Diamond mode** with **Classic 3** start positions (alpha1, beta5, gamma11)
- **Props smooth** (`constraintPreset: "smooth"`), **hands mixed** (`handPathMode: "mixed"`), **dashes mixed** (`motionTypeFilter: null`)
- **Rotated quartered LOOP** (`loopType: STRICT_ROTATED`, `sliceSize: QUARTERED`)

### Files to Create

| File | Purpose |
|------|---------|
| `components/cards/PresetCard.svelte` | BaseCard showing active preset or placeholder |
| `components/presets/PresetDrawer.svelte` | Bottom drawer for browsing/selecting presets |

### Files to Modify

| File | Change |
|------|--------|
| `state/preset.svelte.ts` | Add `activePresetId`, `activatePreset()`, `deactivatePreset()`, extend `GenerationPreset` interface, update seed preset |
| `shared/services/implementations/CardConfigurator.ts` | Row 1 rebalance: Word(2) + Preset(2) + Length(2), add preset card descriptor |
| `shared/services/contracts/ICardConfigurator.ts` | Add preset-related fields to `CardHandlers` |
| `components/CardBasedSettingsContainer.svelte` | Add PresetCard to component map, wire drawer, wrap handlers with preset deselect |

### Future Considerations (not in this scope)

- **Multi-user presets:** `author` field is included but no fetch/browse from other users yet
- **Create/edit/delete UI:** Drawer is read-only for now. Users can't create presets from the UI yet.
- **Preset sharing:** Eventually presets could be stored in Firebase and shared publicly
- **Preset search/filter:** When the list grows, add search

## Testing

No earned tests needed. This is UI wiring and state management — if it breaks, you'll see it immediately. The existing `createPresetState()` tests (if any) cover the CRUD operations.

## Summary

One new card, one new drawer, a few state additions, and a handler wrapper for deselection. The existing preset infrastructure does most of the heavy lifting.
