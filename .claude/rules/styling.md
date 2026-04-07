# Styling Rules

Full reference with variable lists and scrollbar system in `docs/reference/styling-guide.md`.

## Core Rules

- **Component-scoped `<style>` blocks.** Never create global CSS utility classes.
- **CSS custom properties** for design tokens. Share values, not layout rules.
- **Container queries** (`cqw`, `cqh`) for component-relative sizing. Mobile-first.
- **3-layer variable hierarchy:** `--settings-*` (static layout), `--theme-*` (dynamic, adapts to background), `--semantic-*` / `--prop-*` (constant colors).
- **Panels:** `var(--theme-panel-bg)` for main panels, `var(--theme-card-bg)` + `var(--theme-stroke)` for cards. NO blur on content panels.
- **Typography:** 14px min for essential text (`--font-size-min`), 12px min for supplementary (`--font-size-compact`). Never below 12px.
- **Legacy (`--*-current`):** Still in 30+ components. Migration ongoing.
