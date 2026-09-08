---
paths:
  - "src/**/*.{svelte,ts}"
---

# Sequence Word Display Contract

User-visible sequence words pass through `simplifyRepeatedWord` from
`src/lib/shared/foundation/utils/word-simplifier.ts`, or a shared helper that
calls it. This applies to titles, names, filenames, labels, summaries, chips,
captions, cards, and toasts.

The expanded `sequence.word` remains valid data for playback and step math; do
not expose it directly as display copy. Use `simplifyAndTruncate` when the
surface also has a length limit. Never hand-roll repeat detection.
