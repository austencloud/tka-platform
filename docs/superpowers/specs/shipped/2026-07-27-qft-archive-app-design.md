# QfT Archive App — design

**Date:** 2026-07-27
**Status:** design approved, implementation not started
**Supersedes nothing.** Extends `2026-07-26-qft-notation-toy-design.md`, which
delivered the computational model and the instrument.

## What this is

QfT is a poi notation devised by Charlie Cushing and written up by Ben
"DrexFactor" Drexler in 2011. It is the least durable system in the notation
catalog: the forum original has lost every image to `Non-Https Image Link`
placeholders, the surviving mirror is one hosting bill from gone, and the ten
video chapters that carry the only complete statement of the formula have under
1,200 views between them.

This app restores the lost diagrams and runs each one beside a model that
computes the same move from the published rules.

Two audiences, in order: Charlie, who is a friend of Austen's and has never seen
his fifteen-year-old work made interactive; and anyone who later wants to know
what QfT was.

## Position on the source material

The full extraction stays private in `docs/reference/archive/qft-notation/`.
Nothing goes in `static/`.

What ships is **excerpt-and-analyze, not a mirror**: the restored images, short
quoted passages that specify the system, and the computed model. The model is
the original work that makes the excerpts citation rather than republication —
it reproduces every published table, including Charlie's `n` placements, derived
from geometry rather than copied.

**No narrator.** The only prose is quoted from the source. Labels state facts
(`radius 0.5 · prop advances one position per step`), never interpretation.
Austen does not appear in first person and does not characterise either author's
intent. This is both the tone he asked for and the defensible position.

**Not mythologised.** The Charlie/Drex disagreement is not a story about two
people. It appears once, as a footnote on scope: as published, the direction
column has two variants. That single line exists because the instrument carries
a convention toggle, and an unexplained toggle implies one variant is canonical
when neither is.

## Architecture: one app, two modes

The instrument at `/test/qft-notation` already is this app — fixed viewport,
concept chips, stage, live table, transport. The archive is the same shell with
one more pane. They are not two things.

| Mode | Content | Controls |
|---|---|---|
| **Guide** | The eight canonical moves. Charlie's restored animation beside the computed stage, the sourced passage, the notation. | Concept chips, transport. Knobs locked. |
| **Instrument** | Free exploration. All eight downbeat values, both conventions. | Knobs unlocked. No original — there isn't one for arbitrary settings. |

A reader who understands the eight moves and then wants to turn a knob is one
click away, not one URL away. That step — from watching to playing — is where
the system clicks.

Destination route: `/notation/qft`, linked from the catalog entry. The
`/test/*` prototypes are scaffolding and do not ship.

Rejected: a separate archive app sharing the primitives. It costs a second shell
and the two would drift the way `/q` and the viewer drawer did before
`sequence-viewer-shell.md`.

## Components

Existing, reused:

- `qft-model.ts` — the model. Unchanged.
- `QftStage.svelte` — computed stage. Unchanged.
- `QftTable.svelte` — notation. Extended with `compact`, which collapses the
  table to the step on screen.
- `Crossfade.svelte` — concept transitions, `fill` mode inside the sized stage.
  Two mutually exclusive states in one box is a true crossfade; hand-rolling it
  has caused layout shift every previous time.

New:

- `QftFrames.svelte` — Charlie's animation, driven by the model's step.
- The app shell: mode switch, concept chips, transport, info panel.

## Frame-driven pairing

The load-bearing mechanism, and the reason the page can claim what it claims.

A browser gives no control over GIF playback — no seek, no pause, no frame
access. An `<img>` runs on its own clock, so the original and the computed stage
drift apart within seconds. A page whose thesis is *these are the same move* is
undermined by two things visibly out of phase.

Every archive animation holds **exactly nine frames**: the eight increments plus
the closing frame back to the start — the same shape as the notation itself.
**Frame index is step index**, verified against the model on static spin,
triquetra and cateye, not assumed. Rendering frame `i` at step `i` makes drift
impossible rather than merely small.

All nine frames are grid-stacked and toggled by opacity, so no frame decodes
mid-playback and the box never resizes.

### Extraction

