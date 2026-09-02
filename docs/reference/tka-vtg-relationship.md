# TKA ↔ VTG: How the Two Systems Relate

Working understanding, written for fact-checking. Source tags:
**[VTG]** = Noel Yee primary docs (VTG1 2010 / VTG2 2015), **[MCP]** = flow-arts
knowledge base, **[code]** = this repo, **[you]** = Austen's teaching this session,
**[infer]** = my own deduction (check hardest).

---

## 0. TL;DR

TKA and VTG describe the same physical prop spinning, but from **opposite design
centers** and with **two different reference frames**. The single biggest source
of confusion is that they don't reference the same origin: TKA measures the prop
relative to the **center of the grid**; VTG measures it relative to **gravity (the
downbeat, straight down)**. Almost every "why don't these line up" question traces
back to that. The **club** (a one-ended prop both systems support) is the clean
translation point between them.

---

## 1. Origins: opposite design centers [you]

- **TKA was built for two-ended props (staff)**, then adapted to one-ended props.
- **VTG was built for one-ended props (poi/club)**, then adapted to two-ended.
- The **club is the Rosetta stone**: it's one-ended and exists in both systems, so
  it's where the two vocabularies translate without ambiguity.
- Consequence: **a two-ended prop doubles the petal count** of a one-ended prop
  doing the same motion. So whenever we talk petal counts, we mean the
  **single-ended (club) count** unless we say otherwise. [you]

---

## 2. Two reference frames (the root of all confusion)

- **TKA is center-referenced.** Orientation = the prop's angle relative to the grid
  **center**. [MCP: downbeat — "TKA uses center-referenced positions"]
- **VTG is gravity-referenced.** Its anchor is the **downbeat** — the **south /
  bottom** of the prop's circle, where gravity lives. VTG reads a pattern by *when
  the props cross the downbeat*. [MCP: downbeat; VTG]
- These frames only coincide at specific grid points. At south the two line up; at
  east they're 90° apart; etc. So converting between them is **position-dependent**
  — you can't use a constant offset, you need a per-position rotation (a
  "conversion table"). [infer, consistent with code below]

---

## 3. Orientation: 8 points (TKA) vs 2 (VTG)

- **TKA** has an 8-point center-relative orientation cycle:
  `in → clockIn → clock → clockOut → out → counterOut → counter → counterIn`.
  [MCP: orientation algebra]
- **VTG has only two orientations: in and out.** [you; VTG notation pages — the
  prop glyph is a circle with a line for in vs out; the props axis is
  **Props Out / Props In / Props In-Out**]
- The prop *physically passes through* clock/counter/interradial angles, but VTG
  never **names or references** them — they're transit, not landmarks. Clock,
  counter, and "nonradial" are TKA-only concepts. [you]

---

## 4. Spin type & base rotation

- **Inspin (VTG) = prospin / pro (TKA):** prop rotates the **same** direction as
  the hand's circular path. [MCP terminology; VTG]
- **Antispin = anti:** prop rotates **opposite** the hand's path. [MCP; VTG]
- **Base rotation** [MCP: base rotation]: TKA turn counts measure *additional*
  rotation on top of an inherent base. For a curved shift at **0 turns**, pro and
  anti are already **two different states** (pro base preserves center-relative
  orientation, anti base reverses it). "0 turns" is not "no spin."
- **1 TKA turn = 180° of additional rotation.** [MCP: base rotation]

---

## 5. Turn ratio (props:hands) and the TKA↔VTG turn map

- **Ratio convention is `props:hands` (P:Q)** = P prop rotations per Q hand
  revolution. Confirmed canonical across VTG1, VTG2 Index, VTG2 Ch.1–2; *"every
  one rotation of the hand corresponds to one rotation of the prop"* = 1:1.
  [VTG1 p4]
- Our app uses `props:hands` everywhere; the old VTG app's `1:3` is just the
  inverse (hands:props) display order. We're aligned with Yee. [code:
  vtg-pattern-data.ts; you]
- **TKA turns → VTG ratio:**

  | TKA turns | VTG ratio |
  |-----------|-----------|
  | Float | 0:1 |
  | -0.25 | 1:2 |
  | 0   | 1:1 |
  | 0.25 | 3:2 |
  | 0.5 | 2:1 |
  | 0.75 | 5:2 |
  | 1   | 3:1 |
  | 1.25 | 7:2 |
  | 1.5 | 4:1 |
  | 1.75 | 9:2 |
  | 2   | 5:1 |
  | 2.25 | 11:2 |
  | 2.5 | 6:1 |
  | 2.75 | 13:2 |
  | 3   | 7:1 |

  For a positive reduced ratio **P:Q**, the two directions of the conversion are:

  - **P/Q = 2·turns + 1**
  - **turns = (P/Q - 1) / 2**

  Float is the zero-ratio exception: **0:1 maps to the binary Float state, not
  numeric -0.5 turns**. At Level 4, turns move in 0.25 increments, so every
  reduced positive ratio has denominator 1 or 2. Between Float and 0, that
  leaves exactly one directly representable numeric ratio: **1:2 = -0.25**.
  Ratios such as 1:3 and 2:3 convert to -1/3 and -1/6, but those angles do not
  land on TKA's current eight-orientation wheel. [infer from the 180° rule and
  current Level 4 orientation algebra]

