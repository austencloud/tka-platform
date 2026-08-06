# The ghost learns what the app is for

**Date:** 2026-08-06
**Status:** design, being implemented
**Supersedes nothing. Extends:** `2026-08-04-ghost-mind-design.md`, `2026-08-05-ghost-presence-design.md`

## The problem

The presenter can operate the app. It cannot *understand* it, and the difference
shows from across a room.

Austen (2026-08-06), on the All/Continuous filter: *"ask yourself why somebody
would want to use this toggle, what would go through their head when they are
deciding to pick between them, what might they be confused about and then
suddenly have a realization about... Every little thing like this should be
psychoanalyzed so that the ghost actually has realistic interactions."*

Today every intention is stateless with respect to meaning. `filter-continuous`
fires on `has(ctx, "option-filter")` at appeal 0.45 — essentially at random —
presses the toggle, and retreats if the list emptied. It never had a reason to
press it, is never surprised by what happens, and is in exactly the same
relationship to the control on the fortieth press as on the first. That reads as
fiddling, because it is fiddling.

A person's relationship to a control has a history. The interesting part of
watching someone use software is watching that history happen.

## The load-bearing domain fact

```ts
getReversalCount(option: PictographData, sequence: PictographData[] = [])
```

Continuity is **not a property of a letter**. It is a property of the transition
from where the sequence currently is. The same letter is continuous in one
sequence and a reversal in another.

That is why the toggle is confusing (the surviving set changes between steps,
which is inexplicable if you think it filters letters) and it is precisely what
the realization consists of (it filters *what follows this*, not *which letters
are nice*). The arc below is not decoration on a button press — it is a person
acquiring a real idea about TKA.

## The mechanism: concepts, beliefs, and evidence

A **concept** is an idea the app embodies that a person has to arrive at. Not a
control — `undo` is a control, *"this is forgiving, you can take things back"*
is a concept.

The ghost holds one belief per concept:

```ts
type UnderstandingStage = "unaware" | "curious" | "confused" | "understood";
```

Beliefs live in `GhostMemory.concepts`, so they are seeded, inspectable via
`window.__ghost.memory`, and reset with the mind.

An intention may declare which concept it is an encounter with, and how to read
the result:

```ts
interface Intention {
  concept?: string;
  learn?: (
    before: GhostWorld,
    after: GhostWorld,
    ctx: GhostContext,
  ) => UnderstandingStage | null;
}
```

**The rule that makes this honest: `learn` receives the world before the action
and the world after it, and returns a new stage only when the delta warrants
one.** The mind snapshots both. Returning `null` leaves the belief untouched.

This is the whole design, and the constraint is the point. The ghost cannot say
"oh, it only shows me what flows on from here" unless the option count actually
collapsed when it pressed the toggle. On a screen where Continuous happens not
to filter anything, no insight is claimed, because none was available. The
previous attempt at giving the presenter an inner life failed by writing lines
first and finding excuses for them second (`ca21afa1f6`, reverted). Evidence
first, line second, or not at all.

Ordering in the tick is therefore fixed: **perform → sense again → learn →
react.** The reaction is allowed to be about what was just understood, which is
what makes a realization land as a realization instead of an announcement.

## The arc, using continuity as the worked example

| Stage | Gate | What it is |
|---|---|---|
| `unaware` | — | Has not built enough to have a problem. Does not touch the filter. |
| `curious` | played the sequence, > 20 options on screen | The motive comes from **playback**, not from the picker. Nobody constrains their option space for fun; they do it after something felt lumpy and they went hunting for why. |
| `confused` | pressed it, option count collapsed hard | *"did I break it?"* The honest first reaction to forty options becoming six. |
| `understood` | met the collapse a second time and the surviving set had **changed** | The realization: it is not filtering letters, it is filtering what follows this one. |

Past `understood`, the same press means the opposite of what it meant at
`confused`: going back to All is no longer a panicked retreat, it is *"I want
that letter and I will take the reversal."* Same control, same action, different
person.

## Concepts modelled

Each one is a real idea, and each `learn` is a measurable delta — no concept
ships without an observation that could fail.

| Concept | The idea | Evidence |
|---|---|---|
| `continuity` | The picker recommends, it does not restrict | option count collapses, and the survivors differ between encounters |
| `extension` | A sequence that closes can be completed for you | length jumps without the ghost adding steps |
| `reversibility` | It is forgiving — you can take things back | length returns to what it was |
| `transformation` | You can change the whole thing without rebuilding it | word changes, length does not |
| `generation` | You can ask for one instead of making it | length goes 0 → many in one press |
| `layering` | How it looks is separate from what it is | effects change, length does not |

## Reach: the app the ghost could not see

Confirmed by grep on 2026-08-06: `src/lib/features/create/shared/components/sequence-actions/`
contains **zero** `data-ghost` attributes across 40 components, including
`ExtendView`, `TransformsGridMode` (Mirror / Swap / Rotate / Reverse) and the
step editor. `UndoButton` and `SequenceActionsButton` are likewise unannotated.
The ghost has never touched any of it, in any run, because none of it exists as
far as its sensors are concerned.

New kinds: `sequence-actions` (opens the panel), `extend`, `transform`, `undo`.

`extend` looked like it would need a published state attribute — `canExtend` is
computed by `sequence-extender.ts` and the sensors' standing discipline is that
where the DOM cannot answer a question, the component publishes one. It turned
out not to: `TransformsGridMode` renders the Extend button inside
`{#if onExtend && canExtend}`, so **the button's existence already is the
signal**. Annotating it is sufficient and strictly honest — the ghost can only
see the control on a sequence that really can be extended. No new attribute.

The same applies to `undo` (`data-ghost` set only while `canAct`) and to the
transforms (`helpMode` turns every one of them into a help popup the ghost
would have no way out of, so they are only pressable when they really perform).

## What this is not

Not a planner, and not a mood model. The mind stays `appeal × novelty ×
freshness × momentum` over a bag of small curiosities; selection stays
weighted-random over the top few. Understanding changes *what the ghost says and
when it is willing to act*, never how the winner is chosen. A scheduler would be
invisible from fifteen feet away. A presenter that visibly gets an idea is not.

## Verification

The session simulator (`tests/unit/attract/`) is the instrument: it runs the
real mind against a simulated app and reports the transcript. The contract is
that a long session actually completes an arc — the ghost must reach
`understood` on continuity, and must be seen using the sequence actions it can
now reach. Assertions live alongside the existing personality tests.

The simulator models what is annotated and what pressing it does. It cannot
judge how any of this reads from across a room; that is a browser job.
