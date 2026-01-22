# End Position Constraint Implementation Plan

## Goal

Allow users to specify a target end position for sequences. The generator should work backwards through the sequence to find a valid variation chain that reaches the target, prioritizing bridge letter modifications.

---

## Architecture Overview

```
User: "BUTTHOLE ending at alpha1" or "BUTTHOLE with quartered strict_rotated LOOP"
                    │
                    ▼
┌─────────────────────────────────────┐
│      Target Position Resolution     │
│  - Explicit: "end at alpha1"        │
│  - Implicit: derive from LOOP type  │
└─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────┐
│     Forward Generation (existing)   │
│  - Beam search with constraints     │
│  - Produces candidate sequence      │
└─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────┐
│      End Position Check             │
│  - Does sequence end at target?     │
│  - If yes → done                    │
│  - If no → backward resolution      │
└─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────┐
│     Backward Position Resolution    │
│  1. Find final letter variations    │
│     that end at target position     │
│  2. Work backwards finding valid    │
│     chains that reach those         │
│  3. Prioritize bridge modifications │
│  4. Regenerate affected portion     │
└─────────────────────────────────────┘
```

---

## Phase 1: Core Infrastructure

### 1.1 New Types

**File: `mcp-server/src/core/constraints/types.ts`**

Add to existing types:
```typescript
/**
 * Target end position specification.
 */
export interface EndPositionTarget {
  /** The exact position to end at (e.g., "alpha1") */
  position?: string;

  /** Position group to end at (e.g., "alpha") - more flexible */
  positionGroup?: "alpha" | "beta" | "gamma";

  /** Derive target from LOOP requirements */
  loopType?: "strict_rotated" | "rewound";
  loopSlice?: "halved" | "quartered";
}
```

### 1.2 End Position Constraint

**File: `mcp-server/src/core/constraints/implementations/end-position-constraint.ts`** (NEW)

```typescript
/**
 * Hard constraint that requires the sequence to end at a specific position.
 * Only applies to the final letter of the sequence.
 */
export class EndPositionConstraint implements IVariationConstraint {
  readonly type = ConstraintType.POSITION;
  readonly mode: ConstraintMode = "hard";
  readonly description: string;

  constructor(
    private targetPosition: string,      // e.g., "alpha1"
    private targetGroup?: string         // e.g., "alpha" (fallback)
  ) {
    this.description = `End at position ${targetPosition}`;
  }

  evaluate(context: ConstraintContext): ConstraintScore {
    // Only applies to final letter
    if (context.stepIndex !== context.totalSteps - 1) {
      return { score: 1, satisfied: true, reason: "Not final step" };
    }

    const endPos = context.candidate.endPosition;

    // Exact match
    if (endPos === this.targetPosition) {
      return { score: 1, satisfied: true, reason: `Ends at ${this.targetPosition}` };
    }

    // Group match (fallback)
    if (this.targetGroup && endPos.startsWith(this.targetGroup)) {
      return { score: 0.8, satisfied: true, reason: `Ends in ${this.targetGroup} group` };
    }

    return { score: 0, satisfied: false, reason: `Ends at ${endPos}, need ${this.targetPosition}` };
  }
}
```

---

## Phase 2: Backward Resolution Algorithm

### 2.1 Position Chain Resolver

**File: `mcp-server/src/core/constraints/search/position-chain-resolver.ts`** (NEW)

This is the core algorithm that works backwards to find a valid chain.

```typescript
/**
 * Result of backward chain resolution.
 */
export interface ChainResolutionResult {
  success: boolean;

  /** Index where the chain diverges from original (0 = start position) */
  divergeIndex: number;

  /** New variations to use from divergeIndex onwards */
  newVariations: PictographData[];

  /** If a bridge was modified, info about the change */
  bridgeModification?: {
    transitionIndex: number;
    originalBridge: string;
    newBridge: string;
  };

  /** Why resolution failed (if !success) */
  error?: string;
}

/**
 * Resolve a position chain backwards to reach a target end position.
 *
 * Algorithm:
 * 1. Start from final letter, find variations ending at target
 * 2. For each valid final variation, determine required start position
 * 3. Work backwards: can previous letter reach that start position?
 * 4. If previous letter is a bridge, try all bridge options
 * 5. Continue backwards until we find a flex point or reach start
 */
export function resolvePositionChain(
  currentSteps: PictographData[],
  targetEndPosition: string,
  allPictographs: PictographData[],
  bridges: BridgeInfo[],
  constraintSet: ConstraintSet
): ChainResolutionResult {
  // Implementation details below
}
```

### 2.2 Algorithm Pseudocode

