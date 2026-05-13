# #015 — Sabre

> It's standing on its tip in the middle of the bridge. It does not intend to share.

## Identity

| Field | Value |
|-------|-------|
| Name | Sabre |
| Prop | Saber / Flow Sword |
| Tier | 3 — Rare |
| Rarity | Biome-specific (battlefields, bridges, high vantage points) |
| Animal Analog | Hawk — proud, territorial, precise, observes from above |

## Appearance

A single straight blade, about 80cm long, with a slight curve toward the tip. The guard is minimal — a small crosspiece that reads as a shoulder line, giving the creature a vaguely humanoid silhouette when standing upright. The blade surface is brushed steel, non-reflective except at the cutting edge, which catches light in a thin bright line.

The pommel (base) is weighted, allowing the creature to balance vertically on its tip. When upright, Sabre looks like a sentinel — a narrow, rigid figure standing at attention.

The blade edge is not sharp in a dangerous way. It's sharp in an aesthetic way — clean, defined, authoritative. Sabre is a creature of lines, not curves.

Optional: googly eyes on the flat of the blade, just below the guard (the "face" area). When Sabre tilts to look at something, the eyes stay gravity-oriented, creating a head-tilt effect like a bird of prey assessing a mouse.

## Movement & Behavior

### Idle
- Balances on tip, perfectly vertical, at the highest point in its territory
- Rotates slowly in place — a full 360 every 8 seconds — scanning
- Occasionally tips forward in a precise 15-degree bow, holds for 2 seconds, then returns to vertical (a targeting assessment — it saw something and is measuring distance)
- The blade catches ambient light and throws a thin reflection line across nearby surfaces — a lighthouse sweep
- Does not drift or wander. Sabre stays where it plants itself.

### Alert (player approaches)
- Stops rotating. Faces the player directly — flat side toward them, edge invisible, minimizing visual profile
- Tilts forward 30 degrees — the bird-of-prey lean
- If the player continues approaching, Sabre performs a single fast slash through the air (45-degree diagonal cut, 0.2 seconds) and returns to guard position
- The slash is a warning. There's no damage. But the air displacement is real — nearby particles scatter, grass flattens
- If the player stops moving after the warning slash, Sabre tilts back upright. Respect acknowledged.

### Happy (after capture / in party)
- Escorts the player at shoulder height, blade-edge forward, moving in clean straight lines with sharp 90-degree direction changes
- Performs kata sequences while the player walks — precise cuts, blocks, and guards in repeating patterns
- Occasionally plants on a high point as the player passes (lamppost, wall top, rock) and watches the path ahead before catching up in a fast straight-line glide
- When the player stops, Sabre takes a guard position to their right, angled 45 degrees outward. Sentry stance.

### Startled
- Instant horizontal slash — a reflex, not a decision
- Returns to vertical, blade vibrating at a high frequency for 2 seconds (adrenaline)
- Orients toward the threat source and does not look away
- If the threat persists for more than 3 seconds, Sabre moves to intercept — placing itself between the player and the threat
- The only creature that steps toward danger instead of away from it

### Sleep
- Tips over slowly from vertical, falling in a controlled arc (not a collapse — a deliberate lay-down)
- Rests flat, horizontal, hovering 10cm above a surface
- The blade dims. The edge-line light fades.
- The guard piece rises and falls slightly — breathing
- Even sleeping, the pommel faces the most likely approach direction. Always guarding.

## How You Encounter It

High ground. Bridges. Battlefields. Anywhere that commands a view and has a single point of access.

Sabre claims the narrowest, most strategic position in any area and stands on it. You see it from a distance first — a thin vertical line on top of a bridge pillar, or at the center of a narrow canyon pass. As you approach, the line resolves into a blade.

Sabre is always between you and where you want to go. It picked that spot on purpose.

Special condition: Sabre only appears in areas with a clear territorial boundary — a bridge, a gate, a ridge line. It claims chokepoints. If the area has no defensible position, Sabre won't spawn there.

## Capture Sequence Difficulty

Hard. The capture sequence is a duel. Fastest and most technically demanding of the Tier 3 creatures.

