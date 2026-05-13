# #004 — Klubba

> Three clubs that never touch the ground. Good luck keeping up.

## Identity

| Field | Value |
|-------|-------|
| Name | Klubba |
| Prop | Juggling Clubs |
| Tier | 1 — Common |
| Rarity | Common (found in starter area) |
| Animal Analog | Squirrel — hyperactive, unpredictable trajectory, always airborne, impossible to follow with your eyes |

## Appearance

Three juggling clubs in constant aerial rotation. Each club is about 20 inches long with the classic bowling-pin silhouette — bulbous body, narrow neck, knobbed handle. They tumble end over end in a cascade pattern, tracing three overlapping parabolic arcs. At any given moment, two are in the air and one is at the peak or trough of its arc. The clubs have a matte finish that catches light differently on the body versus the handle, making the spin visually readable.

There is no visible hand or mechanism catching and throwing them. They simply exchange — one reaches the bottom of its arc, decelerates, reverses, and launches back up. The toss happens at a single point in space: the invisible "hand" position, about waist height.

Optional: one googly eye on the knob of each club. The eyes spin with the tumble, creating a strobing blink effect.

## Movement & Behavior

### Idle
- Continuous three-club cascade — the default pattern, two arcs crossing in front
- The "hand point" drifts through the environment at walking speed, and the clubs follow in their pattern above it
- Occasionally switches from cascade to columns (clubs go straight up and down in parallel) or a shower (all clubs arc in the same direction)
- Drops a club every so often — it bounces once, pops back up into the pattern. Not a failure state; more like a hiccup

### Alert (player approaches)
- Pattern tightens — arcs get lower and faster, clubs barely leaving the hand point
- Hand point rises from waist height to head height, as if standing on tiptoe
- One club breaks from the pattern and hovers at the top of a high toss, watching (the periscope)
- The remaining two continue cascading faster, nervously

### Happy (after capture / in party)
- Pattern explodes outward — clubs toss to absurd heights, triple-spinning on the way up
- Flourishes: behind-the-back tosses, under-the-leg tosses (under an invisible leg), backcrosses
- Occasionally tosses a club toward the player in an inviting arc, catches it back at the last second
- Multiplies temporarily — a fourth club appears from nowhere, joins the cascade, then vanishes (the showing-off illusion)

### Startled
- All three clubs launch straight up simultaneously — a panicked triple toss
- Long hang time at the top, spinning fast
- Come down scattered — the cascade breaks, and the clubs spend several seconds finding each other and re-syncing
- A dropped club rolls away, pauses, then hops back to rejoin

### Sleep
- Three clubs balanced vertically in a tripod stack — two leaning against each other, one resting across the top
- Motionless except for occasional micro-wobble in the balance
- The tripod slowly rotates on its base, like a music box
- If disturbed, the tripod collapses and reforms with a clatter

## How You Encounter It

Klubba lives in open vertical spaces — clearings, plazas, anywhere with headroom. You see it from below: three objects tumbling against the sky, too high to identify at first. As you approach, the cascade descends to a readable height. Klubba moves through the space on a patrol route, tossing as it goes, never stopping.

Catching Klubba requires timing. The capture window opens during a drop — when one club bounces on the ground, the pattern is broken for about two seconds. The player can also trigger a drop by startling Klubba (loud noise, sudden movement), but this scatters the clubs wider and gives a shorter window.

Found in the starter area's open plaza and park clearings. Avoids tight spaces and low ceilings. Multiple Klubbas sometimes pass clubs between each other mid-air — a passing pattern between two cascades.

## Capture Sequence Difficulty

**Easy-Medium.** Klubba is easy to find (it's loud and visible from far away) but the capture window is narrow. The player needs to either wait for a natural drop or deliberately trigger one. The capture sequence is an upward toss motion — throw something up. Klubba respects the gesture because it recognizes another tosser.

Wrinkle: if the player's timing is off and they trigger the sequence during a clean cascade (no drop), Klubba interprets this as a challenge and speeds up its pattern instead of engaging. The player has to wait for vulnerability, not strength.

## Party Role

Klubba is the entertainer. In camp or rest areas, it performs increasingly elaborate patterns to the reactions of other creatures. It has no practical scouting or sensing ability — its value is morale. A party with Klubba rests faster because other creatures are stimulated and engaged rather than idle.

Interactions with other creatures:
- Tosses a club at Stavvy (Stavvy bats it back with a tip — they invented catch)
- Orbelle tries to orbit one of the clubs mid-toss (the timing never works, both get flustered)
- Hoopla rolls under the cascade (Klubba doesn't notice, Hoopla thinks this is hilarious)
- Terrified of Chukka (nunchaku = clubs on chains = wrong, wrong, wrong)

Special ability: **Cascade Lift.** In traversal sections, Klubba can toss small objects (keys, tokens, other collectibles) vertically to reach high platforms. The player tosses the item to Klubba's hand point, and the cascade launches it upward.

## 3D Implementation Notes

Core system: three club meshes running on a juggling simulator — each club follows a parabolic trajectory with configurable toss height, spin rate (revolutions per toss), and dwell time at the catch/throw point. The cascade pattern is three staggered parabolas offset by one-third of the cycle period. Columns and shower are alternate phase configurations of the same system.

Club spin uses the real tumble axis — clubs rotate around their center of mass (closer to the body than the handle), which produces the characteristic end-over-end wobble. Spin rate is coupled to toss height: higher tosses = more rotations, matching real juggling physics.

The invisible hand point is the creature's root node. It handles pathfinding and drift. Club trajectories are calculated relative to this point, so the entire cascade moves through space as the hand point moves.

Drop simulation: one club's catch fails, it falls with a ballistic trajectory, impacts the ground (bounce using coefficient of restitution), then a spring force pulls it back up to the hand point to rejoin the pattern.

State machine:
- IDLE (cascade) → ALERT (player proximity)
- IDLE → PATTERN_SWITCH (random timer, cycles through cascade/columns/shower)
- ALERT → SCATTER (startled input)
- SCATTER → REFORM (clubs auto-seek hand point after delay)
- ANY → HAPPY (post-capture)
- IDLE → SLEEP (no nearby activity for 60s — clubs land and stack)
- SLEEP → IDLE (any stimulus — tripod collapses, cascade resumes)

## Voice / Sound

No speech. Klubba communicates through:
- Rhythmic *thock-thock-thock* of clubs hitting the invisible catch point (the heartbeat — steady = content, fast = nervous)
- Whistling spin on high tosses (excitement)
- Clatter and bounce on a drop (surprise, embarrassment)
- Hollow wooden knock when clubs collide mid-air (rare, always accidental, always funny)
- The tripod creak during sleep (barely audible rotation)
- A sharp ascending whistle when a club is tossed unreasonably high (showing off)

## Design Intent

Klubba teaches the player to read rhythm. Every other common creature rewards spatial awareness — where to stand, when to move, how to approach. Klubba rewards temporal awareness — when the pattern breaks, when the window opens, when to act. The cascade is a clock. The drop is the alarm.

Klubba also introduces airborne physics as a movement family. Stavvy bobs (grounded rigid body). Orbelle orbits (tethered centrifugal). Hoopla rolls (ground contact). Klubba flies (ballistic parabola). Four creatures, four physics systems. The player who catches all four understands that this game's vocabulary is physics itself.
