# #017 — Triadi

> Three weights, one mind, zero consensus on which direction to go.

## Identity

| Field | Value |
|-------|-------|
| Name | Triadi |
| Prop | Triad (Astrojax / Triball) |
| Tier | 3 — Rare |
| Rarity | Biome-specific (junction points, crossroads, tidal zones) |
| Animal Analog | Ant colony — three-bodied hive mind, coordinated through connection |

## Appearance

Three weighted spheres, each roughly tennis-ball-sized, connected by two segments of cord. The end spheres are darker (deep maroon and midnight blue) and the center sphere is brighter (pale gold). The cord is thin but visible — it defines the creature's geometry at all times. You always know where the connections are.

The three spheres are never the same distance apart. The cord lengths shift: sometimes one segment is taut while the other hangs slack. Sometimes both are taut and the creature forms a rigid triangle. The geometry is always changing, always asymmetric.

Each sphere has a different surface texture: one matte, one glossy, one translucent. They read as three individuals forced into a single body. The translucent center sphere (the "brain") occasionally pulses with a faint internal light, as though processing a decision.

Optional: googly eyes on all three spheres. Six eyes total. They never look in the same direction. Ever.

## Movement & Behavior

### Idle
- The three spheres orbit each other in a continuous braid pattern — the cord wraps and unwraps as they weave
- The braid switches between vertical and horizontal planes, transitioning through a tumbling figure-eight
- The center sphere stays roughly stationary while the end spheres orbit it, then the roles swap — one end sphere becomes the anchor and the other two orbit
- Every few seconds, the formation collapses: all three spheres cluster together, cord bunched, pause for one beat, then burst apart into a new orbital pattern
- The cluster-burst cycle is the "breathing" rhythm. It looks like a system resetting.

### Alert (player approaches)
- All three spheres align in a straight line, cord segments taut, aimed at the player like an arrow
- The formation holds for 2 seconds — a collective assessment
- Then the end spheres split outward and upward, forming a wide V with the center sphere as the vertex
- The V-shape tracks the player: as the player moves left, the V rotates to keep the opening facing them
- If the player gets within 3m, the V collapses and the three spheres scatter in different directions — then snap back together at a new position 5m away
- The scatter-and-reform is instantaneous and disorienting. Where was it? Where is it now? The player has to re-locate all three spheres.

### Happy (after capture / in party)
- The three spheres distribute around the player: one ahead (scout), one beside (companion), one behind (rearguard)
- The cord connecting them drapes across the player's path — the player is literally inside the creature
- The formation adjusts in real-time as the player turns: the scout sphere always leads, rearguard always follows
- Occasionally the three spheres perform a "joy braid" — a fast weaving sequence around the player's body, cord wrapping and unwrapping like a maypole dance, then snapping back to formation
- When the player stops, all three spheres drift together and cluster near the player's hip — a resting huddle

### Startled
- Explosive scatter: all three spheres fly outward to maximum cord length in different directions
- The cords go taut. The creature becomes a rigid triangle at full extension — maximum footprint, maximum visual size
- Holds the full-extension triangle for 3 seconds, rotating slowly, assessing the threat from three angles simultaneously
- Contracts back to center in a fast collapse, then immediately re-extends toward the threat direction — a flinch-then-face response
- The three-angle assessment is Triadi's unique threat response: it doesn't have to turn to face danger. It's already facing every direction.

### Sleep
- The three spheres settle into a tight equilateral triangle on the ground, cord segments forming the visible sides
- Each sphere rotates slowly in place — not orbiting, just spinning on its own axis
- The individual spins are at different speeds, creating a quiet polyrhythmic clicking as each sphere taps the ground once per rotation
- The center sphere's internal pulse slows to one flash every 5 seconds — a heartbeat
- The triangle drifts very slowly across the ground during sleep — not walking, just following some imperceptible current. You can track where Triadi slept by the path in the dust.

## How You Encounter It

Junctions. Crossroads. Anywhere three paths meet.

Triadi lives at the intersection — literally. You arrive at a three-way fork in the path and notice three spheres hovering at the junction, one above each path. The cords between them form a triangle that spans the entire crossroads. You can't take any path without passing through the creature.

Triadi doesn't block you. It's not territorial like Sabre. It's studying the intersection. Each sphere monitors one path. The creature is a three-way sensor, and the crossroads is its domain because the crossroads is where information converges.

Special condition: Triadi only appears at junctions with exactly three paths. Two-way splits and four-way intersections don't qualify. The creature's geometry requires triangulation — three connection points, three observation angles.

## Capture Sequence Difficulty

Hard. The capture sequence is a coordination puzzle — three simultaneous tasks.

The screen splits into three zones, one per sphere. Each zone presents a simple pattern (match the rhythm, trace the path, hold the position). The patterns are individually easy. The difficulty is that all three run simultaneously and share a resource — the player's input. Attending to one zone means the others drift.

