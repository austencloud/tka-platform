# Turn Pattern Redesign

**Date:** 2026-08-16
**Status:** Awaiting approval
**Supersedes the UI half of:** `docs/superpowers/specs/2026-08-16-generative-turn-configuration-design.md`
(the engine half — `turnPattern` in `BuildOptions`, consulted during beam search — is
shipped and unchanged)

## Why

The first attempt put a two-mode switch and a 550px pattern editor into the settings
bento, then into a drawer, and both failed. The specific failures:

- Turn intensity has real users who know how it works. Replacing its card changed a
  control they rely on, to make room for a feature almost nobody will use.
- The tile reported intensity while never mentioning that a pattern could exist, and
  its colour ramp read the pattern's busiest value, so starting a pattern turned the
  card mint green — a colour unrelated to the theme or the setting.
- The editor's vocabulary — Book, Long Book, Solo 1 — is borrowed from
  `choreo-card/domain/reversal-patterns.ts`. It is real TKA canon, and nothing on
  screen teaches it. A first-time reader has no way in.
- Lane labels read "Blue" and "Red" on controls that were already blue and red: a
  tautology that spends a word and teaches nothing.
- `.pbs-label` is `width: 44px; flex: 0 0 44px` with bold 14px text and no overflow
  handling, so "Right" and "Blue" run out of their boxes into the first strip cell.
- Intensity mode showed a 160px stepper in a full-height drawer, with the rest empty.

Underneath all of it was a presentation lie. `SequenceBuilder.ts:597` reads
`options.turnPattern ? patternSource(...) : allocationSource(...)`. A pattern
**replaces** intensity; it is never consulted alongside it. Presenting them as two
peer modes implied they could conflict, which is exactly the confusion this redesign
removes.

## Placement

**The bento returns to what it was.** `TurnsCard`, `TurnsExpandedOverlay`,
`TurnsDrawer`, and the `turnsOverlay` members of `panel-coordination-state` are
deleted. The `turn-intensity` cell renders `TurnIntensityCard` with its original
props. A user who has never opened Customize sees no change whatsoever.

**Customize gains a fourth drill row**, alongside Style / Start Position /
End Position:

```
Turn Pattern                          Random, ≤2  ›
```

The value line reports what the engine actually does:

| Engine state | Row reads |
| --- | --- |
| No pattern (intensity in charge) | `Random, ≤2` — the ceiling comes from the bento card |
| Pattern set | `Left 1·0 · Right 0·1` |

A pattern is an override you went looking for, and its row says so.

## The editor

Length / Rhythm / Amount / Result collapses into two lines of English, a length row,
and the strip:

```
  Set exactly how much each hand turns. The generator only picks
  letters that can carry the figure.

  Left   turns  ( 1 )  on  ( every other step )
  Right  turns  ( 1 )  on  ( every other step, starting on step 2 )

  Repeats ×4 across 16 steps        [1] [2] [4] [8] [16]

  Left   │  1  │  0  │  1  │  0  │
  Right  │  0  │  1  │  0  │  1  │

  Layers 1·3·1·3                    [ Use random turns instead ]
```

- `Left` is tinted blue, `Right` red. The colour says which prop; the word says
  which hand. A first-timer learns blue = left for free.
- The parenthesised slots are `FilterChipBase mode="dropdown" size="sm"` — the
  primitive `chip-primitives.md` names for chip-opens-popover. No new primitive.
- The strip stays the source of truth and stays tap-editable. Nothing an expert
  could do before is lost.
- The strip gets `flex: 1` so its cells grow into the drill pane's height. This is
  what removes the dead space.

### The phrase is derived from the mask, not from a preset name

A new pure module, `src/lib/shared/create/domain/rhythm/pattern-sentence.ts`,
converts one lane's active-step mask into English:

| Mask | Phrase |
| --- | --- |
| all active | `every step` |
| all base | `never` |
| `[✓, ·]` | `every other step` |
| `[·, ✓]` | `every other step, starting on step 2` |
| `[✓, ·, ·, ·]` | `every 4th step` |
| `[·, ·, ✓, ·]` | `every 4th step, starting on step 3` |
| anything else | `steps 1, 3 and 6` |

This is why Alternating stops needing an explanation: each lane says what it does
rather than naming a figure the reader has never met. It is a pure function over a
`boolean[]`, unit-tested, with no per-rhythm copy to maintain.

Consequence worth noting: the dropdown's option labels ("Trade off") differ from the
closed slot's text ("every other step, starting on step 2"). That is correct — the
option is the shortcut's name, the closed state is what it did to this lane.

### Vocabulary

`RhythmDef` gains `plainLabel`. Sentence mode reads `plainLabel`; the existing
stacked mode keeps reading `label`, so Reversals and Duration are untouched.

