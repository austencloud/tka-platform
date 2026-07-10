# Simplified Word Display — ENFORCED

## The Problem This Solves

The save-scene modal shipped with the default title "FΨFΨFΨFΨ — 3D scene".
The sequence's word repeats; TKA canon is that a repeating word ALWAYS
displays in its smallest form: **FΨ**, never FΨFΨFΨFΨ. Austen (2026-07-10):
*"I will never prefer you to show me FΨFΨFΨFΨ when you could show me FΨ.
Like literally never."*

The utility already existed (`simplifyRepeatedWord`) and is used at 10+ call
sites (library, exports, card fronts, quiz, compose). The bug happened because
a new display surface read `seq.word` raw instead of routing it through the
simplifier. This rule makes that a named, greppable violation.

## The Rule

**Any user-visible rendering of a sequence word goes through
`simplifyRepeatedWord` from
`src/lib/shared/foundation/utils/word-simplifier.ts`.**

That includes, without exception:

- Titles and default names (save dialogs, collection entries, export
  filenames, tab titles, toasts)
- Labels, summaries, chips, captions, card text
- Anything derived from `sequence.word`, `sequence.name`, `sequenceWord`, or
  `seq.word` that a human will read

`sequence.word` is DATA (the full expanded letter string, correct for
playback and step math). What the USER sees is the simplified form. Those are
different layers — never let the data layer leak into the display layer.

Related helpers in the same module: `simplifyAndTruncate` (when length limits
also apply), `compressWord`. Prefer them over hand-rolling.

## The Self-Check

Before shipping ANY new surface that displays a word: grep your diff for
`\.word` / `sequenceWord`. Every hit that feeds a template string, prop,
label, or default name must be wrapped in `simplifyRepeatedWord(...)` (or a
helper that calls it). A raw `seq.word` in display code is a bug, same class
as a checkbox.

## Forbidden

- `` `${seq.word} — 3D scene` `` or any raw-word template in user-facing text
- Copying a word into a saved entry's `name` field unsimplified
- "The word is usually short so it doesn't matter" — LOOP sequences repeat by
  construction; repeated words are the COMMON case, not the edge case
- Hand-rolling repeat detection instead of importing the utility

## Related

- Memory: `feedback_simplified_word_and_glyphs`
- `never-hand-roll.md`, `primitive-discovery.md` — the utility exists; find it
- Domain background: LOOP-type sequences repeat their word by construction
  (MCP `get_domain_topic("loop")` for canon)