```
function resolvePositionChain(steps, targetPosition, pictographs, bridges, constraints):

  finalLetter = steps[last].letter

  # Step 1: Find all variations of final letter that end at target
  validFinalVariations = pictographs.filter(p =>
    p.letter == finalLetter && p.endPosition == targetPosition
  )

  if validFinalVariations.isEmpty():
    return { success: false, error: "Final letter cannot end at target position" }

  # Step 2: For each valid final variation, try to build chain backwards
  for finalVar in validFinalVariations:
    requiredStartPos = finalVar.startPosition

    result = tryBuildChainBackwards(
      steps[0..last-1],  # All steps except final
      requiredStartPos,   # Position we need to reach
      pictographs,
      bridges,
      constraints
    )

    if result.success:
      return {
        success: true,
        divergeIndex: result.divergeIndex,
        newVariations: [...result.chain, finalVar],
        bridgeModification: result.bridgeModification
      }

  return { success: false, error: "No valid chain found" }


function tryBuildChainBackwards(steps, targetPos, pictographs, bridges, constraints):

  # Base case: we've reached the start position
  if steps.length == 1:  # Just the start position
    if steps[0].endPosition == targetPos:
      return { success: true, divergeIndex: 0, chain: [] }
    else:
      return { success: false }

  currentStep = steps[last]
  previousStep = steps[last-1]

  # Check if current step is a bridge
  bridgeInfo = bridges.find(b => b.selectedBridge == currentStep.letter)

  if bridgeInfo:
    # This is a bridge! Try all bridge options
    for bridgeOption in bridgeInfo.availableOptions:
      bridgeVariations = pictographs.filter(p =>
        p.letter == bridgeOption &&
        p.startPosition == previousStep.endPosition &&  # Must chain from previous
        p.endPosition == targetPos  # Must reach our target
      )

      if bridgeVariations.isNotEmpty():
        # Score by constraints and pick best
        best = scoreAndPickBest(bridgeVariations, constraints)
        return {
          success: true,
          divergeIndex: steps.length - 1,
          chain: [best],
          bridgeModification: {
            transitionIndex: bridgeInfo.transitionIndex,
            originalBridge: bridgeInfo.selectedBridge,
            newBridge: bridgeOption
          }
        }

  # Not a bridge, or bridge didn't work - try changing this letter's variation
  alternativeVariations = pictographs.filter(p =>
    p.letter == currentStep.letter &&
    p.startPosition == previousStep.endPosition &&
    p.endPosition == targetPos
  )

  if alternativeVariations.isNotEmpty():
    best = scoreAndPickBest(alternativeVariations, constraints)
    return {
      success: true,
      divergeIndex: steps.length - 1,
      chain: [best]
    }

  # Can't fix at this level - recurse backwards
  # Find what positions current letter CAN end at (from previous)
  possibleVariations = pictographs.filter(p =>
    p.letter == currentStep.letter &&
    p.startPosition == previousStep.endPosition
  )

  for variation in possibleVariations:
    # Try to build chain that ends at this variation's start
    result = tryBuildChainBackwards(
      steps[0..last-1],
      variation.startPosition,
      pictographs,
      bridges,
      constraints
    )

    if result.success:
      # Check if this variation can reach our target
      if variation.endPosition == targetPos:
        return {
          success: true,
          divergeIndex: result.divergeIndex,
          chain: [...result.chain, variation]
        }

  return { success: false }
```

---

## Phase 3: Integration with Constrained Builder

### 3.1 Modify buildConstrainedSequence

**File: `mcp-server/src/core/constraints/search/constrained-builder.ts`**

Add to `ConstrainedBuilderOptions`:
```typescript
export interface ConstrainedBuilderOptions {
  // ... existing options

  /** Target end position (optional) */
  targetEndPosition?: string;

  /** Target end position group (optional, more flexible) */
  targetEndPositionGroup?: "alpha" | "beta" | "gamma";
}
```

Modify `buildConstrainedSequence`:
```typescript
export function buildConstrainedSequence(options: ConstrainedBuilderOptions): ConstrainedSequenceResult {
  // ... existing generation logic ...

  // After normal generation, check if we need position resolution
  if (options.targetEndPosition || options.targetEndPositionGroup) {
    const currentEndPos = result.steps[result.steps.length - 1].endPosition;
    const target = options.targetEndPosition;
    const targetGroup = options.targetEndPositionGroup;

    const needsResolution = target
      ? currentEndPos !== target
      : !currentEndPos.startsWith(targetGroup);

    if (needsResolution) {
      const resolution = resolvePositionChain(
        result.steps,
        target || `${targetGroup}*`,  // Group matching handled in resolver
        allPictographs,
        result.bridges || [],
        constraintSet
      );

      if (resolution.success) {
        // Apply the resolution - replace steps from divergeIndex
        result.steps = [
          ...result.steps.slice(0, resolution.divergeIndex),
          ...resolution.newVariations
        ];

        // Update bridge info if modified
        if (resolution.bridgeModification) {
          // Update bridges array
        }

        // Re-propagate orientations
        result.steps = propagateOrientations(result.steps);
      } else {
        // Resolution failed - report but return best effort
        result.error = resolution.error;
        result.constraintReport.satisfied = false;
      }
    }
  }

  return result;
}
```

---

## Phase 4: LOOP-Aware Position Derivation

