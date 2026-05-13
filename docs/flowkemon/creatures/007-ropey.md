# #007 — Ropey

> A coil of weighted rope hiding in the tall grass, waiting for something to wander close enough.

## Identity

| Field | Value |
|-------|-------|
| Name | Ropey |
| Prop | Rope Dart |
| Tier | 2 — Uncommon |
| Rarity | Found exploring — tall grass, underbrush, rocky crevices, anywhere with cover |
| Animal Analog | Snake — coiled ambush predator, explosive strike, surprisingly calm when not hunting |

## Appearance

A length of braided rope, about 12 feet total, with a weighted dart head at one end and a tail knot at the other. The rope is weathered — dark fiber with frayed sections that make it look like part of the terrain. The dart head has a dull metallic sheen, teardrop-shaped, heavy enough to pull the rope taut in a straight line when it strikes.

When coiled, Ropey looks like a pile of old rope someone left behind. The dart head tucks under the outer coils, hidden. Only the faintest rhythmic tightening of the coils — a breathing pattern — gives it away.

Optional: two googly eyes on the dart head. They face the direction of the next strike. If you see the eyes, you're already in range.

## Movement & Behavior

### Idle
- Coiled in a flat spiral on the ground, motionless except for a slow rhythmic pulse (coils tightening and loosening, ~4 second cycle)
- Dart head tucked under the outer ring, invisible
- Tail end flicks occasionally — a single loop lifts, curls, and settles back down
- If a butterfly, leaf, or ambient particle passes within 2 meters, the entire coil tenses — every loop tightens simultaneously — then relaxes when the object exits range
- Between tension events, Ropey slowly repositions by uncoiling one side and re-coiling offset by a few inches. Migration speed: about 1 meter per minute

### Alert (player approaches)
- Outer coils loosen and spread — the spiral opens like a flower, revealing the dart head
- Dart head rises on a short section of rope, oriented toward the player — a cobra's hood
- The body begins slow lateral oscillation — the rope swaying side to side, building momentum
- If the player freezes: Ropey freezes too. Standoff. The rope holds its S-curve, dart head fixed in space, waiting
- If the player retreats: dart head tracks them for 3 seconds, then Ropey slowly re-coils. It remembers where they were

### Happy (after capture / in party)
- Loosely draped around the player's path, weaving between their feet without tripping them
- Dart head rides at hip height off to one side, bobbing like a dog's head out a car window
- Periodically launches the dart head forward to tag a tree, lamppost, or rock — wraps once, yanks itself forward, releases. Rope dart parkour
- The tail end wags. Literally wags. The knot swishes back and forth

### Startled
- Full-length snap — the entire 12 feet of rope goes rigid in a straight line, dart head at maximum extension
- Hangs there for a beat (the crack of a whip, frozen in time)
- Then recoils violently back into a tight defensive coil, twice as fast as the strike
- Won't re-emerge for 10 seconds. The coil pulses rapidly. Catching its breath

### Sleep
- Loose figure-eight on the ground (the natural resting shape of a rope dropped from height)
- No pulsing. No tension. Completely limp
- Dart head rests on the ground, pointed at nothing
- If disturbed: one coil lifts lazily, flops back down. The rope equivalent of rolling over

## How You Encounter It

Ropey lives where things hide. Tall grass at the edge of clearings. Between rocks in canyon biomes. Under the canopy in dense forest. Always on the ground, always near a path where creatures or players travel.

You don't find Ropey. Ropey finds you. The encounter begins when you walk through what looks like empty terrain and the ground tenses. A section of what you thought was dead vine or fallen branch starts breathing. By the time you notice, the dart head is already up and tracking.

Special encounter: occasionally Ropey strikes at an ambient creature (butterfly, small critter) and misses. The dart head shoots out, wraps around a branch, and Ropey hangs there looking embarrassed while it slowly retracts. These failed-hunt moments are the player's best window to approach — Ropey is literally tangled and can't strike or flee.

