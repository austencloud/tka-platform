# Ghost Mind — a curiosity-driven presenter for the whole app

**Date:** 2026-08-04
**Status:** Design approved, not implemented
**Companion spec:** `2026-08-04-taco-cat-presence-design.md` (the body)
**Deferred siblings:** the docent (takeover dialogue), the park QR funnel

---

## The problem

Austen wants to bring a laptop to a flow jam, prop it open, and have the app
demonstrate itself to passersby for hours without him touching it. Two existing
attract acts (Construct and Generate, on the composer marketing page) prove the
motor model works but only cover two hand-scripted sections of one page.

Scaling that model to 26 modules by writing 26 scripts fails twice: it is a
permanent authoring treadmill, and a script that breaks reads as a ghost
frozen in front of strangers.

The requirement is not "more scripts." It is a presenter that **decides what to
do next based on what it just did** — so its exploration is emergent, never
repeats the same tour, and covers breadth no author would sequence by hand.

Austen's framing (2026-08-04):

> "it can create a sequence that starts with A and then have the thought I
> wonder if there's something I can make that would be continuous from this
> ... and then it can think I'm bored of doing effects let's see what this
> tunnel button is ... and then it can remember that it's touched the tunnel
> button in this session"

## What this is

A **utility-scored intention loop** driving the existing attract-ghost motor.

The ghost holds a bag of small curiosities. Each one knows whether it's
currently possible, how appealing it is right now, what it's thinking, and how
to act it out. One loop scores every satisfiable intention, picks a winner,
performs it, and re-scores against the world the intention just changed.

That is the entire mind. It is roughly a hundred lines. The Sims uses the same
shape.

**The intention sequence is never authored** — only individual intentions are.
This is what buys hand-choreographed quality per action AND emergent breadth
across the app, which the scripted and crawler approaches each only half
deliver.

## Non-goals

- **A smarter scorer.** Mood models, planners, an LLM in the loop. A weighted
  score with recency decay and hard preconditions produces ~95% of the
  observable behavior; the rest is invisible to someone standing fifteen feet
  away. Budget goes to more intentions, not a better brain.
- **The docent.** Greeting the visitor, walking them through, offering to
  reset — a different interaction model (branching, responsive, written
  dialogue). Separate spec, deferred past the first jam.
- **Automated bug-finding.** A wandering clicker is a monkey test with no
  oracle: it distinguishes "threw" from "didn't throw," never "correct" from
  "wrong." This spec pays only the two cheap taxes that keep it possible later
  (seeded RNG, action trail) and does not build it.

---

## Architecture

### Layers

```
  Intention bag        22 curiosities: precondition + score + thought + beat
        |
  Mind loop            score → pick → perform → remember → repeat
        |
  Sensors (ctx)        DOM-derived reading of live app state
        |
  Attract ghost core   motor model, press gate, park/resume  [EXISTS]
        |
  GhostBody            the dot today, Taco Cat next          [SPEC 2]
```

### Move the core out of the route folder

`attract-ghost.svelte.ts` currently lives at
`src/routes/(public)/composer/_sections/attract-ghost.svelte.ts`. It is now
whole-app infrastructure and cannot stay inside one marketing route.

Move to `src/lib/shared/attract/services/attract-ghost.svelte.ts`. Pure move,
no behavior change; the two composer acts update their import. Do this first —
everything else imports from the new home.

Resulting layout:

```
src/lib/shared/attract/
  services/attract-ghost.svelte.ts     moved, unchanged
  services/mind.svelte.ts              the loop
  services/sensors.svelte.ts           GhostContext construction
  services/rng.ts                      seeded RNG
  services/trail.ts                    action ring buffer
  domain/intention.ts                  the Intention type + categories
  domain/safety.ts                     allowlist + route denylist
  intentions/build.ts                  |
  intentions/playback.ts               |
  intentions/effects.ts                | the bag, grouped by category
  intentions/explore.ts                |
  intentions/admire.ts                 |
  components/ThoughtCaption.svelte     the visible monologue
```

### The Intention

```ts
export type IntentionCategory =
  | "build" | "playback" | "effects" | "props"
  | "explore" | "admire" | "reset";

export interface Intention {
  id: string;
  category: IntentionCategory;

  /** The visible monologue. A function when it names what it found. */
  thought: string | ((ctx: GhostContext) => string);

  /** Hard gate. False means it is not even a candidate this tick. */
  can: (ctx: GhostContext) => boolean;

  /** Appeal right now, 0..1, BEFORE novelty and fatigue are applied. */
  appeal: (ctx: GhostContext) => number;

  /** The choreography. Same primitives the composer acts already use. */
  perform: (g: AttractGhost, ctx: GhostContext) => Promise<void>;

  /** Optional mood hint for the body (spec 2). Defaults to "curious". */
  mood?: GhostMood;
}
```

`perform` is written against the existing `AttractGhost` surface —
`waitFor`, `browseAndPick`, `moveAndPress`, `hoverOn`, `restBeside`, `dwell`,
`glideTo`. No new motor primitives are required. Each `perform` is small: the
existing `fiddleTurns` and `fiddleFilter` in `construct-attract-act.svelte.ts`
are already exactly the right size and shape to be lifted into intentions
nearly as-is.

