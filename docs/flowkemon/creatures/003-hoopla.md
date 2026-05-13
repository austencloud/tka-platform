# #003 — Hoopla

> A hoop that rolls away laughing. You will chase it. It knows you will chase it.

## Identity

| Field | Value |
|-------|-------|
| Name | Hoopla |
| Prop | Hoop |
| Tier | 1 — Common |
| Rarity | Common (found in starter area) |
| Animal Analog | Golden retriever — boundless energy, wants you to chase it, no concept of personal space once it likes you |

## Appearance

A single rigid ring, roughly three feet in diameter, with a faint iridescent shimmer along its surface. The ring is slightly thicker than a real hoop — giving it a chunky, toylike quality. When rolling, it catches light along the leading edge. When spinning on-body (on the ground, on a post), the surface blurs into a continuous band of color.

Optional: two googly eyes mounted on the inner surface of the ring, visible when Hoopla faces the player flat-on. When rolling edge-on, the eyes vanish. This means Hoopla only "looks at you" when it stops.

## Movement & Behavior

### Idle
- Rolls along paths at a leisurely pace, following the terrain's contour
- Hits a bump or slope change and wobbles — precession oscillation, the hoop leaning side to side before stabilizing
- Occasionally tips over, spins flat on the ground like a coin, slows to a wobble, then pops back upright and rolls again
- Gravitates toward downhill slopes

### Alert (player approaches)
- Rolls faster — just enough to stay ahead
- Takes turns at intersections, always picking the path away from the player
- Looks back (tips to face the player flat-on for a split second, then snaps back to rolling edge)
- If the player stops chasing, Hoopla wobbles to a stop and waits. The moment the player steps forward, it rolls again.

### Happy (after capture / in party)
- Rolls tight circles around the player's feet
- Hops up and spins around the player's torso (on-body hooping, the signature hoop move)
- Oscillates between waist-level and ground-level orbits — the hoop equivalent of jumping up and down
- Rolls ahead on the path, comes back, rolls ahead again — fetching nothing, returning with nothing, thrilled about it

### Startled
- Tips over flat and spins rapidly on the ground — a defensive disc
- The spin creates a low hum and slight ground vibration
- Anything that steps on it gets launched (minor knockback to other creatures)
- Slowly decelerates, wobbles, tips back upright

### Sleep
- Leans against the nearest wall or vertical surface at an angle, motionless
- If no wall is available, lies flat on the ground
- Occasional slow roll back and forth — a few inches each way — like breathing
- Surface shimmer dims to almost nothing

## How You Encounter It

Hoopla lives on paths. Roads, trails, boardwalks, any long continuous surface. You see it in the distance, rolling along the path ahead of you, and your instinct is to chase it. That's the trap. Hoopla is faster than you on a straight path. You catch it at the wobble — when it hits terrain changes, bumps, or transitions between surface types (dirt to stone, flat to slope), it decelerates and wobbles. The capture window opens during the wobble.

Alternatively, let it roll past you. If Hoopla rolls out of sight ahead and you don't chase, it circles back and rolls past you the other direction, closer. Do this three times and it stops next to you, tipped flat, waiting.

Found on every path in the starter area. Loves long downhill stretches. Multiple Hooplas sometimes roll together in a line, spaced evenly, like a hoop caravan.

## Capture Sequence Difficulty

**Easy.** The difficulty is self-inflicted. Players who chase Hoopla make it harder — it speeds up. Players who recognize the wobble windows or the "let it come to you" pattern catch it quickly. The capture sequence itself is a rolling motion — draw a circle. Hoopla responds to circular gestures because that's what it is.

Wrinkle: Hoopla on a steep downhill slope is nearly uncatchable in motion. The wobble windows shrink because gravity keeps it stable. Uphill Hooplas wobble constantly and are trivially easy.

## Party Role

Hoopla is the pathfinder. It naturally rolls ahead of the party along whatever path you're on, scouting the route. It returns if it encounters something — a dead end, a creature, a fork in the road — by rolling back and wobbling in place.

Interactions with other creatures:
- Rolls circles around Stavvy (Stavvy tries to follow and gets dizzy)
- Orbelle tries to orbit it — Hoopla rolls away, creating a chase spiral that goes nowhere
- Fascinated by Cyrus (Cyr wheel = the biggest hoop Hoopla has ever seen)
- Bounces off Klubba mid-air (the collision sends Hoopla wobbling and Klubba tumbling)

Special ability: **Terrain Reader.** Hoopla's wobble frequency indicates ground stability. More wobble = rougher terrain. In dungeon or cave areas, watching Hoopla roll ahead reveals unstable floor sections before the player steps on them.

## 3D Implementation Notes

Core system: a torus mesh with rigid-body rolling physics. The rolling behavior needs proper angular momentum simulation — the hoop maintains its plane of rotation due to gyroscopic stability, and wobble (precession) kicks in when angular velocity drops. This is the same physics that makes a real hoop stay upright.

Ground contact uses a single-point raycast from the bottom of the torus to the terrain. Surface normal changes trigger wobble — the steeper the normal transition, the more precession. Flat-spin mode (startled, coin-wobble) switches from rolling contact to a spinning-disc simulation with angular decay.

On-body orbit (happy state) parents the hoop to an invisible orbit path around the player character, with vertical oscillation layered on top.

State machine:
- IDLE (rolling) → ALERT (player enters detection range, from behind)
- ALERT → FLEE (player velocity toward Hoopla)
- ALERT → WAIT (player stops moving)
- WAIT → ALERT (player resumes)
- FLEE → WOBBLE (terrain change detected)
- ANY → HAPPY (post-capture)
- ANY → STARTLED (audio/collision event)
- IDLE → SLEEP (stationary for 120s)

## Voice / Sound

No speech. Hoopla communicates through:
- Smooth rolling hum on hard surfaces (contentment)
- Rattling chatter on rough surfaces (excitement or complaint, depending on speed)
- Wobble-wobble-wobble — a rhythmic tipping sound during precession (the laugh)
- Coin-spin descending whirr (startled flat-spin)
- A single hollow *bong* when it hits something (surprise)
- Silence when sleeping, except the faintest back-and-forth scrape

## Design Intent

Hoopla teaches the player that not everything is caught by approaching it. The chase instinct is a trap — Hoopla rewards the player who reads the environment (wobble windows, terrain, slope) or who simply waits. This is the game's first lesson in reading prop physics to solve a problem rather than brute-forcing it.

Hoopla also introduces rolling as a movement family. Stavvy bobs. Orbelle orbits. Hoopla rolls. Three common creatures, three fundamentally different physics systems, three different strategies to catch them. By the time the player has all three, they understand that every creature in this game moves the way its real-world prop does — and that understanding the prop is how you understand the creature.
