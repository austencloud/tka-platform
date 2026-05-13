# #016 — Chukka

> Something just clacked in the dark. Twice. It sounded angry.

## Identity

| Field | Value |
|-------|-------|
| Name | Chukka |
| Prop | Nunchaku |
| Tier | 3 — Rare |
| Rarity | Biome-specific (dense forests, urban ruins, underground corridors) |
| Animal Analog | Wolverine — small, aggressive, guards territory with disproportionate ferocity |

## Appearance

Two short, thick batons connected by a length of chain. The batons are dense — dark wood or matte-black metal, scuffed and nicked from constant impact. The chain is short (15cm), keeping the two halves close together. The whole creature is compact. Smaller than most Tier 3 creatures. What it lacks in size it makes up in speed.

The batons move constantly. Even at rest, they're shifting — one half tucked under the other, flipping over the chain, snapping into new grips. Chukka never holds one position for more than two seconds. The transitions between positions are violent: hard stops, sharp reversals, the chain snapping taut with an audible *crack*.

Optional: googly eyes on the end of one baton. Just one. The other baton is the weapon. The baton with the eyes is the face. The distinction matters — Chukka attacks face-first sometimes, like it's headbutting.

## Movement & Behavior

### Idle
- Cycles through stance transitions in a repeating loop
- Stance 1: both batons parallel, chain hanging — resting guard
- Stance 2: one baton whips over and tucks under the arm of the other (a figure-four lock)
- Stance 3: full extension, chain stretched, both batons pointing outward — maximum threat display
- Stance 4: rapid spin around the chain axis — a buzzsaw blur
- Each transition snaps with zero ease-in. Instant acceleration, instant stop.
- Patrols a small territory (5-7m radius), reversing direction at the boundary with a sharp chain-crack

### Alert (player approaches)
- Freezes mid-transition, both batons locked in extension — the threat display
- Vibrates. The whole creature shakes with contained kinetic energy
- If the player takes one more step: Chukka charges halfway to the player, stops, performs a rapid three-hit combo in the air (left-right-overhead), then retreats to patrol distance
- This is a bluff charge. The combo connects with nothing. The message is clear: "I can."
- Repeats the bluff charge if the player continues advancing. Each repetition adds one hit to the combo.

### Happy (after capture / in party)
- The aggression redirects into showmanship
- Performs continuous freestyle sequences: behind-the-back passes, under-leg wraps, wrist rolls, all at high speed
- Stays close to the player — within 1m — as a bodyguard
- Occasionally snaps a hard stop next to the player's ear, just close enough to feel the air. Not a threat. Showing off. "Watch this."
- When the player accomplishes something (capture, puzzle solve), Chukka does a victory sequence: rapid alternating spins ending in a dramatic held pose

### Startled
- Immediate full-speed chain whip in the direction of the threat — the fastest attack in Chukka's repertoire
- Both batons become a blur as they alternate spinning around the chain connection point
- Chukka advances toward the threat, not away from it
- Takes 8-10 seconds to de-escalate, during which any further stimulus re-triggers the attack chain
- The most dangerous startled state of any Tier 3 creature. Give it space.

### Sleep
- Both batons rest on the ground, chain loosely draped between them
- One baton lies flat. The other leans against it at a slight angle — two sticks in a campfire formation
- Tiny twitches: one baton shifts, like a dreaming dog's leg kicking
- A barely audible chain rattle accompanies each twitch
- Wakes instantly. No groggy transition. Asleep one frame, threat-display the next.

## How You Encounter It

Tight spaces. Dense forests where the canopy blocks the light. Urban ruins with narrow alleyways. Underground corridors with low ceilings. Anywhere the creature has walls at its back and a defensible front.

Chukka doesn't announce itself visually. You hear it first: the rhythmic *clack-clack-clack* of the batons hitting each other during stance transitions. The sound echoes off the walls, making it hard to locate. You follow the sound down a corridor and find a small clearing — Chukka's territory.

The territory is marked. Scuff marks on the walls and floor where the batons have struck during patrol. Impact dents in wooden surfaces. These marks are the first clue that something lives here; Chukka itself might be around the next corner.

Special condition: Chukka appears only in enclosed biomes where the ceiling is below a certain height. It fights in tight quarters. Open sky makes it uncomfortable — too much space to defend.

## Capture Sequence Difficulty

Hard. The capture sequence is an endurance test with escalating pressure.

