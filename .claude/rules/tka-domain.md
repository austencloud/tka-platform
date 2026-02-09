# TKA Domain Knowledge

## What TKA Is

TKA (The Kinetic Alphabet) is a notation system for two-handed prop manipulation. It is **prop-agnostic** — it describes hand positions and prop rotation behaviors that apply regardless of what prop is being used. Do not describe TKA as being "for poi" or any specific prop type.

---

## The 6 Letter Types

| Type | Name | Description | Letters |
|------|------|-------------|---------|
| 1 | Dual-Shift | Both hands shift | A-V (22 letters) |
| 2 | Shift | One shifts, one static | W, X, Y, Z, &Sigma;, &Delta;, &Theta;, &Omega; |
| 3 | Cross-Shift | One shifts + one dashes | W-, X-, Y-, Z-, &Sigma;-, &Delta;-, &Theta;-, &Omega;- |
| 4 | Dash | One dashes, one static | &Phi;, &Psi;, &Lambda;, &tau;- |
| 5 | Dual-Dash | Both hands dash | &Phi;-, &Psi;-, &Lambda;- |
| 6 | Static | Both hands stationary | &alpha;, &beta;, &gamma;, &zeta;, &eta;, &tau;, ⊕ |

### CRITICAL: Motion Type Precision

**NEVER say "both hands move" as the distinguishing feature of Type 1.**

Multiple types have both hands moving:
- Type 1: Both hands **shift** (adjacent movement)
- Type 3: Both hands move (one shifts, one dashes)
- Type 5: Both hands **dash** (opposite movement)

What makes Type 1 unique is that both hands **shift** - not that both move. Always use the specific motion type (shift vs dash vs static).

---

## CRITICAL: The "-" Suffix Convention

**When a user says "[Letter] dash", they mean the Type 3 letter with "-" suffix.**

| User Says | They Mean | Type |
|-----------|-----------|------|
| "Sigma dash" | &Sigma;- | Type 3 |
| "W dash" | W- | Type 3 |
| "Phi dash" | &Phi;- | Type 5 |
| "Tau dash" | &tau;- | Type 4 |

The "-" suffix does NOT mean "letter with dash motion type". It's a naming convention for Type 3 (Cross-Shift), Type 4 (Dash), and Type 5 (Dual-Dash) letters.

**Note:** &tau;- is Type 4 (one dashes, one static) where the static hand is at center. It has no Type 5 (dual-dash) variant because a hand at center cannot perform a standard dash (no "opposite" of center exists).

---

## MCP Server Tools

### CRITICAL: Just Generate. No Pre-Checks.

**When a user asks for a sequence, call `generate_sequence` IMMEDIATELY.**

```
generate_sequence(word: "SMACKDOWN")  // Just do it
```

Do NOT call `analyze_word_feasibility` first. The generator handles everything:
- Bridge letters are auto-inserted for impossible transitions
- Constraints are applied with best-effort
- If it fails after 100 attempts, retry with `maxAttempts: 500`

**DO NOT:**
- Pre-check feasibility
- Warn about bridge letters
- Suggest alternative words
- Hesitate or ask if the user is sure

**DO:**
- Generate immediately (default 500 attempts handles complex words)
- Only use `analyze_word_feasibility` for debugging if generation truly fails

### Primary Tools

- **`generate_sequence`** - Generate and open choreo card in viewer (~50 tokens) - **DEFAULT CHOICE**
- **`generate_pictograph`** - Generate and open single pictograph in viewer (~50 tokens)

### Data Tools (when Claude needs to analyze without showing)

- **`get_sequence_data`** - Sequence step data without image
- **`get_pictograph_data`** - Raw motion data without image

### Reference Tools

- **`list_available_letters`** - All letters organized by type
- **`get_alphabet_info`** - Comprehensive domain reference
- **`list_letter_variations`** - Variations for a specific letter
- **`get_letter_explanation`** - Detailed explanation for teaching
- **`analyze_word_feasibility`** - Check constraint feasibility (rarely needed - constraints are checked inline)

**If unsure about a letter**, call `list_available_letters` first.

---

## Grid System

