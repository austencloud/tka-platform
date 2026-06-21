# LOOP Info Modal Redesign

## Problem

The LOOP info modal shows a generic paragraph about LOOPs, then "ACTIVE COMPONENTS:" with unlabeled icons. Users don't know what the 6 components are, which ones are active, or what the transformation means for *their* sequence. The Level indicator — which shows all 3 levels as cards with the current one highlighted and a tailored explanation — is the proven pattern. The LOOP modal should match it.

## Design

### Layout (mirrors LevelInfoModal)

```
+-------------------------------------------+
| [infinity] Rotated LOOP              [X]  |
|           "Transformation pattern"        |
+-------------------------------------------+
|                                           |
|  [Rotated]  [Mirrored]  [Flipped]         |
|  (active)   (dimmed)    (dimmed)          |
|                                           |
|  [Swapped]  [Inverted]  [Rewound]         |
|  (dimmed)   (dimmed)    (dimmed)          |
|                                           |
|  8 beats. The word MIST repeats twice     |
|  -- beats 1-4 and 5-8 use the same        |
|  letters. But the positions rotate: the    |
|  grid keeps turning the same direction.    |
|  Play it twice and you're back where you   |
|  started.                                 |
+-------------------------------------------+
```

### Component Card Row

A 3x2 grid (or responsive 6-across on wide screens) of all 6 LOOP components. Follows the same visual logic as `LevelProgressionRow`:

- **Active cards** — full color background tint (using existing `LOOP_COMPONENT_MAP` colors), colored icon, label, and one-line description expanded below the label. Slightly larger/elevated.
- **Inactive cards** — dimmed, grayscale icon, label only (no description). `opacity: 0.5`, `filter: grayscale(1)`.

Each card shows:
- Colored badge with FontAwesome icon (from `LOOP_COMPONENT_MAP`)
- Component label ("Rotated", "Mirrored", etc.)
- Description (active only): one-line from `LOOP_COMPONENT_MAP.description`

### New Component: `LOOPComponentRow.svelte`

Parallel to `LevelProgressionRow.svelte`. Props:

```ts
interface Props {
  activeComponents: Set<LOOPComponent>;
}
```

Renders all 6 components from `LOOP_COMPONENTS` constant. Applies `.current`/`.dim` classes mirroring LevelProgressionRow's pattern.

### New Component: `LOOPInfoModal.svelte`

Parallel to `LevelInfoModal.svelte`. Replaces the inline `<BaseModal>` block in `SequenceDisplay.svelte` (lines 286-315). Props:

```ts
interface Props {
  open: boolean;
  activeComponents: Set<LOOPComponent>;
  loopDisplayName: string;
  sequence: SequenceData;
  period: number;
  onclose: () => void;
}
```

### Structural Explanation Text

The modal body shows a 3-layer explanation generated from the actual sequence data. This replaces the generic "A LOOP means..." paragraph.

**Layer 1 — Structure** (what the user built):
Describes beat count, word, and repetition structure.

**Layer 2 — Transformation** (what changes between passes):
Names the active component(s) and describes what they do in terms of the sequence.

**Layer 3 — Payoff** (the practical result):
How many passes to return home.

#### Single-Component Copy (period 2)

**Rotated:**
> {beatCount} beats. {word} repeats twice — beats 1-{half} and {half+1}-{beatCount} use the same letters. The positions rotate: where the first half places your hands, the second half continues around the grid. Play it twice and you're back where you started.

**Mirrored:**
> {beatCount} beats. {word} repeats twice — same letters, but every position flips left-to-right. The second half is the mirror image of the first. Two passes return home.

**Flipped:**
> {beatCount} beats. {word} repeats twice — same letters, but every position flips top-to-bottom. The second half inverts the vertical axis. Two passes return home.

**Swapped:**
> {beatCount} beats. {word} repeats twice — same positions, same motions, but blue and red trade roles. What one hand did in the first half, the other does in the second. Two passes return home.

**Inverted:**
> {beatCount} beats. {word} repeats twice — same positions, but pro motions become anti and vice versa. The rotation direction reverses while the path stays the same. Two passes return home.

**Rewound:**
> {beatCount} beats. {word} repeats twice — the second half plays the first in reverse. A temporal mirror that loops back to start through time reversal.

#### Single-Component Copy (period 4 — quartered)

**Rotated:**
> {beatCount} beats. {word} repeats four times. Each pass rotates positions 90 degrees further around the grid. Four passes complete the full circle — back to start.

**Mirrored (quartered):**
> {beatCount} beats. {word} repeats four times. Positions mirror every two passes; orientations take all four to complete their cycle.

