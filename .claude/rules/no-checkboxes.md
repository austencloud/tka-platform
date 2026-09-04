---
paths:
  - "src/**/*.svelte"
---

# Toggle Control Contract

New TKA boolean controls use the established button plus visible toggle
indicator pattern, not `<input type="checkbox">` or a third-party checkbox.

Search for `aria-pressed`, `role="switch"`, and existing toggle indicators;
reuse or extend the matching primitive. Before completing toggle work, inspect
the changed markup for checkbox inputs and confirm the chosen control exposes a
clear visual state and accessible name.
