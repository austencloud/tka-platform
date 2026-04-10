# Sequence Generation Rules

Full reference with humor workflow details in `docs/reference/sequence-generation-guide.md`.

## Always Use `constraintPreset: "smooth"`

Two builders exist: legacy (random walk, fails often) and constrained (beam search, reliable). Adding `constraintPreset: "smooth"` triggers the reliable one. Always include it unless user specifies a different constraint.

```
generate_sequence(word: "BOOK", constraintPreset: "smooth")
```

## When User Doesn't Specify a Word

**Never invent words.** Use `length` and/or `loopType` instead:

```
generate_sequence(loopType: "rotated", constraintPreset: "smooth")
generate_sequence(length: 8, constraintPreset: "smooth")
```

## Named Words = Humor Training

When user provides a specific named word (e.g. "generate CAKE"), present 4 tagline options from the humor profile before generating. See full workflow in `docs/reference/sequence-generation-guide.md`.

Does NOT apply to requests by letter, level, loop type, or length.
