# #009 — Ribbini

> A length of silk that moves like it remembers being part of the ocean.

## Identity

| Field | Value |
|-------|-------|
| Name | Ribbini |
| Prop | Ribbon / Flag |
| Tier | 2 — Uncommon |
| Rarity | Found exploring — open meadows, cliff edges, anywhere with gentle wind |
| Animal Analog | Jellyfish — graceful, passive, delicate, retreats when touched |

## Appearance

A single ribbon, about 15 feet long and 4 inches wide, made of translucent silk that shifts color depending on the angle of light hitting it — milky white in shade, prismatic at the edges when backlit. One end is slightly heavier (the handle end of a real ribbon wand), giving the motion a leading edge and a trailing body.

The ribbon moves like it's underwater. Even in still air, it ripples. The physics of real ribbon manipulation — sine waves propagating from the handle through the fabric — are Ribbini's default state of being. The trailing edge is always a few frames behind the leading edge, creating a permanent, mesmerizing delay.

No hard edges anywhere. Every surface catches light softly. Ribbini looks like it would dissolve if you gripped it too hard.

Optional: googly eyes on the weighted end. They peek out from behind the silk when Ribbini curls inward. Shy eyes.

## Movement & Behavior

### Idle
- Drifts through the air in slow vertical spirals, the ribbon body trailing in a helix behind the leading end
- The spiral tightens and loosens with a breathing rhythm — inhale contracts, exhale expands
- Responds to ambient wind: in breeze, the ribbon extends and flows horizontally; in still air, it hangs in loose S-curves
- Occasionally performs a slow figure-eight, the classic ribbon gymnastics pattern, leaving a temporary afterimage trail of fading color
- Never touches the ground. The trailing end comes close — within inches — then curls upward at the last moment, like a hem being lifted over a puddle

### Alert (player approaches)
- The spiral pauses. The ribbon hangs in the air, fully extended, oriented toward the player
- Ripples stop propagating. For one moment, the silk is perfectly still — a held breath
- Then: a single slow wave rolls from the leading end to the trailing end. A greeting or a warning. Hard to tell
- If the player moves smoothly: Ribbini begins a slow orbit around them, trailing silk in a wide circle. Invitation
- If the player moves suddenly: the entire ribbon recoils — contracts into a tight ball of folded silk in under a second, like a sea anemone closing. Stays balled for 5 seconds. Reopens cautiously, one fold at a time

### Happy (after capture / in party)
- Wraps loosely around the player as they walk — not constricting, more like a scarf that keeps rearranging itself
- Performs longer, more elaborate patterns: spirals, figure-eights, wide sweeping arcs that trace shapes in the air
- The color shift intensifies — more prismatic, the edges catching light more often, as if Ribbini is choosing to be beautiful rather than invisible
- Sometimes extends fully and rides the wind above the player like a kite, connected by the thinnest thread of trailing silk
- When the player stops moving, Ribbini drapes itself gently over something nearby — a branch, a rock, a fence post — and hangs there, swaying

### Startled
- Instantaneous contraction into a tight spiral — the ribbon wraps around itself like a spring
- The spiral whips away from the sound source at speed, unraveling behind it as it goes (a retreating trail of silk)
- Stops 10-15 meters away, hovering, the ribbon gradually un-spiraling and resuming its resting S-curves
- The color washes out for several seconds after startle — goes paper-white, slowly regaining its prismatic quality as it calms

### Sleep
- Settles onto the nearest horizontal surface and pools — silk folding and settling like cloth dropped from height
- The pooled shape ripples occasionally, as if something underneath is breathing
- Leading end (weighted) curls inward, tucked under the silk — hiding its face
- In sleep, Ribbini looks like a forgotten handkerchief. Wind doesn't move it. Whatever force animates it is fully dormant

## How You Encounter It

Ribbini inhabits liminal spaces where air moves — meadow edges where tree cover ends and open sky begins, cliff faces with updrafts, gaps between buildings where wind tunnels form. It rides thermals and currents, tracing the invisible architecture of airflow.

The encounter is visual before anything else. You see something in the distance that moves wrong. Not wind-blown debris — too deliberate. Not a bird — too slow. A ripple of color at the edge of a meadow, following a path through the air that no physical object should take. The motion is what draws you.

Approach matters more with Ribbini than any other Tier 2 creature. Running triggers the recoil. Walking triggers the alert orbit. Standing still and waiting — just being present in its space without demanding anything — eventually causes Ribbini to drift close on its own terms. It circles. It investigates. The trailing edge of the silk brushes the player's shoulder. Then it pulls back. Circles again. Closer this time. The encounter is a slow negotiation of personal space.