### 4.1 Derive Target Position from LOOP Type

**File: `mcp-server/src/core/loop/loop-position-requirements.ts`** (NEW)

```typescript
/**
 * Given a start position and LOOP configuration, determine valid end positions.
 */
export function getValidEndPositionsForLoop(
  startPosition: string,
  loopType: "strict_rotated" | "rewound",
  sliceSize: "halved" | "quartered"
): string[] {
  if (loopType === "rewound") {
    // Rewound works with any position pair
    return ["*"];  // Wildcard - any position
  }

  if (loopType === "strict_rotated") {
    if (sliceSize === "halved") {
      // Need 180° rotation - opposite position
      return getOppositePositions(startPosition);
    } else {
      // Need 90° rotation
      return get90DegreePositions(startPosition);
    }
  }

  return [];
}

function get90DegreePositions(position: string): string[] {
  // Extract group and number
  const match = position.match(/^(alpha|beta|gamma)(\d+)$/);
  if (!match) return [];

  const [, group, numStr] = match;
  const num = parseInt(numStr);

  // 90° CW and CCW positions
  // Position numbering: 1, 3, 5, 7 for alpha/beta (cardinal points)
  // or 1, 3, 5, 7, 9, 11, 13, 15 for gamma (8 points)

  if (group === "alpha" || group === "beta") {
    // 4 positions: 1, 3, 5, 7
    const cw = ((num + 2 - 1) % 8) + 1;   // +90°
    const ccw = ((num - 2 - 1 + 8) % 8) + 1;  // -90°
    // Only odd numbers are valid
    const cwValid = cw % 2 === 1 ? cw : cw + 1;
    const ccwValid = ccw % 2 === 1 ? ccw : ccw - 1;
    return [`${group}${cwValid}`, `${group}${ccwValid}`].filter(p => p !== position);
  }

  // Gamma has 8 positions
  // ... similar logic for gamma

  return [];
}
```

---

## Phase 5: MCP Tool Updates

### 5.1 Update generate_sequence_data

Add parameters:
```typescript
endPosition: z.string().optional().describe(
  'Target end position (e.g., "alpha1", "beta3"). Generator will work backwards to achieve this.'
),
endPositionGroup: z.enum(["alpha", "beta", "gamma"]).optional().describe(
  'Target end position group. More flexible than exact position.'
),
```

### 5.2 Update generate_sequence_image

Same parameters as above.

### 5.3 Update generate_loop_image

When LOOP type requires specific positions, automatically derive and apply:
```typescript
// In generate_loop_image handler:
if (loopType === "strict_rotated") {
  // Derive required end positions from start + slice size
  const validEndPositions = getValidEndPositionsForLoop(
    startPosition,  // From first step
    loopType,
    sliceSize
  );

  // Pick the first valid one as target
  options.targetEndPosition = validEndPositions[0];
}
```

---

## Phase 6: Testing

### 6.1 Unit Tests

```typescript
// Test backward resolution finds bridge modification
test("resolves BUTTHOLE to end at alpha1 by changing bridge", () => {
  const result = buildConstrainedSequence({
    letters: ["B", "U", "T", "T", "H", "O", "L", "E"],
    allPictographs,
    constraintSet: getPresetConstraintSet("maximize-dash"),
    targetEndPosition: "alpha1"
  });

  expect(result.success).toBe(true);
  expect(result.steps[result.steps.length - 1].endPosition).toBe("alpha1");
});

// Test impossible position is reported
test("reports error when target position impossible", () => {
  const result = buildConstrainedSequence({
    letters: ["A"],  // A only ends at alpha positions
    allPictographs,
    constraintSet: emptyConstraintSet(),
    targetEndPosition: "beta1"  // Impossible
  });

  expect(result.success).toBe(false);
  expect(result.error).toContain("cannot end at");
});
```

---

## Implementation Order

1. **Types & EndPositionConstraint** - Foundation
2. **Position chain resolver algorithm** - Core logic
3. **Integration with constrained builder** - Wire it up
4. **Basic MCP tool parameters** - User-facing API
5. **LOOP position derivation** - Smart defaults for LOOP requests
6. **Testing & verification**

---

## Edge Cases to Handle

| Scenario | Handling |
|----------|----------|
| Final letter has no variation at target | Error: "Letter X cannot end at position Y" |
| No valid chain exists | Error: "No valid path to target position" |
| Multiple valid chains | Pick one that best satisfies soft constraints |
| Target conflicts with other hard constraints | End position wins (user explicitly requested) |
| LOOP type has no valid positions from start | Error: "LOOP type requires start at X, sequence starts at Y" |

---

## Success Criteria

1. `generate_sequence_data word=BUTTHOLE endPosition=alpha1 constraintPreset=maximize-dash` produces sequence ending at alpha1
2. `generate_loop_image word=BUTTHOLE loopType=strict_rotated sliceSize=quartered` automatically derives and achieves required end position
3. When impossible, clear error message explains why
4. Performance: backward resolution adds <500ms to generation time