**Grid Locations** - The 9 points where hands can be placed:
- Cardinal (4): n (north), e (east), s (south), w (west)
- Intercardinal (4): ne, se, sw, nw
- Center (1): The center point (introduced in Level 5)

**Grid Modes:**
- **Diamond**: Hands on cardinal points
- **Box**: Hands on intercardinal points
- **Skewed**: One hand cardinal, one intercardinal (mixing grid systems)
- **Centric**: At least one hand at center (Level 5 - not yet implemented)

**Adjacency:** On both 4-point and 8-point grids, each perimeter point has exactly 2 adjacent neighbors (CW and CCW along the perimeter). On a 4-point grid, the opposite point is 1 (reachable via dash). On an 8-point grid, there are 6 non-opposite, non-self perimeter points reachable via shift arcs of varying length.

---

## Hand Paths

A hand path describes the trajectory of the hand from one grid point to another. The geometric shape of the path (curved vs straight) determines which rotation types are available.

There are **three fundamental hand path families**, distinguished by geometry:

| Family | Geometry | Base path | Modifiers |
|--------|----------|-----------|-----------|
| **Static** | No movement | Stay at current point | — |
| **Shift** | Curved arc | Arc to adjacent perimeter point | +/- (skew) |
| **Dash** | Straight line | Straight to opposite perimeter point | +/- (extended/shortened) |

**The geometric distinction matters:** Shifts follow curved arcs around the grid. Dashes follow straight lines through the grid. This determines whether pro/anti/float distinctions exist (they require a curve to define "with" vs "against").

### The +/- Path Modifier System

Both shifts and dashes support **path length modifiers** that extend or shorten the standard path. These are displayed per-hand in the turns column of the TKA glyph, alongside the turn count.

**For shifts (L4+, 8-point grid):**

| Modifier | Name | Path |
|----------|------|------|
| (none) | Standard shift | Arc to adjacent point (1 segment) |
| + | Skew+ | Extended arc (e.g., S→NE, 3 segments) |
| - | Skew- | Shortened arc (less than 1 segment) |
| ++ | Skew++ | Double-extended arc |

**For dashes (L5+/L6+):**

| Modifier | Name | Path | Level |
|----------|------|------|-------|
| (none) | Standard dash | Perimeter → opposite perimeter | L1+ |
| - | Dash- | Perimeter → center (or center → perimeter) | L5+ |
| + | Dash+ | Perimeter → center of *other* grid | L6+ |
| ++ | Dash++ | Perimeter → opposite perimeter of *other* grid | L6+ |

**Dash- is called "hash"** — a shortened dash to/from center instead of to the opposite perimeter point. Same geometry, same rotation rules, half the distance. "Hash" is the official name for dash-, just as "skew" is the official name for shift+/-.

### Why Three Families, Not Five

Dash and "hash" share identical physics: straight-line trajectory, 0 turns = no rotation (1 state), 1+ turns = CW/CCW (2 states per turn count). They differ only in distance. The +/- modifier captures this cleanly without creating a separate hand path type. Similarly, skew+/- are not separate hand paths from shift — they're length variants of the same curved-arc family.

This means the letter type system classifies by **hand path family** (shift, dash, static), and the +/- modifier is a per-hand parameter stored in variation data:

| Type | Combination | Includes |
|------|------------|----------|
| 1 | shift + shift | Standard shifts, skew+/- variants |
| 2 | shift + static | |
| 3 | shift + dash | shift + dash, shift + dash-, shift + dash+ |
| 4 | dash + static | dash + static, dash- + static |
| 5 | dash + dash | dash + dash, **dash + dash-**, dash- + dash- |
| 6 | static + static | |

### Extended Dashes (L6+, conjoined grids — DESIGN PHASE)

When two grids share a junction point (Level 6), new straight-line paths emerge that cross the grid boundary. These use the same +/- modifier system as shifts and L5 dashes:

**Key properties:**

- **Still geometrically straight lines.** Dash+/++ follow straight-line trajectories through the junction, not curved arcs. This means they follow dash rotation rules, not shift rules.
- **0 turns = 1 directionless state.** Same as standard dash — no arc means no pro/anti distinction at base rotation.
- **1+ turns = CW/CCW.** Same rotation behavior as any straight-line path.
- **Letter classification unchanged.** A dash+ or dash++ is still a "dash" for letter type purposes. One hand doing dash++ while the other shifts = Type 3 (Cross-Shift). Both hands doing dash++ = Type 5 (Dual-Dash). The existing letter set covers these — no new letters needed.