### Sensors: the actual engineering

The scoring is trivial. Knowing truthfully whether the 3D viewer is openable
*right now* is not. When a precondition lies, the ghost reaches for something
that isn't there and reads as broken. **This is where the work and the rot
live.**

The discipline that keeps it contained: **sensors read the DOM, never feature
code.** The existing core already works this way (`waitFor`, `elementFromPoint`
hit-testing) and it is the reason the ghost cannot break the app — it is a
zero-dependency observer, not a consumer of 26 modules' state.

```ts
export interface GhostContext {
  // ---- world (re-read every tick) ----
  moduleId: string | null;      // from the route + MODULE_DEFINITIONS
  tabId: string | null;
  hasSequence: boolean;
  sequenceLength: number;
  isPlaying: boolean;
  activeEffectIds: string[];
  viewerOpen: boolean;
  pickerOpen: boolean;

  // ---- memory (persists for the session) ----
  performed: Map<string, number>;          // intentionId -> times
  visitedModules: Set<string>;
  lastCategory: IntentionCategory | null;
  fatigue: Map<IntentionCategory, number>; // 0..1, decays back toward 0
  moduleDwellMs: number;                   // time in the current module
  rng: Rng;
  trail: Trail;
}
```

Where the DOM genuinely cannot answer a question, the component gets **one
attribute** — `data-ghost-state="playing"` — rather than the ghost gaining an
import. Cheap, local, and it travels with the component through refactors
instead of rotting in a distant file.

### Scoring

```
final = appeal(ctx)
      × novelty      1 / (1 + performed(id))
      × freshness    1 - fatigue(category)
      × momentum     1.6 if category follows last naturally, else 1.0
```

**Momentum is what produces the chain of thought.** `build → playback` and
`playback → effects` and `effects → effects` are natural successors; the bonus
makes "make a thing, watch it, then dress it up" the *likely* path without ever
hardcoding that sequence. A `FOLLOWS` adjacency map holds these pairs.

**Fatigue is what produces boredom.** Performing any intention adds ~0.35 to
its category's fatigue; every tick decays all fatigue by ~0.04. Six effect
tweaks in a row drives `effects` fatigue near 1, `freshness` collapses, and the
ghost genuinely tires of effects and looks elsewhere — Austen's "I'm bored of
doing effects, let's see what this tunnel button is," emergent rather than
scripted.

**Selection is weighted-random over the top 5, not argmax.** Argmax is
deterministic and will retrace the same tour every session, which is precisely
the failure the whole design exists to avoid.

### Navigation

`MODULE_DEFINITIONS` (26 entries) and the per-module `*_TABS` in
`tab-definitions.ts` are the map — already built, already accurate, no new
authoring. A single generic `go-to-module` intention scores highest for modules
absent from `visitedModules`, so breadth is a natural consequence of novelty
rather than a separate mechanism.

`moduleDwellMs` feeds a rising pressure to move on, so the ghost cannot get
stuck admiring one screen for the whole jam.

### Safety — "everything except mess with your work"

Three layers, default-deny:

1. **Allowlist, not blacklist.** The ghost may only press an element carrying
   `data-ghost="safe"`, or one matched by an intention's own explicit
   selector constant. Everything unannotated is invisible to it. Blacklists
   lose; a control added next month is safe by default under this rule and
   dangerous by default under the other.
2. **Route denylist.** `domain/safety.ts` hard-refuses navigation to `/admin`,
   settings danger zone, feedback submission, and shop checkout regardless of
   annotation.
3. **A demo identity on the park laptop.** Not code — a browser profile signed
   in as a demo account, so there is no work of Austen's present to damage.
   This is an operations step in the handoff, not a build task. It is the
   belt; the allowlist is the braces.

Presentation mode is explicitly opt-in and never auto-starts. Under
`prefers-reduced-motion` the mind does not mount, matching the existing acts.

### Takeover

Unchanged from the shipped behavior: the section's capture listener sees a real
pointer event, calls `pause()`, the ghost glides to the corner and parks as a
"watch it again" button. The mind's contribution is that on `resume()` it keeps
its memory — it does not restart its tour from scratch, it carries on from what
it had already seen. The docent's greeting hooks this same seam later.

### Two cheap taxes for the monkey-test future

Both are near-free now and impossible to retrofit cheaply later:

- **Seeded RNG.** Every `Math.random()` in the mind and in new intentions goes
  through `rng.ts`. The seed is logged at start. Without this, anything the
  ghost stumbles into is unreproducible.
- **Action trail.** A 200-entry ring buffer of
  `{ t, intentionId, thought, moduleId, ok }`. Costs nothing, and it is exactly
  the payload a future monkey-test mode would dump on a console error.

The existing core keeps its own bare `Math.random()` calls for motor jitter —
that noise is cosmetic and does not affect reproducibility of *decisions*.

---

## The intention bag (22)