`scripts/extract-qft-frames.mjs`, output to the private archive with a manifest.
Uses `sharp`; no new dependency.

Two findings worth keeping:

1. **The GIFs decode as RGBA.** They carry a transparency index. Reading them as
   RGB shears every row and produces noise.
2. **The source table panels animate too** — their numbers change per frame — so
   raw motion detection swallows them. The crop finds the still gutter between
   diagram and panel and stops there.

Nine of eleven auto-detect. Two carry an explicit edge, documented with the
reason: a single gutter threshold cannot serve both a diagram with internal gaps
and one sitting close to its panel, and **triquetra's panel is below its diagram
rather than beside it**, which no column rule can reach. Eleven is a fixed,
inspected set — not a rule hoping to generalise.

**Crops are not squared.** Squaring is what dragged the panels back into shot.
Each card takes its frame's real proportions from the manifest (triquetra
421×265, cateye 124×200), so the drawing fills its card instead of sitting as a
speck in a white field.

The originals keep a white card. They were drawn black-on-white for a light
forum and are unreadable without it.

## Layout

Composed per viewport, never reflowed. No page scroll: the shell is `100dvh` and
each concept is a composition that fills it.

| Viewport | Composition |
|---|---|
| ≥105rem wide, ≥50rem tall | Both axes. Pair left, notation right, quote beneath. Animations scale to available height. |
| Standard desktop / laptop | Pair centred, notation beneath, quote beneath that. |
| Wide and short (fold-open landscape) | Pair beside notation, quote hidden. |
| Phone | Panes stack. Both animations stay side by side — showing one at a time destroys the comparison, which is the point. The notation collapses to the compact strip instead. |

The compact threshold is `max-width: 48rem` or `max-height: 34rem` — matched to
where eight rows of seven numbers stop being legible, not to a device.

Test routes do not match the `app.css` ramp selectors, so every `/test/*`
harness is frozen at 1080p proportions on 4K. The prototype scopes the same
documented curve locally. On the shipped route the site ramp applies.

Concept chips stay in teaching order and default to the first. An app lets
someone land on triquetra and be lost; the sequence is offered even though it is
no longer enforced.

## Content

Eight units: static spin · pendulum · extension · isolation · cateye ·
triquetra · 4-petal antispin · 4-petal inspin.

Direction is folded into the units whose `*dir*` images exist rather than
getting its own section — those images exist precisely because direction is what
separates the flowers.

Info panel, out of the main view: what QfT is, the four sources, and a dated
timeline ending in fifteen years of silence. Dates and links are facts; a
chronology that ends in silence argues for the archive without editorialising.

## Open work

**Passage transcription is unfinished.** Only two quotes are verified in the
archive README. The remaining six units carry no quote rather than invented
text. This is the largest outstanding item and it gates shipping — a page of
restored images with two captions is thinner than the material deserves.

**Charlie's video chapters are unextracted.** Chapters 5 and 10 hold the two
pieces the written guide never delivered (the hand vector method, socket
syntax). Worth writing up as technical description, and worth asking Charlie
about directly.

**Publication is gated on Austen's call**, not on permission from either author.
He has decided to publish under fair use with attribution and links, to send
Charlie the app as a gift rather than a permission request, and not to establish
contact with Drex. The design above — excerpt not mirror, model as the
substantial original work, no characterisation of intent — is what keeps that
position defensible.

## Verification

- Model tests: 19/19, reproducing every published table plus both Charlie
  variants.
- Frame/step correspondence: checked against the model, not assumed.
- Screenshots at 1920, 2560, 3840, 1440, 820, 960×412, 375 before any
  completion claim. **Only 3840 is verified so far.** The compact breakpoint and
  the fold-open rule are written and unproven.
- Known unfixed in the prototype: the three elements sit on three different
  baselines, and content fills roughly half the vertical space at 3840.

## Related

- `docs/reference/archive/qft-notation/README.md` — sourcing archive
- `docs/superpowers/specs/2026-07-26-qft-notation-toy-design.md` — the model
- `.claude/rules/crossfade-primitive.md`, `4k-native-layout.md`,
  `visual-verification-mandatory.md`, `never-hand-roll.md`