Chukka's sequence is a parry challenge: it performs attack patterns and the player must block/parry at the correct timing. But Chukka doesn't tire. Each round, the combo length increases by one hit, the timing windows tighten by 10%, and the pattern shuffles.

Round 1: 3-hit combo, generous timing. Round 2: 4 hits, tighter. Round 3: 5 hits, tight. The player needs to survive 5 rounds.

The twist: Chukka inserts a grab attempt (chain wrap) into later rounds. During a grab, the correct response is NOT to parry but to dodge (different input). The grab looks different from a strike only in the first 100ms of the animation — the chain extends instead of the baton leading. Players who are autopiloting the parry rhythm get caught.

Failed attempts: Chukka performs a dismissive backhanded spin (one baton whips lazily in the player's direction — "you're not worth a real attack") and returns to patrol. The player can try again immediately, but Chukka starts the next attempt one round higher — you've already proven you can handle the early rounds.

## Party Role

The enforcer. Chukka discourages other creatures from approaching uninvited.

When Chukka is in your party, wild creatures that would normally approach the player with hostile intent are deterred — they enter alert state, reassess, and often retreat. Chukka's threat display reads to other creatures as "occupied territory."

Special ability: **Chain Break.** Chukka can snap a single structural weak point — a cracked beam, a rusted hinge, a frayed rope — by whipping one baton into it at full extension. More surgical than Meteora's brute force. Where Meteora demolishes, Chukka disassembles.

Creature interactions:
- Sees Sabre as a rival. Performs increasingly elaborate combos when Sabre is nearby. Sabre ignores this. Chukka escalates. The cycle never ends.
- Intimidates Stavvy (who hides behind the player when Chukka enters the party)
- Grudging respect for Meteora (Chukka's chain physics recognizes Meteora's rope physics — kindred momentum creatures)
- Gives Crysta a wide berth. A creature that doesn't react is the one thing Chukka doesn't know how to handle.

## 3D Implementation Notes

Two baton meshes connected by a chain constraint. The chain should be a real physics constraint — not an animation — so the batons' relative positions are driven by chain length and momentum rather than keyframes. The keyframed elements are the grip transitions (which baton leads, where the chain wraps); the chain's physics response to those transitions should be simulated.

Stance transitions: authored start and end poses for each stance. The transition between poses should be instantaneous (1-2 frames of interpolation maximum). The snapping quality is Chukka's signature — ease curves will ruin the character.

Impact VFX: a small radial burst of particles (dust/sparks depending on surface) at the point where a baton strikes a surface. The burst should be proportional to the baton's velocity at the moment of impact.

Chain-crack sound sync: the audio crack plays on the frame the chain reaches full extension (chain segment length equals maximum). Track the distance between baton connection points each frame; trigger sound when distance exceeds threshold.

The patrol path: a simple waypoint loop with randomized pause durations at each waypoint. At each pause, Chukka performs 2-3 stance transitions before moving to the next point.

Bluff charge: move Chukka 50% of the distance to the player in 0.4 seconds (fast, linear), perform the combo at the midpoint, then return to patrol origin in 0.6 seconds. The asymmetric speed (fast approach, slower retreat) makes the charge feel aggressive and the retreat feel deliberate.

## Voice / Sound

No speech. Chukka communicates through:
- The *clack* of baton on baton — the primary voice. Rhythm, speed, and volume encode mood.
- Chain rattle — a metallic undertone beneath every movement. Faster when agitated.
- A sharp *crack* when the chain snaps to full extension (the threat punctuation mark)
- The dull *thud* of baton on wood/stone during patrol — territory marking
- A low, continuous chain hum during the buzzsaw spin (both batons orbiting the chain point at speed)
- Near silence during sleep — just the occasional twitch-rattle, like a single chain link shifting

## Design Intent

Chukka is the creature that says "no" louder than Sabre. Where Sabre is a dignified sentinel, Chukka is a feral guard that doesn't care about dignity. It's small, it's angry, and it will absolutely start a fight with something three times its size.

The player's emotional arc with Chukka is adversarial-to-loyal. The creature that bluff-charged them, dared them to approach, and punished their parry timing is the same creature that later stands between them and a threat, chain cracking, daring the threat to approach.

The emotional beat: the player captures Chukka after surviving 5 rounds of escalating combos. Chukka goes quiet for one beat — the only silence in the entire encounter. Then it tucks both batons in, chain loose, and drifts to the player's shoulder. Not excited. Not happy. Committed. The fight is over, and Chukka decided which side it's on.
