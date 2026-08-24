# Concept Visual Grounding Gate

Use this gate before changing the layout, styling, selection behavior, or TKA
artifacts in a Learn concept. Its purpose is to stop a lesson from acquiring a
new visual language merely because its experience component is feature-local.

## Evidence Before Design

Read these sources before proposing markup or CSS:

1. `docs/reference/styling-guide.md`
2. `.claude/rules/never-hand-roll.md`
3. `.claude/rules/primitive-discovery.md`
4. `.claude/rules/no-left-edge-accent-bar.md`
5. `.claude/rules/simplified-word-display.md` when letters or words appear
6. `.claude/rules/sequence-viewer-shell.md` when the lesson shows a sequence as
   notation, animation, or both

Search by meaning, not only filenames. For each capability, read the closest
owner and at least one current consumer. Prefer current shared app surfaces over
an older Learn lesson: Learn contains legacy and experimental CSS that is not a
design-system authority.

Record this ledger in commentary or the implementation plan:

| Capability                  | Search terms                     | Owner           | Consumer             | Relationship |
| --------------------------- | -------------------------------- | --------------- | -------------------- | ------------ |
| Example: sequence selection | selected, outline, sequence cell | `selection.css` | guide sequence strip | reuse        |

The relationship must be one of reuse, extend, compose, or create. `Create`
requires evidence that no owner exists and a description of the distinct
interaction contract.

## Hard Visual Contracts

- A rendered pictograph or choreography card owns its visual rectangle. Do not
  place it inside a second decorative rounded card merely to make it look like
  an app panel.
- Selection marks the whole selectable object. Use the existing owner's full
  perimeter treatment. Never add an accent bar, thick border, or inset shadow
  on only one edge.
- Any visible Latin or Greek character that denotes a TKA letter must use the
  canonical glyph path. Use `TKAWordGlyph` for word identity and `.tka-font`
  only for compact inline notation. Ordinary text remains valid for accessible
  names and prose that discusses spelling rather than displaying notation.
- A choice must be visually inspectable before selection. Selection may
  highlight, animate, or explain an option; it must not be required merely to
  reveal what the option looks like unless concealment is the approved lesson
  mechanic.
- When notation and motion explain the same sequence, preserve both sources of
  information. Follow the sequence viewer's simultaneous split/stack contract
  or document why the lesson needs a different interaction. Do not introduce a
  mode switch solely to save layout space.
- Reusing a canonical control does not make its use correct. Verify that the
  control's interaction semantics match the learning task.
- Use theme, spacing, typography, motion, and responsive tokens from the shared
  system. Do not sample hardcoded colors, radii, or gradients from an arbitrary
  lesson.

## Pre-Edit Report

Before editing, state:

1. the capability owners being reused or extended;
2. which existing visual treatments are explicitly rejected;
3. how every TKA letter, word, pictograph, and animation will be rendered;
4. how all choices remain inspectable before selection; and
5. the wide, tall, tablet, and phone layout behavior.

If this cannot be answered from current repository evidence, continue research.
Do not fill the gap with a new card, toggle, diagram, color, or explanatory
sentence.

## Verification

After implementation:

1. Run the focused concept contract tests.
2. Grep the diff using the self-check in
   `.claude/rules/no-left-edge-accent-bar.md`.
3. Search changed markup for visible raw TKA letters and words.
4. Visually verify the required viewport matrix from
   `.claude/rules/visual-verification-mandatory.md` and
   `.claude/rules/4k-native-layout.md`.
5. Treat user approval as the only path from `BUILT` to `CONFIRMED`.
