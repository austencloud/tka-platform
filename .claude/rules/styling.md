# Styling System

## Core Principles

- Component-scoped `<style>` blocks
- CSS custom properties for design tokens
- Container queries (`cqw`, `cqh`) for component-relative sizing
- Mobile-first with progressive enhancement

---

## NEVER Create Global CSS Utility Classes in Svelte

**On January 3, 2026, Claude created `landing-utilities.css` with global classes like `.landing-section`, `.landing-container`, `.landing-h2` - then had to revert the entire change.**

**This was wrong. Svelte scopes styles for good reasons.**

**The mistake:** Seeing "duplicated" CSS like `.container { max-width: 1200px }` in multiple components and thinking "I should extract this to a shared file!"

**Why it's wrong:**

1. **Svelte scopes styles intentionally** - each component is self-contained and deleteable
2. **"Duplication" in scoped styles isn't a problem** - it's explicit, isolated, no hidden dependencies
3. **Global utility classes create coupling** - change the global, break N components
4. **Goes against the framework's philosophy** - Svelte chose scoping for a reason

**What to share in Svelte:**

| SHARE (via CSS variables)                | DON'T SHARE (keep scoped)                   |
| ---------------------------------------- | ------------------------------------------- |
| Colors: `var(--theme-card-bg)`           | Layout: `.container { max-width }`          |
| Spacing tokens: `var(--spacing-md)`      | Typography: `h2 { font-size }`              |
| Border radii: `var(--radius-lg)`         | Section padding: `.section { padding }`     |
| Semantic colors: `var(--semantic-error)` | Grid definitions: `.grid { display: grid }` |

**The rule:** Share design tokens (values), not layout classes (rules).

**If you see "duplicated" layout CSS across Svelte components:**

- That's fine. Leave it alone.
- Each component owns its own layout.
- The "duplication" is actually encapsulation.

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
- Use for: surfaces, text, borders, accents, shadows
- Variables: `--theme-panel-bg`, `--theme-card-bg`, `--theme-accent`, `--theme-text`, etc.

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

**Legacy (`--*-current`)**: Still used by 30+ components. Migration ongoing.

---

## Unified Panel Background System

**Problem:** Panels had inconsistent backgrounds - some used glassmorphism blur, some used gradients, some used solid colors.

**Solution:** Use theme variables exclusively. NO blur effects on content panels.

### Panel Types

1. **Main Panels** (full-screen content areas):
   ```css
   background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
   ```

2. **Cards/Sub-panels** (nested content):
   ```css
   background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
   border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
   ```

3. **Hover States**:
   ```css
   border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
   ```

### Override Drawer Glassmorphism

Most drawers should NOT have blur. Override the defaults:

```css
:global(.your-drawer-class) {
  --sheet-bg: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  --sheet-filter: none; /* Disable blur */
}
```

**When to use blur:** ONLY for modal backdrops to dim content behind. Never for content panels, drawers, forms, or interactive surfaces.

See `docs/UNIFIED_PANEL_BACKGROUNDS.md` for full guidelines.

---

## Typography System (Accessibility-First)

Defined in `src/app.css`. Two-tier minimum font size system:

### Tier 1: Essential Text (14px / 0.875rem minimum)

- Use `var(--font-size-min)` or `var(--font-size-sm)`
- For: body text, form labels, buttons, links, error messages
- Any text users MUST read to understand/use the interface

### Tier 2: Supplementary Text (12px / 0.75rem minimum)

- Use `var(--font-size-compact)` or `var(--font-size-xs)`
- For: navigation labels under icons, badges, timestamps, metadata
- Captions where context is already clear from surrounding UI

### Rules

- NEVER go below 12px for any user-visible text
- Icons can be smaller (10-12px) as they're not text
- Always use semantic tokens, not raw pixel values
- Include fallback: `var(--font-size-compact, 12px)`

### Pattern for New Components

```css
.body-text {
  font-size: var(--font-size-min, 14px);
}
.badge {
  font-size: var(--font-size-compact, 12px);
}
.nav-label {
  font-size: var(--font-size-compact, 12px);
}
```
