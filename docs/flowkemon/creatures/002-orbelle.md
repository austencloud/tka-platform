# #002 — Orbelle

> A tethered orbit that never quite lands. You can't grab it. It grabs you.

## Identity

| Field | Value |
|-------|-------|
| Name | Orbelle |
| Prop | Poi |
| Tier | 1 — Common |
| Rarity | Common (found in starter area) |
| Animal Analog | Cat — curious, approaches on its own terms, pulls away the moment you reach for it |

## Appearance

Two weighted pods connected by flexible tethers to a shared center point that floats at roughly waist height. The pods swing in continuous arcs around the center, tracing circles in different planes. The tethers flex and drape with centrifugal tension — taut when swinging fast, sagging into catenary curves when slow. The pods have a soft glow that brightens at speed and dims when the orbits decay.

Optional: one googly eye per pod. They spin with the rotation, so the eyes are perpetually dizzy.

## Movement & Behavior

### Idle
- Pods orbit the center point in opposing circles, tracing butterfly and extension patterns
- Orbits drift between planes — wall plane, wheel plane, floor plane — never settling on one
- Wraps around nearby vertical objects (lamp posts, fence posts, tree trunks) then unwinds
- The whole assembly drifts slowly through the environment, tethered to nothing but orbiting everything

### Alert (player approaches)
- Orbit radius shrinks — pods pull in tight, spinning faster
- Center point drifts toward the player in a spiral approach, never straight
- One pod extends toward the player while the other stays in tight orbit — the cat reaching out a paw
- If the player moves too fast, both pods snap back to tight orbit and the center point retreats

### Happy (after capture / in party)
- Orbits widen into full extensions — generous, sweeping arcs
- Wraps around the player briefly then unwinds (a poi hug)
- Traces flowers and geometric patterns in the air — the showing-off phase
- Occasionally tangles its own tethers, pauses, then untangles with a little shimmy

### Startled
- Pods collapse inward, wrapping tight around the center point like a cocoon
- Tethers wind up into a tangled knot
- Center point drops altitude sharply
- Slowly unwinds after a few seconds, one cautious orbit at a time

### Sleep
- Pods hang straight down from the center point, pendulum-still
- Center point descends to knee height
- Occasional micro-swing, like breathing — a pendulum that never fully stops
- Tethers drape in loose catenary curves

## How You Encounter It

Orbelle lives anywhere with vertical structures. Lamp posts, pillars, fence lines, trees. You spot it from a distance by the motion — something orbiting a lamp post that shouldn't be there. Walk closer and the orbit shifts to the next post over. Follow it through three or four posts and it starts orbiting you instead, but at a distance. The capture window opens when it wraps around something and pauses to recalculate.

Common in the starter area's town square, where there are plenty of posts and columns to orbit. Also found along fence-lined paths. Rarer in open fields — Orbelle needs things to wrap around.

## Capture Sequence Difficulty

**Easy.** Orbelle comes to you. The challenge is patience, not skill. Players who charge at it will chase it from post to post forever. Players who stand still near a vertical object will find Orbelle orbiting them within 30 seconds. The capture sequence triggers when the player performs a circular motion — Orbelle recognizes the gesture as kin.

Wrinkle: if the player performs the sequence too aggressively, Orbelle interprets it as a competing orbit and retreats. Smooth and steady wins.

## Party Role

Orbelle is the scout. Its natural orbit behavior makes it the first creature to investigate anything new — it circles unknown objects, creatures, and landmarks before the rest of the party approaches.

Interactions with other creatures:
- Orbits around Stavvy endlessly (Stavvy watches, confused but patient)
- Tangles with Ropey (both tether-based — territorial dispute over wrapping rights)
- Terrified of Klubba (airborne objects near tethers = tangle risk)
- Mesmerized by Crysta (orbits the motionless ball at decreasing radius, never touching)

Special ability: **Tether Sense.** Orbelle can detect creatures behind walls and obstacles by extending a pod around corners. Acts as a proximity radar in unexplored areas.

## 3D Implementation Notes

Core system: two sphere meshes on invisible tether constraints, parented to a floating center node. Tether physics use a simple verlet chain (3-4 segments per tether) with centrifugal force simulation — the same math that drives real poi trajectory. Center node handles creature-level pathfinding and drift.

Orbit patterns can pull from TKA's existing motion-type definitions — extension, butterfly, and weave patterns are already mathematically described in the platform's letter system. The idle behavior cycles through a few of these.

Wrapping behavior: when the center node is within range of a vertical collider, one or both pods switch to an orbit anchored on that collider instead of the center point. Unwinding reverses the process.

State machine:
- IDLE → ALERT (player proximity, gradual transition based on distance)
- ALERT → RETREAT (player velocity exceeds threshold)
- ALERT → HAPPY (post-capture)
- ANY → STARTLED (audio/proximity event)
- IDLE → SLEEP (no nearby movement for 90s)

## Voice / Sound

No speech. Orbelle communicates through:
- Rhythmic whooshing (contented orbiting — the faster, the happier)
- Soft thwip of tethers going taut (alert, interested)
- Tangle clatter (startled — pods knocking together as tethers wind up)
- Whisper-quiet pendulum creak (sleeping)
- A single bright *whip-crack* when a pod reaches full extension at speed (showing off)

## Design Intent

Orbelle teaches the player that creatures have their own terms for interaction. You cannot approach Orbelle directly — it approaches you, in spirals, on its schedule. This is the first creature the player catches, and the catch mechanic rewards patience over aggression. That lesson carries through the entire game.

Orbelle also introduces tether physics as a movement family distinct from Stavvy's rigid-body behavior. The player should feel the difference immediately: Stavvy is solid and grounded, Orbelle is fluid and indirect. Two sticks versus two weights on strings. Same world, completely different physics, completely different personality.
