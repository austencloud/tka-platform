# #006 — Levvi

> A wand that floats where it shouldn't, watching you with the patience of something that has nowhere to be.

## Identity

| Field | Value |
|-------|-------|
| Name | Levvi |
| Prop | Levitation Wand |
| Tier | 2 — Uncommon |
| Rarity | Found exploring — forest clearings, abandoned stages, anywhere with good sight lines |
| Animal Analog | Owl — silent, watchful, unsettlingly present |

## Appearance

A single thin wand, about 18 inches long, matte black or pale birch depending on the biome. Floats perfectly horizontal at the player's eye level with no visible support. No string. No mechanism. Just hanging there.

The wand's surface catches light at wrong angles — a faint shimmer runs along its length like a soap bubble, hinting at the invisible force holding it aloft. When it moves, there's a barely perceptible lag, as if the air around it is thicker than it should be.

Optional: one googly eye, dead center. It doesn't blink often. When it does, the blink is very slow.

## Movement & Behavior

### Idle
- Hovers at exact eye level, maintaining altitude with eerie precision
- Drifts laterally at walking pace — slow enough to seem stationary until you look away and back
- Rotates on its long axis with glacial slowness (one full rotation per ~30 seconds)
- Occasionally rises or drops by a few inches, then corrects — the levitation equivalent of adjusting its glasses
- Maintains a fixed distance from the nearest surface (wall, tree, cliff face), as if magnetically repelled

### Alert (player approaches)
- Stops all drift. Locks position in space
- Rotates to point one tip directly at the player — a wand aimed, not a creature turning
- Rises by about a foot — not fleeing, just getting a better angle
- If the player circles it, the wand counter-rotates to keep one tip tracking them. The gaze follows
- No sound. No movement other than the tracking. The silence IS the alert state

### Happy (after capture / in party)
- Floats at the player's shoulder height, off to one side — a familiar perched on an invisible branch
- Begins slow figure-eight drift patterns, weaving in and out of the player's peripheral vision
- Occasionally floats directly in front of the player's face, hovers there for a beat, then slides back to its perch
- The shimmer along its surface brightens — a cat purring, expressed as light

### Startled
- Drops straight down by two feet, then catches itself — the levitation hiccupped
- Spins rapidly on its center point (like a compass needle that lost north)
- Shoots upward to twice its normal hover height
- Takes 3-4 seconds to stabilize, wobbling back to equilibrium with visible effort

### Sleep
- Descends slowly to about knee height
- Tips toward vertical — one end almost touching the ground, the other pointing up
- Rocks gently side to side, a metronome winding down
- The shimmer fades to nothing. In sleep, it looks like an ordinary stick someone leaned against the air

## How You Encounter It

Levvi appears in places with clear sight lines — forest clearings with a single shaft of light, the tops of hills, empty amphitheaters. Always at eye level. Always already watching when you arrive.

The trick is noticing it. Levvi doesn't move toward you or make noise. It's just there, floating, and most players will walk past it two or three times before the stillness registers as wrong. A stick floating at eye level in perfect silence. Your brain edits it out until it can't.

First encounter pattern: you enter a clearing. Nothing happens. You start to leave. Something in your peripheral vision isn't moving with the wind. You turn back. There it is. It was there the whole time.

Weather matters. Levvi doesn't appear during rain — the droplets would break the illusion, hitting something invisible. Overcast days, fog, still air. That's when Levvi hunts. (Levvi doesn't hunt. Levvi just watches. But the distinction feels academic when you're being watched.)

## Capture Sequence Difficulty

**Medium.** The difficulty isn't execution — it's patience.

Levvi won't flee or fight. It holds position and watches. The capture sequence requires the player to perform slow, deliberate movements — the kind of controlled motion that levitation wand manipulation demands. Rushing the sequence causes Levvi to drift backward, resetting the encounter. The wand rewards stillness and precision.

The failure mode isn't "too hard" — it's "too impatient." Players who spam fast sequences will chase Levvi across the entire clearing without catching it. Players who slow down and match its energy complete the capture in one attempt.

## Party Role

Levvi is the party's scout. It floats higher than other creatures and detects encounters before the player does — a faint directional shimmer along its length points toward nearby creatures.

Interaction with other party members:
- Hovers above Stavvy, looking down — Stavvy looks up, confused about where the wand went
- Positions itself between the player and Chukka — a silent, thin barrier
- Ignores Orbelle entirely. Orbelle orbits it anyway. Levvi does not acknowledge this
- Mirrors Ribbini's spirals at a different altitude — the two of them create an unintentional double helix

Special ability: **Stillness Field.** When Levvi is in the active party, wild creatures take longer to notice the player. The silence is contagious.

## 3D Implementation Notes

Single cylinder geometry with custom shader for the surface shimmer (scrolling noise texture, opacity modulated by view angle — Fresnel-adjacent). Hover position calculated relative to camera eye height, not world Y.

Drift uses Perlin noise on X/Z with very low frequency (0.05 Hz). Altitude maintenance via spring-damper targeting the player's head bone Y position.

Alert state tracking: wand forward vector lerps toward player position with high damping (feels like a turret, not a snap). Sleep transition: quaternion slerp from horizontal to 80-degree vertical over 4 seconds.

The "invisible support" shimmer is a thin volumetric line (additive blend, low opacity) connecting wand center to a point 2m directly above — visible only at certain camera angles, simulating the real-world string catch.

## Voice / Sound

No speech. Levvi communicates through:
- Near-silence (idle — the absence of sound IS its presence)
- A faint high-frequency hum when rising (the sound of air being displaced by nothing)
- A soft wooden clatter when startled (the wand tapping against its own invisible support)
- A single resonant tone when it detects a creature — like running a finger along the rim of a glass

The quiet is the point. In a party full of clattering, whooshing, spinning creatures, Levvi's silence stands out more than noise would.

## Design Intent

Levvi is the creature that makes the player uncomfortable in a way they can't articulate. Not threatening. Not hostile. Just... present. Watching. Floating where things shouldn't float.

It teaches a different capture cadence than the Tier 1 creatures. Stavvy teaches engagement. Orbelle teaches pursuit. Levvi teaches restraint. The player who tries to brute-force a Levvi capture learns that some things in Flowkemon reward slowing down.

Emotionally, Levvi occupies the "quiet friend" slot. It doesn't demand attention. It doesn't perform. It's just there, at your shoulder, floating in silence, and after a while you'd miss it if it left. The owl on the branch that you nod to every morning.
