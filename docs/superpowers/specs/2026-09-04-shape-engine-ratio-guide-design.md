# Shape Engine Ratio Guide

## Outcome

Give Kinetic Shape Engine a concise attribution surface and a permanent public
reference for Lorq Nichols’ original Shape Matrix ratios, their TKA turn names,
and the point where Austen Cloud’s work extends beyond the original matrix.

## Evidence boundary

- Lorq Nichols’ publication labels its three source families `1:1`, `1:3`, and
  `1:5`, with four even-petaled driving styles in each family.
- The TKA level system introduces zero turns at Level 1, whole turns at Level 2,
  halves and Float at Level 3, and quarter turns at Level 4. Shape Engine also
  exposes its negative-quarter `1:2` flower in the Level 4 band.
- The History archive already owns the sourced VTG and Lorq Nichols records.
  This feature links to those records instead of copying their source ledger.

## Owners and composition

- Reuse `BaseModal` with its `xl` size for the About dialog.
- Reuse `GuideShell`, `GuideSeo`, and the existing Guide navigation.
- Keep Lorq’s three source-family labels as sourced editorial data and use the
  same labels SpiroAnim presents: `1:1`, `1:3`, and `1:5`.
- Use `levelForTurnValue` to build each family’s deep link into Shape Engine.
- `ratioLabel` and `theoryRatioLabel` own that display order across Matrix,
  Theory Matrix, QfT, and lab surfaces. `spinRatioKey` remains the prop-first
  storage and URL format so existing links do not change meaning.

## Copy and layout

The About dialog uses two readable columns on wide screens: Lorq’s foundation
and Austen Cloud’s independent work. It collapses to one column when the modal
cannot give both columns a useful reading measure. Detailed ratio instruction
moves to `/guide/ratios`.

The ratio guide leads with the construction itself: three ratio families, four
driving styles in each, twelve choices per hand, and 144 pairings. The source
families appear as three connected rows rather than a field of equal cards.
TKA’s 0-turn, 1-turn, and 2-turn names sit beside those families. A short final
section names the later half-turn, quarter-turn, and Theory Matrix extensions,
then links to Shape Engine and the two relevant History records.

The page does not argue for a ratio reading order, print reciprocal labels, or
reproduce the entire Level 1–4 turn ladder. Those details obscured the lineage
the page exists to explain.

## Verification

- Focused unit and source-contract tests protect the identity, route links, and
  generated mapping.
- `svelte-check` must finish with zero errors and warnings in owned files.
- The About dialog and ratio guide must be inspected at 375×667, 960×412,
  820×1180, 1440×900, 1920×1080, 2560×1440, and 3840×2160, plus 200% browser
  zoom. The dialog must remain keyboard reachable and use one scroll owner.
