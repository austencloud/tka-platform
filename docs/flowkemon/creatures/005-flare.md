# #005 — Flare

> A fan that wants you to look. Then doesn't want you to look. Then definitely wants you to look.

## Identity

| Field | Value |
|-------|-------|
| Name | Flare |
| Prop | Fans |
| Tier | 1 — Common |
| Rarity | Common (found in starter area) |
| Animal Analog | Peacock — lives to be seen, dramatic in everything, retreats into false modesty only to set up a bigger reveal |

## Appearance

Two rigid fans, each about 18 inches when fully spread. The fans operate as a pair — always two, mirroring or complementing each other. When open, each fan is a semicircular spread of flat vanes radiating from a pivot point at the base. When closed, each collapses into a narrow stick, roughly the size of a conductor's baton. The transition between open and closed is instant — a snap, not a gradual fold.

The fan faces have a visible front and back. The front catches light with a metallic sheen. The back is matte, dark. This matters because Flare uses the orientation — showing front versus back, open versus closed — as its primary expression system.

Optional: one googly eye per fan, mounted at the pivot point. When closed, the eye peeks out from the top of the folded stick. When open, the eye sits at the center of the spread, surrounded by vanes like a pupil in an iris.

## Movement & Behavior

### Idle
- Both fans float at shoulder height, opening and closing in alternating rhythm — one spreads as the other folds
- Occasional full-spread pose: both fans snap open simultaneously, hold for two seconds, then close
- Fans trace slow arcs through the air, rotating around their pivot points — the tech-spinning pattern, flat face sweeping through space
- Drifts through the environment at a leisurely pace, pausing at any reflective surface (water, glass, polished stone)

### Alert (player approaches)
- Both fans snap shut — the closed sticks point toward the player like antennae
- One fan opens slightly, angled to hide the creature behind it (peekaboo, one eye visible over the top edge)
- If the player continues approaching, the hiding fan spreads wider while the other stays closed — asymmetric, coy
- Retreats slowly, keeping the open fan between itself and the player like a shield

### Happy (after capture / in party)
- Full performance mode: both fans execute rapid open-close sequences, creating a strobe effect
- Fans sweep through coordinated patterns — stacking (one behind the other to create depth), framing (forming a window around the player's face), and waving (flowing figure-eight patterns)
- Clacks: fans snap shut against each other in rhythmic percussion, the equivalent of applause
- Occasionally frames another party creature between both fans, presenting them like a portrait, whether they want it or not

### Startled
- Both fans snap open at full spread and face outward — making itself look as large as possible
- Fans vibrate at high frequency while fully open (a threat display, like a cobra hood)
- If the threat doesn't retreat, both fans snap shut and Flare bolts — fast, low to the ground, closed fans cutting through air with minimal drag
- Takes several minutes to resume normal idle behavior after a startle

### Sleep
- Both fans fold closed and cross over each other in an X, like arms crossed over a chest
- The crossed fans tilt forward slightly, drooping
- No movement except a barely perceptible slow-breathing sway
- If disturbed, one fan snaps open instantly (the "I'm awake, I was awake the whole time" bluff)

## How You Encounter It

Flare lives near landmarks and open sightlines — hilltops, overlooks, the centers of plazas, anywhere it can be seen from a distance. You spot it doing its idle display against a scenic backdrop, and it's clearly chosen the spot for the view. The creature has taste.

Approaching Flare triggers the peekaboo sequence. It hides, then reveals, then hides again. The capture window opens when Flare commits to a full reveal — both fans open, facing the player directly. This happens after the player mirrors Flare's behavior: open something (a menu, a bag, any in-game action that involves revealing) or stand still long enough that Flare decides you're an audience, not a threat.

Found in the starter area's scenic overlook and the town square fountain. Also near any structure with reflective surfaces. Flare checks its own reflection. This is not a joke.

## Capture Sequence Difficulty

**Easy.** Flare wants to be caught. It just needs to believe the capture is its idea. The challenge is theatrical — the player must engage in the peekaboo rhythm rather than lunging. The capture sequence is a spreading motion — open your hands outward, like opening a fan. Flare recognizes the gesture as a compliment.

Wrinkle: if the player performs the capture gesture while Flare is in the hiding phase (single fan up as shield), Flare interprets it as mockery and retreats dramatically. Timing the gesture to match the reveal phase is the skill check.

## Party Role

Flare is the presenter. Its natural behavior frames things — literally, it positions its fans around objects, creatures, and landmarks to draw the player's attention. In unexplored areas, Flare gravitates toward notable items and presents them between its open fans. It's a living highlight marker.

Interactions with other creatures:
- Frames Stavvy between its fans constantly (Stavvy tolerates this with visible patience)
- Competes with Orbelle for the player's attention (Orbelle orbits, Flare poses — escalating displays)
- Hides behind a single fan when Klubba performs (jealousy, but also genuine awe it refuses to show)
- Hoopla rolls through one of Flare's posed frames, ruining the composition (Flare snaps both fans shut in indignation)

Special ability: **Reveal.** Flare can illuminate hidden objects and passages by opening both fans toward a surface, casting fan-shaped light that reveals what normal light doesn't. Useful in dark areas and puzzle rooms.

## 3D Implementation Notes

Core system: two fan meshes, each built as a set of flat vane segments sharing a pivot point at the base. The open/close animation rotates all vanes around the pivot — closed state bunches them into a stack, open state fans them into a semicircle. The snap timing is critical: the transition should take 2-3 frames, not a smooth interpolation. Fans read as mechanical, not organic.

Each fan tracks orientation independently. The "face" direction matters for lighting and for gameplay (front = display, back = hidden). A dot product check between the fan normal and the camera/player direction determines whether the creature is "showing" or "hiding."

The pair floats on a shared invisible root node that handles creature-level movement. Each fan has independent rotation but mirrored choreography — movement patterns are defined as paired keyframe sequences (left fan + right fan).

Clack sounds trigger on collision detection between the two closed fan meshes. The detection zone is small and requires both fans to be in closed state within a threshold distance.

State machine:
- IDLE (display cycle) → ALERT (player proximity)
- ALERT → PEEKABOO (alternating hide/reveal phases on a timer)
- PEEKABOO → FULL_REVEAL (player mirrors behavior or waits long enough)
- FULL_REVEAL → capture window open
- ANY → STARTLED (threat display, then flee if sustained)
- ANY → HAPPY (post-capture)
- IDLE → SLEEP (no audience for 90s)

## Voice / Sound

No speech. Flare communicates through:
- Sharp *snap* of fans opening (announcement, emphasis — the louder the snap, the more dramatic the moment)
- Softer *fwip* of fans closing (withdrawal, modesty, or setup for the next snap)
- Rapid flutter of half-open vanes (nervous excitement, anticipation)
- *Clack-clack-clack* of closed fans striking each other (applause, celebration, or impatient percussion)
- Whisper of air displaced by a slow fan sweep (contentment, the idle performance)
- Dead silence when sleeping (even the breathing-sway is soundless — Flare sleeps like it's posing for a painting)

## Design Intent

Flare teaches the player that some creatures want to interact — the challenge is matching their terms, not overcoming their resistance. Every other common creature is some form of pursuit or patience. Flare is performance. The player has to become an audience before they can become a partner.

Flare also introduces orientation as a game mechanic. Open versus closed, front versus back, showing versus hiding — the fan's flat face is a binary state (visible/hidden) that creates a communication system. The player who reads Flare's fan orientation understands the creature's mood without any other cue. This is the simplest possible version of the TKA concept that prop orientation carries meaning.