| id | `label` (unchanged) | `plainLabel` (new) |
| --- | --- | --- |
| `book` | Book | Every step |
| `long-book` | Long Book | Every other |
| `alternating` | Alternating | Trade off |
| `red-book` | Red Book | Right only |
| `blue-book` | Blue Book | Left only |
| `solo-1` | Solo 1 | One at a time |

Separately and independently, `DURATION_RHYTHMS` stops saying "beat" — "Every beat"
→ "Every step", "Last beat" → "Last step". `.claude/rules/tka-domain.md` reserves
beat; the app says step. This is a domain-rule fix, not part of the redesign.

Reversals and Duration therefore receive exactly two changes between them: this
rename (Duration only) and the lane-label spill fix below. Both are corrections to
existing defects, not presentation changes — neither touches their editor's shape.

### Clearing a pattern

The Intensity/Pattern mode switch is gone, so the detail pane carries an explicit
**Use random turns instead** button. It writes `null` (not `undefined` —
`updateConfig` strips `undefined`, so `null` is the clear sentinel), the row returns
to `Random, ≤N`, and the bento card is back in charge.

## Left and Right, everywhere

The visible word is Left or Right; the tone is blue or red. Two consequences:

1. `TurnsExpandedOverlay`'s `laneLabels: ["Blue", "Red"]` was the deviation —
   `TurnPatternView.svelte:46` already uses Left/Right to match the APPLY TO /
   HandSelector convention. The new editor uses Left/Right.
2. The two `Blue` / `Red` labels above the orientation controls in
   `CustomizeExpandedOverlay.svelte:377` become Left / Right. They keep their tint
   and their `aria-label`; only the tautology goes.

`chip-primitives.md` is honoured: prop identity is opted into with an explicit
`tone`/`color` prop. Nothing infers identity from the words Left and Right, which
also name camera views and prop ends.

The spill is fixed at the same time: `.pbs-label` and `.amt-lane` are sized in `ch`
to fit "Right", with `min-width: 0` and `text-overflow: ellipsis` as a backstop.
This lands on all three consumers because it is strictly a fix.

## Scope

In scope:

| File | Change |
| --- | --- |
| `rhythm-catalog.ts` | `plainLabel` on `RhythmDef`; DURATION_RHYTHMS beat → step |
| `pattern-sentence.ts` | **new** — mask → English, plus tests |
| `pattern-strip-types.ts` | `StripBinding.sentence?: { verb: string; never: string }` |
| `PatternStripEditor.svelte` | sentence mode when `sentence` is present; Amount folded into the sentence; strip fills remaining height |
| `PatternStepStrip.svelte` | lane-label spill fix |
| `CustomizeExpandedOverlay.svelte` | Turn Pattern row + detail; orientation labels → Left/Right |
| `CardBasedSettingsContainer.svelte` | `turn-intensity` renders `TurnIntensityCard` again |
| `card-configurator.ts` | revert the `turn-intensity` card props |
| deleted | `TurnsCard.svelte`, `TurnsExpandedOverlay.svelte`, `TurnsDrawer.svelte`, turns-overlay state in `panel-coordination-state.svelte.ts` |

`sentence` is **optional**, which is the seam that keeps this narrow: a binding
without it renders exactly the stacked editor that ships today.

Deferred, tracked as tasks so they are not lost:

- **Task #1** — convert the Reversal strip to sentence mode, and decide whether its
  chips show `plainLabel` or the canonical TKA name (reversal patterns are where
  that vocabulary is genuinely canon).
- **Task #2** — convert the Duration strip to sentence mode (single-lane, accent
  lane, no hands).

Explicitly not in scope: `TurnIntensityCard` is composed, not deleted — five other
surfaces render it (`LoopBentoBoard`, `FuseRecipeBasics`, `DeckArchitectPage`,
`(public)/composer/_sections/GenerateSection`, `routes/test/unified-generation`).

## Testing

Unit, on the pure module:

- `pattern-sentence.ts` — every row of the mask table above, plus a single-lane
  binding and an amount-less (binary) binding.
- The existing `turn-pattern-prediction`, `loop-period-strip`, and
  `card-configurator-level-layout` suites must stay green; the last one asserts the
  bento's card layout and is the guard on the revert.

Visual, per `.claude/rules/visual-verification-mandatory.md` — the Customize drill at
1920×1080, 2560×1440, 3840×2160, 1440×900, 820×1180, 960×412, 375×667, in both the
root-list and Turn-Pattern-detail states. Specifically checked: no control stretched
across the pane, the strip filling its height rather than stranding it, and the lane
labels inside their boxes at every width.

## Open questions

None. Placement, editor shape, vocabulary, and scope are settled.
