# Hand Motions Overview Copy Review

**Concept ID:** `hand-motions-intro`

**Review state:** APPROVED TERMINOLOGY / REDESIGN REQUIRED

**Implementation gate:** OPEN for previously approved text and terminology;
CLOSED for new teaching explanation pending exact-copy approval
**Last reviewed:** 2026-09-04

## Approved Text

The lesson quotes the Level 1 Guide's Hand Motions page:

> There are three fundamental hand motions in the Alphabet.
>
> The arrow shows the direction of motion.
>
> The hand shows the end position.

The three step captions are also verbatim:

> Move to an adjacent point
>
> Move to the opposite point
>
> Remain at the same point

Sources: `src/routes/(public)/guide/level-1/_pages/HandMotionsPage.svelte` and
`src/routes/(public)/guide/level-1/_data/content/hand-motions.content.ts`.

## Boundary

Routine labels such as “Blue hand,” “Previous,” and “Next” are exempt. No
additional explanation of how to perform these motions is approved.

## Timing and Direction Comparison — Exact UI Copy

The concept heading is exactly:

> Timing and Direction

This chapter follows Shift, Dash, and Static in the same lesson.

### Bridge

> Time compares the hands: together, split, or quarter. Direction compares
> their travel: same or opposite.

### Six demonstrations

> SS
>
> Split time, same direction.

> TS
>
> Together time, same direction.

> QS
>
> Quarter time, same direction.

> SO
>
> Split time, opposite direction.

> TO
>
> Together time, opposite direction.

> QO
>
> Quarter time, opposite direction.

The full relationship name may appear when a mode is focused: `Split-Same`,
`Together-Same`, `Quarter-Same`, `Split-Opposite`, `Together-Opposite`, or
`Quarter-Opposite`. Element identity is communicated by its established icon;
the lesson does not repeat Water, Earth, Sun, Fire, Air, or Moon as headings.

### Approved Attribution (not shown in the current four-step lesson)

> Vulcan Tech Gospel codified and widely distributed Split-Same,
> Together-Same, Split-Opposite, and Together-Opposite as time-and-direction
> categories.
>
> The four elemental names are community-developed extensions of those
> categories. Their original creator is not yet documented.
>
> The Kinetic Alphabet adds Sun and Moon for Quarter-Same and
> Quarter-Opposite.

## Evidence Map

| Proposed claim                                                                                                                         | Current evidence                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Shift, Dash, and Static are the three fundamental hand motions                                                                         | Level 1 Guide Hand Motions page; Flow Arts MCP topic `hand path modifiers and hand motion types`                                    |
| Time categories are together, split, and quarter; direction categories are same and opposite                                           | Flow Arts MCP `list_vtg_categories`; Level 1 Guide `hm-type1` and `hm-gamma` pages                                                  |
| Water = Split-Same; Earth = Together-Same; Sun = Quarter-Same; Fire = Split-Opposite; Air = Together-Opposite; Moon = Quarter-Opposite | Flow Arts MCP topic `elementals timing direction sun moon`; `TND_BY_FAMILY` in `src/lib/features/choreo-card/domain/tnd-element.ts` |
| VTG codified and distributed the original four time/direction categories                                                               | _Vulcan Tech Gospel V.1_, compiled by Noel Yee; Flow Arts MCP VTG category and contributor records                                  |
| The four elemental names circulated as community extensions; their original creator is not established                                 | Austen's 2026-09-04 authorship correction; current MCP records establish later use and teaching but do not identify an originator   |
| TKA adds Sun and Moon for quarter time                                                                                                 | Flow Arts MCP elemental topic; Quarter-Same and Quarter-Opposite are identified as community extensions by the VTG category record  |

## Approval Record

- 2026-09-03 — Austen approved a pre-letter tutorial that teaches time and
  direction as animated hand motions, grounded in the book.
- 2026-09-04 — Drafted the combined Hand Motions + Elementals chapter and
  attribution for Austen's explicit copy approval.
- 2026-09-04 — Austen rejected personal attribution for the original four
  element names: known practitioners used and taught them, but the original
  creator is not established. Revised the draft to say they are
  community-developed extensions and leave authorship unknown.
- 2026-09-04 — Austen approved the revised wording.
- 2026-09-04 — Austen replaced the six serial demonstrations with one six-up
  comparison board and established the learner-facing terminology: “split
  time, same direction,” not “split timing, same direction.” He also approved
  icon-first mode labels and removing repeated element-name headings.
- 2026-09-04 — Austen clarified that the system is called “Timing and
  Direction,” while an individual relationship uses “split time,” “together
  time,” or “quarter time.” This supersedes the current `Time + Direction`
  screen heading. He requested a slower introduction before the six-up board,
  larger labels, a production Choreo Card hand-path breakdown after selecting
  a relationship, and removal of the duplicated top-left element icon when the
  canonical glyph is already visible at bottom right. No new explanatory prose
  was approved.