Austen's eleven, plus eleven to round out coverage.

**build**
1. `pick-start` — no sequence yet → browse start positions and choose
2. `add-step` — picker open → `browseAndPick` an option
3. `filter-continuous` — *"I wonder if anything continues from this"* → toggle
   the All/Continuous pill, pick from the filtered set, retreat if it emptied
4. `fiddle-turns` — change a hand's turns and watch the grid re-derive
5. `page-families` — flip letter-family pages, browsing
6. `clear-and-restart` — *"let's try something completely different"*
   (category `reset`; scored by sequence length and total dwell)

**playback**
7. `play-it` — *"let's see what that looks like"*
8. `pause-to-look` — freeze mid-play, hold, resume
9. `scrub-back` — press an earlier step cell, watch the replay land
10. `change-tempo` — where a BPM control is annotated

**effects**
11. `try-effect` — *"I wonder what this looks like with bubbles"*
12. `reject-effect` — *"…no. Not bubbles."* → swap to another
13. `tune-effect` — walk a slider thick → thin and back

**props**
14. `try-prop` — reskin the whole board live

**explore**
15. `what-is-this-button` — press an annotated control it has never pressed in
    this session; the thought names it
16. `open-viewer` — *"what's this 3D thing?"*
17. `overwhelmed` — in a dense view, drift the pointer around pressing nothing,
    then leave. Pure personality; presses no controls, so it is always safe
18. `go-to-module` — the generic navigator, scored by novelty
19. `browse-gallery` — *"I wonder who else has made stuff"*
20. `open-someone-elses` — open a gallery sequence and watch it

**admire**
21. `linger` — sit still on a `data-ghost-linger` element and just watch. This
    is the "spend more time on the things that are really pretty" requirement,
    and it is the only intention that deliberately does nothing
22. `open-mandala` — pull up a mandala and let it sit

### Thought copy

The caption is the intention's `thought`. Rules: first person, present tense,
short enough to read at a glance from across a picnic table, and it follows
`ai-writing-guide.md` — no exclamation-mark enthusiasm, no "Let's dive in."

Any thought that names a sequence **must** route the word through
`simplifyRepeatedWord` (`src/lib/shared/foundation/utils/word-simplifier.ts`)
per `simplified-word-display.md`. A LOOP's word repeats by construction and the
ghost must never think *"nice, FΨFΨFΨFΨ"*.

---

## Testing

Austen's instinct — tests as the anti-rot barrier — is right, and this design
puts them where they are cheap. **The mind is pure logic and highly testable;
26 rendered-module selector suites are not.**

| Test | Kind | What it protects |
|---|---|---|
| Scorer produces a stable tour for a fixed seed | unit, no DOM | the loop, momentum, fatigue |
| Fatigue drives category switching within N ticks | unit, no DOM | boredom actually emerges |
| Every intention's `can` is false against an empty ctx | unit, no DOM | no intention assumes state |
| Novelty strictly decreases on repeat | unit, no DOM | no infinite repetition |
| Every `data-ghost-linger` sits on a `data-ghost="safe"` element | static grep | annotation integrity |
| Denylisted routes are unreachable from any intention | static | safety layer 2 |
| Set-piece selector constants still resolve | rendered, ~5 only | the choreographed beats |

That last row is the only one that renders anything, and it is capped at the
handful of intentions whose choreography genuinely earns it. This deliberately
does not gate every UI push on a heavy browser suite —
`component-test-discipline.md` is explicit that a broad required gate before it
has earned trust costs more than it catches.

## Verification

Per `visual-verification-mandatory.md`, this ships with screenshots — it is a
new visual surface. Required: 1920×1080, 2560×1440, 3840×2160, 1440×900. The
park laptop is the target, so the small-end viewports are skippable here and
that skip is recorded. The thought caption must be checked for layout shift per
`no-layout-shift.md`: it is variable-width text that changes at runtime, which
is the exact ghost-sizer case.

Beyond frames, the honest acceptance test is behavioral: **run it for twenty
minutes and watch.** If two consecutive five-minute windows look like the same
tour, the scorer is too deterministic. If it stalls anywhere, a precondition is
lying.

## Risks

| Risk | Mitigation |
|---|---|
| A precondition lies; ghost reaches for nothing | Every `perform` already no-ops on empty `waitFor`; the trail records `ok: false` so stalls are findable |
| The tour feels random rather than curious | Momentum bonus + the visible caption. If it still reads random, raise momentum before adding intentions |
| Thermals/battery over hours at a park | `moduleDwellMs` pressure caps time in 3D-heavy modules; a global cooldown after any WebGL-heavy intention |
| Firestore read cost from gallery browsing | `browse-gallery` and `open-someone-elses` share a per-session cap |
| Someone walks up mid-3D-scene and it is slow | Existing takeover already parks instantly; unaffected by the mind |

## Open question carried into implementation

The thought caption's placement relative to the pointer is a visual judgment
that cannot be settled on paper — it must not obscure the control the ghost is
about to press, and it must stay on-screen at the band edges. Resolve it at the
browser, not in this document.
