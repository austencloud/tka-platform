export const COMMON_QUESTIONS: Record<string, string> = {
  "why cross-shift": `## Why "Cross-Shift" instead of "Dash-Shift"?

"Cross-Shift" was chosen over "Dash-Shift" for two practical reasons:

1. **Abbreviation conflict:** "Dash-Shift" abbreviates to "DS" - the same as "Dual-Shift". This would cause confusion when discussing types.

2. **Conceptual identity:** "Cross-Shift" gives the combination its own name, rather than just listing the constituent parts ("Dash" + "Shift"). It wraps the concept into a single term.

The "cross" refers to the combination of different motion types, not a geometric crossing pattern on the grid.`,

  "what is tka": `## What is TKA?

TKA (The Kinetic Alphabet) is a notation system for encoding flow arts movements into written symbols.

**Purpose:** Before TKA, flow artists could only share movements through video. TKA provides a written language - you can write down a sequence, share it, and another spinner can read and perform it.

**How it works:** Each "letter" represents one beat of motion, encoding:
- Where the hands start (position)
- Where the hands end (position)
- How each hand moves (motion type: shift, dash, or static)
- How each prop rotates (pro or anti)

**Structure:** 47 letters in 6 types, organized by motion pattern.`,

  "what is vtg": `## What is VTG?

VTG (Vulcan Tech Gospel) is an older notation framework for flow arts created by Noel Yee and spinners at the Vulcan Lofts in Oakland, CA. Many flow artists learn VTG before encountering TKA.

**The Downbeat:** VTG is ground-referenced. The "downbeat" (south / bottom of the circle) is the anchor point for all classifications.

**The Four Categories:**
- **Split-Same (SS):** Props 180° out of phase, both rotating same way
- **Together-Same (TS):** Props in sync, both rotating same way
- **Split-Opposite (SO):** Props 180° out of phase, rotating opposite ways
- **Together-Opposite (TO):** Props in sync, rotating opposite ways

**How VTG maps to TKA:**
- **Tog = Beta** (hands at same point)
- **Split = Alpha** (hands at opposite points)

TKA builds on VTG concepts. Every pictograph has timing/direction fields that correspond to VTG categories.`,

  "what is a pictograph": `## What is a Pictograph?

A pictograph is the visual representation of one TKA letter - one beat of motion.

**Components:**
- **Grid:** The reference frame (diamond or box orientation)
- **Props:** Two colored shapes (blue and red) showing hand positions
- **Arrows:** Show the path each hand takes (if moving)
- **Letter glyph:** The TKA letter name (e.g., "A", "Σ-")

**Reading a pictograph:**
1. Find the starting positions (where props begin)
2. Follow the arrows to see the motion path
3. Note the ending positions (where props end up)
4. The letter type tells you the motion pattern`,

  "what is a sequence": `## What is a Sequence?

A sequence is a series of TKA letters performed in order - like a word made of letters.

**Properties:**
- Each letter is one beat
- Letters connect: the end position of one letter is the start position of the next
- A valid sequence has matching positions between consecutive letters

**Special sequences:**
- **LOOP:** A circular sequence where the last letter's end position matches the first letter's start position
- **Infinite LOOP:** A LOOP that can repeat indefinitely`,

  "what is a loop": `## What is a LOOP?

A LOOP is a circular sequence - the end position returns to the start position.

**Definition:** A sequence where the last letter's ending position equals the first letter's starting position.

**Why it matters:** LOOPs can be repeated infinitely. Non-LOOP sequences would require a transition to restart.

**LOOP types:** Rotated, mirrored, flipped, swapped, inverted, rewound - each describes how the sequence transforms when repeated.`,

  "what is float": `## What is Float?

Float is a prop rotation type where the prop holds its absolute spatial angle while the hand traces a curved arc. No prop rotation in world space.

**Key properties:**
- Only applies to shifts (requires a curved hand path)
- Has no turn count - it's a single binary state
- Introduced at Level 3
- Center-relative orientation CHANGES even though the prop holds still in space

**Why it only applies to shifts:** Without a curve, there's no distinction between float and 0-turn static - the prop isn't rotating either way.`,

  "what is hash": `## What is Hash?

Hash is a hand path where the hand moves in a straight line to or from the center grid point. It's a "half-dash."

**Key properties:**
- Introduced at Level 5 with the center grid point
- Same straight-line geometry as dash
- At 0 turns: no rotation, no direction (1 state)
- At 1+ turns: CW or CCW (2 states per turn count)
- Creates tau positions (one hand at center, one at perimeter)`,

  "what are compound letters": `## What are Compound Letters?

Compound letters are pairs that complete each other to create circular (LOOP) motion.

**The 7 compounds:**
- **DJ** (Disco Jam) - Pro/Pro isolation cycle (beta ↔ alpha)
- **EK** (Exploding Kitten) - Anti/Anti cycle
- **FL** (Fruity Loops) - Hybrid (anti/pro) cycle
- **MP** (Magic Potion) - Gamma internal cycle
- **NQ** (Never Quit) - Gamma internal cycle
- **OR** (Open Road) - Gamma internal cycle
- **ΦΨ** - Dash compound cycle

In continuous spinning, you're always doing compound units. D alone is half a cycle; DJ is complete.`,

  "what is a word": `## What is a Word?

A word in TKA is a sequence of letters that spells out a choreographic phrase. Each letter is one beat of motion, and stringing them together creates a "word" - a complete movement sequence.

**Example:** The word "CAKE" is 4 beats long: C → A → K → E, each letter representing one beat of dual-prop movement.

**Key properties:**
- Words can be any length (1 letter = 1 beat, 6 letters = 6 beats, etc.)
- Letters must chain: the end position of one letter must match the start position of the next
- Invalid transitions require "bridge" letters to connect
- If a word loops back to its starting position, it's a LOOP`,

  "what are interradials": `## What are Interradial Orientations?

Interradials are the 4 orientations at 45° between the cardinal orientations. Introduced at Level 7.

**The 4 interradial orientations:**
- **clockIn** - between clock and in
- **clockOut** - between clock and out
- **counterIn** - between counter and in
- **counterOut** - between counter and out

**Key properties:**
- Complete the 8-point radial cycle: in → clockIn → clock → clockOut → out → counterOut → counter → counterIn
- Produced by quarter turns (0.25, 0.75, 1.25, etc.)
- Level 7 completes 2D mastery before 3D begins at Level 8`,
};

export function getCommonAnswer(question: string): string | null {
  const normalized = question.toLowerCase().trim();
  for (const [key, answer] of Object.entries(COMMON_QUESTIONS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return answer;
    }
  }
  return null;
}
