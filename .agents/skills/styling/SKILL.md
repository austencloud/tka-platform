---
name: styling
description: Use when writing or modifying CSS, design tokens, or component styles. Enforces the 3-layer variable hierarchy, container-query sizing, and typography minimums specific to this project.
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# Styling

- **Component-scoped `<style>` blocks.** Never create global CSS utility classes.
- **CSS custom properties** for design tokens. Share values, not layout rules.
- **Container queries** (`cqw`, `cqh`) for component-relative sizing. Mobile-first.
- **3-layer variable hierarchy:**
  - `--settings-*` — static layout
  - `--theme-*` — dynamic, adapts to background
  - `--semantic-*` / `--prop-*` — constant colors
- **Panels:** `var(--theme-panel-bg)` for main panels, `var(--theme-card-bg)` + `var(--theme-stroke)` for cards. No blur on content panels.
- **Typography:** 14px min for essential text (`--font-size-min`), 12px min for supplementary (`--font-size-compact`). Never below 12px.
- **Legacy (`--*-current`):** Still in 30+ components. Migration ongoing.

Full reference with variable lists and scrollbar system: `docs/reference/styling-guide.md`.
