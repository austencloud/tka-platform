/**
 * Deep Domain Topics
 *
 * Extended reference content for TKA domain concepts. These are served
 * on-demand via the `get_domain_topic` MCP tool, keeping them out of
 * the system prompt while remaining fully accessible when needed.
 *
 * Pattern: Record<topicKey, markdown content>
 * Following the common-questions.ts convention.
 */

import { PRECISE_QUARTER_SAME_EXPLANATION } from "./rotation-invariant.js";

export const DOMAIN_TOPICS: Record<string, { title: string; content: string }> = {
  "static-props": {
    title: "TKA and Props: Built for Double Staves",
    content: `## TKA and Props: Built for Double Staves

TKA was built for **double staves**. That's the canonical prop, and understanding why matters.

### The Thumb/Pinky Reference System

Each staff has two visible ends. One end is the consistent **thumb reference**, the other is the consistent **pinky reference**. With proper technique, these references never have to change. This dual-end landmark system is the foundation of TKA's entire orientation framework -- you always know which way the prop is pointing because you can see both ends and their relationship to your grip.

### Proper Technique

Two techniques keep the thumb/pinky references consistent through every movement:

1. **Negative space above and below the shoulder** -- using the open space around the body to transition the prop without regripping
2. **Body turns** -- rotating your body to pass the prop into the plane behind you, accomplishing moves that would otherwise require a grip change

These aren't optional refinements. They're how TKA movements are executed while maintaining the orientation reference system.

### Other Props

Other static props (fans, clubs, buugeng) work with TKA because they're also gripped directly and the performer controls orientation. But staves are what the system was designed around. Fans have a visible flat face that shows orientation, but they lack the dual-end reference that makes staves canonical.

### Why Not Poi?

TKA is a **radial system** -- all orientations are measured from the prop to the performer's center point, not relative to the ground. Gravity does not constrain a staff's orientation the way it constrains poi's trajectory. **Momentum-based props (poi)** can perform many TKA sequences but not all. A Poi Lab module is **planned but not yet built** to identify the poi-legal subset.

### The Parameter Space

The TKA parameter space is precise and finite: 9 grid locations (8 perimeter + center), 8 center-relative orientations (4 radial/nonradial + 4 interradial at L6+), and rotation increments down to 45 degrees (quarter turns at L6). What TKA does NOT enumerate: grip changes, body movement, behind-the-back passes, contact rolling, tosses, or 3D planes below Level 8.

TKA is for **dual-wielded** props. Contact staff (balancing/rolling on body) is NOT part of TKA.`,
  },

  "base-rotation": {
    title: "The Base Rotation Principle",
    content: `## The Base Rotation Principle

**Turn counts in TKA measure ADDITIONAL rotation on top of an inherent base rotation.** This is the most commonly misunderstood concept.

Every motion has a **base rotation** -- the natural prop behavior during the hand path at 0 additional turns:

**For shifts (curved arcs):** The arc itself causes center-relative angular change. The prop's relationship to the center changes as the hand moves along the curve. At 0 turns:
- **Pro base:** Prop rotates with the arc. Center-relative orientation is preserved.
- **Anti base:** Prop rotates against the arc. Center-relative orientation reverses.

This means 0-turn pro and 0-turn anti are two DIFFERENT states for shifts, even though "0 turns" sounds like "no rotation." The prop IS rotating in both cases -- it's just rotating at the base rate with zero additional turns.

**For dashes, hashes, and statics (straight lines or no movement):** There is no arc, so base rotation at 0 turns means truly no rotation. The prop translates along the line (or stays put) without spinning. This is why 0 turns for these motion types produces exactly 1 state (no rotation = no direction to speak of). Hash follows identical rotation physics to dash -- the +/- modifier changes distance, not behavior.

### Why This Matters

| Motion | 0 turns | States |
|--------|---------|--------|
| Shift (incl. skews) | Pro base OR anti base (two distinct behaviors) | 2 |
| Dash (incl. hash) | No rotation (one behavior) | 1 |
| Static | No rotation (one behavior) | 1 |

Adding 1+ turns to any motion type introduces CW/CCW direction (2 states per turn count).

### Turn Unit: 1 Turn = 180 degrees Additional Rotation

TKA defines 1 turn as 180 degrees of additional prop rotation beyond base behavior. This is a deliberate pedagogical choice:

- If 1 turn = 360 degrees, quarter turns (Level 6) would be 1/8 turns -- fractional chaos
- If 1 turn = 90 degrees, Level 2 would need 6 turn values (0-6) instead of the clean 0-3
- At 180 degrees, the math stays clean at every level: whole turns 0-3 are small integers, half turns (90 degrees) produce cardinal orientation shifts, and quarter turns (45 degrees) produce interradial orientations

This also makes the orientation parity rules intuitive: each additional turn (180 degrees) flips orientation once, so even turns preserve and odd turns reverse.`,
  },

  "orientation-algebra": {
    title: "Orientation Algebra",
    content: `## Orientation Algebra

### Whole-Turn Parity Rules

| Motion type | Even turns (0, 2, ...) | Odd turns (1, 3, ...) |
|-------------|------------------------|------------------------|
| Pro, Static | Preserves orientation | Reverses orientation |
| Anti, Dash, Hash | Reverses orientation | Preserves orientation |

"Reverses" means in<->out, clock<->counter (and interradial pairs at L6+: clockIn<->counterOut, clockOut<->counterIn).

### Fractional Turns (Half-turns at L3+, Quarter-turns at L6+)

Half turns (0.5, 1.5, 2.5) produce orientations 90 degrees from the start. Quarter turns (0.25, 0.75, 1.25, ...) produce interradial orientations using the 8-point radial cycle:

in -> clockIn -> clock -> clockOut -> out -> counterOut -> counter -> counterIn

Each quarter turn = 1 step. Direction rule:
- **Anti/Dash/Hash:** Step SAME direction as rotation
- **Pro/Static:** Step OPPOSITE direction to rotation

### Float Orientation

Float holds absolute spatial angle. As the hand arcs, the center-relative orientation changes by an amount determined by arc length and direction. For a standard single-segment shift: a CW arc shifts orientation one position CW in the radial cycle; a CCW arc shifts one position CCW. Float only changes orientation for CW/CCW hand paths; a dash/static hand path with float would preserve orientation (but float doesn't apply to those).`,
  },

  "combinatorial-space": {
    title: "Combinatorial Motion Space",
    content: `## Combinatorial Motion Space

The complete enumeration of single-hand motions from any grid point, stratified by level.

### Formulas

Given maximum turn count T (number of distinct turn values) and float availability F (1 for shifts, 0 otherwise):

- **Per shift destination:** 2(T) + F states (T pro values + T anti values + F float)
- **Per dash/hash/static destination:** 2T - 1 states (1 directionless 0-turn + (T-1) turn values x 2 directions)

*At 0 turns: shifts have 2 states (pro base, anti base). Dashes/hashes/statics have 1 state (no rotation = no direction).*

### Level-by-Level Totals

**L1: 0 turns only, 4-point grid, no float** -> 6 states per perimeter point
**L2: Whole turns 0-3, 4-point grid, no float** -> 30 states
**L3: Half-turns (7 values), 4-point grid, float** -> 56 states
**L4: Same turns as L3, 5-point grid (4 perimeter + center), float** -> 69 from perimeter, 65 from center
**L5: Same turns, 9-point grid (8 perimeter + center)** -> 129 from perimeter, 117 from center
**Ceiling (L6+): Quarter-turns (13 values), 9-point grid** -> 237 from perimeter, 225 from center

### Summary Table

| Level | Grid | Turn values | Float | From perimeter | From center |
|-------|------|-------------|-------|----------------|-------------|
| L1 | 4-pt | 1 (0 only) | No | **6** | -- |
| L2 | 4-pt | 4 (0,1,2,3) | No | **30** | -- |
| L3 | 4-pt | 7 (0-3 + halves) | Yes | **56** | -- |
| L4 | 5-pt | 7 | Yes | **69** | **65** |
| L5 | 9-pt | 7 | Yes | **129** | **117** |
| Ceiling | 9-pt | 13 (0-3 + quarters) | Yes | **237** | **225** |

The original estimate of 214 possibilities was based on incorrect assumptions (0-turn dash/static counted as having CW/CCW direction, and no center point). The validated ceiling is 237 from perimeter, 225 from center.

### Detailed Breakdowns

**L1 (6 states):** Shift: 2 destinations x 2 (pro0, anti0) = 4. Dash: 1 x 1 = 1. Static: 1.

**L2 (30 states):** T=4. Shift: 2 x 2(4) = 16. Dash: 1 x (2*4-1) = 7. Static: 7.

**L3 (56 states):** T=7. Shift: 2 x (2*7+1) = 30. Dash: 1 x 13 = 13. Static: 13.

**L4 from perimeter (69):** 5-point grid (4 perimeter + center). Shift: 2 x 15 = 30. Dash: 13. Hash (to center): 13. Static: 13.
**L4 from center (65):** Hash (to 4 perimeter): 4 x 13 = 52. Static: 13.

**L5 from perimeter (129):** 9-point grid (8 perimeter + center). Shift: 6 x 15 = 90. Dash: 13. Hash (to center): 13. Static: 13.
**L5 from center (117):** Hash (to 8 perimeter): 8 x 13 = 104. Static: 13.

**Ceiling from perimeter (237):** T=13. Shift: 6 x 27 = 162. Dash: 25. Hash: 25. Static: 25.
**Ceiling from center (225):** Hash: 8 x 25 = 200. Static: 25.`,
  },

  "hand-path-modifiers": {
    title: "Hand Path Modifier System (+/-)",
    content: `## Hand Path Modifier System (+/-)

A hand path describes the trajectory of the hand from one grid point to another. The geometric shape (curved vs straight) determines available rotation types.

Three fundamental hand path families, distinguished by geometry:

| Family | Geometry | Base path | Modifiers |
|--------|----------|-----------|-----------|
| **Static** | No movement | Stay at current point | -- |
| **Shift** | Curved arc | Arc to adjacent perimeter point | +/- (skew) |
| **Dash** | Straight line | Straight to opposite perimeter point | +/- (extended/shortened) |

**The geometric distinction matters:** Shifts follow curved arcs (enabling pro/anti/float). Dashes follow straight lines (no pro/anti/float at 0 turns).

### The +/- Path Modifier System

Both shifts and dashes support **path length modifiers** displayed per-hand in the turns column of the TKA glyph.

**For dashes (L4+/L7+):**
- (none): Standard dash -- perimeter to opposite perimeter (L1+)
- -: Dash- (hash) -- perimeter to center or center to perimeter (L4+)
- +: Dash+ -- perimeter to center of *other* grid (L7+)
- ++: Dash++ -- perimeter to opposite perimeter of *other* grid (L7+)

**For shifts (L5+, 8-point grid):**
- (none): Standard shift -- arc to adjacent point (1 segment)
- +: Skew+ -- extended arc (e.g., S to NE, 3 segments)
- -: Skew- -- shortened arc (less than 1 segment)
- ++: Skew++ -- double-extended arc

**Dash- is called "hash"** -- a shortened dash to/from center instead of to the opposite perimeter point. Same geometry, same rotation rules, half the distance.

### Why Three Families, Not Five

Dash and hash share identical physics: straight-line trajectory, 0 turns = no rotation (1 state), 1+ turns = CW/CCW. They differ only in distance. The +/- modifier captures this without creating a separate type. Similarly, skew+/- are length variants of the shift family.

The letter type system classifies by **hand path family** (shift, dash, static):

| Type | Combination | Includes |
|------|------------|----------|
| 1 | shift + shift | Standard shifts, skew+/- variants |
| 2 | shift + static | |
| 3 | shift + dash | shift + dash, shift + dash-, shift + dash+ |
| 4 | dash + static | dash + static, dash- + static |
| 5 | dash + dash | dash + dash, dash + dash-, dash- + dash- |
| 6 | static + static | |

### Extended Dashes (L7+, conjoined grids -- DESIGN PHASE)

When two grids share a junction point (Level 7), new straight-line paths emerge crossing the grid boundary. Dash+/++ follow straight-line trajectories (not curved arcs), so they follow dash rotation rules. No new letters needed -- existing letter classification covers all combinations.

**Dash- vs Dash+:** Dash- (L4) goes to center of *same* grid. Dash+ (L7) goes to center of *other* grid. Both are straight-line paths to a center point.

### Skews (L5+ only, 8-point grid)

When the 8-point grid is available, shifts can traverse arcs longer or shorter than standard:
- **Skew+** (shift+): Extended arc (e.g., S to NE, spanning 3 segments)
- **Skew-** (shift-): Shortened arc (less than one standard segment)

Skews support all three shift motion types (pro, anti, float). Theoretically unbounded in arc length.

**CHU:** A skew++ (double-extended arc) with float has been identified as a distinct phenomenon. TKA does NOT give it a separate motion type -- it is expressible as an extended-arc float shift within the existing framework.`,
  },

  "level-system": {
    title: "Level System",
    content: `## Level System

### Locked-In Order (Feb 2026)

| Level | Concept | What it adds | Arc |
|-------|---------|-------------|-----|
| 1 | Foundation | 0 turns, alpha + beta + gamma positions | Foundation |
| 2 | Whole turns | 0-3 whole turns | Foundation |
| 3 | Half turns + float | Halves, float motion type | Foundation |
| 4 | Centric | Center point, hash hand path, tau/terra positions | New grid point |
| 5 | Skewed grid | 8-point grid, zeta + eta (cross-grid asymmetry), skew+ and skew- | Grid mixing |
| 6 | Interradial orientations | 8 orientations, quarter turns, completes single-grid 2D | Orientation freedom |
| 7 | Conjoined grids | Dual grids sharing a junction point, extended dashes | Canvas expansion |
| 8 | Atomics | Multi-plane / 3D (wall, wheel, overhead) | New dimension |
| 9 | Rubik's cube | Skewed across intersecting planes | 3D COMPLETE |

### Why This Order

**All three base positions from L1:**
- Alpha (180°, symmetric), beta (0°, symmetric), and gamma (90°, asymmetric) are all present at Level 1 with 0 turns
- Learners encounter asymmetry (leader/follower) immediately -- it is foundational, not advanced
- L5's skewed grid adds cross-grid asymmetry (zeta, eta) where one hand is on diamond and the other on box, not asymmetry in general

**Centric before skewed (L4 before L5):**
- Center point adds 1 new location and 1 new hand path (hash) -- a +23% state space expansion
- Skewed grid adds 4 new locations and introduces grid mode mixing -- a +87% expansion
- Centric motions are intuitive and commonly reached for before skewed positions
- Skewed grid shares cognitive complexity with interradials (L6), grouping the "hard 2D" together

**Interradials before conjoined (L6 before L7):**
- Complete all orientation freedom within one grid before expanding beyond one grid
- "Complete then expand" -- master the full orientation vocabulary (4 to 8) before doubling the spatial canvas
- Interradials are a precision concept best learned on familiar single-grid territory
- Conjoined grids at L7 bridge naturally to L8's multi-plane expansion

**Conjoined before 3D (L7 before L8):**
- Conjoined grids expand spatial canvas while staying in 2D, easing the transition
- All single-grid 2D knowledge (including interradials) carries forward into conjoined and then into 3D

**Symmetry:** L6 completes orientation freedom, L7 completes spatial expansion in 2D. L9 completes 3D the same way -- precision pass after dimensional expansion (atomics at L8).`,
  },

  "skewed-letters": {
    title: "Letter Types on the 8-Point Grid (L5 Skewed)",
    content: `## Letter Types on the 8-Point Grid (L5 Skewed)

> **Audit note (Feb 2026):** This section was drafted during a long exploratory conversation. Core conclusions validated by Austen, but details/framing may contain errors.

The 8-point grid introduces skewed positions (Zeta, Eta) where one hand operates on the diamond grid and the other on the box grid.

### The Two Halves of Asymmetric Positions

Every asymmetric position has two halves, determined by which hand is directionally ahead of the other.

**Gamma** has gamma1-8 (one half) and gamma9-16 (the other half). Same-direction shifts stay within the same half. Opposite-direction shifts cross between halves (while remaining in gamma).

This is why gamma compound letters (MP, NQ, OR) are structurally analogous to alpha/beta compounds (DJ, EK, FL). DJ oscillates between beta and alpha. MP oscillates between gamma's two halves.

**Zeta** and **Eta** each have two halves, but their halves are more isolated. Opposite-direction shifts leave the position entirely (Eta becomes Zeta, Zeta becomes Eta).

### The Skewed World as Distinct Territory

You **enter** skewed territory from standard positions (via Type 2 or Type 3 letters), **exist** within it, and **exit** back.

**Notation:** Curly braces in written sequences: A{MP}G. Individual pictographs use the 8-point grid visual.

### Transition Rules

When both hands shift one step, angular separation either stays the same or changes by 180 degrees:
- **Same direction** -> angle unchanged (stay in same position type)
- **Opposite direction** -> angle changes by 180 degrees (swap to paired position)

| Diamond grid | Skewed grid |
|-------------|-------------|
| Alpha <-> Alpha (same dir) | Zeta <-> Zeta (same dir) |
| Beta <-> Beta (same dir) | Eta <-> Eta (same dir) |
| Beta <-> Alpha (opp dir) | Eta <-> Zeta (opp dir) |
| Gamma <-> Gamma (both dirs) | *(gamma can't be skewed)* |

### Type 1 (Dual-Shift) and letter group attribution

**Correction (2026-04-18):** A previous version of this topic claimed "all skewed Type 1 transitions use M-V, not A-L." That was wrong.

A-L and M-V are defined by diamond-grid position, not by skewed behavior:
- **A-L** are Type 1 letters on alpha/beta (the symmetric diamond-grid positions)
- **M-V** are Type 1 letters on gamma (the asymmetric diamond-grid position)

How zeta/eta transitions are actually assigned to letters is a **separate question** that this topic does not resolve. Don't conflate the two. Ask Austen or reference the Skewed pictograph dataframe directly before making claims about skewed-position letter assignments.

### Type 4 (Dash + Static): Phi and Psi

Lambda requires gamma (90 degrees), impossible in skewed positions. Skewed Type 4 uses Phi (diverging, angle increases) and Psi (converging, angle decreases).

### Type 5 (Dual-Dash)

Phi- and Psi- extend the same way. Lambda- cannot be skewed.

### Summary

| Context | Behavior | Why |
|---------|----------|-----|
| Type 4/5 diverge/converge | Phi (diverging) / Psi (converging); Lambda cannot be skewed | Gamma (90°) requires both hands on same grid |
| Position symmetry | Zeta and Eta are asymmetric | One hand directionally ahead of the other |
| Transition structure | Zeta↔Eta via opposite-direction shift (like Alpha↔Beta) | Same shift geometry, different position family |

Note: Type 1 letter assignment for zeta/eta transitions is intentionally omitted from this summary. Determining whether a given skewed transition uses an A-L letter, an M-V letter, or a new letter entirely is a distinct question from defining what A-L and M-V mean on the 4-point diamond grid. Refer to the Skewed pictograph dataframe or Austen directly for the ground truth on skewed letter assignment.`,
  },

  "position-symmetry": {
    title: "Position Symmetry and Gamma Skewing",
    content: `## Position Symmetry (Critical for Letter Assignment)

Whether a position is **symmetric** or **asymmetric** determines which letters apply to it.

**Symmetric positions:** You can swap which hand is which (via rotation or mirror) and get an equivalent configuration. Alpha (180 degrees) and Beta (0 degrees) are symmetric.

**Asymmetric positions:** One hand is directionally "ahead" of the other. Swapping hands produces a distinct configuration. Gamma (90 degrees), Zeta (135 degrees), and Eta (45 degrees) are all asymmetric.

| Position | Angle | Symmetric? | Why |
|----------|-------|------------|-----|
| Alpha | 180 degrees | Yes | Rotate 180 degrees and it's identical |
| Beta | 0 degrees | Yes | Both hands at same point, fully interchangeable |
| Gamma | 90 degrees | No | One hand CW of the other; swapping changes it |
| Zeta | 135 degrees | No | Same asymmetry as gamma |
| Eta | 45 degrees | No | Same asymmetry as gamma |

**Why this matters:** In asymmetric positions, when both hands shift the same direction, one hand "leads" and one "follows." This creates a leader/follower distinction that requires additional letter differentiation.

**Important:** Leader/follower only applies to **same-direction** movement. When hands go **opposite directions** in an asymmetric position, they diverge/converge symmetrically -- no leader, no follower.

### Gamma Cannot Be Skewed

On the 8-point grid, skewed positions require one hand on a cardinal point and one on an intercardinal point. The possible angular separations are always odd multiples of 45 degrees: either 45 degrees (Eta) or 135 degrees (Zeta). You **cannot** get 90 degrees with one hand on each grid. Gamma (90 degrees) only occurs when both hands are on the **same** grid (both cardinal or both intercardinal).`,
  },

  "loops": {
    title: "LOOP System and Compositional Theory",
    content: `## LOOP System

A **LOOP** is a sequence that returns to its starting position (circular) and follows a structured transformation pattern between its halves/quarters. The LOOP type is determined by step data (positions, motion types, hand identity), not by the word or letters.

### LOOP Types

| Type | Definition |
|------|------------|
| **Strict LOOP** | Single transformation applies uniformly to ALL beat pairs |
| **Compound LOOP** | Different transformations at different intervals |
| **Modular LOOP** | Multiple distinct patterns at the SAME interval |
| **Freeform** | Circular but no recognizable pattern |

### Six Transformation Components

| Component | What it does |
|-----------|-------------|
| **Rotated** | Positions continue rotating same direction (180 or 90 degree slices) |
| **Mirrored** | Left-right swap across vertical axis |
| **Flipped** | Top-bottom swap across horizontal axis |
| **Swapped** | Blue<->Red hand roles swap |
| **Inverted** | Pro<->Anti motion types swap |
| **Rewound** | Second half plays in reverse (temporal, not geometric) |

---

## Compositional LOOP Theory (Feb 2026)

### Turn Independence

The LOOP algebra operates on a reduced space of:
- **Grid positions** (where hands are)
- **Motion types** (pro / anti / static / dash / float)
- **Hand identity** (blue / red)

**Turn values and orientations do not affect LOOP classification.** You can set every turn to 0 and the LOOP type is unchanged. Every LOOP type has a "canonical zero-turn form" representing its pure algebraic skeleton:

\`\`\`
Performed Sequence = LOOP Skeleton + Turn Assignment
\`\`\`

### Compositional Notation

Instead of flat component bags like {MIRRORED, SWAPPED, INVERTED}, express LOOPs as ordered compositions:

- \`/\` = applied **simultaneously** as one compound operation
- \`+\` = applied **sequentially** (inner pattern, then outer transformation on top)

Example: \`SWAPPED + MIRRORED/INVERTED\`
1. Take a SWAPPED inner pattern (seed doubled via hand-role swap)
2. Apply MIRRORED and INVERTED simultaneously (mirror positions + flip pro/anti)

The flat label {MIRRORED, SWAPPED, INVERTED} doesn't tell you which transformation came first. The compositional notation preserves construction order.

### The Fixed-Point Theorem

For the composition INNER + OUTER:
- INNER produces a circular sub-pattern: starts at S, ends at S
- OUTER takes that sub-pattern and applies a transformation to double it
- The outer half must start at S (continuity) and end at S (circularity)

**Therefore: T(S) = S for any outer transform T.** The starting position must be a **fixed point** of the outer transformation.

### Computed Fixed Points

From the actual position maps in the codebase:

| Transform | Fixed-point positions (can be OUTER from these) |
|---|---|
| **MIRROR (vertical)** | alpha1, alpha5, beta1, beta5 |
| **FLIP (horizontal)** | alpha3, alpha7, beta3, beta7 |
| **SWAP** | all beta (beta1-beta8) |
| **ROTATE 180deg** | terra1 only (L5) |
| **INVERTED** | ALL positions (doesn't change positions) |

Swap is identity on beta because swapping two hands at the same grid location changes nothing positionally. This is why beta enables the most compositions.

### Compound Outer Fixed Points

Intersect the individual fixed-point sets:

| Compound Outer | Valid Starting Positions |
|---|---|
| MIRROR/INVERTED | alpha1, alpha5, beta1, beta5 |
| FLIP/INVERTED | alpha3, alpha7, beta3, beta7 |
| SWAP/INVERTED | all beta |
| MIRROR/SWAP | beta1, beta5 only |
| FLIP/SWAP | beta3, beta7 only |
| MIRROR/FLIP | none (L1-4), terra1 (L5) |
| MIRROR/SWAP/INVERTED | beta1, beta5 only |
| FLIP/SWAP/INVERTED | beta3, beta7 only |

### Rotation Is Always Inner

**No standard L1-L4 grid position is a fixed point under 180deg rotation.**

- alpha1 -> alpha5 (moves)
- beta3 -> beta7 (moves)
- gamma1 -> gamma5 (moves)
- Only terra1 (both hands at center, L5) maps to itself

ROTATE cannot be an outer transform from any standard position. It must be the innermost structural layer or standalone. This is a mathematical constraint, not a design choice.

For ROTATE as INNER, the seed goes S -> ROTATE(S), which is always a different position, producing non-degenerate structure from any starting point.

### Composability Matrix (from alpha1)

| Composition | Inner valid? | Outer valid? | Overall |
|---|---|---|---|
| SWAP + MIRROR/INV | alpha1->alpha5 yes | MIRROR(alpha1)=alpha1 yes | **VALID** |
| SWAP + FLIP/INV | alpha1->alpha5 yes | FLIP(alpha1)=alpha5 no | **BLOCKED** |
| SWAP + INVERTED | alpha1->alpha5 yes | always yes | **VALID** |
| ROTATE + SWAP | alpha1->alpha5 yes | SWAP(alpha1)=alpha5 no | **BLOCKED** |
| ROTATE + MIRROR/INV | alpha1->alpha5 yes | MIRROR(alpha1)=alpha1 yes | **VALID** |
| MIRROR/INV + SWAP | alpha1->alpha1 degenerate | SWAP(alpha1)=alpha5 no | **BLOCKED** |

### Composability Matrix (from beta3)

| Composition | Inner valid? | Outer valid? | Overall |
|---|---|---|---|
| SWAP + MIRROR/INV | beta3->beta3 degenerate | MIRROR(beta3)=beta7 no | **BLOCKED** |
| ROTATE + SWAP | beta3->beta7 yes | SWAP(beta3)=beta3 yes | **VALID** |
| ROTATE + FLIP/INV | beta3->beta7 yes | FLIP(beta3)=beta3 yes | **VALID** |
| MIRROR/INV + SWAP | beta3->beta7 yes | SWAP(beta3)=beta3 yes | **VALID** |

### Key Results

1. **Order matters.** SWAP + MIRROR/INV (valid from alpha1) and MIRROR/INV + SWAP (valid from beta3, not alpha1) are different compositions. NOT interchangeable.
2. **Beta is the universal connector.** All beta positions are SWAP fixed points. beta1/beta5 support MIRROR as outer. beta3/beta7 support FLIP as outer.
3. **ROTATE is always the innermost layer.** Mathematical proof: no L1-L4 position is a 180deg rotation fixed point.
4. **INVERTED is always free.** No positional constraint. Can be added to any outer transform via / without restricting valid starting positions.
5. **Flat detection loses information.** The same component set can correspond to different compositional structures depending on starting position and construction order.`,
  },

  "caps-vs-loops": {
    title: "LOOP Transformation Algebra and CAPs vs LOOPs",
    content: `## LOOP Transformation Algebra

LOOPs use six transformation components that operate on TKA words:

| Transformation | What it does |
|---------------|-------------|
| **Rotated** | Positions continue rotating same direction (180 or 90 degree slices) |
| **Mirrored** | Left-right swap across vertical axis |
| **Flipped** | Top-bottom swap across horizontal axis |
| **Swapped** | Blue<->Red hand roles swap |
| **Inverted** | Pro<->Anti motion types swap |
| **Rewound** | Second half plays in reverse |

These are **composable** (apply mirror then flip = valid new transformation) and **invertible** (each is its own inverse -- mirror twice = original). This makes them a **finite transformation group** satisfying all four group axioms: closure, associativity, identity, and inverses.

"Algebraic" is the precise mathematical term. The LOOP transformations form a group action on the space of TKA words. Austen didn't study group theory; the structure emerged naturally from the design.

### LOOPs vs. CAPs

CAPs (Continuous Assembly Patterns) and LOOPs address the same need -- patterns you can spin forever -- but they are **parallel concepts, not parent/child.**

The deepest difference is the base unit:
- **CAPs** compose per-hand trajectories (define left hand's path, define right hand's path, overlay them)
- **LOOPs** compose per-beat snapshots (one letter = both hands simultaneously, combine letters into words)

LOOPs are **speakable** -- say "DJ" and another person reproduces the movement. CAPs require describing each hand independently.

The six LOOP transformations have no CAP equivalent. Charlie Cushing's 8-Step CAP is a positional exploration strategy. LOOP transformations are algebraic operations on words -- structurally different objects.

**Charlie's full system is not well enough understood** to make detailed comparative claims. His 10-part video series needs transcription before assuming limitations.

**The per-hand model is not "early learning" or "backwards"** -- it's a different cognitive preference. The Assembler tab bridges for people who think per-hand.`,
  },

  "vtg-deep": {
    title: "VTG (Vulcan Tech Gospel) Deep Dive",
    content: `## VTG (Vulcan Tech Gospel) Deep Dive

VTG is an older, widely-adopted notation framework created by Noel Yee and spinners at the Vulcan Lofts in Oakland, CA.

### VTG Formed the Core That TKA Expands

**Type 1 letters were intentionally designed to represent everything VTG covers.** VTG's four timing/direction categories plus "quarter time" are fully encoded in the Type 1 alphabet:

- **A, B, C** (alpha to alpha) = VTG's **split-same** (SS)
- **G, H, I** (beta to beta) = VTG's **tog-same** (TS)
- **D, E, F / J, K, L** (alpha-beta transitions) = VTG's **split-opp** and **tog-opp** territory (varies by variation)
- **M through V** (gamma patterns) = what the community called **"quarter time"** -- a 90-degree phase offset that VTG never formally integrated

"Quarter time" is a misnomer -- it describes a phase relationship, not a timing/duration. No formal VTG name was ever assigned.

### VTG Covers Three Planes

VTG **does** enumerate movement across three planes: **Wall** (W), **wHeel** (H), and **Floor** (F). Extended by Lorq Nichols' 3 Planes System and 324 Patterns framework.

### Lorq Nichols' Influence

Lorq Nichols (Sir Lorq) created the Shape Matrix, Tech Tiles, 324 Patterns, 9 Flower Families, 144 Atomic Hybrids, the Book of P.H.A.T. (with Brian Thompson, David Cantor, and Noel Yee), and the 3 Planes System. His Shape Matrix -- a multiplication table cross-referencing left-hand and right-hand flower patterns -- is conceptually adjacent to TKA's per-beat encoding. Austen took Lorq's class in 2017.

### The Downbeat Reference

VTG is ground-referenced. The "downbeat" (south / bottom of circle) anchors all classifications:
- **Together (tog):** Both props pass through the downbeat simultaneously
- **Split:** Props are 180 degrees out of phase

### The Four VTG Categories

"Same/opposite" refers to **hand path direction** (whether both hands arc the same way), not prop rotation direction.

| VTG Term | Abbreviation | Timing | Hand Path Direction |
|----------|--------------|--------|---------------------|
| Split-Same | SS | Out of phase | Both hands arc same way |
| Together-Same | TS | In sync | Both hands arc same way |
| Split-Opposite | SO | Out of phase | Hands arc opposite ways |
| Together-Opposite | TO | In sync | Hands arc opposite ways |

### VTG Classification: Fixed vs Orientation-Dependent

Letters staying in the same position have fixed VTG timing:
- **A, B, C** (alpha to alpha): always **split-same**
- **G, H, I** (beta to beta): always **tog-same**

Compound letters vary by variation:
- DJ east-start = **split-opp**
- DJ south-start = **tog-opp**

### TKA vs VTG Reference Systems

| Aspect | VTG | TKA |
|--------|-----|-----|
| Reference point | Ground (south/downbeat) | Center of grid |
| Position names | tog = together, split = apart | Alpha = opposite, beta = same |
| Classification | Fixed per pattern | Varies by orientation |

### Teaching Order

VTG starts with tog-same (G, H, I) because it feels grounded for beginners. TKA starts with split-same (A, B, C) because it's first in the systematic organization. Neither is "wrong."

### Per-Hand vs Per-Beat Learning

VTG's per-hand decomposition (define left, then right, then combine) and TKA's per-beat unit (one letter = both hands) are different cognitive preferences. **Neither is "early" or "late," "beginner" or "advanced."** The Assembler tab bridges for per-hand thinkers.`,
  },

  "compound-letters": {
    title: "Compound Letters",
    content: `## Compound Letters

Compound letters are pairs that complete each other to create circular (LOOP) motion. In continuous spinning, you perform compound units, not individual letters.

### Type 1 beta-alpha Compounds (Dual-Shift)

| Compound | Components | Mnemonic | Style |
|----------|------------|----------|-------|
| DJ | D (beta to alpha) + J (alpha to beta) | "Disco Jam" | Pro/Pro (isolation) |
| EK | E (beta to alpha) + K (alpha to beta) | "Exploding Kitten" | Anti/Anti |
| FL | F (beta to alpha) + L (alpha to beta) | "Fruity Loops" | Hybrid (anti/pro) |

### Gamma Internal Compounds (gamma to gamma)

| Compound | Components | Mnemonic |
|----------|------------|----------|
| MP | M + P | "Magic Potion" |
| NQ | N + Q | "Never Quit" |
| OR | O + R | "Open Road" |

### Type 4 Dash Compounds

| Compound | Components |
|----------|------------|
| Phi-Psi | Phi (beta to alpha) + Psi (alpha to beta) -- one hand dashes, one stays static |

### Why Compounds Matter

- D alone is beta to alpha (half a cycle)
- J alone is alpha to beta (half a cycle)
- DJ together = beta to alpha to beta (complete cycle)
- In continuous motion, you're always doing the compound
- **Split/tog timing is vantage-relative.** The same loop reads as split-opp or tog-opp depending on where you start it: split-opp from the alpha-phase start, tog-opp from the beta-phase start. DJ/EK/FL are not intrinsically "split" — that label is just the canonical alpha1 vantage.
- The "beta to alpha" descriptions above are the canonical alpha1 reading. The same loop started elsewhere is the same compound, only described from a different vantage.`,
  },

  "center-relative-orientation": {
    title: "Center-Relative Orientation System",
    content: `## Center-Relative Orientation

**All orientations in TKA are measured from the prop to the performer's center point.** This is not arbitrary -- it makes the entire orientation algebra work.

### Radial and Nonradial Orientations (4)

"Radial" means along the line from prop to center. "Nonradial" means perpendicular to that line.

| Orientation | Type | Meaning |
|-------------|------|---------|
| **in** | Radial | Prop faces toward center |
| **out** | Radial | Prop faces away from center |
| **clock** | Nonradial | Prop faces clockwise (perpendicular to center axis) |
| **counter** | Nonradial | Prop faces counter-clockwise |

### Interradial Orientations (4, L6+)

At 45 degrees between radial and nonradial:
- **clockIn**: between clock and in
- **clockOut**: between clock and out
- **counterIn**: between counter and in
- **counterOut**: between counter and out

### Center Orientations (8, L5+)

For the center point, orientation uses compass directions: centerN, centerNE, centerE, centerSE, centerS, centerSW, centerW, centerNW.

### Why Center-Relative?

When a hand traces a curved arc, the angle from prop to center changes continuously:
- A prop rotating with the arc maintains constant center angle = **preserves orientation** (pro at 0 turns)
- A prop rotating against the arc reverses center angle = **reverses orientation** (anti at 0 turns)
- A prop holding fixed spatial angle sees center angle change = **changes orientation** (float)

**TERMINOLOGY NOTE:** Do not confuse these coordinate systems:
- **Cardinal / Intercardinal** = grid point LOCATIONS (N/E/S/W vs NE/SE/SW/NW)
- **Radial / Nonradial / Interradial** = prop ORIENTATIONS relative to center`,
  },

  "elemental-model": {
    title: "The 6-Element Model",
    content: `## The 6-Element Model

The Elemental Model maps VTG's timing/direction categories to classical elements, giving each category an intuitive name and visual quality. The original four elements were popularized by Leonardo Icaza (@poidanceflow, Vancouver BC) and taught in video form by Ronan McLoughlin. Austen Cloud expanded the framework with two additional elements (Sun and Moon) to cover the gamma/"quarter time" patterns that VTG never formally classified.

### The Six Elements

| Element | Symbol | Timing | Direction | VTG Term | TKA Letters | Visual Quality |
|---------|--------|--------|-----------|----------|-------------|----------------|
| **Earth** | 🜃 | Together | Same | Tog-Same | G, H, I (beta to beta) | Solid, grounded |
| **Water** | 🜄 | Split | Same | Split-Same | A, B, C (alpha to alpha) | Flowing |
| **Sun** | ☀ | Quarter | Same | -- | S, T, U, V (gamma same-dir) | Constant rotation |
| **Air** | 🜁 | Together | Opposite | Tog-Opp | DJ, EK, FL variations | Light, open |
| **Fire** | 🜂 | Split | Opposite | Split-Opp | DJ, EK, FL variations | Chaotic |
| **Moon** | ☽ | Quarter | Opposite | -- | MP, NQ, OR compounds | Opens and closes |

### Why Sun and Moon

**Sun** = quarter time, same direction. Both hands arc the same way through a 90-degree offset. Constant, even, always the same amount of rotation -- like the sun always shining.

**Moon** = quarter time, opposite direction. Hands arc opposite ways through the 90-degree offset. In diamond mode, this creates a visual opening and closing -- like lunar phases waxing and waning. The MP/NQ/OR compounds bloom open and contract shut.

DJ/EK/FL compounds also exhibit an open/close quality. Type 2 and Type 3 letters also involve opening and closing depending on whether they transition into alpha, beta, or gamma.

### Grid-Mode Dependency

**The elemental classification is not a fixed property of a letter. It is a function of letter + grid mode.**

Same-direction elements are invariant -- they look and feel the same regardless of grid rotation:
- **Earth** (tog-same): both hands together, both arcing same way. Doesn't matter if beta is at a cardinal or intercardinal point.
- **Water** (split-same): both hands opposite, both arcing same way. Alpha at N/S or NE/SW -- still flows.
- **Sun** (quarter-same): both hands at 90 degrees, both arcing same way. Gamma on diamond or box -- still constant.

Opposite-direction elements permute with grid mode:
- **Air** and **Fire** (tog-opp, split-opp): In diamond mode, DJ/EK/FL compounds can be Air or Fire depending on variation. In box mode, they reclassify as **Moon** because the diagonal alpha positions create an opening/closing quality.
- **Moon** (quarter-opp): In diamond mode, MP/NQ/OR compounds are Moon. In box mode, they reclassify as **Air or Fire** -- the same ambiguous pair that DJ/EK/FL occupy in diamond mode.

### The Invariance Rule

| Element | Direction | Grid-mode invariant? |
|---------|-----------|---------------------|
| Earth | Same | Yes |
| Water | Same | Yes |
| Sun | Same | Yes |
| Air | Opposite | No -- swaps with Moon in box mode |
| Fire | Opposite | No -- swaps with Moon in box mode |
| Moon | Opposite | No -- becomes Air/Fire in box mode |

Three stable elements. Three that permute with grid rotation. The same-direction triad holds its identity everywhere. The opposite-direction triad is context-dependent. The element is an emergent property of the geometry, not a label stamped on the letter.

### Attribution

- **Leonardo Icaza** (@poidanceflow): Popularized the 4-element mapping of VTG categories. Coined "body tracer" and defined horizontal stacking for poi. Teaching primarily via Instagram and in-person workshops. Based in Vancouver, BC. Featured in "The Art of Flow" (2012 documentary).
- **Ronan McLoughlin**: Created "The 4 Elements of Timing and Direction" YouTube video that teaches the framework systematically.
- **Austen Cloud**: Added Sun and Moon to cover gamma patterns, identified the grid-mode dependency rule.`,
  },

  "motion-types-complete": {
    title: "Motion Types (Complete Reference)",
    content: `## Motion Types (Complete Reference)

### Shift Motion Types (curved arc required)

| Type | Behavior | Turn count |
|------|----------|------------|
| **Pro** | Rotates with the arc direction | 0, 1, 2, 3, ... |
| **Anti** | Rotates against the arc direction | 0, 1, 2, 3, ... |
| **Float** | Holds absolute spatial angle | N/A |

Pro and anti are defined relative to the arc ("with" and "against"). They are NOT absolute CW/CCW -- the same pro motion at different grid positions rotates different absolute directions.

**Float** is absence of prop rotation in absolute spatial terms. The center-relative orientation CHANGES because the hand traces a curve. Float has no turn count -- it is a single binary state. No "degrees of float." Negative turns do not exist.

**Float only applies to shifts** because it requires a curved hand path. Without a curve, there is no distinction between float and 0-turn static.

### Non-Shift Motion Types (straight line or stationary)

| Type | Behavior | Turn count |
|------|----------|------------|
| **Dash** | Prop rotates during straight-line traverse to opposite point | 0, 1, 2, 3, ... |
| **Hash** (dash-) | Prop rotates during straight-line traverse to/from center | 0, 1, 2, 3, ... |
| **Static** | Prop rotates in place (hand doesn't move) | 0, 1, 2, 3, ... |

At 0 turns: no rotation, no direction (1 state).
At 1+ turns: CW or CCW direction (2 states per turn count).

Hash is dash with a **-** modifier -- same rotation physics, shorter distance.

### Skews (L5+ only, 8-point grid)

Shifts can traverse arcs longer or shorter than standard:
- **Skew+** (shift+): Extended arc (e.g., S to NE, spanning 3 segments)
- **Skew-** (shift-): Shortened arc (less than one standard segment)

Skews support all three shift motion types (pro, anti, float). Theoretically unbounded in arc length.

**CHU:** A skew++ (double-extended arc) with float has been identified as a distinct phenomenon. TKA does NOT give it a separate motion type -- it is expressible as an extended-arc float shift within the existing framework. The decision not to add a 6th motion type was deliberate: CHU is a specific combination of existing parameters, not a fundamentally new behavior.`,
  },

  "stuv-anomaly": {
    title: "The STUV Anomaly: Why Quarter-Same Has 4 Letters",
    content: PRECISE_QUARTER_SAME_EXPLANATION,
  },

  "l1-quartered-loop-deck": {
    title: "The Level 1 Quartered Rotated LOOP Deck: Why 64",
    content: `## The Level 1 Quartered Rotated LOOP Deck: Why 64

### The Result

Under the constraints Level 1 (0 turns), Diamond grid, Continuous rotation, Quartered Rotated LOOP, and starting from one of three canonical positions (alpha1, beta5, gamma11), there are exactly **64 valid 8-beat sequences per starting position** -- 192 total.

This is remarkable because:
- Alpha has 13 available first-beat letters
- Beta has 13 available first-beat letters
- Gamma has 21 available first-beat letters

Despite wildly different letter pools, the LOOP constraint produces **identical counts**. The three position families are combinatorially isomorphic.

### How Quartered Rotation Constrains

A quartered rotated LOOP divides 8 beats into 4 quarters of 2 beats each:
- **Q1 (beats 1-2):** Freely chosen seed
- **Q2 (beats 3-4):** Q1 rotated 90° on the grid
- **Q3 (beats 5-6):** Q1 rotated 180°
- **Q4 (beats 7-8):** Q1 rotated 270°

90° rotation preserves the letter -- only grid positions and hand locations change. So the 8-beat word is the 2-beat seed repeated 4 times: seed AB becomes ABABABAB.

For the LOOP to close, the seed's end position must equal rotatePos90(start). This is the key constraint that limits the space from billions of unconstrained paths down to 64.

### The 10 Hand-Path Families

The 64 sequences decompose into 10 families based on the type pairing of beat 1 and beat 2:

| Family | Beat 1 | Beat 2 | Count | Why |
|--------|--------|--------|-------|-----|
| Dual-Shift + Dash | Type 1 | Type 4 | 8 | 4 letter variants × 2 dash hand assignments |
| Dual-Shift + Dual-Dash | Type 1 | Type 5 | 4 | 4 letter variants × 1 (symmetric) |
| Dual-Shift + Static | Type 1 | Type 6 | 4 | 4 letter variants × 1 (symmetric) |
| Shift + Shift | Type 2 | Type 2 | 8 | 2 letters × 2 letters × 2 hand configs |
| Shift + Cross-Shift | Type 2 | Type 3 | 8 | 2 × 2 × 2 |
| Cross-Shift + Shift | Type 3 | Type 2 | 8 | 2 × 2 × 2 |
| Cross-Shift + Cross-Shift | Type 3 | Type 3 | 8 | 2 × 2 × 2 |
| Dash + Dual-Shift | Type 4 | Type 1 | 8 | 2 dash hand assignments × 4 letter variants |
| Dual-Dash + Dual-Shift | Type 5 | Type 1 | 4 | 1 × 4 |
| Static + Dual-Shift | Type 6 | Type 1 | 4 | 1 × 4 |

Total: 8 + 4 + 4 + 8 + 8 + 8 + 8 + 8 + 4 + 4 = **64**

### Why the Count is Position-Invariant

Each position family (alpha, beta, gamma) contains structurally isomorphic letter sets:

| Role | Alpha1 | Beta5 | Gamma11 |
|------|--------|-------|---------|
| Type 1 same-direction | A, B, C (split-same) | G, H, I (tog-same) | S, T, U, V (quarter-same) |
| Type 1 opp-direction | J, K, L (split-opp) | D, E, F (tog-opp) | M, N, O, P, Q, R (quarter-opp) |
| Type 2 (shift) | Σ, Δ | Θ, Ω | W, X, Y, Z |
| Type 3 (cross-shift) | Θ-, Ω- | Σ-, Δ- | W-, X-, Y-, Z- |
| Type 4 (dash) | Ψ | Φ | Λ |
| Type 5 (dual-dash) | Φ- | Ψ- | Λ- |
| Type 6 (static) | α | β | γ |

Despite gamma11 having more individual letters (21 vs 13), the combinatorial structure is identical:
- 4 "letter variants" in Type 1 per direction (pro/pro, anti/anti, and 2 hybrid arrangements)
- 2 pro/anti variants per Type 2 and Type 3 letter
- 1 dash letter with 2 hand-assignment variants
- 1 dual-dash and 1 static (symmetric, no hand-assignment variation)

The STUV anomaly (quarter-same having 4 letters instead of 3) and the larger Type 2/3 pools at gamma are absorbed: the LOOP constraint sees only the motion-type structure, not the letter count.

### The Asymmetry Absorption Principle

This result demonstrates a deep structural property: **the STUV anomaly and gamma's asymmetric letter pools do not propagate into LOOP-level combinatorics.** The quartered rotation constraint acts as a symmetry equalizer.

Groups of 3 vs 4 in the alphabet? Irrelevant at the LOOP level. Different position types with different letter counts? The LOOP sees through to the underlying motion-type algebra, which is isomorphic across all three.

64 = the number of distinct ways to pair two consecutive motion configurations on a 4-point grid such that 90° rotation closes the loop. This number is a property of the grid geometry and the motion-type system, not of the specific letters.

### Practical Application: The First Deck

These 192 sequences (64 × 3 starting positions) form the complete **Level 1 Quartered Rotated LOOP Deck** -- the most accessible set of 8-beat circular sequences in TKA. Every sequence:
- Uses 0 turns (Level 1)
- Maintains continuous rotation (no reversals)
- Has 4-fold rotational symmetry
- Loops back to its starting position
- Is fully determined by a 2-beat seed`,
  },

  "symmetry-invariance": {
    title: "The Symmetry Invariance Principle",
    content: `## The Symmetry Invariance Principle

### The Design Rule

A foundational principle of TKA: **a pictograph represents the same letter under three transformations:**

1. **Rotation** -- Spin the pictograph card. The letter is defined by relationships between hands, not absolute positions.
2. **Reflection** -- Mirror the pictograph. Spatial relationships are preserved.
3. **Color swap** -- Swap red and blue (swap which hand is which). If the two hands have equivalent roles, this produces the same letter.

This principle drove the entire letter enumeration. A "unique letter" is an equivalence class under these three operations.

### Why It Works (Most of the Time)

For **symmetric positions** (alpha: hands opposite, beta: hands together), color swap always produces an equivalent arrangement. If both hands are at opposite points and you swap which hand is where, you get the same spatial relationship. The letter is unchanged.

For **opposite-direction movement** in any position, color swap produces the mirror image, which is already covered by the reflection invariance.

### Where It Breaks

**Same-direction movement in asymmetric positions** (gamma, zeta, eta). When hands are 90 degrees apart and both move the same way, one hand leads and the other follows. Swapping colors swaps who leads. For pure motion types (both pro or both anti), the resulting movement is geometrically equivalent. But for **hybrid** motion types (one pro, one anti), swapping colors changes which motion type leads, producing a genuinely different movement.

This is why the quarter-same group (S, T, U, V) has 4 letters instead of 3. See the "stuv-anomaly" topic for the full explanation.

### Practical Impact

The symmetry principle means:
- Sequence images can be rotated/flipped for display without losing meaning
- Color assignment (which hand is red vs blue) is arbitrary for most letters
- The total letter count is minimized -- without this principle, there would be redundant letters for every spatial rotation
- The exceptions (STUV) are well-defined and mathematically motivated`,
  },

  "glyph-anatomy": {
    title: "Glyph Anatomy: PADS, Slots, Dots, and Turn Notation",
    content: `## Glyph Anatomy: PADS, Slots, Dots, and Turn Notation

A **glyph** is a letter combined with other characters — numbers, dots, or modifiers — that together describe a single pictograph's motion parameters. The Level 2 Guide formalizes the glyph's anatomy and the rules for assembling it. This topic covers how each element works and how the TKA software represents them.

### The Turns Column: High Slot and Low Slot

To the right of each letter, a TKA glyph has two stacked slots:

- **High slot** (upper): holds the turn number for one of the two hands
- **Low slot** (lower): holds the turn number for the other hand

These two slots contain numbers (or the string \`fl\` for float) that indicate how many additional turns each hand receives. Which hand occupies which slot is determined by **PADS**.

### PADS: The Priority Order

**PADS = Pro, Anti, Dash, Static.** This is the priority order that assigns motions to slots when the two hands have different motion types. The motion higher on the PADS list goes in the high slot; the motion lower goes in the low slot.

| Letter type | Example letters | High slot | Low slot |
|---|---|---|---|
| Type 1 pro/anti hybrid | C, F, I, L, O, R, U, V | Pro | Anti |
| Type 2 (shift + static) | W, X, Y, Z, Σ, Δ, θ, Ω | Shift | Static |
| Type 3 (shift + dash) | W-, X-, Y-, Z-, Σ-, Δ-, θ-, Ω- | Shift | Dash |
| Type 4 (dash + static) | Φ, Ψ, Λ | Dash | Static |

**When motion types match** (A, B, D, E, G, H, J, K, M, N, P, Q plus the dual-dashes Φ-, Ψ-, Λ- and statics α, β, Γ), PADS doesn't disambiguate because both hands have the same type. The convention is **left hand goes high, right hand goes low**.

**S and T are exceptions** to the matching-type rule. Even though both of their hands share a motion type (pro|pro or anti|anti), they have a leader/follower asymmetry. For S and T, **leading goes high, following goes low** — this is how their base forms are disambiguated in the glyph.

**U and V** have a leader/follower too — U's leader has pro rotation, V's leader has anti rotation. But because their motion types differ (pro|anti hybrid), the glyph slots follow the standard PADS rule (pro high, anti low) rather than leading/following.

In the codebase, PADS is not stored as an explicit priority list — the priority is implicit in per-letter-type case branches in \`src/lib/shared/pictograph/tka-glyph/services/implementations/TurnColorInterpreter.ts\` and \`src/lib/shared/pictograph/arrow/positioning/placement/services/implementations/TurnsTupleGenerator.ts\`.

### Rotational Relationship: Same-Dot and Opp-Dot

When **both** hands are rotating in a single beat (not just one), their rotation directions form either a **Same** or **Opp** relationship relative to each other. This is the **rotational relationship**, and the glyph notates it with a dot:

- **Same-dot** (above the letter): both props rotate in the same direction — spoken "[Letter]-Same"
- **Opp-dot** (below the letter): props rotate in opposite directions — spoken "[Letter]-Opp"

Rotational relationship **only applies when both props rotate**. Pictographs with only one rotating prop have nothing to describe. Φ(1,0) — only the dash rotates — has no dot.

Rotational relationship applies to Type 2, Type 3, Type 4, Type 5, and Type 6 pictographs (whenever both hands rotate). It does **not** apply to Lambda (Λ, Λ-) or Gamma (Γ), which use opening/closing instead.

In the codebase, rotational relationship is derived at render time by comparing \`blueMotion.rotationDirection\` to \`redMotion.rotationDirection\` (see \`TurnsTupleGenerator.ts\` lines ~192-248 for Type 2, ~448-452 for Type 5, ~551-555 for Type 6). It is not a stored field on \`MotionData\`. The visual dot is rendered by \`src/lib/shared/pictograph/tka-glyph/components/DirectionDot.svelte\`.

### Opening and Closing: The Lambda/Gamma Exception

Lambda (Λ), Lambda-Dash (Λ-), and Gamma (Γ) use **opening/closing** instead of same/opp. This is not an additional modifier alongside rotational relationship — it **replaces** it for these letters.

The reason: gamma's right-angle position is geometrically asymmetric in a way alpha and beta are not. The same-direction vs opposite-direction distinction collapses here; rotation direction combined with the asymmetric geometry produces variants that cannot be captured by same/opp.

**Opening** means: if the rotating hand's trajectory were extrapolated into a subsequent pro-shift, the motion would resolve toward an **alpha** position (hands at opposite grid points — spatially "open").

**Closing** means: extrapolating the trajectory would resolve toward a **beta** position (hands at the same point — spatially "closed").

Opening/closing is **per-hand**. Each rotating prop gets its own op/cl designation. A Λ- with both hands rotating can be:
- Both opening: \`Λ-(1,1,op,op)\`
- Blue closing, red opening: \`Λ-(1,1,cl,op)\`
- Blue opening, red closing: \`Λ-(1,1,op,cl)\`
- Both closing: \`Λ-(1,1,cl,cl)\`

All four are distinct pictographs. **No rotation, reflection, or mirror** can transform any of them into another — which is the core TKA invariant that makes the disambiguation necessary. (Every unique pictograph must have its own unambiguous description; no pictograph can be equivalent to a different-letter pictograph under a symmetry operation.)

When only one hand rotates (e.g., Λ(0,1) with a 1-turn static and base dash), only that rotating hand gets an op/cl flag: \`Λ(0,1,op)\`. The non-rotating hand has no trajectory to extrapolate.

In the codebase, opening/closing is **computed at placement-key-generation time**, not stored. The rule is encoded in hard-coded lookup tables keyed by \`\${endLocation}|\${otherHandEndLocation}|\${rotationDirection}\` in \`src/lib/shared/pictograph/arrow/positioning/placement/services/implementations/PropRotationStateTracker.ts\` (see \`blueRotationMap\`, \`redRotationMap\`, \`dashRotationMap\`, \`staticRotationMap\` around lines 110-375). The \`TurnsTupleGenerator\` calls into this tracker for Lambda, Λ-, and Γ generation (lines ~307-630).

### Turn Notation: Written Forms

TKA has several ways to write a turn-annotated letter:

**Canonical parenthetical form** — used in software, code, and any context requiring fractional or float values:
- \`C(1,0)\` = letter C with 1 turn on the high-slot motion (pro) and 0 on the low-slot motion (anti)
- \`C(0,1)\` = a **different** pictograph where the turn is on the anti motion (not a mirror — pro and anti are different motions, so moving the turn between slots changes what's actually rotating)
- \`W(s,0,1)\` = W with same-dot, 0 turns on shift, 1 on static
- \`Ω-(o,1,1)\` = Omega-Dash with opp-dot, 1 turn on each hand
- \`Λ(0,1,op)\` = Lambda with 0-turn dash, 1-turn opening static
- \`Λ-(1,1,op,cl)\` = Lambda-Dash with blue opening, red closing (positional: two turn values then two op/cl flags in the same hand order as the turns)

**Type 3 letters** (W-, X-, Y-, Z-, Σ-, Δ-, θ-, Ω-) have the dash as part of the letter itself — \`Z-\` is its own letter, spoken "Z-Dash". The parenthetical parameters follow the full letter: \`Z-(s,0,1)\`.

**Unicode shorthand (print only):** for whole integer turns, the Level 2 Guide's printed books use superscripts and subscripts — \`C¹\` = \`C(1,0)\`, \`C₁\` = \`C(0,1)\`. This form cannot encode \`fl\` or fractional values like \`0.5\`, so it does not generalize to software or higher levels. The parenthetical form is canonical.

**Greek letter ASCII shorthand:** in source code, the greek letters are often typed as their first three letters — \`sig\`, \`del\`, \`the\`, \`om\`, \`phi\`, \`psi\`, \`lam\` — and a rendering pass substitutes the Unicode glyph. Example: \`phi(0,1)\`.

### Spoken Forms

Glyphs read aloud incorporate every modifier. The Level 2 Guide's spoken conventions:

- \`C(1,0)\`: "C-High-One"
- \`C(0,1)\`: "C-Low-One"
- \`W(s,0,1)\`: "W-Same-Low-One"
- \`W(o,1,0)\`: "W-Opp-High-One"
- \`Λ(0,1,cl)\`: "Lam-Low-One-Closing"
- \`Z-(o,0,1)\`: "Z-Dash-Opp-Low-One"

In casual conversation or when talking about a sequence at a high level, you can drop the modifiers and just refer to the base letter: "Lam" instead of "Lam-Low-One-Closing." The Level 2 Guide explicitly sanctions this shorthand.

### Software Placement

The Level 2 Guide notes: *"TKA software now handles the placement of these numbers, so it's less important that you learn this. Don't sweat it. Focus on the motions."* The glyph's turn-column anatomy is implemented in:

- \`src/lib/shared/pictograph/tka-glyph/components/TurnsColumn.svelte\` — renders the two slots
- \`src/lib/shared/pictograph/tka-glyph/services/implementations/TurnColorInterpreter.ts\` — assigns hands to slots per PADS
- \`src/lib/shared/pictograph/tka-glyph/components/DirectionDot.svelte\` — renders the same/opp dot
- \`src/lib/shared/pictograph/arrow/positioning/placement/services/implementations/TurnsTupleGenerator.ts\` — serializes the full turn tuple (including op/cl for Lambda/Gamma) used as a placement lookup key
- \`src/lib/shared/pictograph/arrow/positioning/placement/services/implementations/PropRotationStateTracker.ts\` — the op/cl lookup tables
- \`src/lib/shared/pictograph/tka-glyph/utils/turn-tuple-parser.ts\` — parses generated tuples (note: currently truncates Lambda/Gamma 4- and 5-part forms, though placement lookups bypass the parser and use the raw string)

### Sources

- Austen Cloud, *The Kinetic Alphabet*, Level 2 Guide (Glyphs / PADS section)
- ADR 003: Level-1-Base Float Classification (\`docs/adr/003-level-1-base-float-classification.md\`)`,
  },
};

