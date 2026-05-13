# #011 — Dragonstik

> The oldest creature in the world. It hasn't stopped spinning since before you were born.

## Identity

| Field | Value |
|-------|-------|
| Name | Dragonstik |
| Prop | Dragon Staff |
| Tier | 3 — Rare |
| Rarity | Biome-specific (ancient ruins, stone gardens) |
| Animal Analog | Tortoise-monk — ancient, unhurried, impossibly patient |

## Appearance

A single staff, thicker than Stavvy's, with weighted ends that glow like embers. The central grip area is wrapped in what looks like worn leather — darkened from centuries of use. The staff is always in motion: rolling, tilting, tracing slow arcs across whatever surface it's near.

The weighted ends leave faint heat-shimmer trails as they move. One end burns warmer (orange) and one cooler (amber), giving it a head-and-tail asymmetry.

Optional: googly eyes near the center grip. They stay perfectly level no matter how the staff rotates beneath them — like a gyroscope-stabilized camera on a tumbling aircraft.

## Movement & Behavior

### Idle
- Contact-rolls across the ground in slow, meditative paths
- When it reaches a wall, it rolls up the wall without pausing
- Transitions between surfaces without interrupting its rotation — ground to rock to fallen pillar, continuous
- Occasionally balances vertically on one end, perfectly still except for a slow wobble-correction
- The rolling is quiet. Almost silent. You hear it before you see it — a low hum from the weighted ends cutting air

### Alert (player approaches)
- Does not speed up. Does not flee.
- Continues rolling but shifts its path to orbit the player at ~5m distance
- The orbit tightens slowly — not chasing, evaluating
- Weighted ends glow slightly brighter
- If the player moves suddenly, Dragonstik pauses mid-roll, balanced on one end, and waits

### Happy (after capture / in party)
- Rolls along any surface near the player — the ground, a railing, the player's outstretched arm if they hold still
- Performs full contact-roll sequences: neck rolls along ledges, body rolls across curved surfaces
- Sometimes balances on the player's shoulder, spinning in place like a top
- The hum becomes a purr — a resonant low-frequency vibration from the weighted ends

### Startled
- Snaps to a vertical balance on one end — rigid, motionless
- Both weighted ends flare bright
- Holds the pose for 3-4 seconds, then slowly tips back into a roll, pretending nothing happened
- The only creature that reacts to surprise with stillness instead of motion

### Sleep
- Lays across two elevated surfaces like a bridge — balanced at the center grip
- The weighted ends hang down, swaying with a pendulum rhythm
- Ember glow dims to barely visible
- The hum fades to silence

## How You Encounter It

Stone gardens. Ancient ruins. Anywhere the architecture is old and the surfaces are varied.

Dragonstik doesn't hide. It's rolling across a crumbling amphitheater when you arrive, contact-rolling along the curved seating rows like it's done this every day for a thousand years. It has. The stone beneath its path is polished smooth — worn down by repetition over time nobody can measure.

You don't find Dragonstik. You arrive at a place Dragonstik has always been.

Special condition: Dragonstik only appears during the golden hour (the 30 minutes before sunset in-game). The ember glow of its weighted ends is invisible in full daylight. At golden hour, you see the trails.

## Capture Sequence Difficulty

Hard. The capture sequence requires sustained contact — Dragonstik tests patience, not reflexes.

The sequence involves body-roll patterns: long, continuous motions that can't be interrupted. Miss a beat and the sequence resets from the beginning, not from the last checkpoint. Dragonstik doesn't punish mistakes with speed; it punishes them with starting over.

The final phase requires the player to hold a balance pose (matching Dragonstik's vertical balance) for a full 5 seconds without input correction. Most players twitch. Dragonstik waits.

Three failed capture attempts and Dragonstik rolls away — off the edge of the ruins, down a cliff face, contact-rolling surfaces you can't follow. It returns the next golden hour.

## Party Role

The stabilizer. Dragonstik's presence in your party makes other creatures calmer:
- Klubba's frantic self-tossing slows to a measured rhythm
- Orbelle's erratic orbit becomes more regular
- Chukka stops snarling at everything

Dragonstik doesn't interact with other creatures directly. It just rolls. The others settle down around it like animals around a campfire.

Special ability: **Surface Reader.** Dragonstik can identify hidden paths and climbable surfaces by rolling across them. It marks traversable terrain the player would otherwise miss. In ruins biomes, this is the difference between finding the passage and walking past it.

## 3D Implementation Notes

Single cylinder mesh with weighted-end geometry (wider, emissive). The contact-roll system needs a surface-following algorithm — raycast downward and along the movement direction to detect surface transitions. The staff should parent its roll axis to the surface normal, rotating around its long axis while the long axis itself follows the surface contour.

Key challenge: seamless surface transitions. Ground-to-wall-to-ceiling should feel continuous. Use spline-based path generation along surface edges, with the roll speed tied to the spline parameter rather than world-space velocity.

Ember trail: short-lived emissive particles spawned at weighted-end positions, fading over ~1 second.

Balance state: IK-style wobble correction — apply a small random torque, then correct it with a slightly-delayed counter-torque. The delay sells the "almost falling" feeling.

## Voice / Sound

No speech. Dragonstik communicates through:
- Low resonant hum from weighted ends in motion (pitch rises slightly when happy)
- Soft stone-on-stone rolling sound (changes timbre with surface material)
- A deep, satisfying *thunk* when it settles into a vertical balance
- Silence when startled (the absence of the hum is the signal)
- A crackling ember sound when weighted ends flare

## Design Intent

Dragonstik is the creature that teaches the player patience is a skill. Every other Tier 3 creature rewards quick reflexes or clever tactics. Dragonstik rewards the player who can stand still.

It's also the creature that makes the world feel old. Dragonstik was here before the player. It'll be here after. The polished stone beneath its path is environmental storytelling — this creature doesn't belong to you. You're visiting its home.

The emotional beat: the first time Dragonstik rolls along the player's arm, voluntarily, after capture. It chose you. It took its time deciding.
