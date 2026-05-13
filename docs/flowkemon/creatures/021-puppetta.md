# #021 — Puppetta

> It moves like something is pulling its strings. Something you can't see.

## Identity

| Field | Value |
|-------|-------|
| Name | Puppetta |
| Prop | Marionette / Flow Puppet |
| Tier | 4 — Legendary |
| Rarity | Rare spawn in abandoned structures. Mimics must be earned. |
| Animal Analog | Octopus — boneless movement, mimicry, unsettling intelligence |

## Appearance

A humanoid figure, roughly two-thirds player height, made of jointed wooden segments connected by thin rods and hinges. Arms, legs, torso, head — all articulated like a marionette, but with no visible crossbar above it. The strings extend upward and vanish into nothing. The joints have visible gaps between segments, and the limbs hang at slightly wrong angles when at rest. Not broken — just not quite right.

The wood is old. Stained dark, with grain visible. Metal joint pins glint. The proportions are almost human but compressed — shorter torso, longer arms, head slightly too large. It stands in the uncanny valley between puppet and person.

No googly eyes. Puppetta has painted-on eyes. They don't move. The head tilts to "look" at things by angling the painted gaze. Somehow worse than if the eyes tracked.

## Movement & Behavior

### Idle
- Walks in short, jerky loops around a fixed area. The gait is marionette-perfect: feet lift too high, knees bend at odd moments, arms swing with a half-second delay after each step
- Occasionally stops and holds a pose — hand extended, head tilted, one foot raised — as if the puppeteer paused mid-thought
- The strings above it sway gently even when Puppetta is still, implying something is shifting its weight from above
- If no player is nearby for 60+ seconds, Puppetta sits down. The motion is disturbingly smooth — the joints fold in sequence, top to bottom, like a real person sitting. The contrast with its jerky walking is the uncanny part.

### Alert (player approaches)
- Stops mid-step. Freezes. One foot still in the air.
- The head rotates to face the player. Just the head. The body stays frozen.
- Then: it mirrors the player's last movement. Exactly. If the player walked left, Puppetta takes one step left. If the player jumped, Puppetta's knees bend and straighten. The timing is delayed by exactly one second. Echo, not sync.
- This mirroring continues as long as the player is within 10m. It's disorienting. The player moves and sees their own movement reflected back at them, puppet-ified.

### Happy (after capture / in party)
- The jerky gait smooths out. Not fully — Puppetta never moves like a real creature — but the pauses between joint movements shorten. It's learning.
- Performs small "dances" — simple sequences of movements that combine the player's most common actions into choreography. It's been watching.
- Walks beside the player and occasionally reaches toward their hand. The fingers don't quite close. The string tension won't allow it.
- Other party creatures are uneasy around happy Puppetta. Stavvy watches it from behind the player.

### Startled
- All strings go slack simultaneously. Puppetta collapses — a heap of wooden segments on the ground. Fully limp.
- A beat of stillness. It looks like a pile of craft supplies.
- Then the strings re-tension from the top down: head lifts first, then shoulders, then torso, then legs straighten. Standing back up takes 3 full seconds and looks like something is reassembling it from above.
- The reassembled pose is slightly different from the pre-startle pose. The arms are at new angles. The head tilts the other way. Something adjusted it.

