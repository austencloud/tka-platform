# #008 — Diablo

> A spool that can't stop spinning and can't stop falling. The anxiety is the whole personality.

## Identity

| Field | Value |
|-------|-------|
| Name | Diablo |
| Prop | Diabolo |
| Tier | 2 — Uncommon |
| Rarity | Found exploring — between trees, under bridges, anywhere with two anchor points |
| Animal Analog | Hamster on a wheel — compulsive, anxious, oddly endearing in its desperation |

## Appearance

A double-cone spool (the classic diabolo shape — two cups joined at a narrow axle) spinning on an invisible string stretched between two anchor points. The string isn't visible, but the anchors are: two faint points of light floating at hip height, about 6 feet apart, tethered to trees, posts, or rocks.

The diabolo itself is matte with a faded racing stripe around each cup's rim. Scuffed. Dented. This thing has hit the ground thousands of times and gotten back up every time. The cups' rims glow faintly when spin speed is high, dimming as it slows.

Optional: googly eyes on the axle, between the cups. They're wide open. Always. Permanent state of mild alarm.

## Movement & Behavior

### Idle
- Spinning on the invisible string between two anchor points, maintaining altitude through gyroscopic force
- Spin speed fluctuates visibly — speeds up, stabilizes, starts to wobble, corrects, speeds up again. A perpetual almost-failing that never quite fails
- Periodically the string sags and Diablo dips toward the ground. The anchor points pulse brighter (the invisible sticks "pumping" the string) and Diablo recovers altitude. Every recovery looks like it was the last possible save
- Occasionally throws itself upward off the string — a self-toss — hangs in the air for a terrifying beat with no support, then lands back on the string. Wobbles violently. Stabilizes. Acts like nothing happened
- The anchor points slowly migrate, carrying Diablo between different pairs of environmental features. A nomadic anxiety station

### Alert (player approaches)
- Spin speed increases dramatically — the rim glow brightens to full
- Self-tosses more frequently, getting higher each time, as if showing off or panicking (possibly both)
- The string angle tilts to face the player — Diablo is now performing AT you
- Starts attempting tricks: grinds along the string from one anchor to the other, wraps under and over, pirouettes. Every trick has a 30% chance of almost-failing, which makes the successful ones more impressive
- If the player gets too close too fast: Diablo botches a trick, falls off the string, hits the ground, and bounces to a new pair of anchor points 10 meters away. Not fleeing — relocating with dignity

### Happy (after capture / in party)
- Generates its own anchor points — two small light motes orbit the player at waist height, and Diablo spins between them
- Tricks become smoother. The wobble is still there, but now it reads as style rather than panic
- Occasionally launches itself high above the player's head, does a full pirouette at the apex, and lands back on the string. Sticks the landing 70% of the time. The 30% failures are slapstick — ground bounce, scramble back up, resume spinning as if nothing happened
- Purrs. The purr is the sound of a diabolo at peak spin speed — a deep, satisfying hum

### Startled
- Falls off the string. Hits the ground. Bounces twice
- The two anchor motes scatter in opposite directions like startled birds
- Diablo rolls on the ground in a tight circle (a diabolo's natural ground behavior — it rolls on its rim like a wheel)
- After 3-4 seconds: anchor motes return, string re-establishes, Diablo hops back on with exaggerated urgency
- Spin speed is maximum immediately after recovery. Compensating

### Sleep
- Spin slows to near-zero. The diabolo wobbles to a stop on the string
- Sags into the lowest point of the string's catenary curve, resting in the dip like a hammock
- Anchor motes dim to nearly invisible
- Occasional micro-spins — the sleep equivalent of twitching. Even unconscious, Diablo can't fully stop

## How You Encounter It

Diablo lives in the gaps between things. Two trees with the right spacing. Bridge supports. Fence posts. Anywhere you could hypothetically string a line. The anchors pick geometry that's structurally sound — Diablo has opinions about its support infrastructure.

You hear it before you see it. The high-pitched whir of a spinning spool carries. Follow the sound and you'll find the anchor points first — two faint lights that don't belong. Then you see the string (or rather, the curved path where the string should be). Then the diabolo blur between them.

First encounter: Diablo is mid-trick when the player arrives. It notices them, gets distracted, and drops. Rolls across the ground in a wide arc, bumps against the player's feet, wobbles there for a moment as if dazed, then the anchor motes yank it back up onto the string. The eye contact during the ground moment is key — this is where the player decides if Diablo is pathetic or charming. (It's both.)

