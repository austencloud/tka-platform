# #014 — Crysta

> It was on the pedestal. Now it's on the floor. You didn't see it move. Neither did anyone else.

## Identity

| Field | Value |
|-------|-------|
| Name | Crysta |
| Prop | Contact Ball (Acrylic) |
| Tier | 3 — Rare |
| Rarity | Biome-specific (crystal caves, still-water grottos, libraries) |
| Animal Analog | Spider — perfectly still, then suddenly somewhere else |

## Appearance

A single sphere, roughly palm-sized, made of perfectly clear acrylic. The surface catches and refracts light so completely that the ball appears to be made of solidified water — or nothing at all. In bright light, it's a lens that warps the world behind it. In dim light, it's nearly invisible except for a faint highlight.

The ball has no glow, no trail, no particle effects. It is a sphere that looks exactly like a real contact juggling ball. Its power is that it doesn't look like a creature at all.

The only tell: a faint internal caustic pattern — light bending through the sphere creates a bright spot that slides across surfaces nearby. The bright spot moves even when the ball doesn't.

Optional: googly eyes. They are inside the ball, suspended in the clear acrylic, slightly magnified by the lens effect. They look larger than they should. They do not blink. Ever.

## Movement & Behavior

### Idle
- Sits on a surface. Does not move.
- Completely, absolutely, unnervingly still
- The caustic light pattern it casts on the ground rotates slowly, which is impossible because the ball isn't rotating
- If the player looks directly at Crysta for 10+ seconds, it begins to appear to float — rising by millimeters, so slowly the player questions whether the surface was always that far away
- If the player looks away and looks back, Crysta is in a different position. Same surface, different spot. No animation plays. It's just there now.

### Alert (player approaches)
- Does not move. Does not react.
- The player gets closer. Still nothing.
- At 2m distance, the caustic pattern freezes
- At 1m distance, the player's reflection in the ball's surface begins tracking the player's movement with a barely perceptible delay — the reflection is watching
- If the player circles Crysta, the ball doesn't rotate to follow. But the caustic pattern does.

### Happy (after capture / in party)
- Rolls along the player's arm, shoulder, and back in classic contact-juggling isolation paths
- Appears to float motionless while the player moves — the isolation illusion. The ball stays fixed in world space and the player's body flows around it
- Occasionally teleports (no animation, just appears) to the player's other hand
- When the player stops moving, Crysta settles into their palm and goes still
- The caustic pattern draws small, warm shapes on the player's skin — circles, spirals

### Startled
- Drops. Straight down, hard, fast.
- Hits the ground with a heavy crystalline *tink*
- Rolls to the nearest shadow and stops
- The internal caustic goes dark — no light passes through. The ball becomes opaque for 3 seconds
- Then the caustic slowly returns, and Crysta resumes stillness as though nothing happened

### Sleep
- Rests in a concave surface — a bowl, a cupped stone, a depression in the ground
- Indistinguishable from a decorative object
- No movement. No light play. No caustic.
- The only sign it's alive: the ambient temperature within 0.5m is slightly lower than the surrounding area (visible as faint condensation on nearby surfaces in humid biomes)

## How You Encounter It

Still places. Crystal caves where the only sound is dripping water. Libraries with dust on every surface except one shelf. Grottos where the pool is so still it reflects perfectly.

Crysta doesn't appear. It was already there. You walked past it three times before you noticed something on that pedestal / shelf / rock that wasn't there before. Or was it? The player's memory of the room is now unreliable.

The discovery mechanic is unique to Crysta: the creature spawns when the player first enters the area, placed in a spot the player hasn't directly looked at. When the player's camera sweeps past Crysta's position for the first time, it's already sitting there, still, looking like it's been there forever. There is no spawn animation.

Special condition: Crysta only appears in areas where the player is alone and moving slowly. If the player is sprinting or has party creatures deployed nearby, Crysta won't manifest. It waits for quiet.

## Capture Sequence Difficulty

Hard. The capture sequence is an isolation test — the player must demonstrate stillness, not action.

