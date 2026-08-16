# Museum Pedestal and Console — Design

**Date:** 2026-08-16
**Scope:** museum-wide (all 19 exhibit cases, all 6 wings), first built in Water
**Status:** written from the 2026-08-16 conversation; awaiting Austen's review
**Departments:** exhibit-design, experience-design, art-direction, engineering

---

## 1. What this settles

The museum had no answer to a question that applies 19 times: **what does a
performer stand on?** Nothing in the tracker specified it. This spec fixes the
pedestal as the museum's single cohesion thread, and defines the one interactive
object that sits in front of it.

Two ideas drive everything below:

1. **The pedestal is a readout, not a label.** Its face shows the figure the
   props above are actually drawing, generated from the bound sequence. A label
   can lie about the domain. A readout cannot.
2. **The pedestal belongs to the era. The console belongs to the museum.** A
   console in front of an ancient exhibit is not anachronistic — it is the
   museum's apparatus, the same way a touchscreen in front of a fossil is. What
   *is* era-bound is the set of verbs it offers.

---

## 2. Decision status

| # | Decision | Status |
|---|---|---|
| D1 | Pedestal is the museum-wide constant across all 19 cases | Decided 2026-08-16 |
| D2 | Pedestal face carries the generated mandala of the bound sequence | Decided 2026-08-16 |
| D3 | Face trace count follows prop bilaterality (one trace or two) | Decided 2026-08-16 |
| D4 | Consoles are per performer, not per wing | Decided 2026-08-16 |
| D5 | Console is diegetic: no zoom, no mode, no HUD | Decided 2026-08-16 |
| D6 | Framing while editing always holds all three performers | Decided 2026-08-16 |
| D7 | Modifications persist; the base is the indicator; restore is physical | Decided 2026-08-16 |
| D8 | Cave control tier is three universal buttons plus one contextual | Decided 2026-08-16 |
| D9 | "Show a different variation" is cut from the control set | Decided 2026-08-16 |
| D10 | Water's three performers stand mid-pool on stanchions | Decided 2026-08-16 (trial: "let's see how it feels") |
| E1 | Static vs. animated base lighting | **Open experiment** — build both, look at both |
| S1 | Wing opener form (propless avatar + unlabeled choreo card) | Sealed 2026-08-11, carried forward unchanged |

---

## 3. The pedestal standard

### Fixed museum-wide

- **Height** — chest-high, so the prop circle above lands at visitor eye level
  and is never cropped by the case's vertical framing.
- **Footprint diameter** and **edge profile** — identical in every wing.
- **Top face** — carries the generated figure of the sequence performed above it.

### Free per wing

Material, colour, light temperature, and what the pedestal stands in or on.
Water's rise out of the pool as wet stone. Fire's are ember-lit and sooted.
Earth's sit on root. Same object, six costumes.

### Why this is the cohesion thread

The wings must not look alike — that is the point of six elemental treatments.
So cohesion cannot come from material, colour, or light. It has to come from a
piece of grammar that repeats: same object, same job, same reading, dressed
differently each time. The pedestal is the only object present in all 19 cases
without exception.

---

## 4. The face is generated, never drawn

The face renders the **mandala** of the bound sequence — the integrated path the
prop tips trace.

**This is not new vocabulary.** The mandala already exists as a feature module
(`src/lib/features/mandala/`), is computed from prop-tip geometry (see the
mandala geometry calculator note at
`src/lib/shared/animation-engine/domain/types/prop-tip-points.ts:446`), and is
already proven as a teaching device — three separate games in Play are built on
reading them (`MandalaMatchGame`, `MotionToMandalaGame`, `CardToMandalaGame`).
The visitor who learns to read one here will meet it again in the app.

**Hand-drawn motifs are forbidden on any pedestal, board, or diagram.** The
Earth Long Terrace Gate 1 review (2026-08-08) caught the exact failure this
prevents: a board drew letter G as two rings side by side when both hands are at
beta — the props are co-located and their traces are concentric, not adjacent.
The board drew the two props in different places in a room whose subject is that
they are in the same place. That review's own remediation (findings I4 and I11)
was to generate the trace from the bound sequence's prop-tip path rather than
draw it. This spec adopts that as a museum-wide rule.

---

## 5. Prop identity on the face

Per the TKA glossary (MCP `get_term_definition("bilateral")`): a **bilateral**
prop is held at its center and extends equally both sides — a staff. A
**unilateral** prop is held at one end — a fan.

Consequence for the face: **a bilateral prop draws two figures at once; a
unilateral prop draws one.** The face must reflect this live.

This is the lesson the prop-swap control delivers, and it is two lessons rather
than one:

> The figure belongs to the hand. The number of copies belongs to the prop.