Diablo is more common in areas with regular geometry — built environments, tree farms, ruins with intact columns. Organic forest with irregular tree spacing frustrates it. The anchors can't find good mounts.

## Capture Sequence Difficulty

**Medium.** The difficulty is rhythm maintenance.

The capture sequence requires sustained rhythmic input — a pumping pattern that mirrors the string manipulation real diabolo players use to maintain spin. The player has to keep the beat steady for a set duration. Speed up too much and Diablo panics (flies off the string, resets). Slow down and Diablo's spin decays, it sags, and the capture fails.

The sweet spot is a medium tempo held consistently for about 8 beats. Players who try to show off with complex sequences scare Diablo. Players who find the groove and hold it earn its trust. The metaphor is deliberate: diabolo manipulation is about rhythm, not flash.

Unique mechanic: if Diablo drops during the capture (30% chance per attempt), the player can "save" it by timing a single input to the exact moment Diablo would hit the ground. A successful save counts as two beats of progress. A missed save resets the encounter. High risk, high reward, very funny when it works.

## Party Role

Diablo is the party's metronome. Its constant spin provides a visual rhythm reference during capture sequences with other creatures — a spinning HUD element that pulses with the beat.

Interaction with other party members:
- Orbits Stavvy's staves at high speed, using them as anchor points. Stavvy stands perfectly still, confused but compliant. A prop being used as prop infrastructure
- Tries to use Ropey's extended dart as an anchor point. Ropey retracts. Diablo falls. Every time
- Matches spin speed with Orbelle's poi when they're near each other — an involuntary synchronization that neither creature controls
- Terrified of Klubba. The clubs' chaotic tosses look like projectiles aimed at Diablo's string. Diablo relocates to the opposite side of the party whenever Klubba self-tosses

Special ability: **Momentum Share.** When Diablo is in the active party, the player's capture sequence timing window is slightly more forgiving — the rhythm can drift by 10% without breaking combo. Diablo's anxiety about maintaining spin translates into a buffer that prevents the player from experiencing the same.

## 3D Implementation Notes

Diabolo body: lathe geometry (double cone profile), spinning on local Y-axis. Rotation speed drives rim emissive intensity via shader uniform.

String simulation: catenary curve between two anchor points, updated per frame. Diabolo constrained to slide along the string with friction. "Pumping" simulated by oscillating anchor Y positions (±5cm at input frequency), which transfers energy to the diabolo's string-position velocity.

Self-toss: diabolo gets upward velocity impulse, detaches from string constraint, follows ballistic arc, re-attaches on descent when Y position crosses string catenary. Miss detection: if landing X is outside string X-range, trigger ground bounce.

Ground roll: switch from string-rider to physics rigid body with high angular velocity on the rim-contact axis. The double-cone shape makes this naturally wobbly.

Anchor motes: point lights with bloom, position-constrained to nearby geometry via raycasts at spawn time. Migration: new anchor targets selected periodically, motes lerp to new positions at walking speed.

## Voice / Sound

No speech. Diablo communicates through:
- A rising-pitch whir when spinning fast (gyroscopic hum — the sound of commitment)
- A falling-pitch whine when losing spin (the sound of everything going wrong, slowly)
- A rubber-on-concrete bounce when hitting the ground (comedic, not painful)
- A sharp zip when grinding along the string (diabolo sliding on nylon)
- The deep hum at peak spin (the purr — contentment expressed as angular momentum)

The pitch of the whir is Diablo's emotional state rendered as audio. High and steady = happy. Rising = excited. Falling = uh oh. The player learns to read Diablo's mood by ear within minutes.

## Design Intent

Diablo is the creature that makes failure funny. Every other creature in the game has a dignity to maintain. Diablo has none. It falls, it bounces, it scrambles back, it falls again. And somehow, because it never stops trying, the falls become charming instead of sad.

The design serves two purposes. First: it normalizes failure for the player. Watching Diablo eat dirt and immediately hop back up reframes the player's own failed capture sequences as part of the fun, not punishment. Second: it introduces the concept of maintenance — some things in Flowkemon require sustained attention, not just a single input. Diablo's spin decay is a gentle tutorial for later creatures that demand more complex sustained interactions.

The emotional beat is recognition. Every flow artist has been Diablo — the diabolo hits the ground, you pick it up, you try again, you drop it, you pick it up. The creature is the prop's experience of being learned, not the performer's experience of learning. That inversion is the joke and the heart of it.
