# Public Pages: Editorial-on-Cosmic Redesign (/about, /roots)

Date: 2026-06-24

## Why

`/about` and `/roots` were near-identical copies of a generic dark-dashboard
template: flat `linear-gradient(145deg,#0f0f23…)` background, `.icon-wrapper`
colored-square + FontAwesome icons, `rgba(255,255,255,.03)` glass cards,
gradient-text `h1`, `translateY(-2px)` hover. That reads "AI template," and it
doesn't match the cosmic public chrome the landing + /support now use, nor the
genuinely modern /guide (OKLCH, Inter optical sizing, subgrid prose grid,
scroll-driven reveal).

Goal: bring both pages to the bar set by /guide (type) and /support (background)
without losing any content. The /guide stays the north star.

## Design

1. **Shared shell — `CosmicPageShell.svelte`** (`src/lib/shared/landing/components/`).
   Wraps a page in the same structure /support uses: a `z-index:-2` deep-space
   fallback, the COSMIC `BackgroundHost` at the fixed bg layer,
   `applyThemeForBackground(COSMIC)` on mount, `SiteHeader`, and a transparent
   `content-layer` (`z-index:1`) holding a `{@render children()}` slot. Removes
   the cosmic + theme boilerplate that /support, /about, /roots would otherwise
   each repeat. (/support may migrate onto it in a later pass; not required here.)

2. **Shared editorial CSS — `public-editorial.css`** (`src/lib/shared/landing/styles/`).
   The /guide's type language as a reusable system, imported by /about + /roots:
   OKLCH text scale (heading `oklch(.95 .01 270)`, body `oklch(.72 .01 270)`,
   dim `oklch(.55 .02 270)`), Inter `font-variation-settings:'opsz'`, fluid
   `clamp()` headings with tightened tracking, ~46rem prose measure. Shared
   classes: `.editorial`, `.page-title`, `.page-subtitle`, `.lede`,
   `.editorial-section` (+ `.panel` for emphasis blocks that frost the cosmic),
   `.section-title` (thin `--accent` rule above it, no icon box), `.prose`,
   `.bullet-list`, `.resource-chip`, `.cta-card`/`.cta-button`, plus the /guide's
   `@supports (animation-timeline: view())` scroll-reveal. Reduced-motion safe.

3. **Re-skin both pages** onto the shell + shared classes. Drop every
   `.icon-wrapper` colored square and the FontAwesome section icons. Section
   accent colors survive only as the thin rule above each title. Emphasis
   sections (roots Music Theory, about/roots CTA) use `.panel`.

4. **Content preserved verbatim.** /about: 5 sections, the position-pictograph
   grid + `LightsToggleButton`, the visible FAQ, and ALL JSON-LD
   (AboutPage/BreadcrumbList/FAQPage). /roots: all sections, external-link chips,
   lists, CTA. Pure re-skin — no copy or structural-content changes.

## Out of scope

- Migrating /support onto `CosmicPageShell` (optional follow-up).
- Touching /guide (it's the reference).
- Any copy changes.
