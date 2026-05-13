# #020 — Glowr

> Something is pulsing in the dark. Colors that don't exist in daylight.

## Identity

| Field | Value |
|-------|-------|
| Name | Glowr |
| Prop | LED/Glow Props (podpoi, glow staffs, pixel whips, orbitals) |
| Tier | 4 — Legendary |
| Rarity | Night-only. Invisible by day. One spawn per night cycle. |
| Animal Analog | Anglerfish — bioluminescent, deep-dweller, lures with light |

## Appearance

A shifting assembly of light trails with no visible solid form. The "body" is implied by the movement of colored light through space — the way a glow poi's trail draws a circle, the circle becomes the creature. Multiple light sources orbit, spiral, and weave: two podpoi-like orbs tracing orbital paths, a central glow staff spine pulsing in sync, and trailing pixel whip tendrils that extend and retract like tentacles.

Colors cycle through programmed patterns — not random, deliberate. Each pattern has a name in the LED prop community (rainbow chase, fade-to-white, strobed trail). Glowr's color state reflects its mood.

In daylight: invisible. The LEDs are on, but ambient light drowns them completely. The player can walk directly through Glowr's position and never know. Only at night do the trails become visible against the dark.

No googly eyes. The brightest point of the central orb serves as the "face" — a single white pulse that tracks the player's position.

## Movement & Behavior

### Idle
- Drifts slowly through dark areas — caves, forests, deep water edges
- Light trails paint geometric patterns in the air: circles, figure-8s, flowers
- Patterns change every 15-20 seconds, cycling through a library of real LED mode presets
- Leaves fading afterimages — light trails persist for 2-3 seconds after the source moves on
- Attracts smaller nocturnal creatures. Insects (particle effects) orbit Glowr's light.

### Alert (player approaches)
- All lights shift to a single color — cool blue. Watching.
- Orbital speed increases. The trails tighten, drawing the "body" in closer.
- The central pulse brightens and locks onto the player. Unblinking.
- If the player holds still: Glowr slowly approaches, extending a single tendril of light toward them. Curiosity.
- If the player moves suddenly: Glowr strobes once (a camera-flash burst) and relocates 30m away in the darkness. The player sees spots.

### Happy (after capture / in party)
- Colors warm — purples, pinks, golden tones. Festival palette.
- Trails extend outward, painting the air around the player with geometric light art
- Syncs its color cycling to the player's movement rhythm — walk faster, colors shift faster
- At night, turns the player's immediate surroundings into a light show

### Startled
- All lights kill to black. Total darkness.
- A 2-second hold. Nothing visible.
- Then: a strobe burst in pure white, disorienting. Every trail fires simultaneously at max brightness.
- When vision returns, Glowr has changed its color palette entirely. Different creature, same location.

### Sleep
- Dims to a single slow pulse. One color. Deep violet.
- The pulse matches a resting heartbeat — ~60bpm
- All orbital motion stops. The light sources hang motionless in space.
- The faintest possible glow. A nightlight in the void.

## How You Encounter It

Glowr only exists after dark, and only in specific conditions: new moon nights (the darkest the game world gets) in the deep forest or cave biomes. Light pollution from torches, Fyr's flame, or the player's UI elements can mask Glowr. The game's brightness setting matters — players who crank gamma will never find it.

Prerequisite: the player must have completed at least one night-only exploration achievement. Glowr rewards players who've already proven they're comfortable in the dark.

The encounter starts with a peripheral cue. The player sees color at the edge of their screen — not in the center of view. A brief trail of magenta, gone when they turn to look. Then again, from a different direction. Glowr is circling the player, just outside visible range.

The player has to stop moving. Stand still. Let their in-game eyes adjust (a mechanical darkness-adaptation timer, 15 seconds of no movement). As adaptation completes, the world gets darker but Glowr gets brighter. Contrast reveals it.

Glowr is performing in the dark. Like a real LED flow artist at a festival late-night session — spinning for nobody, or for everybody, in a field where only the light is visible and the person holding the props has disappeared. The player walks toward a light show that has no visible performer.

If the player brings any external light source (torch, Fyr in party, lantern item) within 20m of Glowr, it vanishes instantly. The encounter requires committing to the dark.

## Capture Sequence Difficulty

Glowr's capture sequence is performed in near-total darkness. The player can barely see their own character.

