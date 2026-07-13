# TKA Domain Rules

Behavioral guardrails for how Claude interprets input, talks to users, and uses tools.
Deep domain knowledge lives in the MCP package — use `get_domain_topic` or `get_term_definition` for details.

---

## Framing

- **TKA was built for double staves.** That's the canonical prop. Each staff has two visible ends — one end is the consistent thumb reference, the other is the consistent pinky reference. With proper technique, these references never change. This is the foundation of the entire orientation system.
- Other static props (fans, clubs, buugeng) work with TKA but staves are what the system was designed around.
- When recommending a starting prop: **double staves, not fans.** Fans have visible orientation but lack the dual-end reference system that TKA is built on. Staves give you the thumb/pinky landmarks that make orientation readable.
- **Proper technique that preserves the thumb/pinky references:** negative space above and below the shoulder, and body turns to pass into the plane behind you. These techniques mean you never have to change your grip reference.
- NOT poi. Never list poi alongside static props as equals. Poi is a restricted subset.
- Poi Lab is planned, not built. Don't present it as working.
- TKA is for dual-wielded props. Contact staff (balancing/rolling on body) is NOT part of TKA.
- Don't say "any amount of rotation" — smallest increment is 45 degrees (quarter turns at L7).
- Don't say "fixed grip" — say "gripped directly."

---

## The "-" Suffix Convention

**When a user says "[Letter] dash", they mean the Type 3/4/5 letter with "-" suffix.**

| User Says | They Mean | Type |
|-----------|-----------|------|
| "Sigma dash" | Sigma- | Type 3 |
| "W dash" | W- | Type 3 |
| "Phi dash" | Phi- | Type 5 |
| "Tau dash" | tau- | Type 4 |

The "-" suffix does NOT mean "letter with dash motion type". It's a naming convention.

---

## MCP Tool Rules

**Just generate. No pre-checks.** Call `generate_sequence` IMMEDIATELY when asked.

Always use `constraintPreset: "smooth"` unless the user specifies otherwise (triggers the reliable builder).

| Tool | Use When |
|------|----------|
| `generate_sequence` | **Default.** Show sequence to user (~50 tokens) |
| `generate_pictograph` | Single letter (~50 tokens) |
| `get_sequence_data` | Need step data without image |
| `get_domain_topic` | Deep domain questions (base rotation, orientation algebra, etc.) |
| `get_term_definition` | Quick glossary lookup |

**DO NOT:** Pre-check feasibility, warn about bridges, suggest alternative words, hesitate.

---

## Explaining Pictographs

Assume zero domain knowledge. Use precise terminology:

**DO say:**
- "Hands start at opposite points (alpha) and end at the same point (beta)"
- "Blue hand at south, red hand at east — that's gamma (hands form a right angle)"
- "Beta means both hands at the same point"

**DON'T say:**
- "Hands together" (vague)
- "Props parallel" (position isn't about props)
- "180 degrees apart" (implementation detail, not domain language)
- "Perpendicular" (say "right angle" instead)

---

## Correcting Terminology

When users use incorrect TKA terminology, **explicitly correct it** before answering.

| User Says | Correct To |
|-----------|------------|
| "Type A letter" | "Type 1 — types are numbered 1-6, not lettered" |
| "Type B letter" | "Type 2 — types are numbered 1-6, not lettered" |

---

## Terminology Guardrails

- **Cardinal / Intercardinal** = grid point LOCATIONS. **Radial / Nonradial / Interradial** = prop ORIENTATIONS. Never conflate.
- Types classify by hand path FAMILY (shift, dash, static), not by position.
- "Both hands move" is NOT what makes Type 1 unique. Multiple types have both hands moving. Type 1 = both **shift**.
- 1 turn = 180 degrees additional rotation (not 360).
- **"Turn" is reserved for PROP turns and BODY turns only.** Never use "turns" for anything else — especially not for a LOOP's rotation slice. A loop that rotates its positions 180° or 90° per repeat is "180°"/"90°" (or halved/quartered rotation), NOT "half turns"/"quarter turns". That misnomer collides with prop/body turns and is banned in UI, copy, and comments. (Austen, 2026-07-13: *"'Turns' have a specific meaning in TKA... Body turns and prop turns are the only times we use turns."*)
- The per-hand learning model (VTG) is not "early learning" or "backwards" — it's a different cognitive preference.
- The 6-Element Model maps VTG categories + gamma patterns to elements. Use `get_domain_topic("elemental-model")` for full details.
- Same-direction elements (Earth, Water, Sun) are grid-mode invariant. Opposite-direction elements (Air, Fire, Moon) permute between diamond and box mode.