Ribbini is absent during storms. High wind shreds its movement vocabulary — it can't form clean patterns, and it seems to know this. Clear days with light breeze are ideal. Golden hour is peak Ribbini time: the low-angle light makes the prismatic edges impossible to ignore.

## Capture Sequence Difficulty

**Easy-Medium.** The difficulty is gentleness.

The capture sequence requires flowing, connected movements — no sharp transitions, no hard stops. The input pattern mirrors ribbon manipulation: smooth arcs that link into continuous paths. Breaking the flow (any staccato input) causes Ribbini to flinch and pull back, though it doesn't fully flee like some creatures.

The forgiving part: Ribbini gives second chances. A flinch costs 2 seconds of paused progress, not a full reset. The creature is shy, not fearful. It wants to be caught — it just needs convincing that the player can be gentle enough to deserve it.

The challenge for experienced players: the sequence is long. Not complex, but sustained. 12-15 beats of unbroken smooth input. Players who play aggressively will find the length tedious. The capture is a meditation test, not a reflex test.

## Party Role

Ribbini is the party's buffer. Its trailing silk dampens sudden movements — when Ribbini is active, other creatures' startled reactions are less severe. The silk absorbs shocks, metaphorically and literally.

Interaction with other party members:
- Drapes over sleeping Stavvy like a blanket. Stavvy doesn't notice. Ribbini doesn't mind
- Recoils from Ropey's strikes but then cautiously extends toward the rope's resting coils. Opposite textures, mutual curiosity
- Follows Levvi's figure-eight drift at a lower altitude, the two of them tracing parallel paths — wand above, ribbon below, like calligraphy
- Wraps around Diablo's anchor motes and flutters in the spin-wash. Diablo's turbulence gives Ribbini something to play with. Symbiosis: anxiety meets grace

Special ability: **Silk Veil.** When Ribbini is in the active party, the player's first mistake in any capture sequence is forgiven — the ribbon absorbs the error, flinching in the player's place. One free pass per encounter. Grace, extended.

## 3D Implementation Notes

Ribbon body: cloth simulation with high stiffness along the length axis and low stiffness perpendicular — resists stretching but bends freely. 48 segments minimum for smooth sine-wave propagation. The weighted end is a mass concentration at segment 0.

Cloth shader: two-sided with view-dependent color (thin-film interference approximation — dot product of surface normal and view direction drives hue shift through a rainbow LUT). Opacity falls off at edges (Fresnel term, inverted — more transparent when viewed head-on, more visible at grazing angles).

Spiral/helix idle motion: segment 0 follows a parametric spiral path; remaining segments follow via spring chain with high damping. Figure-eight: Lissajous curve input to segment 0.

Recoil: all segment target positions collapse to segment 0's position with a fast spring (critically damped, 0.3s settle). Uncoil: targets release sequentially from segment 0 outward, 2 segments per frame.

Wind response: apply per-segment force from a global wind vector, scaled by segment's perpendicular cross-section. Ribbini's idle animation blends with wind-driven displacement additively.

Trail afterimage: store segment positions in a ring buffer (60 frames). Render as a fading ghost mesh with decreasing opacity. Visible only during figure-eight and spiral patterns.

## Voice / Sound

No speech. Ribbini communicates through:
- A soft flutter (silk in light wind — the sound of something barely there)
- A whip-crack whisper when performing fast spirals (fabric cutting air, but quiet — like a flag heard from a distance)
- Silence during recoil (the absence of flutter = the creature is scared)
- A gentle rustling when draping over surfaces or other creatures (silk settling — intimacy expressed as textile physics)
- A faint harmonic tone when backlit at full extension (the ribbon vibrating at its resonant frequency — this only happens in specific wind/light conditions, making it rare and memorable)

Ribbini is the quietest creature after Levvi. The difference: Levvi's silence is presence. Ribbini's silence is absence. When Ribbini goes quiet, something is wrong.

## Design Intent

Ribbini exists to make the player slow down and look. In a game full of creatures that move, spin, strike, and bounce, Ribbini just... flows. The encounter is aesthetic before it's mechanical. The player's first reaction should be "that's beautiful," not "I need to catch that."

The capture mechanic reinforces the creature's thesis: gentleness is a skill. Players conditioned by other creatures to be fast and precise will struggle with Ribbini's long, smooth sequence — not because it's hard, but because it asks for a different kind of attention. Sustained, patient, flowing attention. The kind of attention that ribbon manipulation actually requires.

Emotionally, Ribbini is the creature that makes the player's party feel alive. Stavvy follows you. Ropey guards you. Diablo entertains you. Ribbini decorates the space around you, turning your walk through the world into something that looks like it was choreographed. The party becomes a procession. The game becomes a performance. That's Ribbini's contribution — beauty as gameplay value.
