# #012 — Buugen

> You saw it. Then you didn't. Then it was something else entirely.

## Identity

| Field | Value |
|-------|-------|
| Name | Buugen |
| Prop | Buugeng |
| Tier | 3 — Rare |
| Rarity | Biome-specific (fog zones, optical-illusion areas) |
| Animal Analog | Fox — trickster, shape-shifter, always one step ahead |

## Appearance

Two S-curved staves, mirror images of each other. The curves are pronounced — not subtle bends but full sinusoidal shapes that look different from every viewing angle. From one side: two crescents. From another: a figure-eight. From above: something that doesn't resolve into a shape at all.

The material shifts between matte black and reflective depending on lighting angle. Edges catch light in thin bright lines, making the form readable, then rotate ten degrees and the lines vanish. The creature appears to be made of negative space with occasional bright outlines.

Optional: googly eyes at the top curve of each S-shape. The eyes seem to appear and disappear as the staves rotate — visible from some angles, hidden by the curve from others. You're never sure if you saw one eye or two.

## Movement & Behavior

### Idle
- The two S-curves rotate in opposite directions at matched speed
- The rotation creates a continuous morphing effect — the silhouette never holds a recognizable shape for more than a second
- Occasionally both staves align into a single form (a circle, a line, a diamond) for one frame, then diverge
- Drifts laterally while spinning, covering ground without any clear forward-facing direction
- Seems to flicker at the edges of peripheral vision — fully visible when looked at directly, but shimmer-unstable in the corner of your eye

### Alert (player approaches)
- The rotation slows to near-stop, and both S-curves align into a flat plane facing the player
- For one second, it's completely legible: two S-shapes, clear and still
- Then it splits — one stave phases to 50% opacity while the other rotates behind it, and the creature appears to be in two places at once
- Repeats this split-merge cycle, daring the player to track which one is "real"

### Happy (after capture / in party)
- Orbits the player while spinning, creating a morphing halo effect around the player's head
- Occasionally aligns into recognizable shapes on purpose — a star, a heart, a question mark — then breaks apart before the player can confirm what they saw
- Nuzzles by pressing one S-curve flat against the player's side, the other curving around behind them like a fox tail

### Startled
- Both staves snap to full-speed counter-rotation — the fastest spin in the creature's repertoire
- The visual result is a blur that makes Buugen look twice its actual size
- Rapidly phases between 30% and 100% opacity
- Darts sideways in quick lateral jumps, never the same direction twice

### Sleep
- The two S-curves nest together, interlocking into a compact double-helix shape
- Hovers just above ground, rotating extremely slowly — one full revolution per 30 seconds
- The edges still catch light, tracing a slow DNA-spiral pattern in the dark
- Almost invisible in low light. You could walk past it.

## How You Encounter It

Fog zones. Places where visibility drops and the world gets uncertain.

Buugen lives in the ambiguity. You see something moving in the fog — a shape that could be a creature, could be a branch, could be a trick of the light. You move toward it and it's gone. You turn around and something flickers at the edge of your vision. You spin to look — nothing.

Then it materializes. Not from hiding — it was always there. The fog just made it impossible to resolve its shape until it chose to let you.

Special condition: Buugen only appears when the player is alone (no other party creatures deployed). It won't manifest near other creatures. Fox energy — it comes to the solitary traveler, not the crowd.

## Capture Sequence Difficulty

Hard. The capture sequence tests pattern recognition under visual deception.

The sequence presents morphing shapes. The player must identify the real orientation of the S-curves from a continuously rotating form — picking the correct frame from an optical illusion in motion. It's a timing puzzle where the "correct" answer looks identical to two wrong answers from almost every angle.

Buugen phases in and out during the sequence. During phased-out moments, inputs don't register. The player must time their inputs to windows when Buugen is actually present — but the opacity transitions are smooth, so the boundary between "here" and "not here" is deliberately unclear.

After each failed attempt, Buugen changes its rotation pattern. Muscle memory from the previous attempt actively hurts you.

## Party Role

The scout. Buugen reveals hidden things.

When Buugen is in your party, objects and paths that were previously invisible gain faint edge-glow outlines — the same bright-line effect that makes Buugen's own form visible. Secret doors, buried items, camouflaged creatures: Buugen shows you the edges of things the world is hiding.

Special ability: **Phase Walk.** Once per encounter, Buugen can phase the entire party to 50% opacity for 3 seconds, allowing passage through a visual barrier (fog wall, illusion wall). The destination is always somewhere that was visible but unreachable.

Creature interactions:
- Fascinated by Crysta (two masters of "is it there or not")
- Annoys Sabre by phasing through its territorial boundary
- Stavvy stares at Buugen's morphing shapes, mesmerized, tips tracing the outline

## 3D Implementation Notes

Two S-curve mesh instances with mirrored geometry. The optical-illusion effect comes from the actual shape — buugeng geometry genuinely looks different from different camera angles. No shader tricks needed for the core morphing; just rotate the mesh.

Opacity phasing: animate material opacity with a smooth sine curve. During alert/startled states, increase frequency and add noise to the curve.

Edge-glow for the "bright lines" effect: Fresnel-based rim shader that activates at glancing angles. The lines appear when the surface normal is nearly perpendicular to the view direction — which happens naturally along the S-curves as they rotate.

The split-merge alert behavior: briefly offset the two meshes spatially (one drifts 0.5m left, the other 0.5m right) while fading the drifting one to 50% opacity. Lerp back together over 0.8 seconds. Repeat.

Fog-zone rendering: Buugen's geometry should not interact with the fog volume in the standard way. Exempt it from distance-fade so it can appear and disappear on its own schedule rather than the fog's.

## Voice / Sound

No speech. Buugen communicates through:
- A low, breathy whistle — like air moving through a curved tube (the S-shape acting as a resonator)
- The whistle pitch-shifts as it rotates, rising and falling with the shape's orientation
- A soft "pop" when it phases fully out of visibility
- A reversed "pop" when it phases back in
- When happy, the whistle becomes a two-note harmony (both staves resonating at different pitches)
- When startled, the whistle jumps to a shrill single tone — a fox's bark compressed into a wind-instrument sound

## Design Intent

Buugen is the creature that teaches the player to question what they see. Every other creature is visually honest — what you see is what it is. Buugen is the first creature that lies to you, and it lies with real physics.

The buugeng's optical-illusion property isn't a game mechanic bolted on — it's the actual behavior of the real prop. S-curves spun in opposition genuinely create shapes that morph and disappear. The creature is the illusion.

The emotional beat: the moment the player realizes Buugen has been following them for the last five minutes and they didn't see it. Not because it was invisible — because they were looking at it and couldn't tell it was there. The shape kept resolving into "nothing" from their angle. The trickster was hiding in plain sight.
