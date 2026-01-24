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
| "Sigma dash" | Σ- | Type 3 |
| "W dash" | W- | Type 3 |
| "Phi dash" | Φ- | Type 5 |

The "-" suffix does NOT mean "letter with dash motion type". It's a naming convention for Type 3 (Cross-Shift) and Type 5 (Dual-Dash) letters.

---

## MCP Server Tools

### CRITICAL: Word Feasibility Check (ALWAYS FIRST)

**Before generating ANY sequence from a word, ALWAYS call `analyze_word_feasibility` first.**

```
analyze_word_feasibility(word: "YOURWORD")
```

This tells you which transitions need bridge letters. **Then proceed with generation anyway** - the system auto-inserts bridge letters for impossible transitions.

**DO NOT:**
- Refuse to generate because of impossible transitions
- Try to find alternative words or spellings
- Suggest the user change their word
- Attempt multiple rephrasing attempts

**DO:**
- Inform user: "X→Y needs a bridge letter, so the sequence will be slightly longer"
- Proceed directly to generation
- Let the system handle bridges automatically

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

## Compound Letters

Compound letters are pairs that complete each other to create circular (LOOP) motion. When you spin continuously, you don't do D or J separately - you do DJ as a compound unit.

### Type 1 β↔α Compounds (Dual-Shift)

| Compound | Components | Mnemonic | Style |
|----------|------------|----------|-------|
| DJ | D (β→α) + J (α→β) | "Disco Jam" | Pro/Pro (isolation) |
| EK | E (β→α) + K (α→β) | "Exploding Kitten" | Anti/Anti |
| FL | F (β→α) + L (α→β) | "Fruity Loops" | Hybrid (anti/pro) |

### Gamma Internal Compounds (γ→γ)

| Compound | Components | Mnemonic |
|----------|------------|----------|
| MP | M + P | "Magic Potion" |
| NQ | N + Q | "Never Quit" |
| OR | O + R | "Open Road" |

### Type 4 Dash Compounds

| Compound | Components |
|----------|------------|
| ΦΨ | Φ (β→α) + Ψ (α→β) |

### Why Compounds Matter

- D alone is β→α (half a cycle)
- J alone is α→β (half a cycle)
- DJ together = β→α→β (complete cycle)
- In continuous motion, you're always doing the compound
- VTG timing (split vs tog) applies to the compound unit, not individual letters

---

## VTG (Vulcan Tech Gospel)

VTG is an older, widely-adopted notation framework for poi/flow arts created by Noel Yee and spinners at the Vulcan Lofts in Oakland, CA. Many flow artists learn VTG before encountering TKA.

### The Downbeat Reference

**VTG is ground-referenced.** The "downbeat" (south / bottom of the circle) is the anchor point for all timing and direction classifications.

- **Together (tog):** Both props pass through the downbeat at the same moment
- **Split:** Props are 180° out of phase - one at downbeat when the other is at top

### The Four VTG Categories

| VTG Term | Abbreviation | Timing | Direction |
|----------|--------------|--------|-----------|
| **Split-Same** | SS | Props 180° out of phase | Both rotating same way |
| **Together-Same** | TS, tog-same | Props in sync | Both rotating same way |
| **Split-Opposite** | SO, split-opp | Props 180° out of phase | Rotating opposite ways |
| **Together-Opposite** | TO, tog-opp | Props in sync | Rotating opposite ways |

### VTG Classification: Fixed vs Orientation-Dependent

**Letters that stay in the same position have fixed VTG timing:**
- **A, B, C** (alpha→alpha): always **split-same** - hands stay at opposite points
- **G, H, I** (beta→beta): always **tog-same** - hands stay together

**Compound letters vary by variation:**
- **DJ, EK, FL** can be split-opp OR tog-opp depending on which variation

The VTG classification applies to the **compound**, not individual letters:
- DJ east-start variation → **split-opp**
- DJ south-start variation → **tog-opp**

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

TKA's alphabetical order starts with **split-same** (A, B, C = alpha→alpha) because it's the first position pattern in the systematic organization.

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