Phase 1: Crysta presents a position in 3D space (highlighted by its caustic light). The player must move their input to that exact position and hold perfectly still. Any drift beyond a tight tolerance resets the phase.

Phase 2: Crysta moves. The player must NOT react. The input must remain locked on the original position while Crysta teleports to a new location in their peripheral vision. The instinct to track the movement is the test — and the trap.

Phase 3: The ball and the target position separate. The caustic light shows one location; Crysta is in another. The player must choose which to hold — the real position or the illusion. The correct answer is the illusion. Crysta's whole identity is the isolation trick: the ball appears to be where it isn't. You hold where it appears to be, not where it is.

Failed attempts: Crysta doesn't flee. It just goes still, and when the player looks away, it's gone. No animation, no sound, no departure. It comes back the next time the player enters a qualifying area.

## Party Role

The sensor. Crysta detects things other creatures miss.

When Crysta is in your party, it acts as a proximity alarm for hidden creatures and traps. It doesn't glow or ping — it teleports. If something hidden is nearby, Crysta appears on top of it. The player learns to watch where Crysta goes.

Special ability: **Isolation Field.** Crysta can freeze a small area (3m radius) for 5 seconds — everything inside appears to stop. Projectiles hang in air. Falling objects pause. Other creatures in the radius go idle-state. Nothing actually stops; it's a visual illusion that buys the player time to read the situation.

Creature interactions:
- Buugen is fascinated (two creatures that play with perception, circling each other in mutual study)
- Stavvy nudges Crysta repeatedly, confused by the lack of response, eventually gives up
- Meteora's wind displacement doesn't move Crysta (the ball is impossibly heavy for its size in this universe)
- Sabre ignores Crysta entirely, which is the only appropriate response to something that won't react

## 3D Implementation Notes

Single sphere mesh, high-polish PBR material with refraction (IOR ~1.49, matching real acrylic). The key visual is the caustic — use a projected caustic texture on the ground plane beneath the ball, driven by a light source above. Animate the caustic rotation independently of the ball rotation.

The isolation illusion (ball stays fixed in world space while the player moves) requires parenting the ball to world space during that animation state, then smoothly reparenting to the player rig when transitioning to the rolling-on-body state.

Teleportation: no lerp, no tween, no particle effect. On the frame the player's camera is not pointed at Crysta (dot product of camera forward and ball direction < threshold), update the ball position instantly. The absence of transition IS the effect.

The "reflection that tracks" alert behavior: use a small reflection probe or environment map on the ball surface, with a subtle delay (50-100ms) on the probe position update relative to the camera. The delay creates the "it's watching" feeling without any obvious animation.

Temperature condensation effect: small particle system (slow, ground-hugging mist particles) in a 0.5m radius around the sleep position. Subtle. If the player isn't looking for it, they won't see it.

## Voice / Sound

No speech. Crysta communicates through:
- Silence (the primary communication — Crysta is quietest creature in the roster)
- A crystalline *tink* on impact when startled (glass-on-stone, bright and brief)
- A barely audible harmonic hum when the caustic pattern is active — like running a wet finger around a wine glass rim, but quieter. Players with headphones will hear it. Speakers might not.
- The sound of the ball rolling on skin during the happy state — a smooth, continuous tone that changes pitch with contact pressure
- No sound on teleport. The silence where a sound should be is the point.

## Design Intent

Crysta is the creature that breaks the fourth wall of "creature." Every other creature in the roster moves, emotes, reacts. Crysta just sits there. The player has to project the personality onto it — to decide that the thing they're looking at is alive, despite no evidence.

And then it moves when they're not looking, and they realize: it was alive the whole time. Their perception was the limitation, not the creature's expressiveness.

This is a direct parallel to real contact juggling. The ball doesn't do anything. The manipulator creates the illusion. In Flowkemon, the player's attention creates the illusion that Crysta is inert — and Crysta uses that illusion against them.

The emotional beat: the player puts Crysta in their party and walks for five minutes without seeing it do anything. They start to wonder if it's bugged. Then they look down and the caustic pattern on their hand is drawing a spiral, and they realize Crysta has been there the entire time, resting in their palm, quiet.