**Swapped (quartered):**
> {beatCount} beats. {word} repeats four times. Blue and red exchange roles every other pass. Four passes to complete the full cycle.

#### Multi-Component Copy

For compound LOOPs (multiple active components), concatenate the transformation descriptions. Phrasing is period-aware:

Period 2:
> {beatCount} beats. {word} repeats twice. The second half {verb1} and {verb2}. {cycleText}

Period 4:
> {beatCount} beats. {word} repeats four times. Each pass {verb1} and {verb2}. {cycleText}

Verb phrases come from the existing `COMPONENT_VERB` map in `loop-explainer.ts`:
- rotated: "rotates positions on the grid"
- mirrored: "mirrors east and west"
- flipped: "flips north and south"
- swapped: "swaps blue and red"
- inverted: "swaps pro and anti"
- rewound: "plays the beats in reverse order"

#### Modular LOOP Copy

For modular LOOPs (seeds with independent transformations), use the existing `explainLOOP` function's output:

> {beatCount} beats. Two patterns: {seed1} and {seed2}. {seed1} {transformation1}. {seed2} {transformation2}. {cycleText}

The `explainLOOP` service already decomposes seeds and detects per-pattern transformations. The modal calls it and renders the `summary` field.

### New Service: `generateLoopStructuralCopy`

Location: `src/lib/features/create/shared/workspace-panel/sequence-display/services/loop-structural-copy.ts`

```ts
export function generateLoopStructuralCopy(
  sequence: SequenceData,
  activeComponents: Set<LOOPComponent>,
  period: number
): { lead: string; parts: Array<{ text: string; bold: boolean }> }
```

Returns the same `{ lead, parts }` shape as `LevelInfoModal`'s `progression` computed value, enabling identical bold/normal rendering in the template.

Internally:
1. Compute beat count from `sequence.steps.length`
2. Compute word from `sequence.word` — if empty/null, use "{beatCount}-beat sequence" as fallback
3. Compute pass count from period (2 or 4)
4. Compute cycle count from `sequence.orientationCycleCount` (defaults to period)
5. If `explainLOOP` returns a modular explanation (`type === "modular"`), use its `summary`
6. Otherwise, select single-component or multi-component copy template
7. Inject actual values and bold the transformation verbs

### Data Flow

```
SequenceDisplay.svelte
  ├── loopDetectionResult (from circularLoopDetector)
  ├── loopDisplay (from resolveLoopDisplay)  
  ├── activeComponents, period, loopDisplayName
  └── LOOPInfoModal.svelte
        ├── LOOPComponentRow.svelte (activeComponents)
        └── generateLoopStructuralCopy(sequence, activeComponents, period)
             └── explainLOOP() for modular cases
```

### Integration

In `SequenceDisplay.svelte`, replace lines 286-315 (the inline `<BaseModal>` block) with:

```svelte
<LOOPInfoModal
  open={showLoopInfo}
  {activeComponents}
  {loopDisplayName}
  sequence={currentSequence}
  period={loopPeriod}
  onclose={() => (showLoopInfo = false)}
/>
```

### Styling

Follow `LevelProgressionRow.svelte` patterns exactly:
- `clamp()` for all sizes (responsive)
- `.current` / `.dim` class toggle
- `color-mix()` for active card background tint
- `filter: grayscale(1) brightness(0.85)` for dimmed cards
- `@media (prefers-reduced-motion: reduce)` to disable transitions
- 3x2 grid layout with `gap: clamp(8px, 2vw, 24px)`

Card colors use existing `LOOP_COMPONENT_MAP` colors:
- Rotated: #36c3ff (cyan)
- Mirrored: #6F2DA8 (purple)
- Flipped: #e91e63 (pink)
- Swapped: #26e600 (green)
- Inverted: #eb7d00 (orange)
- Rewound: #00bcd4 (teal)

## Files to Create

1. `src/lib/features/create/shared/workspace-panel/sequence-display/components/LOOPInfoModal.svelte`
2. `src/lib/features/create/shared/workspace-panel/sequence-display/components/LOOPComponentRow.svelte`
3. `src/lib/features/create/shared/workspace-panel/sequence-display/services/loop-structural-copy.ts`

## Files to Modify

1. `src/lib/features/create/shared/workspace-panel/sequence-display/components/SequenceDisplay.svelte` — replace inline LOOP modal with `<LOOPInfoModal>` component

## Out of Scope

- LOOPCompletionPopover (separate interactive tool, not an info display)
- LOOPRingButton (separate component, not mounted yet)
- Changes to LOOP detection logic
- Changes to the LOOP badge button trigger