**What doesn't exist pre-L6:** Standard dashes only reach the opposite point on the same grid. There's nowhere for a straight line to go beyond that. The second grid creates new destinations that happen to be reachable via straight-line paths through the junction.

**Dash- vs Dash+:** Dash- (L5) goes to the center of the *same* grid. Dash+ (L6) goes to the center of the *other* grid. Both are straight-line paths to a center point — one local, one remote.

**Open questions (to resolve before implementation):**
1. Grid location addressing — how to distinguish "east on Grid A" from "east on Grid B" in the data model
2. Which specific cross-grid straight lines are valid (depends on grid arrangement and junction geometry)
3. Orientation reference point — which grid's center defines "center-relative" for a cross-grid motion?

---

## The Base Rotation Principle

**Turn counts in TKA measure ADDITIONAL rotation on top of an inherent base rotation.** This is the most commonly misunderstood concept.

Every motion has a **base rotation** — the natural prop behavior during the hand path at 0 additional turns:

**For shifts (curved arcs):** The arc itself causes center-relative angular change. The prop's relationship to the center changes as the hand moves along the curve. At 0 turns:
- **Pro base:** Prop rotates with the arc. Center-relative orientation is preserved.
- **Anti base:** Prop rotates against the arc. Center-relative orientation reverses.

This means 0-turn pro and 0-turn anti are two DIFFERENT states for shifts, even though "0 turns" sounds like "no rotation." The prop IS rotating in both cases — it's just rotating at the base rate with zero additional turns.

**For dashes, hashes, and statics (straight lines or no movement):** There is no arc, so base rotation at 0 turns means truly no rotation. The prop translates along the line (or stays put) without spinning. This is why 0 turns for these motion types produces exactly 1 state (no rotation = no direction to speak of). Hash follows identical rotation physics to dash — the +/- modifier changes distance, not behavior.

### Why This Matters

| Motion | 0 turns | States |
|--------|---------|--------|
| Shift (incl. skews) | Pro base OR anti base (two distinct behaviors) | 2 |
| Dash (incl. hash) | No rotation (one behavior) | 1 |
| Static | No rotation (one behavior) | 1 |

Adding 1+ turns to any motion type introduces CW/CCW direction (2 states per turn count).

### Turn Unit: 1 Turn = 180° Additional Rotation

TKA defines 1 turn as 180° of additional prop rotation beyond base behavior. This is a deliberate pedagogical choice:

- If 1 turn = 360°, quarter turns (Level 7) would be 1/8 turns — fractional chaos
- If 1 turn = 90°, Level 2 would need 6 turn values (0-6) instead of the clean 0-3
- At 180°, the math stays clean at every level: whole turns 0-3 are small integers, half turns (90°) produce cardinal orientation shifts, and quarter turns (45°) produce interradial orientations

This also makes the orientation parity rules intuitive: each additional turn (180°) flips orientation once, so even turns preserve and odd turns reverse.

---

## Motion Types (Complete)

### Shift Motion Types (curved arc required)

| Type | Behavior | Turn count |
|------|----------|------------|
| **Pro** | Rotates with the arc direction | 0, 1, 2, 3, ... |
| **Anti** | Rotates against the arc direction | 0, 1, 2, 3, ... |
| **Float** | Holds absolute spatial angle (no rotation in world space) | N/A |

Pro and anti are defined relative to the arc: "with" and "against" the hand's curved path. They are NOT absolute CW/CCW — the same pro motion at different grid positions rotates different absolute directions.

**Float** is the absence of prop rotation in absolute spatial terms. Because the hand is moving along a curve, the center-relative orientation CHANGES even though the prop itself holds still in space. Float has no turn count. It is a single binary state. There are no "degrees of float" and negative turns do not exist.

**Float only applies to shifts** because it requires a curved hand path. Without a curve, there is no distinction between float and 0-turn static — the prop isn't rotating either way.

### Non-Shift Motion Types (straight line or stationary)

