# #022 — Oxbow

> It just did something that shouldn't be physically possible. You're not sure what.

## Identity

| Field | Value |
|-------|-------|
| Name | Oxbow |
| Prop | Oxbow |
| Tier | 4 — Legendary |
| Rarity | Spawns in geometrically unusual locations. You find it by not understanding what you're looking at. |
| Animal Analog | Platypus — taxonomically confusing, shouldn't work, somehow thrives |

## Appearance

A looping, continuous metal-and-rubber form that has no stable resting shape. Imagine a Mobius strip that can also be a torus, that can also fold flat, that can also extend into a helix. The cross-section shifts between circular and rectangular as it moves. The surface is matte black rubber over a flexible metal spine, with a visible seam where the material overlaps — functional, not decorative. Industrial.

The topology is wrong. The player can't tell if Oxbow has one surface or two. Watching it fold, it seems to have an inside and an outside, but a moment later the inside IS the outside. It's a prop that gaslights your spatial reasoning.

No googly eyes. Oxbow doesn't have a face. It doesn't have a front. Every angle is equally valid. The player's brain will pick a "face" anyway — that's on them.

## Movement & Behavior

### Idle
- Continuously deforming. Never the same shape twice in sequence.
- Rolls like a wheel, then mid-roll the "wheel" folds into a figure-8 and the roll becomes a tumble, then the tumble unfolds into a spinning disc, then the disc warps into an oval that rolls on its edge
- Each transition is smooth but defies prediction. The player cannot anticipate the next shape.
- Gravitationally ambiguous — Oxbow doesn't always touch the ground. It rolls along surfaces, then rolls off a ledge and continues rolling in the air for a few meters before gravity remembers it exists.
- Leaves no tracks. Despite constant ground contact during rolling phases, no marks. As if it's not quite touching.

### Alert (player approaches)
- Freezes in whatever shape it's in. Holds.
- Then: performs a single, slow fold that reveals the shape was already something else the whole time. Like an optical illusion resolving. The player thought they were looking at a ring; it was a twisted strip viewed at the exact angle to look circular.
- Folds again. And again. Each fold reveals a shape the player didn't see coming from the previous one.
- It's showing off. Or it's confused. Impossible to tell.

### Happy (after capture / in party)
- Shapes become more recognizable: circles, figure-8s, spirals. Less alien geometry, more playful forms.
- Occasionally wraps around other party creatures briefly — Stavvy gets looped, looks confused, Oxbow unloops and rolls away
- Rolls alongside the player, matching pace, but taking wildly indirect paths — loop-de-loops, rolls up a wall and across the ceiling of an overhang, returns to the player's side as if nothing happened
- Will "catch" things — if a particle effect or small object passes near it, Oxbow's shape warps to enclose it momentarily, then releases

### Startled
- Instantly flattens. Goes from three-dimensional form to a 2D disc in a single frame.
- The disc wobbles like a dropped coin — thinning, thinning, almost flat — then snaps back to 3D in a shape completely different from the pre-startle form
- For a moment during the snap-back, the geometry visibly self-intersects. Vertices pass through faces. The mesh is technically broken. Then it resolves and everything is fine.

### Sleep
- Rests as a simple circle on the ground. Finally still.
- The simplest shape Oxbow can be. Just a hoop. No twists, no folds, no spatial paradoxes.
- Breathing motion: the circle slowly oscillates between slightly larger and slightly smaller. Uniform. Peaceful.
- This is the only time the player can study Oxbow's material and construction clearly. Up close, sleeping, it's just rubber over metal. The strangeness was always in the movement.

## How You Encounter It

Oxbow spawns in places where geometry gets weird: narrow canyons with strange echo properties, cave systems where the tunnels loop back on themselves, cliffsides where the horizon tilts at an angle that doesn't match the ground. The world's architecture hints that spatial rules are loose here.

