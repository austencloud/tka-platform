# Fuse generation recipe and settings drawer

**Status:** Approved for implementation

**Approved:** 2026-08-13

**Route:** `/create/fuse`

## Outcome

Fuse owns one generation recipe shared by the Blue and Red Regenerate actions.
The recipe describes how a fresh one-hand LOOP should be generated. Pairing
describes how two existing paths relate. Both use one responsive Fuse settings
drawer with separate drill-in destinations.

The main workspace adapts its recipe controls to the space available:

- Spacious desktop and 4K headers contain six stable summary tiles: Length,
  Level, Grid, Style, Starting conditions, and Pairing.
- Every summary tile opens a focused anchored popover for that one setting.
- Level owns Max turns. Max turns is not shown when Level 1 is selected.
- Smaller headers replace the six tiles with one clickable recipe summary. It
  opens the existing Generate drawer / mobile bottom sheet with the same six
  destinations.
- There is no duplicated Customize modal and no separate Pairing row.
- Changing recipe settings never rewrites a visible path. A source changes only
  when its Regenerate action is selected.

## Responsive interaction

- Spacious desktop and 4K use anchored popovers. They do not obscure the whole
  workspace or create a second representation of the recipe.
- Compact desktop uses the recipe summary and responsive Generate settings
  drawer.
- Mobile uses the same content in a bottom sheet.
- Opening the recipe summary starts on the six-destination recipe list.
- The drawer follows the existing Generate customization pattern, including
  familiar drill navigation and style controls.
- Fuse owns its recipe state. It must not share Generate's persisted settings or
  mutate Generate configuration.

## Path recipe

### Basics

- Length
- Level
- Max turns

### Style

- Props: Smooth, Mixed, Choppy
- Hands: Smooth, Mixed, Choppy
- Dashes: Low, Mixed, High

The Style control presentation should be shared with Generate rather than
copied. Its state and generation intent remain feature-local.

### Starting conditions

- Start location
- Allowed start orientation
- Traversal direction
- Random is the default for each setting.

These are generation preferences, not promises. LOOP closure and the selected
Level remain hard constraints. When a preferred combination cannot produce a
valid LOOP, generation may choose another allowed value and should not create
an invalid path merely to satisfy the preference.

### Defaults

Fuse starts at Level 2 with a maximum of one turn, matching the Generator's
visible default. The setting is a ceiling, not a guarantee that every generated
path contains a nonzero turn. Existing Fuse randomness remains the default for
prop continuity, hand continuity, dash frequency, location, orientation, and
traversal direction until the user narrows it.

## Orientation policy

Fuse follows the current three-level Generate policy for every supported path
length:

- Level 1: In and Out only
- Level 2: In and Out only
- Level 3: In, Out, Clock, and Counter

True interradial orientations remain excluded. The policy applies to generic
solo loops and four-step flowers. Generation must not seed a candidate from an
orientation outside the selected Level's allowed set.

## Four-step flower variation

The four-step flower path source must randomize start location and traversal
direction while respecting the recipe. Authored flower candidates need explicit
scoring or filtering for requested style and starting conditions. If no authored
candidate can honor the hard constraints, Fuse falls back to the generic solo
LOOP generator rather than repeatedly favoring one canonical flower orientation
or direction.

## Pairing

The tall inline relationship composer and the separate Pairing row are replaced
with the Pairing summary tile, such as `Blue → Mirror + Invert → Red`.

- The Pairing tile opens driver selection, transformation selection, the live
  equation, Cancel, and Use this relationship.
- Compact layouts expose the same editor through the Pairing drill destination.
- Transformation choices use a bounded natural-width grid instead of stretching
  across the available 4K width.
- A draft relationship continues to preview without mutating the applied
  relationship until Use this relationship is selected.

## Validity

Every generated path must preserve its requested step count, location closure,
orientation closure, and structured LOOP classification. Invalid transformed
candidates are discarded. The rewound constructor remains the guaranteed
fallback.

## Approved implementation task list

- [x] Render Length, Level, Max turns, and Grid through shared Generate card
      editors.
- [x] Replace the duplicated header controls, Customize modal, and Pairing row
      with six stable header summary tiles and focused anchored popovers.
- [x] Hide Max turns at Level 1 and keep it inside the Level destination.
- [x] Collapse the six tiles to one clickable recipe summary when they no longer
      fit.
- [x] Convert compact Fuse settings into the Generate right drawer / mobile
      bottom sheet with the same six drill destinations.
- [x] Share the Generate Style control presentation and add Fuse-local prop,
      hand, and dash preferences.
- [x] Add random-by-default start location, allowed orientation, and traversal
      direction controls.
- [ ] Extend the solo-loop generation contract so both Blue and Red Regenerate
      consume the same Fuse-local recipe.
- [ ] Extract or extend single-motion style scoring in the sequence engine rather
      than duplicating paired-sequence UI logic in Fuse.
- [ ] Enforce the three-level orientation policy across all Fuse lengths.
- [ ] Randomize four-step flower location and clockwise/counterclockwise
      traversal, with authored-candidate scoring and a valid generic fallback.
- [x] Remove the expanded Pairing section and summarize the applied relationship
      in its recipe tile.
- [x] Move driver, transform, equation, and apply controls to the Pairing
      popover / drill destination and constrain the transform grid width.
- [ ] Preserve both visible paths when settings change; regenerate only the
      selected source after an explicit Regenerate action.
- [ ] Add silent-bug coverage for recipe mapping, orientation bounds, style
      scoring, flower variation, closure, and atomic relationship application.
- [ ] Verify the drawer and compact workspace at 375 x 667, 960 x 412,
      820 x 1180, 1440 x 900, 1920 x 1080, 2560 x 1440, and 3840 x 2160.

## Ownership

- `FuseSettingsDrawer.svelte` owns the responsive shell and drill navigation.
- `fuse-state.svelte.ts` owns Fuse-local recipe state and applied pairing state.
- `solo-loop-generator.ts` consumes the recipe and preserves LOOP validity.
- The sequence engine owns reusable continuity, dash, turn, and orientation
  generation behavior.
- Generate and Fuse share presentational controls where their interaction is the
  same, but not feature state or persistence.

## Verification gates

- Persisted Fuse recipe state and Level 3 to Level 2 clamping
- Level-specific turn palettes and maximum ceilings
- Level 3 float materialization
- Level 1 and 2 orientation exclusion; Level 3 Clock/Counter inclusion
- Balanced start-location and traversal-direction coverage under deterministic
  randomized tests
- Style preference mapping and valid fallback behavior
- Exact closure for 2, 4, 8, 12, 16, 24, and 32 step loops
- Four-count authored flower filtering and generic fallback
- Draft pairing does not mutate the applied relationship
- Responsive visual checks at every required viewport