---

## 6. Petals: a SEPARATE count from ratio

This is the correction that mattered. **Petal count and turn ratio are two
different measurements against two different references.** [you]

- **Petals** are read off the **radial reference**: the **out point for antispin**,
  the **in point for inspin**. This is about the *flower shape*. [you]
- **Turn ratio / timing** is read off the **downbeat (gravity)** — nothing to do
  with the petal reference. [you]
- They **correlate cleanly** but are not the same act of counting. Single-ended
  (club) petal formulas [code: `TURN_RATIO_MAPPINGS`; consistent with you]:
  - **Inspin petals = N − 1 = 2·turns** (1:1 → 0 petals = a plain circle).
  - **Antispin petals = N + 1 = 2·turns + 2** (1:1 → 2; 3:1 → 4).
  - Worked example you gave: **4-petal antispin = 3:1 = 1 TKA turn on a club.** ✓
- **Two-ended props double these counts.** The formulas above are single-ended. [you]
- (The earlier research agent claimed "4-petal antispin = 4:1" — that's wrong; it
  conflated petal count with ratio. Discarded.)

---

## 7. The simplest antispin: trammel → oval [you]

- TKA **0 turns** = VTG **1:1** antispin = the "2-petal antispin," but at its
  smallest form it **doesn't cross itself** — it's a long, thin shape.
- If the prop tip sat exactly at the grid midpoint (prop length = half the grid),
  it collapses to a literal **straight line — a trammel** (the old Roman device:
  two points sliding on fixed straight lines).
- We deliberately **offset the tip** so it renders as a **wide oval** instead of a
  line — which keeps it visually distinct from a **dash** (which also draws a
  straight line). VTG made the same choice; it's the horizontal/vertical antispin.

---

## 8. Modality: timing & direction (and where TKA extends VTG)

- **Direction:** same vs opposite — do the two hands orbit the same way or
  mirrored. [code: tnd-deriver `blueDir === redDir ? same : opp`]
- **Timing:** measured by **downbeat-crossing phase** between the two hands.
  [MCP: downbeat — "both at south = together; 180° out of phase = split"]
- **VTG natively had only two timings: Together and Split** (and same/opposite
  direction) → **4 modes: T/S, T/O, S/S, S/O**, exactly what the VTG notation
  pages show. [VTG notation pages; you]
- **Quarter timing (gamma) is a TKA extension VTG never formally classified** —
  Austen added it (the Sun/Moon elements cover the 90° phase). So TKA has **6**
  timing×direction modes (adds Quarter-Same, Quarter-Opp) where VTG had 4.
  [MCP: elemental-model]

---

## 9. What our code already does (the bridge)

- **The downbeat conversion is already implemented.** `tnd-deriver.ts` extrapolates
  each hand's phase **to south** (`phaseToSouth(loc, dir)`) before reading timing /
  direction — that *is* the position-dependent conversion table from §2. It's
  purely geometric (no letter, no grid-mode lookup). [code: tnd-deriver.ts]
- **The mandala is pure geometry**: per beat, `staffDelta = ±centerMovement +
  turns·π` (pro = `+`, anti = `−`). The tip traces as the hand arcs and the prop
  rotates by that delta. So the mandala shape is set by **prop-spin sign + hand arc
  (centerMovement) + turns**; the start orientation sets the rosette's phase.
  [code: mandala-geometry-calculator.ts]
- **Two-ended vs one-ended** is the mandala's `tipEnds` (staff = both tips, club =
  one tip). [code: SequenceMandala / mandala-geometry-calculator]

---

## 10. Implications for the labeling system

- The orientation axis for VTG naming is **in/out only** (the spin type picks which
  one anchors the petals: out for antispin, in for inspin). Clock/counter get no
  VTG names. So a core's VTG name keys off **(spin, ratio, in-vs-out)** —
  **not** a 4-way orientation.
- **Petals** come from the ratio via the single-ended formulas (§6); display
  doubles for staff.
- **Timing / modality** is the separate downbeat read we already compute — it
  belongs to the *two-hand* combination, not the single-hand core shape.
- So a per-hand **core** = `spin × ratio (props:hands) × radial-reference (in/out)`
  → a VTG name + petal count. The two-hand cell adds timing/direction on top.

---

## 11. Remaining fact checks

1. **out = antispin reference, in = inspin reference** — for *petals only*. (You
   said "true enough.") Correct framing?
2. **Petal formulas single-ended:** inspin = 2·turns, antispin = 2·turns + 2;
   staff doubles both. Right? (Is our `TURN_RATIO_MAPPINGS` petal column already
   single-ended, or does it assume staff?)
3. **VTG = 4 modes (T/S,T/O,S/S,S/O); Quarter is a TKA-only addition.** Correct?
4. Anything in §2 (center vs gravity frame) stated too strongly?
