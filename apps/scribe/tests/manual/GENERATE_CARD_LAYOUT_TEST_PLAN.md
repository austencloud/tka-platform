# Generate Panel Card Layout - Manual Test Plan

## Test Scenarios

### Scenario 1: 8-Card Layout (Circular + Intermediate/Advanced)

**Settings:**

- Generation Mode: Circular
- Level: Intermediate (2) or Advanced (3)

**Expected Layout:**

```
Row 1: [Level] [Length] [TurnIntensity]    (3 cards @ 2 cols)
Row 2: [GenMode] [Grid] [PropContinuity]   (3 cards @ 2 cols)
Row 3: [SliceSize (50%)] [LOOP (50%)]        (2 cards @ 3 cols) ✅ NO EMPTY SPACE
```

**Verification:**

- [ ] All 8 cards are visible
- [ ] SliceSize card takes up exactly half the row width
- [ ] LOOP card takes up exactly half the row width
- [ ] No empty cell in row 3

---

### Scenario 2: 6-Card Layout (Circular + Beginner)

**Settings:**

- Generation Mode: Circular
- Level: Beginner (1)

**Expected Layout:**

```
Row 1: [Level] [Length] [GenMode]          (3 cards @ 2 cols)
Row 2: [Grid] [PropContinuity] [SliceSize] (3 cards @ 2 cols)
Row 3: [LOOP] [empty] [empty]                (1 card @ 2 cols)
```

**Verification:**

- [ ] Turn Intensity card is NOT visible
- [ ] 6 cards total are visible
- [ ] SliceSize and LOOP use default 2-column span
- [ ] Row 3 has one card and two empty cells

---

### Scenario 3: 5-Card Layout (Freeform + Beginner)

**Settings:**

- Generation Mode: Freeform
- Level: Beginner (1)

**Expected Layout:**

```
Row 1: [Level] [Length] [GenMode]    (3 cards @ 2 cols)
Row 2: [Grid] [PropContinuity] [empty] (2 cards @ 2 cols)
```

**Verification:**

- [ ] Turn Intensity card is NOT visible
- [ ] SliceSize card is NOT visible
- [ ] LOOP card is NOT visible
- [ ] 5 cards total are visible

---

### Scenario 4: 6-Card Layout (Freeform + Intermediate)

**Settings:**

- Generation Mode: Freeform
- Level: Intermediate (2)

**Expected Layout:**

```
Row 1: [Level] [Length] [TurnIntensity] (3 cards @ 2 cols)
Row 2: [GenMode] [Grid] [PropContinuity] (3 cards @ 2 cols)
```

**Verification:**

- [ ] Turn Intensity card IS visible
- [ ] SliceSize card is NOT visible
- [ ] LOOP card is NOT visible
- [ ] 6 cards total are visible
- [ ] Perfect 2-row layout, no empty cells

---

### Scenario 5: 6-Card Layout (Freeform + Advanced)

**Settings:**

- Generation Mode: Freeform
- Level: Advanced (3)

**Expected Layout:**

```
Row 1: [Level] [Length] [TurnIntensity] (3 cards @ 2 cols)
Row 2: [GenMode] [Grid] [PropContinuity] (3 cards @ 2 cols)
```

**Verification:**

- [ ] Turn Intensity card IS visible (with more intensity options)
- [ ] SliceSize card is NOT visible
- [ ] LOOP card is NOT visible
- [ ] 6 cards total are visible
- [ ] Perfect 2-row layout, no empty cells

---

## Testing Workflow

1. Navigate to the app in your browser
2. Open Build → Generate panel
3. For each scenario above:
   - Set the required settings
   - Verify the card count matches
   - Verify the layout matches the expected grid
   - Check for any empty cells or overflow
   - Verify column spans are correct

## Current Implementation Status

✅ **Implemented:** 8-card scenario optimization (SliceSize + LOOP span 3 columns each)

🔜 **Pending:** Additional optimizations for other scenarios

---

## Notes

- Grid system: 6 subcolumns total
- Default card span: 2 columns (3 cards per row)
- Optimized card span: 3 columns (2 cards per row)
- The 8-card scenario is the primary target for optimization
- Other scenarios may benefit from layout optimizations as well