/** Get list of all available topic keys with their titles. */
export function listDomainTopics(): Array<{ key: string; title: string }> {
  return Object.entries(DOMAIN_TOPICS).map(([key, { title }]) => ({
    key,
    title,
  }));
}

/** Fuzzy-match a topic by key or natural language query. */
export function findDomainTopic(
  query: string
): { key: string; title: string; content: string } | null {
  const normalized = query.toLowerCase().trim();

  // Exact key match
  if (DOMAIN_TOPICS[normalized]) {
    const topic = DOMAIN_TOPICS[normalized];
    return { key: normalized, title: topic.title, content: topic.content };
  }

  // Substring match on keys
  for (const [key, topic] of Object.entries(DOMAIN_TOPICS)) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return { key, title: topic.title, content: topic.content };
    }
  }

  // Substring match on titles
  for (const [key, topic] of Object.entries(DOMAIN_TOPICS)) {
    if (topic.title.toLowerCase().includes(normalized)) {
      return { key, title: topic.title, content: topic.content };
    }
  }

  // Word overlap scoring
  const queryWords = normalized.split(/[\s\-_]+/).filter((w) => w.length > 2);
  let bestMatch: { key: string; score: number } | null = null;

  for (const [key, topic] of Object.entries(DOMAIN_TOPICS)) {
    const targetWords = `${key} ${topic.title}`
      .toLowerCase()
      .split(/[\s\-_]+/)
      .filter((w) => w.length > 2);
    let score = 0;
    for (const qw of queryWords) {
      for (const tw of targetWords) {
        if (tw.includes(qw) || qw.includes(tw)) score++;
      }
    }
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { key, score };
    }
  }

  if (bestMatch) {
    const topic = DOMAIN_TOPICS[bestMatch.key];
    return {
      key: bestMatch.key,
      title: topic.title,
      content: topic.content,
    };
  }

  return null;
}