The sequence is a call-and-response: Sabre performs a cut pattern (1-3 slashes in specific angles), and the player must mirror the pattern in reverse. Left diagonal becomes right diagonal. High cut becomes low cut. Thrust becomes retreat.

Timing is precise — 0.3-second windows. The patterns increase in length and speed across three rounds. Round 1: single cuts. Round 2: two-cut combos. Round 3: three-cut combos with a feint (one cut that should NOT be mirrored — the player must read it as a feint and hold).

The feint is what separates success from failure. Sabre's feints look identical to real cuts for the first 75% of the motion. Only the final 25% diverges — the blade pulls back instead of following through. Players who commit to mirroring before seeing the full motion get caught.

Failed attempt: Sabre performs a clean salute (blade raised vertically, then swept down in a formal dismissal) and returns to its post. The player is not harmed but is clearly outclassed. Sabre respawns at a different chokepoint the next day.

## Party Role

The protector. Sabre is the only Tier 3 creature with a direct combat role.

When Sabre is in your party, environmental hazards that threaten the player trigger an intercept — Sabre moves to block, deflect, or cut the threat before it reaches the player. Falling debris, projectile traps, sudden creature lunges: Sabre handles them.

Special ability: **Clean Cut.** Sabre can sever a single connection — a rope, a chain, a vine bridge support, a lock hasp. One cut, one target, exact precision. Useful for puzzle-solving where the player needs to release something specific without disturbing what's around it.

Creature interactions:
- Respects Dragonstik (fellow ancient — the monk and the warrior nod to each other)
- Guards Crysta without being asked (stands sentinel near the motionless ball)
- Chukka sees Sabre as a rival, postures aggressively — Sabre ignores it completely, which makes Chukka angrier
- Stavvy tries to spar with Sabre. Sabre tolerates this with visible patience, performing slow-motion cuts that Stavvy can follow

## 3D Implementation Notes

Single blade mesh with guard and pommel geometry. The balance-on-tip state requires a stabilization system similar to Dragonstik's — small random torque with delayed counter-torque — but much stiffer. Sabre's balance looks effortless; the corrections should be nearly invisible.

Slash animations: keyframed, not procedural. The cuts need to feel authored — precise angles (45, 90, 135 degrees), consistent speed, clean arcs. A slash should complete in 6-8 frames at 60fps for the warning cut, 3-4 frames for the startled reflex.

The lighthouse reflection: a narrow spot light parented to the blade, aimed along the flat, casting a thin beam that sweeps as the blade rotates. The beam should be visible as a volumetric line in dusty/foggy environments, invisible in clean air (use the scene's particle density to modulate beam visibility).

Movement style: linear interpolation between positions, not ease-in-ease-out. Sabre moves in straight lines and stops hard. No drift, no overshoot, no settle. The 90-degree direction changes should be exactly 90 degrees with zero blend frames.

The kata system (happy state) can use a small library of 4-5 authored cut sequences played in randomized order with randomized pauses between them.

## Voice / Sound

No speech. Sabre communicates through:
- The singing steel of a blade cutting air — a clean, high-pitched slice (pitch rises with speed)
- A low resonant ring when planted vertically (the blade vibrates at its natural frequency, a sustained tone)
- Sharp metallic *ting* when the startled reflex fires (blade meets imaginary resistance)
- The soft whistle of a slow kata cut — the same steel-on-air tone at half speed, half volume
- A single deep note when laying down to sleep — like a tuning fork being dampened
- Silence when scanning. The absence of blade-sound means Sabre is watching, not moving.

## Design Intent

Sabre is the creature that teaches the player respect for space. Stavvy follows. Orbelle orbits. Meteora claims area. Sabre claims a point and says "no."

The player's first instinct will be to walk through the chokepoint. Sabre's warning slash reframes the encounter: this is not a passable obstacle. This is a creature with an opinion about who belongs here.

Capturing Sabre is an earned relationship. The duel isn't a test of strength — it's a test of whether the player can speak Sabre's language. Mirror the cuts. Read the feints. Show you understand the discipline. Sabre doesn't join the weak. It joins the attentive.

The emotional beat: the first time Sabre intercepts a threat the player didn't see coming. A falling rock, a trap trigger, something from the blind side. Sabre was already there, blade-edge out, before the player registered the danger. It was watching the whole time. That's what hawks do.
