# #013 — Meteora

> Something is swinging through the canyon. It's getting closer. It does not care about your plans.

## Identity

| Field | Value |
|-------|-------|
| Name | Meteora |
| Prop | Meteor Hammer |
| Tier | 3 — Rare |
| Rarity | Biome-specific (canyons, open plains, high-altitude areas) |
| Animal Analog | Comet — unpredictable orbit, impossible to ignore once spotted |

## Appearance

A heavy, dense sphere — dark metallic, cratered like a real meteor — connected to a long, flexible tail of braided rope. The rope fades from solid near the weight to frayed and ghostly at the trailing end, giving it the look of a comet's tail.

The sphere has real mass to it. When it swings past, you feel the air displacement. The rope trails behind in a wide, sweeping arc that draws temporary circles and figure-eights in the air, visible as faint motion-blur trails that linger for half a second.

The weight end glows hot where it impacts surfaces — a brief orange flash on contact, like a meteor striking atmosphere.

Optional: googly eyes on the sphere. They rattle with each direction change, always a beat behind the motion — the sphere has already reversed direction but the eyes are still looking the other way. Permanently motion-sick.

## Movement & Behavior

### Idle
- Swings in large, looping arcs at a fixed anchor point (tree branch, cliff overhang, ruined archway)
- The pattern alternates between circular orbits and figure-eight wraps with no predictable cadence
- Each arc covers a radius of ~8m — far larger than any other creature's idle footprint
- Occasionally wraps the rope around its anchor, tightens the orbit to half-radius, then unwinds in a burst
- Makes a deep *whomp whomp whomp* as the weight displaces air on each pass

### Alert (player approaches)
- The orbit doesn't tighten — it widens
- Meteora extends its swing radius toward the player, the weight sweeping past at arm's length
- Not aggressive. Testing distance. "How close will you stand?"
- If the player stands still, the orbit stabilizes with the player just inside the swing path — the weight passing overhead, behind, underneath in a continuous near-miss
- The rope crackles with tension at full extension

### Happy (after capture / in party)
- Orbits the player instead of a fixed anchor — the player becomes the center of its path
- The orbit is friendly-chaotic: wide loops that occasionally tighten into a quick spiral around the player, then fling back out
- The weight taps the ground at the bottom of each arc with a satisfied *thunk*
- Sometimes wraps its rope loosely around the player's torso in a brief hug, then unspools
- Happiest in open spaces. Gets agitated in corridors.

### Startled
- The orbit collapses into a tight, fast vertical spin — the weight whipping in a defensive circle directly around its anchor point
- Radius shrinks to ~1m, speed doubles
- Anything that enters the spin radius gets swatted
- The rope makes a high-pitched whine at this speed
- Takes 5-6 seconds to calm down and widen back out

### Sleep
- The weight rests on the ground, heavy and inert
- The rope coils in a loose spiral around it
- Occasionally the weight shifts — rolling an inch, settling — like a dog adjusting in its sleep
- The comet-tail effect is gone. Just a dark sphere and some rope. Hard to believe it's the same creature.

## How You Encounter It

Open spaces with vertical structure. Canyons. Cliff faces. Ruined aqueducts with arches still standing.

You hear Meteora before you see it. The *whomp whomp whomp* of displaced air carries across the canyon. Follow the sound and you find the weight swinging between rock faces in a pattern that seems random until you watch for three full minutes and realize it's threading a path between six different anchor points, bouncing from one to the next like a cosmic pinball.

Meteora doesn't stay in one spot. Its orbit migrates. The anchor point shifts every 30-60 seconds as the rope wraps a new structure and the swing transfers. Tracking it requires following the sound, not the sight — by the time you spot the weight, it's already moving to the next anchor.

Special condition: Meteora appears only during wind events. Strong in-game wind activates the canyon biome's creatures, and Meteora uses the wind to extend its swing radius beyond what gravity alone would allow.

## Capture Sequence Difficulty

Hard. The capture sequence is a rhythm game against an opponent that doesn't keep rhythm.

The sequence requires the player to match Meteora's swing timing — input at the moment the weight passes through a target zone. But Meteora's timing shifts. Each pass is slightly faster or slower than the last, and the orbit periodically reverses direction without warning.

The challenge isn't speed. It's prediction. The player needs to internalize Meteora's momentum patterns well enough to anticipate the next pass. The weight can't stop on a dime — momentum is conserved — so there ARE patterns. They're just buried under the chaos.

A full-radius orbit change (figure-eight to circle, or the reverse) happens once during the capture sequence. If the player was locked into the old pattern, they fail. If they read the shift, they land the final input.

Meteora breaks free by wrapping its rope around a nearby structure and slingshotting away. You get one attempt per wind event.

## Party Role

The heavy hitter. Meteora is raw kinetic energy.

When Meteora is in your party, environmental obstacles that require force (stuck doors, cracked walls, loose boulders) can be cleared. Meteora wraps its weight through the obstacle in a wrecking-ball arc.

Special ability: **Momentum Transfer.** Meteora can launch other party creatures across gaps and distances they couldn't cross alone. It wraps, spins, and releases — the launched creature sails in a ballistic arc to the target.

Creature interactions:
- Orbelle is the only creature that naturally syncs orbit patterns with Meteora (both are tethered-orbit creatures)
- Crysta is completely unaffected by Meteora's wind displacement, which infuriates Meteora
- Stavvy retreats to 10m distance when Meteora is swinging (healthy respect for the physics)
- Chukka tries to match Meteora's energy and gets exhausted after 20 seconds

## 3D Implementation Notes

Sphere mesh for the weight (emissive on-contact shader, crater normal map). Rope is a dynamic chain/rope physics simulation — NOT a static mesh. Needs real tension, sag, and wrap behavior.

The rope should wrap around anchor-point colliders using a simplified constraint solver: when the rope contacts a cylinder/edge collider, it pins at that point and the free segment continues swinging from the new pivot. Unwinding reverses the process.

Swing physics: driven by a pendulum simulation with damping. The "random" feel comes from layering two pendulum frequencies (orbital and precessional) with slightly incommensurate periods. The result is quasi-periodic — feels chaotic, actually deterministic.

Comet-tail effect: trail renderer attached to the weight, with a gradient from solid to transparent over ~2m of trail length. Trail width narrows toward the end.

Impact flash: point light + particle burst at collision point, 0.15 second duration.

Collision avoidance with player: the swing path should have a soft repulsion zone around the player in non-alert states. In alert state, the repulsion inverts to attraction (but the weight still doesn't hit the player — it's a near-miss system with a minimum clearance of 0.3m).

## Voice / Sound

No speech. Meteora communicates through:
- *Whomp whomp whomp* — the weight displacing air, pitch tied to speed (Doppler shift as it passes the camera)
- Rope tension creak — a stretched-fiber sound when the orbit is at maximum radius
- Impact thunk — deep, resonant, felt more than heard when the weight contacts ground
- High-pitched whine during startled tight-spin state
- Silence when sleeping (just the occasional low scrape of the weight shifting on stone)

## Design Intent

Meteora is the creature that owns space. Its idle footprint is 8m radius — it dominates any area it occupies. The player has to respect the space the creature claims, physically navigating around the swing path.

This teaches a mechanic: some creatures aren't found by walking TO them. They're found by entering the space they control and surviving.

The emotional beat: standing inside Meteora's orbit for the first time. The weight passes overhead, behind your shoulder, under your feet. The air moves. You're inside a system of forces that could hurt you but doesn't. Meteora chose to let you stand here. The trust runs both directions.
