# CSS-First Dark Mode Migration Plan

## Goal
Eliminate all `darkMode` prop drilling by migrating to a CSS-first approach where dark mode state is expressed as a class on `<html>` and consumed via CSS custom properties throughout the component tree.

## Current State (Problems)
- **29 components** receive `darkMode` prop
- **17 components** are intermediate (just pass it down without using it)
- **Max depth: 6 levels** of prop drilling
- **11 SVG components** use hardcoded colors based on `darkMode` prop
- **Dual state sources**: AppSettings (Firebase) + AnimationVisibilityStateManager (localStorage)

## Target Architecture

### 1. Single Source of Truth
The `<html>` element gets a `.dark` class when dark mode is active:

```html
<!-- Light mode -->
<html lang="en">

<!-- Dark mode -->
<html lang="en" class="dark">
```

### 2. CSS Variable Definitions at `:root`
All dark-mode-sensitive colors defined as CSS variables:

```css
:root {
  /* Core colors */
  --dm-bg: #ffffff;
  --dm-bg-secondary: #f5f5f5;
  --dm-text: #000000;
  --dm-text-muted: #666666;

  /* SVG-specific colors */
  --dm-grid-line: #cccccc;
  --dm-grid-line-strong: #999999;
  --dm-glyph-fill: #231f20;
  --dm-pictograph-bg: white;

  /* Motion colors (blue/red props stay constant) */
  --dm-motion-neutral: #231f20;
}

:root.dark {
  --dm-bg: #0a0a0f;
  --dm-bg-secondary: #1a1a2e;
  --dm-text: #ffffff;
  --dm-text-muted: #aaaaaa;

  --dm-grid-line: #333333;
  --dm-grid-line-strong: #555555;
  --dm-glyph-fill: #ffffff;
  --dm-pictograph-bg: #0a0a0f;

  --dm-motion-neutral: #ffffff;
}
```

### 3. SVG Components Use CSS Variables
Instead of:
```svelte
<rect fill={darkMode ? "#0a0a0f" : "white"} />
```

Use:
```svelte
<rect fill="var(--dm-pictograph-bg)" />
```

## Implementation Steps

### Phase 1: Infrastructure (Foundation)
**Files to modify:**
- `src/app.html` - Add reactive class binding mechanism
- `src/app.css` - Add `:root` and `:root.dark` CSS variable definitions
- `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts` - Add effect to sync class to `<html>`

**Implementation:**
1. Add dark mode CSS variables to `src/app.css` under new `/* Dark Mode System */` section
2. In `animation-visibility-state.svelte.ts`, add an `$effect` that sets/removes `.dark` class on `document.documentElement` when `darkMode` changes
3. This makes dark mode state globally available via CSS without any prop passing

### Phase 2: SVG Component Migration
**Components to update (11 total):**

| Component | Current Pattern | Migration |
|-----------|-----------------|-----------|
| `PictographRenderer.svelte` | `darkMode ? "#0a0a0f" : "white"` | `var(--dm-pictograph-bg)` |
| `GridSvg.svelte` | Hardcoded hex values | `var(--dm-grid-line)` |
| `ArrowSvg.svelte` | `getMotionColor()` | Keep motion colors, neutral → `var(--dm-motion-neutral)` |
| `TKAGlyph.svelte` | `filter: invert(0.9)` | Remove filter, use `var(--dm-glyph-fill)` |
| `TurnsColumn.svelte` | feColorMatrix + getMotionColor | Keep motion, neutral → variable |
| `DirectionDot.svelte` | `darkMode ? "#fff" : "#231f20"` | `var(--dm-glyph-fill)` |
| `Dash.svelte` | Same as DirectionDot | `var(--dm-glyph-fill)` |
| `BeatNumber.svelte` | Inline fill/stroke | `var(--dm-text)` |
| `ReversalIndicators.svelte` | `getMotionColor()` | Keep as-is (motion-specific) |
| `PositionGlyph.svelte` | `filter: invert(0.9)` | Remove filter, use variables |

**Order:** Start with leaf components (DirectionDot, Dash, BeatNumber), then work up to PictographRenderer.

### Phase 3: Remove darkMode Props
**After SVGs use CSS variables, remove prop drilling:**

1. Remove `darkMode` prop from component interfaces
2. Remove `darkMode` from parent component props/state
3. Delete subscription code that was only needed to pass darkMode down
4. Work bottom-up: leaf components first, then intermediate, then containers

**Components to clean (by depth):**
- Depth 1-2: OptionPickerContent, OptionPicker, PlaybackTab, etc.
- Depth 3-4: OptionSection, Option456Row, OptionGrid, etc.
- Depth 5-6: OptionViewerSection, OptionPictographCell, etc.

### Phase 4: Cleanup & Verification
1. Remove `IDarkModeProvider` DI service (no longer needed)
2. Remove `darkMode` from any remaining interfaces
3. Grep for `darkMode` prop usage and verify all removed
4. Test L key toggle across all views

## Key Decisions

### Why `--dm-*` prefix?
- Distinguishes from existing `--theme-*` variables (background-based)
- Clear that these are dark-mode-specific
- Avoids conflicts with other systems

### Why not merge with `--theme-*` system?
The existing `--theme-*` system is based on **background luminance** (light background → light theme variables). The dark mode toggle is a **user preference** independent of background. Keeping them separate:
- Dark mode can override theme when needed
- User can have dark mode ON with a light background (or vice versa)
- Cleaner mental model

### Motion Colors Stay Constant
Blue (`#3b82f6`) and red (`#ef4444`) props don't change with dark mode - they're semantic colors. Only "neutral" colors (black/white, grays) flip.

## Verification Checklist
- [ ] L key toggles `.dark` class on `<html>`
- [ ] All SVG components render correctly in both modes
- [ ] No `darkMode` prop in any component interface
- [ ] Transitions are smooth (150ms)
- [ ] Settings persistence works (Firebase + localStorage)
- [ ] TypeScript compiles with no errors
