# TKA Domain Knowledge

> Deep reference (VTG, L4 skewed theory, combinatorial space, LOOP algebra) lives in `packages/domain/src/` — the canonical source. Access via MCP tools (`get_alphabet_info`, `get_letter_explanation`, `get_term_definition`).

## What TKA Is

TKA (The Kinetic Alphabet) is a notation system for two-handed prop manipulation, **built for static props** (staff, fans, clubs, buugeng). It's a **radial system** — all orientations are measured from the prop to the performer's center point, not relative to the ground.

Parameter space: 9 grid locations (8 perimeter + center), 8 center-relative orientations (4 radial/nonradial + 4 interradial at L7+), rotation increments down to 45 degrees. Does NOT enumerate: grip changes, body movement, behind-the-back passes, contact rolling, tosses, or 3D planes below Level 8.

**Poi caveat:** Poi can perform many TKA sequences but not all. **Never list poi alongside static props as if they're equals.** A Poi Lab module is planned but not yet built.

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

**NEVER say "both hands move" as the distinguishing feature of Type 1.** Types 1, 3, and 5 all have both hands moving. What makes Type 1 unique is that both hands **shift**. Always use the specific motion type (shift vs dash vs static).

### CRITICAL: The "-" Suffix Convention

**When a user says "[Letter] dash", they mean the letter with "-" suffix.**

| User Says | They Mean | Type |
|-----------|-----------|------|
| "Sigma dash" | &Sigma;- | Type 3 |
| "W dash" | W- | Type 3 |
| "Phi dash" | &Phi;- | Type 5 |
| "Tau dash" | &tau;- | Type 4 |

---

## MCP Server Tools

### CRITICAL: Just Generate. No Pre-Checks.

**When a user asks for a sequence, call `generate_sequence` IMMEDIATELY.** Do NOT call `analyze_word_feasibility` first. The generator auto-inserts bridge letters and handles constraints.

### Primary Tools

- **`generate_sequence`** - Generate and open choreo card (~50 tokens) - **DEFAULT CHOICE**
- **`generate_pictograph`** - Generate and open single pictograph (~50 tokens)

### Data Tools

- **`get_sequence_data`** - Step data without image
- **`get_pictograph_data`** - Raw motion data without image

### Reference Tools

- **`list_available_letters`** - All letters by type
- **`get_alphabet_info`** - Comprehensive domain reference
- **`list_letter_variations`** - Variations for a specific letter
- **`get_letter_explanation`** - Detailed explanation for teaching
- **`analyze_word_feasibility`** - Only for debugging failed generation

---

## Grid System

**9 grid locations:** Cardinal (n, e, s, w), Intercardinal (ne, se, sw, nw), Center (L5+)

**Grid Modes:** Diamond (cardinals), Box (intercardinals), Skewed (one each, L4+), Centric (center, L5+)

**Adjacency:** Each perimeter point has 2 adjacent neighbors (CW/CCW). On 4-point grid, 1 opposite. On 8-point grid, 6 non-opposite reachable by shift.

---

## Hand Paths

Three fundamental families, distinguished by geometry:

| Family | Geometry | Base path | Modifiers (L4+) |
|--------|----------|-----------|------------------|
| **Static** | No movement | Stay at current point | — |
| **Shift** | Curved arc | Arc to adjacent point | +/- (skew) |
| **Dash** | Straight line | Straight to opposite point | - (hash, L5+), +/++ (extended, L6+) |

**Key:** Shifts follow curved arcs (enables pro/anti/float). Dashes follow straight lines (no pro/anti at 0 turns). "Hash" = dash- (to/from center). "Skew" = shift+/- (extended/shortened arc).

Letter types classify by hand path family. The +/- modifier is a per-hand parameter, not a separate path type.

---

## Motion Types

### Shift Motion Types (curved arc)

| Type | Behavior | Turn count |
|------|----------|------------|
| **Pro** | Rotates with the arc | 0, 1, 2, 3, ... |
| **Anti** | Rotates against the arc | 0, 1, 2, 3, ... |
| **Float** | Holds absolute spatial angle | N/A (single state) |

Pro/anti are arc-relative, NOT absolute CW/CCW. Float only applies to shifts.

### Non-Shift Motion Types (straight line or stationary)

| Type | Behavior | Turn count |
|------|----------|------------|
| **Dash/Hash** | Prop rotates during straight-line traverse | 0, 1, 2, 3, ... |
| **Static** | Prop rotates in place | 0, 1, 2, 3, ... |

### Base Rotation (Key Concept)

Turn counts measure ADDITIONAL rotation beyond base behavior:
- **Shifts at 0 turns:** Pro base OR anti base = **2 distinct states** (prop IS rotating at base rate)
- **Dash/hash/static at 0 turns:** No rotation = **1 state** (no direction)
- **1+ turns (any type):** CW or CCW = 2 states per turn count

**1 turn = 180° additional rotation.** Even turns preserve orientation, odd turns reverse it (for pro/static). Reversed for anti/dash/hash.

---

## Orientations

### Radial/Nonradial (4, all levels)

