---
paths:
  - "src/**/*.{svelte,css}"
---

# Action Affordance Contract

Primary and standalone actions look interactive without hover:

- use a semantic `<button>`, or a semantic `<a>` styled as a button when it
  navigates;
- use the existing button primitive, visible focus, sufficient contrast, and a
  44px touch-target floor;
- reserve inline text links for references inside running prose.

Do not add a faint standalone text action, an affordance-free clickable, or a
duplicate text CTA beside an existing button for the same action.
