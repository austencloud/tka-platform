---
paths:
  - "src/lib/shared/effects/**/*"
  - "src/lib/shared/animation-engine/**/*"
  - "src/lib/features/**/*effect*"
---

# Effect Slot Contract

Before adding a visual effect, state:

1. the observable it uniquely reveals;
2. the closest existing effects and the mechanical distinction;
3. the test that would distinguish the new effect from a preset or variation.

If the distinction is only aesthetic, extend an existing effect instead of
adding a registry slot. Read the current effect registry before naming existing
slots; do not rely on lists in plans or memory. New effect names describe their
specific visual behavior rather than generic “motion” or “flow.”