Time of day matters. Ropey is more active at dawn and dusk — ambush predators work the transition hours. Midday Ropeys are sleepy and easier to spot (but they're also grumpier when woken up, making capture harder).

## Capture Sequence Difficulty

**Medium-Hard.** The difficulty is timing.

Ropey's capture sequence is a call-and-response rhythm. The player performs a movement, and Ropey mirrors it with a strike. The player has to match their next movement to Ropey's retraction timing — the gap between strike and recoil. Get the rhythm wrong and Ropey re-coils defensively, resetting the encounter.

Rope dart manipulation is about pendular momentum — letting the weight swing through arcs and redirecting it at the right moment. The capture sequence reflects this: the player's inputs need to flow, not stutter. A perfectly timed sequence feels like a conversation. A mistimed one feels like interrupting.

Failure penalty: Ropey relocates after a failed capture. It uncoils, slithers (rope sliding across the ground, dart head leading) to a new hiding spot 20-30 meters away, and re-coils. The player has to find it again.

## Party Role

Ropey is the party's trapper. In encounters with wild creatures, Ropey can lash out and slow them down — a brief wrap around whatever geometry the target has, buying the player time to set up a capture sequence.

Interaction with other party members:
- Wraps loosely around Stavvy's staves — Stavvy tolerates this for about 5 seconds, then shakes Ropey off
- Tries to strike at Orbelle's poi. Misses every time. The poi orbit is too fast. Ropey gets progressively more frustrated
- Gives Levvi a wide berth. The floating wand confuses Ropey's depth perception — it strikes at where Levvi appears to be and hits nothing
- Coils around Baton protectively. Smaller creature. Must protect

Special ability: **Tether.** When Ropey is in the active party, the player's capture range extends — Ropey can launch its dart head to tag a fleeing creature at distance, keeping it in encounter range for 3 extra seconds.

## 3D Implementation Notes

Rope body: spline-based tube geometry with per-segment physics (verlet integration, 24 segments). Dart head is a separate rigid body connected to segment 0 with a distance constraint.

Coil state: target positions arranged in an Archimedean spiral; segments spring-lerp toward targets. Strike: dart head gets an impulse along the aim vector; rope segments follow via chain constraint. Recoil: reverse impulse with higher damping.

Idle pulse: scale the spiral radius with a sine wave (amplitude ~5% of coil radius). Slither locomotion: propagate a lateral sine wave down the segment chain with the dart head leading.

Ground conformance: each segment raycasts to terrain and maintains a fixed hover height of 2cm. Grass interaction: segments apply a small radial force to nearby grass shader instances (displacement map push).

## Voice / Sound

No speech. Ropey communicates through:
- A dry sliding sound when repositioning (rope dragging across ground — leather on stone)
- A sharp crack on strike (the snap of a rope going taut at speed)
- A low hiss during alert state (rope fibers vibrating under tension — not a snake hiss, but close enough to trigger the same instinct)
- A soft thump when the dart head lands (weight hitting earth)
- Rapid clicking when happy (the tail knot slapping against the rope body during wagging)

The crack is the signature. Players will hear it before they see Ropey, and after a few encounters, that sound alone will make them stop and scan the grass.

## Design Intent

Ropey is the first creature that makes the player feel hunted. Tier 1 creatures are friendly or playful — they come to you or run away. Ropey watches you approach, waits until you're in range, and strikes. The power dynamic flips.

The encounter design rewards observation. Players who rush through grass get ambushed. Players who slow down and watch for the breathing pattern, the coil tension, the tail flick — they get the drop on Ropey instead.

Once captured, Ropey's personality inverts. The ambush predator becomes a loyal guard dog with a very long leash. The dart head that struck at you now strikes on your behalf. That transition — from threat to protector — is Ropey's emotional beat. You tamed the thing that scared you, and now it scares things for you.