Prerequisite: the player must have caught Buugen (#12, the shape-shifter Rare). Buugen is the gateway to understanding that props can be more than one shape. Oxbow is the final exam.

The encounter starts with the player seeing something they can't parse. At a distance, in one of these geometrically unstable zones, there's a shape. Moving. The player can see it moving, but they can't describe what shape is moving. Their eyes slide off it. It's not invisible — it's incomprehensible.

Approaching clarifies nothing. The player gets closer and still can't pin it down. Oxbow is performing its continuous deformation cycle, and at no point does it hold a shape long enough for the brain to categorize it.

The encounter triggers when the player stands still and watches for 15 uninterrupted seconds. Not approaching, not retreating, just observing. Oxbow rewards the person who stops trying to understand it and just watches.

After 15 seconds of observation, Oxbow stops. Holds one shape. Holds it long enough for the player to finally see it clearly. Then begins the alert sequence.

## Capture Sequence Difficulty

Oxbow's capture sequence tests spatial reasoning, not speed or endurance.

Each beat of the sequence is a shape transformation. The player sees Oxbow's current form and must identify which transformation will produce the next form. Not just "press the button at the right time" — the player selects from multiple options what the next step is.

Round 1: Simple. Ring to figure-8. Two options.
Round 2: Figure-8 to helix. Three options, one of which is a spatial trap (looks right from one angle, wrong from another).
Round 3: Multiple transformation steps chained. The player must predict two transformations ahead.

The difficulty isn't reflex — it's comprehension. The player has to understand how Oxbow's shapes relate to each other. Real oxbow prop manipulation has this same quality: you can't muscle through it, you have to understand the geometry.

Failure: Oxbow immediately resumes its idle deformation cycle. No anger, no fleeing. It just stops being something you can interact with and becomes something you can only watch again. The player has to re-earn the 15-second observation lock. Each re-observation, Oxbow presents a new starting shape. You can't memorize your way through.

## Party Role

Oxbow is the party's spatial anomaly. It doesn't do anything the way other creatures do, and its presence warps the rules slightly.

- Oxbow can traverse terrain other creatures can't: roll up vertical surfaces, loop through tight gaps, cross water by rolling across the surface tension
- Other party creatures are confused by Oxbow. Stavvy watches it with the same expression as the player. Crysta (#14, the contact ball) is the only creature that seems to understand Oxbow — they sometimes synchronize, rolling in complementary shapes.
- Buugen (#12) and Oxbow together create a "shape-shift resonance" — both creatures' transformations become more elaborate and impossible when the other is nearby

Special ability: **Topology**. With Oxbow in the party, the player can access shortcut paths through the world that fold space — entering a cave and exiting from a cliff face across the map. These paths were always there. Oxbow just makes them usable. The loading screen between zones is replaced by a visual of Oxbow unfolding the space.

## 3D Implementation Notes

Oxbow is the most technically challenging creature to render.

The base mesh is a torus with controllable twist parameter (0 = simple ring, 0.5 = Mobius strip, 1.0 = full twist). The twist value animates continuously. The cross-section morphs between circle and rectangle via shader, controlled by a morph target or parameterized vertex displacement.

Shape transitions: blend between predefined topological states using mesh morphing. Key states to model:
- Simple ring (rest/sleep)
- Figure-8 (classic oxbow manipulation shape)
- Helix (the prop extended into a spiral)
- Flat disc (startled state)
- Saddle (the intermediate "I don't know what I'm looking at" shape)

The self-intersection during startle recovery is intentional and should render as-is (no backface culling fix). The brief wrongness is the feature.

Material: matte black rubber shader with subtle normal-mapped texture for the woven surface. Metal spine visible at seam — emissive line along one edge that helps the player track the surface even during complex deformations.

The "gravity delay" (rolling off a ledge and hanging in air) is a simple tween: when ground contact is lost, maintain current trajectory for 0.5 seconds before applying gravity. Small detail, enormous personality payoff.

## Voice / Sound

Rubber and metal under stress. Oxbow sounds like:
- A low, continuous rubber-on-rubber squeak during rolling — not comedic, tonal. Like a cello bow on rubber strings.
- Metallic ping when the internal spine passes through a fold point (the sound of the metal inside the rubber flexing)
- A deep, resonant bwomm when snapping from 2D to 3D (the startled recovery) — something between a rubber band and a bass drum
- No sound during the alert freeze. Silence while it holds a shape. The absence of sound is how the player knows it's paying attention.
- In sleep state: nothing. No sound. Just a rubber ring on the ground. Peace.

## Design Intent

Oxbow is the creature that makes the player feel stupid and then rewards them for admitting it.

Every other legendary has a clear ask: follow me (Cyrus), match my speed (Fyr), watch carefully (Glowr), mirror me (Puppetta). Oxbow's ask is: stop trying to understand. Just look. The 15-second observation mechanic is a meditation gate. Players who approach analytically, trying to categorize what they're seeing, will frustrate themselves. Players who let their eyes relax and just watch will trigger the encounter.

This mirrors the real experience of picking up an oxbow for the first time. Every flow artist who has held one describes the same arc: confusion, frustration, the moment where you stop thinking and start moving, and then the prop makes sense in your hands even though you still can't explain what it is. Oxbow the creature captures that arc.

The "Topology" party ability is the thematic payoff: once you've accepted that space can fold, Oxbow shows you all the folds you've been walking past. The world didn't change. You did.