Phase 1: Two active zones, one idle. Manageable.

Phase 2: All three zones active with independent rhythms. The player must time-slice attention. Most players fixate on one and lose the other two.

Phase 3: The patterns synchronize for a 3-second window. All three zones align to a single beat. The player must recognize the sync moment and hit all three inputs simultaneously. The sync window occurs once. Miss it and the sequence fails.

The design mirrors the creature: three bodies, one mind. The player must think as a hive to catch a hive.

Failed attempts: Triadi scatters its three spheres down the three paths of the junction, one per path. The player can't follow all three. By the time they pick a path and follow one sphere, it's rolled back to a different junction. The creature reassembles at a new crossroads.

## Party Role

The network. Triadi extends the player's awareness in three directions.

When Triadi is in your party, the minimap (if one exists) or spatial awareness system gains three probe points — one per sphere — that fan out ahead of the player and detect creatures, items, and hazards at triple the normal range. The three probes triangulate positions, giving the player directional information (not just "nearby" but "ahead-left, 20m, moving toward you").

Special ability: **Three-Body Solution.** Triadi can split its three spheres to simultaneously activate three separate triggers or pressure plates. The player doesn't need to find rocks to weigh down switches; Triadi places one sphere on each. Any puzzle requiring three simultaneous inputs is trivialized — which is the reward for capturing a creature that tested coordination.

Creature interactions:
- Fascinated by other multi-part creatures (wraps its cord around Stavvy's two staves, trying to integrate them into its system)
- The three spheres vote on reactions to other creatures: two spheres lean toward Orbelle while one leans away, creating visible internal disagreement
- Chukka's two batons confuse Triadi — it keeps trying to count to three and failing
- Dragonstik's steady rolling is the only thing that gets all three spheres to synchronize without the cluster-burst reset

## 3D Implementation Notes

Three sphere meshes with different materials (matte, glossy, translucent with emissive pulse). Cord segments are dynamic line renderers or thin cylinder meshes with length driven by sphere-to-sphere distance.

The braid pattern: use three parametric paths (Lissajous curves with different phase offsets) for the orbital behavior. The three spheres' positions are sampled from three curves that share a common center but have staggered phase, creating the weaving effect. Transition between orbital configurations by cross-fading phase parameters.

Cord physics: the cord segments should hang with catenary sag when slack and straighten when taut. A simple spring constraint between sphere pairs, with gravity, gives the right feel. The cord should never clip through spheres — add collision avoidance at the connection points.

The scatter-reform behavior: cache the target formation position, apply explosive impulse to each sphere (direction = sphere position - center), then after a delay, apply a lerp back to a new formation position. The impulse should be strong enough that the cord goes fully taut before the return begins.

The V-formation tracking: compute the vector from center sphere to player, rotate end spheres to maintain a fixed angular offset (45 degrees each side) from that vector. Update each frame for smooth tracking.

Internal pulse on center sphere: animate emissive intensity with a sine wave (period = 2s idle, 5s sleep, 0.5s alert). The pulse should be visible through the translucent material — use a high emissive value and a slight bloom response.

Three-way audio: each sphere should have its own audio emitter. The player hears slightly different sounds from three positions, reinforcing the hive-mind spatial identity.

## Voice / Sound

No speech. Triadi communicates through:
- A three-voice chord: each sphere produces a different pitched hum (low, mid, high). The chord's quality changes with mood — consonant intervals when happy, dissonant when startled, unison when sleeping
- The *click* of cord going taut — a short, fibrous snap. Frequent during active states. Absent during sleep.
- A collective rattle when all three spheres cluster together — the sound of three objects touching simultaneously
- The polyrhythmic ground-tapping during sleep (three different tempos, drifting in and out of phase)
- During the scatter-reform: a brief silence (all three hums stop) followed by a harmonic re-entry (all three tones restart simultaneously in a major chord)
- The joy braid produces a rising chromatic scale as the spheres weave — each sphere's pitch shifts up as it passes through the formation

## Design Intent

Triadi is the creature that asks: what is an individual? Every other creature in the roster is a single entity — one body, one mind, one behavior set. Triadi is three bodies pretending to be one, or one mind spread across three bodies, and the player never quite resolves which.

The internal disagreement is the key personality trait. The three spheres don't always agree. Two lean toward something while one hangs back. One charges ahead while two cluster together. The player starts reading personalities into each sphere: the bold one, the cautious one, the curious one. Whether those personalities are real or projected doesn't matter. The player experiences Triadi as a group, not a unit.

The capture sequence reinforces this: you can't catch Triadi by focusing on one part. You catch it by thinking like it — distributed attention, simultaneous awareness, coordination across multiple fronts.

The emotional beat: the first time the player stops walking and Triadi's three spheres drift together into a cluster at their hip. Three separate entities, choosing to be close. Not because the cord forces them to — the cord was slack. Because they wanted to.