| Type | Behavior | Turn count |
|------|----------|------------|
| **Dash** | Prop rotates during straight-line traverse to opposite point | 0, 1, 2, 3, ... |
| **Hash** (dash-) | Prop rotates during straight-line traverse to/from center | 0, 1, 2, 3, ... |
| **Static** | Prop rotates in place (hand doesn't move) | 0, 1, 2, 3, ... |

At 0 turns: no rotation, no direction (1 state).
At 1+ turns: CW or CCW direction (2 states per turn count).

Hash is dash with a **-** modifier — same rotation physics, shorter distance. Just as "skew" names shift+/-, "hash" names dash-.

### Skews (L4+ only, 8-point grid)

When the 8-point grid is available, shifts can traverse arcs longer or shorter than a standard single-segment arc:

- **Skew+** (shift+): Extended arc (e.g., S to NE, spanning 3 segments)
- **Skew-** (shift-): Shortened arc (less than one standard segment)

Skews support all three shift motion types (pro, anti, float). They are theoretically unbounded in arc length. For enumeration purposes, the standard single-segment shift is counted; skews are noted as an extension.

**CHU:** A skew++ (double-extended arc) with float has been identified as a distinct phenomenon. TKA does NOT give it a separate motion type — it is expressible as an extended-arc float shift within the existing framework. The decision not to add a 6th motion type was deliberate: CHU is a specific combination of existing parameters, not a fundamentally new behavior.

---

## Center-Relative Orientation

**All orientations in TKA are measured from the prop to the performer's center point.** This is not an arbitrary choice — it makes the entire orientation algebra work.

### Cardinal Orientations (4)

| Orientation | Meaning |
|-------------|---------|
| **in** | Prop faces toward center |
| **out** | Prop faces away from center |
| **clock** | Prop faces clockwise (perpendicular to center axis) |
| **counter** | Prop faces counter-clockwise (perpendicular to center axis) |

### Interradial Orientations (4, L7+)

| Orientation | Meaning |
|-------------|---------|
| **clockIn** | 45 degrees between clock and in |
| **clockOut** | 45 degrees between clock and out |
| **counterIn** | 45 degrees between counter and in |
| **counterOut** | 45 degrees between counter and out |

### Center Orientations (8, L5+)

For the center point, orientation uses compass directions: centerN, centerNE, centerE, centerSE, centerS, centerSW, centerW, centerNW.

### Why Center-Relative?

When a hand traces a curved arc, the angle from prop to center changes continuously. A prop that rotates with the arc maintains a constant angle to center (= preserves orientation). A prop that rotates against the arc reverses its angle to center (= reverses orientation). A prop that holds a fixed absolute spatial angle sees its center-relative angle change as the hand moves.

This is why:
- 0-turn pro preserves orientation (rotating with the arc = constant center angle)
- 0-turn anti reverses orientation (rotating against the arc = flipped center angle)
- Float changes center-relative orientation (prop holds still in space, but the center angle shifts)

---

## Orientation Algebra

### Whole-Turn Parity Rules

| Motion type | Even turns (0, 2, ...) | Odd turns (1, 3, ...) |
|-------------|------------------------|------------------------|
| Pro, Static | Preserves orientation | Reverses orientation |
| Anti, Dash, Hash | Reverses orientation | Preserves orientation |

"Reverses" means in&harr;out, clock&harr;counter (and interradial pairs at L7+: clockIn&harr;counterOut, clockOut&harr;counterIn).

### Fractional Turns (Half-turns at L3+, Quarter-turns at L7+)

Half turns (0.5, 1.5, 2.5) produce orientations 90 degrees from the start. Quarter turns (0.25, 0.75, 1.25, ...) produce interradial orientations using the 8-point radial cycle:

`in -> clockIn -> clock -> clockOut -> out -> counterOut -> counter -> counterIn`

Each quarter turn = 1 step. Direction rule:
- **Anti/Dash/Hash:** Step SAME direction as rotation
- **Pro/Static:** Step OPPOSITE direction to rotation

### Float Orientation

Float holds absolute spatial angle. As the hand arcs, the center-relative orientation changes by an amount determined by arc length and direction. For a standard single-segment shift: a CW arc shifts orientation one position CW in the radial cycle; a CCW arc shifts one position CCW. Float only changes orientation for CW/CCW hand paths; a dash/static hand path with float would preserve orientation (but float doesn't apply to those).

---

## Combinatorial Motion Space

The complete enumeration of single-hand motions from any grid point, stratified by level.

### Formulas

Given maximum turn count T (number of distinct turn values) and float availability F (1 for shifts, 0 otherwise):

- **Per shift destination:** 2(T) + F states (T pro values + T anti values + F float)
- **Per dash/hash/static destination:** 2T - 1 states (1 directionless 0-turn + (T-1) turn values x 2 directions)

*At 0 turns: shifts have 2 states (pro base, anti base). Dashes/hashes/statics have 1 state (no rotation = no direction).*

### Level-by-Level Totals

**L1: 0 turns only, 4-point grid, no float**

| Path | Destinations | Per dest | Subtotal |
|------|-------------|----------|----------|
| Shift | 2 (CW, CCW neighbor) | 2 (pro0, anti0) | 4 |
| Dash | 1 (opposite) | 1 (0-turn, directionless) | 1 |
| Static | 1 (stay) | 1 | 1 |
| **Total** | | | **6** |

**L2: Whole turns 0-3, 4-point grid, no float**

T = 4 turn values (0,1,2,3). Per shift dest = 2(4) = 8. Per dash/static = 2(4)-1 = 7.

| Path | Dest | Per dest | Subtotal |
|------|------|----------|----------|
| Shift | 2 | 8 | 16 |
| Dash | 1 | 7 | 7 |
| Static | 1 | 7 | 7 |
| **Total** | | | **30** |

**L3: Half-turns 0-3 (7 values: 0, 0.5, 1, 1.5, 2, 2.5, 3), 4-point grid, float**

T = 7. Per shift dest = 2(7) + 1 = 15. Per dash/static = 2(7)-1 = 13.

| Path | Dest | Per dest | Subtotal |
|------|------|----------|----------|
| Shift | 2 | 15 | 30 |
| Dash | 1 | 13 | 13 |
| Static | 1 | 13 | 13 |
| **Total** | | | **56** |

**L4: Same turns as L3, 8-point grid, float** (skews exist but are unbounded)

8-point grid: 6 shift destinations per perimeter point (all non-opposite, non-self perimeter points).

| Path | Dest | Per dest | Subtotal |
|------|------|----------|----------|
| Shift | 6 | 15 | 90 |
| Dash | 1 | 13 | 13 |
| Static | 1 | 13 | 13 |
| **Total** | | | **116** |

**L5: Same turns, 9-point grid (add center), float**

From perimeter point:

| Path | Dest | Per dest | Subtotal |
|------|------|----------|----------|
| Shift | 6 | 15 | 90 |
| Dash | 1 | 13 | 13 |
| Hash (to center) | 1 | 13 | 13 |
| Static | 1 | 13 | 13 |
| **From perimeter** | | | **129** |

From center point:

| Path | Dest | Per dest | Subtotal |
|------|------|----------|----------|
| Hash (to 8 perimeter) | 8 | 13 | 104 |
| Static | 1 | 13 | 13 |
| **From center** | | | **117** |

**Ceiling (L7+): Quarter-turns 0-3 (13 values), 9-point grid, float**

T = 13. Per shift dest = 2(13) + 1 = 27. Per dash/hash/static = 2(13)-1 = 25.

| Path | Dest | Per dest | Subtotal |
|------|------|----------|----------|
| Shift | 6 | 27 | 162 |
| Dash | 1 | 25 | 25 |
| Hash (to center) | 1 | 25 | 25 |
| Static | 1 | 25 | 25 |
| **From perimeter** | | | **237** |

From center: 8 x 25 + 25 = **225**

### Summary Table

| Level | Grid | Turn values | Float | From perimeter | From center |
|-------|------|-------------|-------|----------------|-------------|
| L1 | 4-pt | 1 (0 only) | No | **6** | -- |
| L2 | 4-pt | 4 (0,1,2,3) | No | **30** | -- |
| L3 | 4-pt | 7 (0-3 + halves) | Yes | **56** | -- |
| L4 | 8-pt | 7 | Yes | **116** | -- |
| L5 | 9-pt | 7 | Yes | **129** | **117** |
| Ceiling | 9-pt | 13 (0-3 + quarters) | Yes | **237** | **225** |

The original estimate of 214 possibilities was based on incorrect assumptions (0-turn dash/static counted as having CW/CCW direction, and no center point). The validated ceiling is 237 from perimeter, 225 from center.

---

## Level System

### Locked-In Order (Feb 2026)

| Level | Concept | What it adds | Arc |
|-------|---------|-------------|-----|
| 1 | Foundation | 0 turns, basic positions | Foundation |
| 2 | Whole turns | 0-3 whole turns | Foundation |
| 3 | Half turns + float | Halves, float motion type | Foundation |
| 4 | Skewed grid | 8-point grid, skew+ and skew- | Grid mixing |
| 5 | Centric | Center point, hash hand path, tau/terra positions | New grid point |
| 6 | Conjoined grids | Dual grids sharing a junction point, new position combinations, extended dashes (dash+/dash++) | Canvas expansion |
| 7 | Interradial orientations | 8 orientations (clockIn/Out, counterIn/Out), quarter turns, completes 2D | 2D COMPLETE |
| 8 | Atomics | Multi-plane / 3D (wall, wheel, overhead) | New dimension |
| 9 | Rubik's cube | Skewed across intersecting planes | 3D COMPLETE |

### Why This Order

**Conjoined before interradials (L6 before L7):**
- Conjoined grids are visually exciting and immediately accessible ("your grid just doubled")
- Interradials are mathematically dense (doubling orientation vocabulary from 4 to 8)
- Exciting-then-dense beats dense-then-exciting in learning progression
- Interradials at L7 serve as the completionist capstone for 2D mastery

**Interradials before 3D (L7 before L8):**
- Interradials are a 2D precision concept. Learning them in 2D where they're intuitive means the learner doesn't have to learn interradials AND 3D simultaneously
- All 2D knowledge carries forward into 3D. L7 completes the 2D vocabulary before the dimensional leap.

**Symmetry:** L7 completes 2D the way L9 completes 3D. Both are "precision passes" after spatial expansion (conjoined at L6, atomics at L8).

---

## Positions (Hand Locations)

**Position = where the two hands are relative to each other on the grid.**

| Position | Description |
|----------|-------------|
| **Alpha** | Hands at opposite points |
| **Beta** | Hands at the same point |
| **Gamma** | Hands form a right angle |
| **Zeta** | Hands form an obtuse angle |
| **Eta** | Hands form an acute angle |
| **Tau** | One hand at center, one at non-center (Level 5) |
| **Terra** | Both hands at center (Level 5) |

**The numbered suffix** (alpha1, beta5, gamma11) specifies which exact pair of grid locations.

Positions exist independent of props - they describe hand placement only.

**Level progression:**
- Levels 1-3: Alpha, Beta, Gamma (diamond/box modes)
- Level 4: Zeta, Eta (skewed mode)
- Level 5: Tau, Terra (centric mode)
- Level 6: New position combinations from conjoined grids
- Level 7: Existing positions gain interradial orientation options

---

## Compound Letters

Compound letters are pairs that complete each other to create circular (LOOP) motion. When you spin continuously, you don't do D or J separately - you do DJ as a compound unit.

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
| Phi-Psi | Phi (beta to alpha) + Psi (alpha to beta) — one hand dashes, one stays static |

### Why Compounds Matter

- D alone is beta to alpha (half a cycle)
- J alone is alpha to beta (half a cycle)
- DJ together = beta to alpha to beta (complete cycle)
- In continuous motion, you're always doing the compound
- VTG timing (split vs tog) applies to the compound unit, not individual letters

---

## VTG (Vulcan Tech Gospel)

VTG is an older, widely-adopted notation framework for flow arts created by Noel Yee and spinners at the Vulcan Lofts in Oakland, CA. Many flow artists learn VTG before encountering TKA.

### The Downbeat Reference

**VTG is ground-referenced.** The "downbeat" (south / bottom of the circle) is the anchor point for all timing and direction classifications.

- **Together (tog):** Both props pass through the downbeat at the same moment
- **Split:** Props are 180 degrees out of phase - one at downbeat when the other is at top

### The Four VTG Categories

"Same" and "opposite" in VTG refer to **hand path direction** — whether both hands arc the same way (both CW or both CCW). This is distinct from prop rotation direction, which depends on the pro/anti classification of each hand independently.

| VTG Term | Abbreviation | Timing | Hand Path Direction |
|----------|--------------|--------|---------------------|
| **Split-Same** | SS | Props 180 degrees out of phase | Both hands arc the same way |
| **Together-Same** | TS, tog-same | Props in sync | Both hands arc the same way |
| **Split-Opposite** | SO, split-opp | Props 180 degrees out of phase | Hands arc opposite ways |
| **Together-Opposite** | TO, tog-opp | Props in sync | Hands arc opposite ways |

Note: VTG's "same/opposite" classification does not describe prop rotation direction. A letter like C (one hand pro, one hand anti) is still "same" because both hands arc the same direction. Prop rotation direction only becomes classifiable in VTG when both props have matching turn values, which TKA does not assume — turn values change constantly.

### VTG Classification: Fixed vs Orientation-Dependent

**Letters that stay in the same position have fixed VTG timing:**
- **A, B, C** (alpha to alpha): always **split-same** — hands stay at opposite points, both arcing the same direction
- **G, H, I** (beta to beta): always **tog-same** — hands stay together, both arcing the same direction

**Compound letters vary by variation:**
- **DJ, EK, FL** can be split-opp OR tog-opp depending on which variation

The VTG classification applies to the **compound**, not individual letters:
- DJ east-start variation = **split-opp**
- DJ south-start variation = **tog-opp**

This is because VTG timing depends on where the hands are relative to the downbeat (south) at any given moment. TKA stores `timing` and `direction` per variation to track this.

### TKA vs VTG: Different Reference Systems

| Aspect | VTG | TKA |
|--------|-----|-----|
| Reference point | Ground (south/downbeat) | Center of grid |
| Position names | tog = together, split = apart | Alpha = opposite, beta = same |
| Classification | Fixed per pattern | Varies by orientation |

### Mapping VTG Terms to TKA

**These are exact equivalences:**
- **Tog (together)** = **Beta** (hands at same point)
- **Split** = **Alpha** (hands at opposite points)

**Direction is described differently** because TKA doesn't reference the downbeat:
- VTG uses "same direction" / "opposite direction" relative to the downbeat
- TKA tracks timing and direction per variation for compound letters

### Teaching Order: VTG vs TKA

VTG pedagogy starts with **tog-same** (hands together) because it feels grounded for beginners.

TKA's alphabetical order starts with **split-same** (A, B, C = alpha to alpha) because it's the first position pattern in the systematic organization.

This means:
- VTG would start with G, H, I (tog-same)
- TKA starts with A, B, C (split-same)

Neither is "wrong" - they're different design philosophies (pedagogical vs systematic).

---

## Explaining Pictographs to Users

Assume zero domain knowledge. Use precise terminology:

**DO say:**
- "Hands start at opposite points (alpha) and end at the same point (beta)"
- "Blue hand at south, red hand at east - that's gamma (hands form a right angle)"
- "Beta means both hands at the same point"

**DON'T say:**
- "Hands together" (vague)
- "Props parallel" (position isn't about props)
- "180 degrees apart" (implementation detail, not domain language)
- "Perpendicular" (say "right angle" instead)

---

## Correcting Terminology

When users use incorrect TKA terminology, **explicitly correct it** before answering. Don't silently interpret - teach the correct term.

| User Says | Correct To |
|-----------|------------|
| "Type A letter" | "Type 1 - types are numbered 1-6, not lettered" |
| "Type B letter" | "Type 2 - types are numbered 1-6, not lettered" |

**Note on positions:** Users don't need to know numbered variants (alpha1, alpha2, etc.). Focus on the human-readable descriptions:
- **Alpha** = hands at opposite points
- **Beta** = hands at the same point
- **Gamma** = hands form a right angle

The numbered variants are intermediate/advanced knowledge for those who want to specify exact grid locations.

---

## Other Terminology

- **Pictograph**: Visual representation of one beat of motion
- **Variation**: Different ways to execute the same letter (different start/end locations)
