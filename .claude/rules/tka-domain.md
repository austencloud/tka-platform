# TKA Domain Knowledge

## The 6 Letter Types

| Type | Name | Description | Letters |
|------|------|-------------|---------|
| 1 | Dual-Shift | Both hands shift | A-V (22 letters) |
| 2 | Shift | One shifts, one static | W, X, Y, Z, Σ, Δ, Θ, Ω |
| 3 | Cross-Shift | One shifts + one dashes | W-, X-, Y-, Z-, Σ-, Δ-, Θ-, Ω- |
| 4 | Dash | One dashes, one static | Φ, Ψ, Λ |
| 5 | Dual-Dash | Both hands dash | Φ-, Ψ-, Λ- |
| 6 | Static | Both hands stationary | α, β, γ |

---

## CRITICAL: The "-" Suffix Convention

**When a user says "[Letter] dash", they mean the Type 3 letter with "-" suffix.**

| User Says | They Mean | Type |
|-----------|-----------|------|
| "Sigma dash" | Σ- | Type 3 |
| "W dash" | W- | Type 3 |
| "Phi dash" | Φ- | Type 5 |

The "-" suffix does NOT mean "letter with dash motion type". It's a naming convention for Type 3 (Cross-Shift) and Type 5 (Dual-Dash) letters.

---

## MCP Server Tools

When working with the TKA pictograph MCP server:

1. **`list_available_letters`** - Shows all letters organized by type
2. **`get_alphabet_info`** - Comprehensive domain reference
3. **`list_letter_variations`** - Shows variations for a specific letter
4. **`generate_pictograph`** - Generates a pictograph image

**If unsure about a letter**, call `list_available_letters` first to see the full type-organized list.

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
- Level 5: Tau, Terra (centric mode - not yet implemented)

---

## Motion Types

| Type | Movement | Description |
|------|----------|-------------|
| **Static** | None | Hand stays at current grid point |
| **Shift** | Adjacent | Hand moves to adjacent grid point |
| **Dash** | Opposite | Hand moves to opposite grid point |

**Rotation Direction** (for props):
- **Pro** (prospin): Prop rotates with the hand's path direction
- **Anti** (antispin): Prop rotates against the hand's path direction
- **cw/ccw**: Clockwise / counter-clockwise

---

## Other Terminology

- **Pictograph**: Visual representation of one beat of motion
- **Variation**: Different ways to execute the same letter (different start/end locations)

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