An earlier framing in this conversation — "swapping the prop doesn't change the
mandala" — is superseded. The *shape* is unchanged; the *trace count* is not.

---

## 6. Base lighting — the open experiment (E1)

Two candidates, both to be built and looked at before either is chosen:

- **Static.** The figure is lit and holds still under the performer.
- **Animated.** A light runs the circuit of the figure, so the base appears to
  be performing the same drawing as the props above.

**Current recommendation, pending the look:** animation is a **verb, not an
ambient.**

- Under the three performers: static by default. A base animating continuously
  competes with the performer for attention, 19 times over, and 19 always-running
  light circuits is a live performance cost in rooms that already pay for water
  and fire.
- **On the trace button:** the props begin drawing above and the same figure
  begins running as light below, in step. Two synchronized drawings from one
  press, then it settles back to static. This is a payoff moment rather than
  wallpaper, and it is the strongest single argument for the console existing.
- **At the wing opener (§7): always animated.** There is no performer standing
  on it to compete with.

Neither Austen nor Claude can call this from a document. Build the wing's
pedestals with real generated faces, light them both ways, and look.

---

## 7. The wing opener pedestal

**The opener's form is already sealed** (tracker `And3P4gs`, Austen 2026-08-11)
and is not reopened here:

> At the start of every family passage, the wing's choreo card is displayed as
> the hand path — actual pictographs shown, unlabeled — while a propless avatar
> performs just that hand path with a trail effect on the tips of the hands.

That decision also records *why* the card is present: **phase is invisible in an
integrated trace.** A trail shows the shape but not the timing, so the card
carries what the light cannot.

**What this spec adds:** the opener gets a pedestal too, built to the same
standard — same height, same footprint, same edge — but **empty of props**, with
only the hand path on its face, animated.

The emptiness is the message: this is the path with nothing in the hands. The
visitor meets the moving figure at the threshold with nothing else in frame,
learns to read it, then walks to three performers standing on the same figure
held still — one drawing two copies of it, one drawing one, depending on what
they hold.

One object, three states: **empty and moving; occupied and still; occupied and
moving on the button.**

---

## 8. The console — per performer (D4)

**One console per performer.** The argument is structural, not preference: the
hybrid's hand-swap control *only exists on the hybrid*. A pro-only performer has
no roles to swap; both hands do the same thing. A single wing console would have
to grey out a button two thirds of the time, or pretend the three cases are more
alike than they are.

**But the wing-console instinct is preserved as a framing rule (D6):** never
isolate the performer being edited. See §9.

Water's mid-pool staging (D10) makes this free — three stanchions in the middle
of the pool, consoles on the surrounding rail, so every console already looks
across at all three.

---

## 9. Diegetic interaction — no zoom, no mode, no HUD (D5)

The console is a real object at a real height with real buttons, in the form it
will be in when used. **There is no zoom transition, no editor mode, and no
screen-locked control panel. The camera is never taken from the visitor.**

Four alternatives were considered and rejected:

| Option | Rejected because |
|---|---|
| Separate editor land (performer outside the room) | Removes the performer from the room they are the subject of. |
| Fade the rest of the room down | Reads as software, and destroys the comparison that is the wing's entire reason to exist. |
| Screen-lock, controls bottom / performer top | The moment the camera locks, the visitor stops being a person in a room. A frame that perfectly holds one performer is exactly the frame that excludes the other two. |
| Light up the performer being edited | **Accepted** — see below. It is a light in the room, not an overlay. |

### What changes on approach

Two physical changes only, both readable from anywhere in the wing:

1. The console's own face wakes — dark from across the room, live at arm's length.
2. The performer that console owns gets a subtle key-light lift.

**Nothing dims. Nothing fades.**

### Camera

One concession: a gentle **ease** on arrival that settles the view so the console
surface and all three performers are in frame without craning. A nudge, not a
cutscene; the visitor can still look anywhere. If it reads as a takeaway in
testing, cut it entirely.

### The price of diegetic

Control count must stay tiny. **Four large buttons readable at arm's length, not
a panel.** Any design needing a scrollable list has already lost the argument.
This constrains §10 and is a feature, not a limitation.

### Consistency with prior review

The Earth Long Terrace review (finding I10) already called for replacing
proximity triggers with authored verbs. Everything here is an authored verb.

---

## 10. The Cave control tier (D8, D9)

**Three universal buttons plus one contextual.**

| Button | Scope | What it teaches |
|---|---|---|
| Trace on/off | All | The figure under your feet is the figure in the air. |
| Change prop | All | The figure belongs to the hand; the copy count belongs to the prop (§5). |
| Reverse the hand path | All | The same figure, drawn the other way round. Needs no notation to justify, so it is era-safe. |
| Swap which hand does anti and which does pro | **Hybrid only** | A hybrid has a handedness. The mandala visibly mirrors. |