The beats of the sequence are displayed not as UI prompts but as Glowr's own light trails. Glowr traces the pattern the player needs to follow, then dims. The player must reproduce it from memory. Each round adds complexity — longer patterns, faster execution.

This is a "Simon Says" variant with a flow arts vocabulary. The patterns reference real LED performance: orbital traces, isolation movements, stall-and-go timing.

Failure mode: if the player gets a beat wrong, Glowr doesn't flee — it replays the pattern slower, brighter, one more time. It's teaching. But each re-teach reduces the time remaining (same fuel-timer concept as Fyr, but here the "fuel" is night. Dawn is coming. The sky is getting lighter. When sunrise hits, Glowr fades to invisible whether captured or not.)

The race against dawn makes each failed attempt more tense. The player sees the sky brightening at the horizon while trying to memorize light patterns in the dark.

## Party Role

Glowr is the opposite of Fyr. Where Fyr illuminates boldly, Glowr illuminates subtly. With Glowr in the party:

- The player gains enhanced night vision — the world renders slightly brighter in a radius around Glowr, without the harsh light that scares nocturnal creatures
- Hidden night-only collectibles and paths become faintly outlined in Glowr's color
- Creatures that flee from Fyr's firelight are drawn to Glowr's gentle bioluminescence
- Glowr's light trails "paint" the recent path the player has walked, useful for navigation in dark areas

Special ability: **Lure**. Glowr can project a light pattern at a distance to attract nearby creatures, pulling them toward the player. Works on any creature that isn't Tier 4. The pattern mimics the target creature's preferred visual stimulus.

Glowr and Fyr interaction: detailed in Fyr's profile. When both are active at night, warm firelight and cool bioluminescence create a unique dual-tone world.

Glowr and Puppetta interaction: Glowr's light trails make Puppetta's invisible strings faintly visible — the only way to see the strings. The two creatures near each other reveal something hidden about both.

## 3D Implementation Notes

Glowr is pure light — no solid geometry except small emissive sphere meshes at each light source point. The creature is defined by its trail system.

Trail implementation: time-stamped position buffer per light source, rendered as ribbon geometry with emissive material. Trail opacity fades over 2-3 seconds. Color is sampled from a palette texture that scrolls over time (simulating LED mode presets).

Key rendering:
- Additive blending for all trail geometry — light on dark, never occluding
- Bloom post-process is critical. Without bloom, Glowr looks like floating dots. With bloom, it looks alive.
- A subtle volumetric fog in Glowr's radius catches the light and creates visible beams
- The "invisible by day" behavior: Glowr's emissive intensity is constant, but daylight ambient drowns it. No special logic needed if the intensity is calibrated correctly against the day/night light ramp.

Performance note: trail ribbon geometry can get expensive with multiple light sources and long trail durations. Cap trail length at 120 samples per source, LOD by collapsing older trail segments into simpler geometry at distance.

## Voice / Sound

Electronic hums and synthesized tones. Glowr sounds like technology pretending to be organic:
- A low, resonant hum that shifts pitch with color changes (LED props often have internal buzzers or motor hum)
- Soft "whoosh" on each orbital pass — higher frequency than Fyr's fire whoosh, more whistle than roar
- Crystalline chime on color transitions (the sound of pressing the mode button on a real LED prop)
- The strobe burst (startled) produces a sharp electronic crack — like a camera flash capacitor discharge
- During sleep: a barely audible 60hz hum. The sound of electronics idling.

No organic sounds. Glowr is clearly not alive in the biological sense. It's alive in the way a festival light show at 2am feels alive.

## Design Intent

Glowr is the night creature. Players who only explore during the day will never encounter it. Players who are afraid of the dark will have to overcome that fear to find it.

The encounter design rewards patience, darkness-tolerance, and memory. Where Cyrus tests endurance and Fyr tests momentum, Glowr tests perception and recall. It's the puzzle-box legendary.

Glowr also represents the festival late-night flow arts experience — the hour when the stages are closed, the headliners are done, and the real magic happens in dark fields where people spin LED props for the joy of making light in darkness. That specific energy is what Glowr captures. No audience needed. The dark is enough.

The Glowr-Fyr duality is intentional. Fire and LED are the two branches of night-time flow arts, and flow artists tend to have strong opinions about which is better. Having both in the party is a statement: they're better together. The warm and cool light mixing is the visual proof.