### Sleep
- Hangs limp from its strings, feet barely touching the ground. Arms dangle. Head drops forward.
- Sways gently, pendulum-like, as if the unseen support above is rocking
- Occasionally a single limb twitches — a finger curls, a foot flexes — like a dreaming dog kicking, except it's a wooden puppet on strings
- The painted eyes are "closed" (Puppetta's head angles down so the painted gaze hits the ground)

## How You Encounter It

Puppetta is found in abandoned structures: empty buildings, old stages, derelict performance spaces. Places where a puppet show might have once happened.

Prerequisite: the player must have at least 8 creatures in their party. Puppetta has been watching the player interact with other creatures. It's been learning from the mimicry data.

The encounter begins before the player enters the building. Through a window or doorway, the player sees movement inside. Something walking. Human-shaped. But the building is supposed to be empty.

Inside, the space is dim. Puppetta is on a stage — if the building has one — or in the center of the largest room. It's performing. Not for anyone. A slow, deliberate sequence of movements that looks choreographed. Beautiful, in the way a well-operated marionette is beautiful.

When the player enters, Puppetta stops. Faces them. And begins mirroring.

The mirroring phase is the encounter's defining feature. For 30 seconds, everything the player does, Puppetta reproduces with a 1-second delay. Walk forward: Puppetta walks forward. Spin: Puppetta spins. Stop: Puppetta stops. It's a conversation in movement, one sentence behind.

After the mirroring phase, Puppetta adds something the player didn't do. It extends one hand toward the player and holds. This is the capture prompt. The player's capture sequence is performed with Puppetta mirroring alongside — a duet, one second out of phase.

If the player leaves the building without attempting capture, Puppetta follows to the threshold and stops. It can't leave. Something above won't let it. The player can see it standing in the doorway from outside, one hand still extended. It waits there until the player either returns or leaves the area entirely.

## Capture Sequence Difficulty

Puppetta's capture sequence is a mirror test. The beats are not prescribed — the player performs, and Puppetta mirrors with a 1-second delay, but the mirror introduces subtle alterations. The player must spot the alterations and reproduce them in the next round.

Round 1: Player performs. Puppetta mirrors exactly.
Round 2: Player performs. Puppetta mirrors but changes one beat.
Round 3: Player must include Puppetta's change while adding their own.
Round 4: Puppetta mirrors the combined sequence with another change.

It escalates into collaborative choreography. The capture succeeds when both player and Puppetta are performing the same sequence simultaneously — no longer leader and follower, but in sync. The 1-second delay collapses to zero.

Failing doesn't drive Puppetta away. It resets the mirroring to Round 1. Puppetta is patient. It has nothing else to do. But each reset, the painted expression seems to shift — not animated, just a trick of the lighting. The mouth might be slightly more downturned. Projection on the player's part. Probably.

## Party Role

Puppetta learns. Over time, it absorbs movement patterns from every creature in the party and can mimic any of them. Not perfectly — always with the marionette jerkiness, always slightly off — but recognizably.

- Puppetta near Stavvy: mimics the bob-and-wag but with wooden joint delays
- Puppetta near Orbelle: attempts to orbit, manages a jerky ellipse
- Puppetta near Cyrus: tries to roll. Falls over. Reassembles. The most relatable moment in the game.

Special ability: **Understudy**. When a party creature is unavailable (resting, injured, stored), Puppetta can step into its party slot and approximate its unique ability at reduced effectiveness. It's not a replacement. It's a stand-in. The show must go on.

Puppetta and Glowr interaction: Glowr's light trails make Puppetta's invisible strings faintly visible. The player can see thin lines of light extending upward from each joint, converging at a point ~3m above Puppetta's head, where they terminate. Nothing is holding them. The lines just end.

## 3D Implementation Notes

Articulated humanoid mesh with visible joint segments and gaps between body parts. Ragdoll-adjacent physics for the limp/collapse states, but string-constrained during normal operation — each joint has an upward tether that limits downward travel and creates the characteristic "hung from above" posture.

String rendering: thin cylinder geometry from each major joint (head, shoulders, elbows, wrists, hips, knees) extending upward. Alpha fadeout starting at ~2m above Puppetta, fully transparent by 3m. The strings are always rendered but normally invisible — Glowr's proximity triggers an emissive material override.

Animation system: inverse kinematics driven by target positions that are themselves animated on slightly delayed splines. The delay between target and IK solution creates the marionette lag. Happy state reduces delay; idle state increases it.

The mirroring system records the player's character animation as a sequence of joint targets, buffers 1 second, and plays them back through Puppetta's IK rig. The wooden joint constraints add the puppet quality automatically.

## Voice / Sound

Wood and string. Puppetta communicates through:
- Soft clacking of wooden segments bumping during movement (knee-to-calf, elbow-to-forearm)
- A faint creak of strings under tension when it reaches or gestures
- The hollow knock of its feet on floor surfaces — audibly different from the player's footsteps, lighter, less grounded
- Silence during the mirror phase. Complete silence. The player hears only their own sounds reflected back at them with a delay. This is more unsettling than any puppet noise.
- When Puppetta collapses (startled): a clatter of wooden parts hitting each other. Like dropping a box of wooden blocks. When it reassembles: the reverse — individual clicks ascending as each joint re-tensions.

No voice, no breath sound, no organic audio whatsoever. Puppetta is wood and string and whatever is holding the strings.

## Design Intent

Puppetta is the creature that makes the player uncomfortable and then makes them care.

The uncanny valley is the point. Marionettes are inherently liminal — they look almost alive and their movement is almost natural, and the gap between "almost" and "fully" is where the creep factor lives. Puppetta leans into that gap deliberately.

But the relationship arc bends toward empathy. Puppetta's mirroring starts as unnerving and shifts to collaborative. The capture sequence is literally a duet. By the time the player and Puppetta are performing in sync, the jerkiness isn't creepy anymore — it's endearing. It's trying so hard.

The detail that it can't leave the building is the emotional gut punch. Every other legendary has freedom — Cyrus roams the world, Fyr appears where it chooses, Glowr drifts through the night. Puppetta is tethered. Capturing it is the first time it gets to leave. The hand extended through the doorway is the design moment. If the player walks away, they should feel something.

The "Understudy" ability in the party reinforces the theme: Puppetta's whole existence is defined by imitating others. It doesn't have its own movement vocabulary. It borrows. This could read as tragic or as beautiful, depending on the player. Both readings are correct.
