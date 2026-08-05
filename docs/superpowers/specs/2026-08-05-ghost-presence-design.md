# Ghost presence — alive, inviting, and legible from across a room

**Date:** 2026-08-05
**Status:** Approved ("full send", Austen, 2026-08-05)
**Builds on:** `2026-08-04-ghost-mind-design.md` (the brain),
`2026-08-05-ghost-presenter-polish-handoff.md` (what shipped)
**Companion, still blocked on art:** `2026-08-04-taco-cat-presence-design.md`

---

## The problem

The presenter has a good brain and almost no presence. Austen's ask:

> "I want him to feel alive and serve the purpose of making it so anybody from
> afar who's watching the program on the projection screen is curious and is
> drawn in, and I also want them to know that they can take over at any time,
> and I want them to know that they can press buttons on the screen, and that
> this thing is a character."

Three gaps, measured against the built system:

1. **Not alive.** `mind.svelte.ts` computes a `GhostMood` on every decision and
   `GhostPointer.svelte` ignores it entirely. The body has two states — idle and
   pressed — plus a parked breathe. It glides, dips, glides. Nothing anticipates,
   hesitates, reacts, or rests.
2. **Doesn't carry at distance.** The dot is 28px, stepping to 44px only above
   `2600px`. A 1080p projector at a jam therefore gets the *laptop* treatment,
   which is the worst case in the room. The caption is the only thing doing work
   at fifteen feet, and it does it at one pace forever.
3. **Never says you can take over.** The only affordance is the parked dot, which
   appears *after* someone already touched the screen. A passerby has zero signal
   that the thing is live and touchable. This is a hole, not a polish item.

## Decisions taken before designing

Austen, 2026-08-05:

- **Level up the dot; do not wait for Taco Cat.** The dot becomes expressive on
  its own. Taco Cat later becomes a renderer behind the same mood seam rather
  than a rewrite. No art dependency on the critical path.
- **Both distances from one build.** The same tour has to read on a projection
  screen at fifteen feet and on a laptop at arm's length.
- **The invitation is in-character, on a slow loop.** No always-on banner, no
  product chrome sitting on screen for four hours.
- **An unnamed curious presence.** No name, no face, no self-reference.
  Personality comes entirely from what it wonders about and how it moves.
- **Earn moments.** During a payoff beat the ghost gets out of the way and shuts
  up, then reacts.

Explicitly cut: the always-on banner, a named self-aware character, and
camera/proximity presence detection.

---

## 1 — The invitation

A new intention family, `intentions/invite.ts`, registered in the bag like every
other. Nothing new in the architecture: precondition, appeal, thought,
choreography.

| id | what it does |
|---|---|
| `offer-the-wheel` | drifts to open space, stops, thinks *"you can take this from me whenever you want"* |
| `point-it-out` | hovers a control it likes, **does not press it**, thinks *"try this one — go on"*, then leaves it undone |
| `everything-is-live` | rests, thinks *"everything I press, you can press"* |

Design constraints that make it an invitation rather than nagging:

- **Appeal ~0.10**, so it only ever wins when nothing more interesting does.
- **Budgeted** via `memory.budgets.invites`, roughly one per 90–120s and capped
  per session, using the same mechanism `galleryOpens` already uses.
- **`can` requires a calm world** — not playing, no overlay, no picker open.
  Interrupting a payoff to advertise is the opposite of the goal.
- `point-it-out` deliberately leaves a specific thing unpressed. An unfinished
  action is a better invitation than any sentence, because it gives a stranger
  something concrete to do.

Presentation-mode only, like everything else in `attract/`. Real users never see
it.

## 2 — The body becomes a creature

### Mood is rendered, never invented

The vocabulary already exists in `domain/intention.ts`:
`curious | delighted | bored | unsure | still`. The mind sets it; the body reads
it. One table in `GhostPointer.svelte` maps mood to **motion and colour, never
iconography** — no faces, no emoji. Silhouette and behaviour only, which is the
same bar the Taco Cat spec sets for its poses.

| mood | reads as |
|---|---|
| `curious` | baseline — steady breathe, accent hue |
| `delighted` | warmer hue, faster breathe, a brief bloom |
| `bored` | dimmer, slower breathe, larger idle drift |
| `unsure` | slight wobble, desaturated |
| `still` | minimal motion, soft — it is watching something |

### Motion vocabulary

Five additions to the motor in `attract-ghost.svelte.ts`, in order of life
bought per line changed:

1. **Hesitation before commit.** Today it glides onto a target and presses. Add a
   short settle-and-consider at the target before the press fires. This is the
   single largest "alive" tell.
2. **Anticipation and overshoot.** A small pull-back against the direction of
   travel before a long glide; a slight overshoot and settle on arrival. The
   bowed bezier stays; this wraps it.
3. **A trailing wisp.** `GhostState` gains `speed` and `heading`; the body renders
   a comet tail whose length tracks speed. This is what makes the dot legible as
   a *moving thing* at fifteen feet instead of a jumping speck.
4. **Breathing at rest, always.** Currently parked-only. A perfectly still ghost
   reads as a frozen app.
5. **Recoil after a press.** A quick scale rebound rather than a flat return.

These live in the shared motor, so the composer marketing acts inherit them.
That is intended — it is the same ghost.

## 3 — Stage mode

Viewport width cannot distinguish a 1920 projector from a 1920 laptop, so
inferring is a guess. Explicit instead:

```
?present=1       laptop, arm's length   (unchanged behaviour)
?present=stage   projection / TV        (the big read)
?present=0       disarm                 (unchanged)
?present=<seed>  replay                 (unchanged)
```

`stage` ramps four things together, from one flag set once at setup:

- ghost size and trail length
- caption width, type size, and hold duration
- the pace between decisions
- idle drift amplitude

It latches in sessionStorage alongside the existing arming latch, so it survives
the reloads that already drop the query string.

## 4 — Earned moments

`Intention` gains an optional `savor?: number | ((ctx) => number)`. When present,
after a successful `perform` the ghost **shrinks, dims, glides clear of the
action, and the caption clears** for that duration. The app is unobstructed, the
payoff plays, and then the ghost comes back and delivers its `reaction`.

Applied to the beats that have something to watch: `play-it`, effect
application, and the admire family.

This deliberately reintroduces movement-after-press, which was removed in
`3b912bbc97` because `watchKind()` called `restBeside()` after **every** press
("moves out of the way after clicking"). The distinction is the whole point and
is written into the code as a comment: getting out of the way is right when
there is something to see, and wrong when there is not. Only an intention that
declares `savor` moves aside.

---

## Architecture

No new subsystem. Every change lands in a file that already owns that concern:

| File | Change |
|---|---|
| `services/attract-ghost.svelte.ts` | `speed`/`heading`/`dimmed` on `GhostState`; anticipation, overshoot, hesitation, recoil; a `savor()` primitive |
| `domain/intention.ts` | the `savor` field |
| `services/mind.svelte.ts` | run `savor` between perform and reaction; pace from stage mode |
| `intentions/invite.ts` | new — the invitation family |
| `intentions/index.ts` | register it |
| `components/GhostPointer.svelte` | mood table, trail, breathing, stage sizing |
| `components/ThoughtCaption.svelte` | stage tier |
| `services/presentation-mode.ts` | parse `stage` |
| `state/presentation-state.svelte.ts` | expose `stage` |
| `components/PresenterHost.svelte` | pass `mood` and `stage` down |

The mood seam is the load-bearing piece: once the body renders mood rather than
raw coordinates, swapping in a character is a renderer change behind an
unchanged interface.

## Verification

- `npm run check` clean; `tests/unit/attract/` green, including the existing
  static guards (every kind annotated, every kind used, no thought reading the
  DOM without a declared target, no `goto()`/`history.back()`).
- New unit coverage: invitation intentions are budgeted and cannot fire during
  playback or over an overlay; `savor` runs only on success.
- Screenshots at the required viewports for size and caption legibility, plus a
  `?present=stage` frame at 3840 — the frame that answers whether the ghost is a
  presence or a speck.
- **Motion cannot be judged from a still.** The "does it feel alive" call is
  Austen's, watching it run at `?present=1` and `?present=stage`. That is the
  acceptance test and it is stated as such rather than implied.

## Risks

| Risk | Mitigation |
|---|---|
| Motor changes regress the composer marketing acts | They share the motor deliberately; the additions are additive and the acts' cycles are untouched |
| The invitation becomes nagging over four hours | Appeal 0.10, session budget, calm-world precondition |
| `savor` reintroduces the "moves after every click" bug | Opt-in per intention, never global; comment in the code names the prior failure |
| Stage mode forgotten at setup | The laptop default is the safe one; stage is additive, not required |
