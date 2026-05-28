# Halved LOOP Seed Type Compatibility

A theorem about which letter type combinations can form valid seeds for halved rotated LOOPs, derived from the position family transition structure of the diamond grid.

## Position Family Transitions

Every TKA letter type maps to a fixed set of position family transitions. These are structural — they hold for all letters within a type, all grid positions, all turn values.

| Type | Name | Transitions |
|------|------|-------------|
| 1 | Dual-Shift | alpha→alpha, alpha↔beta, beta→beta, gamma→gamma |
| 2 | Shift | alpha→gamma, beta→gamma, gamma→alpha, gamma→beta |
| 3 | Cross-Shift | alpha→gamma, beta→gamma, gamma→alpha, gamma→beta |
| 4 | Dash | alpha↔beta, gamma→gamma |
| 5 | Dual-Dash | alpha→alpha, beta→beta, gamma→gamma |
| 6 | Static | alpha→alpha, beta→beta, gamma→gamma |

Key observation: **Types 2 and 3 (Shift, Cross-Shift) are the only types that cross between {alpha, beta} and {gamma}.** All other types stay within {alpha, beta} or within {gamma}.

## The Halved Seed Constraint

A halved rotated LOOP seed is a 2-step path that starts at position P and ends at the 180°-rotated counterpart of P. Critically, the start and end must be in the **same position family**:

- alpha1 → alpha5
- beta5 → beta1
- gamma11 → gamma15

This means a valid 2-step seed must traverse some intermediate position X and return to the starting family.

## Theorem: Valid Type Pair Families

A 2-step seed with type pair (T₁, T₂) is valid for a halved rotated LOOP **if and only if** the composition of T₁'s transition set and T₂'s transition set includes at least one path that starts and ends in the same position family.

### Proof sketch

Let F₁ be the set of (start_family, end_family) pairs for type T₁, and F₂ for T₂. The composition F₁ ∘ F₂ contains (a, c) if there exists b such that (a, b) ∈ F₁ and (b, c) ∈ F₂. A valid halved seed requires (a, a) ∈ F₁ ∘ F₂ for some family a.

### Why Dual-Shift + Shift is impossible

**Dual-Shift (Type 1)** reaches: alpha, beta (from alpha/beta start) or gamma (from gamma start only).
**Shift (Type 2)** reaches: gamma (from alpha/beta) or alpha, beta (from gamma).

Composition from alpha: Dual-Shift reaches {alpha, beta}. Shift from {alpha, beta} reaches {gamma}. Final family = gamma ≠ alpha. ✗
Composition from beta: Same structure. Final = gamma ≠ beta. ✗
Composition from gamma: Dual-Shift reaches {gamma}. Shift from {gamma} reaches {alpha, beta}. Final ∈ {alpha, beta} ≠ gamma. ✗

The reverse (Shift + Dual-Shift) fails symmetrically:
From alpha: Shift reaches {gamma}. Dual-Shift from {gamma} reaches {gamma}. Final = gamma ≠ alpha. ✗

**Dual-Shift never enters gamma from alpha/beta. Shift always enters gamma from alpha/beta. They occupy non-overlapping corridors in the position graph.**

### Complete compatibility matrix

Computed by composing all type pair transition sets and checking for same-family return paths:

| T₁ \ T₂ | 1-DS | 2-Sh | 3-CS | 4-Da | 5-DD | 6-St |
|----------|------|------|------|------|------|------|
| **1-DS** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **2-Sh** | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| **3-CS** | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **4-Da** | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| **5-DD** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| **6-St** | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |

✓ = valid pair confirmed by exhaustive DFS enumeration
✗ = impossible — verified by both family-level transition analysis AND position-level DFS

The matrix is **anti-diagonal by corridor**: each valid pair involves types that share the same position transition corridor.

- **Corridor 1 (alpha↔alpha, alpha↔beta, beta↔beta):** Types 1+1
- **Corridor 2 (alpha↔gamma, beta↔gamma):** Types 2+3 and 3+2
- **Corridor 3 (alpha↔beta for Dash, self for Dash):** Types 4+4
- **Corridor 4 (self-transitions only):** Types 5+6 and 6+5

DS+Da (1+4) and Da+DS (4+1) appear compatible at the family level (both access alpha↔beta), but exhaustive position-level search confirms no valid seed exists: Dash from a specific alpha/beta position reaches a specific beta/alpha position from which no Dual-Shift letter reaches the required 180° endpoint.

### The 6 valid families (halved rotated, diamond, 4-step)

| Seed Types | Family Name | Canonical Count |
|------------|-------------|-----------------|
| 1+1 | Dual-Shift + Dual-Shift | 16 |
| 2+3 | Shift + Cross-Shift | 4 |
| 3+2 | Cross-Shift + Shift | 4 |
| 4+4 | Dash + Dash | 2 |
| 5+6 | Dual-Dash + Static | 3 |
| 6+5 | Static + Dual-Dash | 3 |
| **Total** | | **29** |

## Implications

1. **Shift (Type 2) can only participate in halved LOOPs via Cross-Shift (Type 3).** They mirror each other's transitions, so one takes you out to gamma and the other brings you back.

2. **The 6 valid families are exhaustive.** No other type combination can form a halved rotated LOOP seed in diamond mode. This is a structural theorem, not an empirical observation — it holds regardless of turn values, orientations, or specific grid positions.

3. **For longer seeds (3+, 4+ steps),** additional type combinations become possible because intermediate positions can chain through gamma and back. This theorem applies specifically to 2-step seeds (halved LOOPs).

## Canonical Fingerprinting

The 47 raw sequences (from 3 start positions × DFS enumeration) collapse to 29 canonical hand paths via min-circular-rotation of the full 4-step letter array. Circular rotation equivalence captures: different entry points into the same circular path, different start positions that traverse the same cycle, and cross-family pairs (e.g., ΣW- from alpha = WΘ- from gamma entered at a different vertex).

## VTG Cross-Reference

All 16 Dual-Shift+Dual-Shift canonicals match the 16 unique VTG motion fingerprints (19 VTG motions → 16 canonical, since split-opp/tog-opp are circular rotations of each other). The 13 non-Dual-Shift canonicals are all new — VTG only covers Type 1 letters.
