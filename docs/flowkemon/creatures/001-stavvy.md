# #001 — Stavvy

> The starter creature. Two staves that follow you everywhere.

## Identity

| Field | Value |
|-------|-------|
| Name | Stavvy |
| Prop | Double Staves |
| Tier | 1 — Common |
| Rarity | Starter (given, not caught) |
| Animal Analog | Dog — loyal, eager, always nearby |

## Appearance

Two parallel staves, roughly 4 feet each, floating upright at slight angles to each other. Tips glow faintly. The staves tilt and rotate in sync, giving the impression of a single organism with two limbs.

Optional: googly eyes near the top tips of each staff. One eye per staff. They blink independently.

## Movement & Behavior

### Idle
- Bobs gently up and down (sine wave, ~2 second period)
- Tips trace slow, lazy arcs — like a dog wagging
- Rotates to face the player when player moves
- Drifts behind player at ~3m distance

### Alert (player approaches)
- Perks up — staves snap parallel, upright
- Bobs faster
- Leans toward player

### Happy (after capture / in party)
- Tips trace wider arcs — full wag
- Occasionally spins in place (full 360 rotation, like a dog chasing its tail)
- Stays closer to player (~1.5m)

### Startled (loud noise, other creature nearby)
- Staves cross defensively (X shape)
- Backs away from source
- Tips vibrate rapidly

### Sleep
- Staves lay horizontal, parallel, hovering just above ground
- Slow breathing-like rise and fall
- Tips dim

## How You Get Stavvy

Stavvy is the starter. Not caught — given.

The player enters the starting area. Stavvy is already there, following them. No tutorial, no Professor Oak speech. You turn around and it's behind you. It was always there.

First-time players won't realize it's a creature. They'll think it's a UI element or environmental decoration. The moment they perform their first sequence (prompted by a simple "press X to spin"), Stavvy reacts — bobs excitedly, mirrors the motion. That's when the player realizes: this thing is alive.

## Capture Sequence Difficulty

N/A — starter creature. But Stavvy demonstrates the capture mechanic by reacting to the player's first sequence, teaching the system without a tutorial.

## Party Role

Stavvy is always in your party. Cannot be released or stored. Your companion throughout the game.

As you catch other creatures, Stavvy reacts to them:
- Curious about Orbelle (watches the orbiting)
- Intimidated by Chukka (hides behind player)
- Confused by Crysta (stares at the motionless ball, nudges it)
- Awed by Cyrus (both staves tilt back, looking up)

## 3D Implementation Notes

Built on existing Staff3D model from TKA platform. Two instances, parented to a shared invisible root node that handles the creature-level movement (bobbing, following, facing player). Each staff instance handles its own tip-arc animation independently.

Behavior state machine:
- IDLE → ALERT (player proximity trigger)
- ALERT → HAPPY (post-capture)
- ANY → STARTLED (audio/proximity event)
- IDLE → SLEEP (no player activity for 60s)

## Voice / Sound

No speech. Stavvy communicates through:
- Wooden tap sounds (tips clicking together = excited)
- Whoosh of spinning (contented humming equivalent)
- Dull thunk (startled, crossing defensively)
- Silence (sleeping)

## Design Intent

Stavvy exists to make the player care about a pair of sticks. If the player feels nothing when Stavvy bobs excitedly after their first sequence, the creature system has failed. If they feel a pang of guilt leaving Stavvy behind while chasing Cyrus across the map, it's working.

The entire emotional arc of Flowkemon starts here: you thought this was just a prop. It's not. It was waiting for you.