| Orientation | Meaning |
|-------------|---------|
| **in** | Prop faces toward center |
| **out** | Prop faces away from center |
| **clock** | Prop faces CW (perpendicular to center axis) |
| **counter** | Prop faces CCW (perpendicular to center axis) |

### Interradial (4, L7+)

clockIn, clockOut, counterIn, counterOut — 45° between radial and nonradial.

### Center Orientations (8, L5+)

centerN, centerNE, centerE, centerSE, centerS, centerSW, centerW, centerNW

### Terminology: Don't Confuse These

- **Cardinal/Intercardinal** = grid point LOCATIONS (N/E/S/W vs NE/SE/SW/NW)
- **Radial/Nonradial/Interradial** = prop ORIENTATIONS relative to center

### Orientation Parity Rules

| Motion type | Even turns (0, 2, ...) | Odd turns (1, 3, ...) |
|-------------|------------------------|------------------------|
| Pro, Static | Preserves orientation | Reverses orientation |
| Anti, Dash, Hash | Reverses orientation | Preserves orientation |

"Reverses" = in&harr;out, clock&harr;counter. Half turns produce 90° shifts. Quarter turns use the 8-point radial cycle: `in → clockIn → clock → clockOut → out → counterOut → counter → counterIn`.

---

## Level System (Locked In)

| Level | Concept | What it adds |
|-------|---------|-------------|
| 1 | Foundation | 0 turns, basic positions |
| 2 | Whole turns | 0-3 whole turns |
| 3 | Half turns + float | Halves, float motion type |
| 4 | Skewed grid | 8-point grid, skew+/- |
| 5 | Centric | Center point, hash, tau/terra |
| 6 | Conjoined grids | Dual grids, junction point, dash+/++ |
| 7 | Interradial orientations | 8 orientations, quarter turns, 2D COMPLETE |
| 8 | Atomics | Multi-plane / 3D |
| 9 | Rubik's cube | Skewed across planes, 3D COMPLETE |

---

## Positions

| Position | Description | Symmetric? |
|----------|-------------|------------|
| **Alpha** | Hands at opposite points (180°) | Yes |
| **Beta** | Hands at same point (0°) | Yes |
| **Gamma** | Hands form right angle (90°) | No |
| **Zeta** | Hands form obtuse angle (135°, L4+) | No |
| **Eta** | Hands form acute angle (45°, L4+) | No |
| **Tau** | One hand at center (L5+) | — |
| **Terra** | Both hands at center (L5+) | — |

Asymmetric positions (gamma, zeta, eta) have leader/follower distinction for same-direction shifts. Gamma cannot be skewed (90° requires both hands on same grid).

---

## Compound Letters

Pairs that complete each other for circular (LOOP) motion:

| Compound | Components | Style |
|----------|------------|-------|
| DJ | D + J (beta↔alpha) | Pro/Pro |
| EK | E + K (beta↔alpha) | Anti/Anti |
| FL | F + L (beta↔alpha) | Hybrid |
| MP | M + P (gamma↔gamma) | — |
| NQ | N + Q (gamma↔gamma) | — |
| OR | O + R (gamma↔gamma) | — |
| Phi-Psi | Phi + Psi (dash, beta↔alpha) | — |

VTG timing (split vs tog) applies to the compound unit, not individual letters.

---

## LOOP Transformations

| Transformation | What it does |
|---------------|-------------|
| **Rotated** | Positions continue rotating same direction |
| **Mirrored** | Left-right swap across vertical axis |
| **Flipped** | Top-bottom swap across horizontal axis |
| **Swapped** | Blue↔Red hand roles swap |
| **Inverted** | Pro↔Anti motion types swap |
| **Rewound** | Second half plays in reverse |

These form a finite transformation group (composable, invertible, satisfies group axioms).

---

## VTG Quick Reference

VTG (Vulcan Tech Gospel) by Noel Yee — ground-referenced notation. Type 1 letters encode everything VTG covers. Key mappings:
- **Tog** = Beta, **Split** = Alpha
- **Same/Opposite** = hand path direction (not prop rotation)
- A,B,C = split-same; G,H,I = tog-same; DJ/EK/FL compounds vary by variation

VTG covers 3 planes (Wall/wHeel/Floor). TKA currently single-plane; L8 adds multi-plane.

**NEVER frame per-hand learning as "early" or "backwards."** The Assembler tab bridges per-hand thinkers to per-beat notation.

> For detailed VTG mapping, L4 skewed letter theory, and combinatorial motion space, use MCP tools or read `packages/domain/src/`.

---

## Explaining Pictographs to Users

Assume zero domain knowledge. Use precise terminology:

**DO:** "Hands start at opposite points (alpha) and end at the same point (beta)"
**DON'T:** "Hands together", "Props parallel", "180 degrees apart", "Perpendicular"

---

## Correcting Terminology

When users use incorrect TKA terminology, **explicitly correct it** before answering.

| User Says | Correct To |
|-----------|------------|
| "Type A letter" | "Type 1 - types are numbered 1-6, not lettered" |
| "Type B letter" | "Type 2 - types are numbered 1-6, not lettered" |