**The contextual button's absence is itself the lesson.** On the pro-only and
anti-only consoles there is no swap button, because there is nothing to swap when
both hands are doing the same thing. Teaching by what is not there costs nothing.

### Cut (D9)

**"Show a different variation" is removed from the control set.** Not on taste —
it is the one control that changes what the exhibit *is*. The museum has a
standing rule that a case never shows a newly generated variation in place of its
bound sequence. The other three change how you look at the record; that one
changes the record.

### Era gating (the standing rule)

A console may offer any verb the museum can honestly demonstrate. A verb that
**changes the choreography** is limited to concepts the era on display actually
had. Turn values do not exist in the Cave's era, so no turn control appears here
— but this rule means the control set can legitimately grow richer in later
halls, as the notation grows. The visitor's agency expands as history expands.

---

## 11. Persistence and restore (D7)

- **Modifications persist.** Walking away does not reset a performer.
- **The base is the indicator.** No status light is needed on the console. A
  performer whose prop changed has a base showing one trace instead of two; a
  performer whose hands swapped has a mirrored figure. The modification is
  legible from across the room, in the museum's own grammar, with no new
  vocabulary added.
- **Restore is physical.** A single restore control on the console. Not a menu.

---

## 12. What this changes in Water (Gate 1 impact)

The Water wing's approved Gate 1 floor plan does not contain any of this. These
are the deltas, and they require a Gate 1 amendment before Gate 2 can close:

1. **Three performer stanchions move into the reflecting pool** (D10), walkable
   from all sides, replacing the far-shore-behind-a-barrier staging. The pool
   becomes the display case; traces read against water.
2. **Three consoles on the pool rail**, one per performer, each with sight of all
   three (D4, D6).
3. **One empty opener pedestal at the wing threshold** (§7), alongside the
   already-planned opener avatar and choreo card.
4. **Sightlines must be re-proved** with the stanchions mid-pool. The approved
   plan's sightline fans were computed against far-shore placement and do not
   carry over.
5. **Fall protection and reach** must be re-checked — consoles on a pool rail sit
   beside water, and the existing barrier derivation (`fenceTopFor`, jump-reach
   based) was computed without them.

**No hero.** All three Water cases are equally important; nothing in the staging
may promote one.

---

## 13. Open questions

- **E1** — static or animated base under the performers. Resolved by building
  both and looking, not by argument.
- **Console geometry** — waist height, angle, and button size are stated as
  intent, not as measurements. They become numbers in the Gate 1 amendment.
- **Face legibility from standing height** — a chest-high pedestal viewed by a
  standing visitor sees the top face at a shallow angle. May require the face to
  be inset, domed, or edge-lit rather than flat. Check in the graybox.
- **Do all six wings get an opener pedestal**, or only those whose hand path is
  hard to read? Recommend all six, for the constant.

---

## 14. Implementation order

Built smallest-first, so each step is worth looking at on its own:

1. **Pedestal geometry** to the fixed standard, one wing's worth, no face.
2. **Generated face** from the bound sequence, static, correct trace count for
   the bound prop.
3. **Look at it.** Screenshot at the required viewports. This is the first point
   at which the thread is visible.
4. **Animated variant** of the same face, at the opener pedestal and under one
   performer. Look at both (E1). Decide.
5. **One console**, diegetic, with the two safest buttons only: trace and prop.
6. **Look at it.** If two buttons do not make the room better, no number of dials
   will.
7. Reverse and hand-swap. Persistence and restore.

Steps 1–4 touch no interaction and can land inside Gate 2. Steps 5–7 are Gate 4
material (production-quality slice with its complete interaction) and need the
Gate 1 amendment from §12 first.

---

## 15. Rules this inherits

- Museum sequences are never replaced by newly generated variations (drives D9).
- Claude-generated ideas enter the tracker as proposals; only explicit direction
  from Austen promotes them to decisions.
- Elemental names are never spoken aloud anywhere in the museum; wings are
  labelled clinically.
- Every TKA domain fact is verified against Flow Arts MCP, never from memory
  (§5 was).
- Visual work is screenshotted and read before it is reported done.

---

## Related

- Sealed wing opener: tracker `And3P4gs` (2026-08-11)
- Water Gate 1 board proposal: tracker `6zDGcqYJ`
- Pedestal standard proposal: tracker `Fy8Vd9tG`
- Earth Long Terrace Gate 1 review (findings I4, I10, I11):
  `docs/superpowers/specs/earth-long-terrace/2026-08-08-opus-floor-plan-review.md`
- Parent architecture:
  `docs/superpowers/specs/2026-08-11-museum-exhibit-hallway-architecture-design.md`
- Water Gate 2 plan:
  `docs/superpowers/plans/2026-08-16-water-wing-playable-graybox.md`
