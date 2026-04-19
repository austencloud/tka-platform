# Responsive Design Strategy

**TKA is an everything-app.** Every UI must work from iPhone SE (375px) to 4K desktop (2560px+) with equal polish. This doc is the canonical reference. Read it before writing any responsive CSS.

## Core principles

1. **Fluid over fixed.** Prefer `clamp(min, preferred, max)` with viewport units to hard breakpoints. Sizes that scale smoothly 375→4K beat `@media` ladders every time.
2. **One breakpoint, not many.** We use **520px** as the single mobile/desktop boundary (defined in `modal-tokens.css`). Don't invent new ones without explicit justification.
3. **Media queries over container queries.** Container queries are fine for component-local layout, but the canonical pattern is `@media (max-width: 520px)`. Mixing both in one tree gets confusing — pick one per component.
4. **Use existing tokens, not ad-hoc pixels.** Modal sizes live in `--modal-width-*`. Touch targets live in `--min-touch-target`. Don't hardcode.
5. **Mobile and desktop have functional parity but different layouts.** Same features, different presentations. Never "hide on mobile" as a shortcut.

## The 520px breakpoint

Defined in `src/lib/shared/foundation/ui/modal/modal-tokens.css` line 263:

```css
@media (max-width: 520px) {
  dialog.base-modal { width: 100%; height: 100%; border-radius: 0; }
  /* sm/md/fit stay as cards with calc(100% - 32px) */
}
```

Any component needing a mobile/desktop split should match this boundary unless there's a specific reason otherwise.

## Modal sizing (the canonical example)

Size variants in `modal-tokens.css`:

| Size | Desktop | Mobile (<520px) |
|------|---------|-----------------|
| `sm` | 360px | card, calc(100% - 32px) |
| `md` | 480px | card, calc(100% - 32px) |
| `lg` | 640px | full-screen |
| `xl` | `min(90vw, 1400px)` — **scales to 4K** | full-screen |
| `fit` | 480px content-driven | card |
| `full` | `min(95vw, 900px)` | full-screen |

**For a modal that should feel big on 4K AND still fit iPhone SE**, use `size="xl"`. Do not override width with a custom global selector — that fights the mobile rule.

## Fluid sizing recipe

For elements inside a modal that should scale with container width (not viewport width, since modals don't always span the viewport), use **container queries** OR **clamp() with viewport units** — pick one:

```css
/* Option A: viewport-relative clamp (simpler, works inside any modal) */
.thumbnail { width: clamp(64px, 14vw, 120px); }

/* Option B: container queries (component-local) */
.body { container-type: inline-size; }
@container (max-width: 480px) { .row { gap: 8px; } }
```

**Don't mix A and B in the same component.** Pick the strategy that matches the rest of the file.

## Typography

Fluid type uses `clamp()`. Pattern: `clamp(min-mobile, preferred-vw, max-desktop)`.

Example: `font-size: clamp(0.875rem, 0.8rem + 0.375vw, 1rem);`

## Do / Don't

| Do | Don't |
|----|-------|
| Use `size="xl"` for big-on-4K modals | Custom `width: min(92vw, 920px)` overrides |
| Use `clamp()` for element scaling | Hardcode `width: 200px` |
| Use the 520px breakpoint | Invent `max-width: 360px` / `480px` breakpoints |
| Keep layout horizontal, scale cards down | Collapse to vertical when cards don't fit |
| Match an existing pattern | Design a new one from scratch |

## When adding a new responsive component

1. Search existing components for similar layout (card grid, row-of-cards, modal-with-picker, etc.). Copy the pattern.
2. Check `modal-tokens.css` for applicable size variants before overriding width.
3. Test at iPhone SE (375x667), iPad (768x1024), and 4K (2560x1440) before claiming done.
4. If you need a new breakpoint, justify it in the commit message.

## Known-good responsive examples

- `BaseModal.svelte` + `modal-tokens.css` — modal sizing and mobile fallback
- `LevelProgressionRow.svelte` — row of pictograph cards, fluid `clamp()` sizing
