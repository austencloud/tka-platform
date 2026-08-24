# Styling System Reference

Loaded on demand when doing CSS work. Not needed every session.

---

## NEVER Create Global CSS Utility Classes in Svelte

Svelte scopes styles for good reasons. "Duplicated" layout CSS across components isn't a problem -- it's encapsulation.

| SHARE (via CSS variables)                | DON'T SHARE (keep scoped)          |
| ---------------------------------------- | ---------------------------------- |
| Colors: `var(--theme-card-bg)`           | Layout: `.container { max-width }` |
| Spacing tokens: `var(--spacing-md)`      | Typography: `h2 { font-size }`     |
| Border radii: `var(--radius-lg)`         | Section padding                    |
| Semantic colors: `var(--semantic-error)` | Grid definitions                   |

**The rule:** Share design tokens (values), not layout classes (rules).

---

## CSS Variable Hierarchy (3 Layers)

See `src/lib/shared/settings/utils/background-theme-calculator.ts` for implementation.

### Layer 1: Static Layout Tokens (`--settings-*`)

- Defined in `settings-tokens.css`
- Spacing, radius, typography, transitions
- Do NOT change with background

### Layer 2: Dynamic Theme Variables (`--theme-*`)

- Injected by background-theme-calculator based on luminance
- Adapt to light/dark backgrounds
- Variables: `--theme-panel-bg`, `--theme-card-bg`, `--theme-accent`, `--theme-text`, `--theme-stroke`, `--theme-stroke-strong`

### Layer 3: Semantic Colors (`--semantic-*`, `--prop-*`)

- Constant colors that never change with background
- Status: `--semantic-error`, `--semantic-success`, `--semantic-warning`, `--semantic-info`
- Domain-specific: `--prop-blue`, `--prop-red`

### Pattern for New Components

```css
.card {
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  color: var(--theme-text, #ffffff);
}
.error {
  color: var(--semantic-error);
}
```

### Theme Variable Ownership

Components consume `--theme-*` variables; they do not redefine theme-looking
variables locally to impose a palette. A feature may define semantic local
tokens such as `--artifact-accent` or `--timeline-progress`, then derive them
from the active theme or sourced artifact identity. It must not set a local
`--theme-text-*`, `--theme-panel-*`, or `--theme-card-*` value and thereby opt
out of the contrast-aware theme calculator.

When a new foreground color is necessary, verify its computed contrast against
every background it appears on. Do not infer contrast from an OKLCH lightness
value or from the fact that the text is technically visible.

**Legacy (`--*-current`)**: Still used by 30+ components. Migration ongoing.

---

## Unified Panel Background System

### Panel Types

1. **Main Panels**: `background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));`
2. **Cards/Sub-panels**: `background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));` + `border: 1.5px solid var(--theme-stroke)`
3. **Hover States**: `border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));`

### Override Drawer Glassmorphism

```css
:global(.your-drawer-class) {
  --sheet-bg: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  --sheet-filter: none;
}
```

**When to use blur:** ONLY for modal backdrops. Never for content panels, drawers, forms, or interactive surfaces.

---

## Typography System (Accessibility-First)

Defined in `src/app.css`. Two-tier minimum font size system:

- **Tier 1 (14px min):** `var(--font-size-min)` or `var(--font-size-sm)` -- body text, form labels, buttons, error messages
- **Tier 2 (12px min):** `var(--font-size-compact)` or `var(--font-size-xs)` -- nav labels under icons, badges, timestamps, metadata
- NEVER go below 12px for any user-visible text
- Always use semantic tokens, not raw pixel values
- Navigation, buttons, help text, and explanatory prose are Tier 1. Tier 2 is
  reserved for dates, counters, timestamps, and genuinely supplementary labels.
- Verification checks computed size, weight, contrast, and the amount of text
  competing for the available space. Satisfying the numeric floor alone is not
  a readability pass.

---

## Scrollbar System

Add `themed-scrollbar` class to any scrollable container. Adapts to background luminance automatically.

| Class                     | Purpose                              |
| ------------------------- | ------------------------------------ |
| `themed-scrollbar`        | Neutral colors, adapts to light/dark |
| `themed-scrollbar-accent` | Uses theme accent color              |

### CSS Variables

| Variable                                          | Purpose                 |
| ------------------------------------------------- | ----------------------- |
| `--scrollbar-thumb`                               | Thumb color             |
| `--scrollbar-thumb-hover`                         | Thumb hover state       |
| `--scrollbar-track`                               | Track background        |
| `--scrollbar-accent` / `--scrollbar-accent-hover` | Accent-colored variants |

On mobile (< 768px), scrollbars expand to 16px width for touch accessibility.

Replace hardcoded `rgba(255, 255, 255, 0.x)` scrollbar colors with theme variables.
