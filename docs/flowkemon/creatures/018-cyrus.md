# #018 — Cyrus

> You don't catch Cyrus. Cyrus catches you.

## Identity

| Field | Value |
|-------|-------|
| Name | Cyrus |
| Prop | Cyr Wheel |
| Tier | 4 — Legendary |
| Rarity | One exists. It decides when you're ready. |
| Animal Analog | Elephant — massive, intelligent, moves on its own terms |

## Appearance

A human-sized metal ring, standing taller than the player. Polished steel surface catches light as it tilts. The ring has visible weight to it — when it leans, the ground texture compresses slightly beneath it. Faint scuff marks along the inner surface suggest thousands of miles traveled.

No googly eyes. Cyrus doesn't need them. The ring itself reads as a face depending on its tilt angle — leaning forward is curious, leaning back is dismissive, perfectly vertical is attention.

## Movement & Behavior

### Idle
- Rolls along predetermined paths through the world at a steady, unhurried pace
- Rotates around its vertical axis while rolling — the signature cyr wheel "coin spin"
- Occasionally stops, balances perfectly upright on a single contact point, holds for several seconds, then continues
- Ignores the player entirely during idle. You are scenery.

### Alert (player approaches)
- Does not acknowledge the player. Keeps rolling.
- If the player blocks its path, Cyrus tilts to one side and rolls around them without slowing down
- Only after the player has followed Cyrus for a sustained distance (60+ seconds of trailing) does it slow. Barely.
- First acknowledgment: a single tilt toward the player. Brief. Then it keeps moving.

### Happy (after capture / in party)
- Rolls in wide circles around the player — protective orbit at ~10m radius
- Occasionally performs a full "waltz" — the cyr wheel move where the ring tips nearly horizontal and traces a wide circle on the ground, then rights itself
- Lets the player walk beside it. Not behind. Beside.
- When the player stops, Cyrus balances motionless next to them. Standing guard.

### Startled
- Drops flat to the ground with a resonant metallic ring
- Vibrates in place — the ring oscillating rapidly on its edge
- Snaps back upright and rolls toward the threat, not away from it

### Sleep
- Balances perfectly upright on a single point of contact
- Zero movement. Perfect stillness.
- The ring catches moonlight or ambient light in a slow crawl across its surface as the world rotates around it
- Approaching a sleeping Cyrus produces no reaction. It sleeps when it decides to sleep.

## How You Encounter It

Cyrus is not found. Cyrus appears.

The player first sees Cyrus rolling across the horizon in the mid-game — a distant silhouette, unmistakably large, moving with purpose through a landscape the player hasn't unlocked yet. No UI marker. No quest prompt. Just a shape on the horizon that clearly isn't terrain.

Second sighting: closer. The player turns a corner in a canyon biome and Cyrus rolls past, 20 meters away, without slowing. The camera tracks it involuntarily. By the time the player reacts, it's gone around the next bend.

Third sighting: Cyrus is on the player's path. Stopped. Balanced upright. Waiting. When the player approaches, Cyrus begins rolling. Slowly. This is the invitation.

The encounter only triggers after the player has caught at least 12 other creatures. Cyrus has been watching. It knows when you're ready.

The chase covers three biomes. Cyrus doesn't run — it just doesn't stop. The player has to keep up across terrain transitions, past other creatures, through weather changes. Other creatures scatter when Cyrus passes. Stavvy tries to keep up but falls behind.

When Cyrus finally stops, it's in the highest point of the map. An open plateau. It turns to face the player.

## Capture Sequence Difficulty

The hardest capture in the game.

Cyrus doesn't resist the capture sequence — it tests you. The sequence required is long (8+ beats) and must be performed cleanly. No restarts, no misses. Cyrus watches each beat. If you fail, Cyrus rolls away. Not fast. Just away. You can follow, but it won't stop again for a real-time cooldown (5 minutes).

The sequence itself references cyr wheel movement vocabulary: wide sweeping arcs, full rotations, weight transfers. The player's props have to trace paths that echo Cyrus's own movement.

Second attempt: the sequence is different. Longer. Cyrus doesn't repeat tests.

Third attempt: if the player has failed twice, Cyrus stops rolling away after the third failure. It waits. Tilts toward the player. The sequence on the third attempt is the same difficulty, but Cyrus gives a subtle visual cue — a slight lean in the direction of the next beat — acknowledging effort.

## Party Role

Cyrus changes the party dynamic. It's the largest creature by far, and others react to its presence.

- Stavvy is awed — both staves tilt back, looking up (referenced in Stavvy's profile)
- Smaller creatures orbit at a wider radius when Cyrus is active
- Aggressive creatures (Chukka, Sabre) immediately de-escalate near Cyrus
- Cyrus doesn't interact with other party members directly. It tolerates them.

Special ability: **Pathfinder**. With Cyrus in the party, hidden paths become visible. Cyrus rolls toward secrets the player hasn't found. It knows the map better than you do.

## 3D Implementation Notes

Single torus mesh, large scale (~1.8m diameter). Chrome/brushed-metal material with environment map reflections. Physics-based rolling animation along spline paths — the ring's contact point with the ground drives rotation, so rolling speed and spin rate are physically coupled.

Key animations:
- Roll: ring rotates around its travel axis, contact point stays grounded
- Coin spin: ring rotates around its vertical axis while stationary or moving
- Waltz: ring tilts 70-80 degrees from vertical, traces a ground circle, rights itself
- Pancake: ring goes nearly horizontal (startle/sleep transition)

The ring needs subtle deformation on ground contact — not literal squash, but a slight camera shake and ground-plane displacement map to sell the weight.

Draw distance for Cyrus is extended beyond normal creature range to support the "distant silhouette" first sighting.

## Voice / Sound

Deep metallic resonance. Cyrus communicates through:
- Low, sustained ring when rolling (like a singing bowl, pitch tied to speed)
- Sharp metallic ping when changing direction (decisive, not startled)
- Ground vibration rumble when approaching (the player hears Cyrus before seeing it)
- A single clear bell tone when it stops and faces the player — the invitation
- Silence when sleeping. Absolute silence. The ambient soundscape itself dims near a sleeping Cyrus.

## Design Intent

Cyrus is the creature that reframes what "catching" means. Every other creature in the game, the player is the pursuer. Cyrus inverts that. You follow. You earn. You wait on its schedule.

The three-sighting buildup is designed to create anticipation across hours of gameplay. The player should be talking about Cyrus before they ever get close to it. "I saw something huge rolling across the canyon." "It came back." "I think it's waiting for me."

When Cyrus finally joins the party, it should feel earned in a way no other creature does. Not because the capture sequence was hard (though it was), but because the relationship started long before the capture. Cyrus chose you. The capture was a formality.
