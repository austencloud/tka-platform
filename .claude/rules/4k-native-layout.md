# 4K Is Home — ENFORCED

## The Problem This Solves

TKA is built, demoed, and used on a 4K monitor, and shown on widescreen TVs at
jams. Pages kept shipping as a phone layout scaled up: a narrow band centered in
a sea of empty rail, one thin row of controls stretched across the top, and a
big-screen media query keyed to a width that never fires.

Austen (2026-07-20): *"every single page should feel just gorgeously at home on
a 4K monitor ... everything is the right size and displayed with the right kind
of layout ... as soon as you go to a page you feel like wow boom layout is
gorgeous right in your face."*

The glossary landing was the case that earned this rule: a full-bleed shell
~500px wider than SiteHeader, nine category cards `auto-fill`ed into a row of 8
plus one orphan, a `min-width: 2200px` tier that never fired at all, and three
different content widths stacked down one page.

## The Three 4K Viewports (know which one you mean)

| Real setup | CSS viewport | What it needs |
|---|---|---|
| 4K @ 200% OS scaling (Windows default) | **~1920px** | Composition only — OS already scaled the pixels |
| 4K @ 150–160% scaling | **~2350–2560px** | Composition + wider band |
| 4K @ 100%, or a TV across the room | **~3840px** | Wider band **AND** element/type scale — nothing is scaling for you |

A single `min-width: 2200px` query misses the first case entirely, which is the
most common one. **The site-wide big-screen seam is `1680`**
(`src/lib/shared/landing/styles/public-editorial.css`) — 1680 catches 4K@200%,
1440p@100%, and fullscreen 1920 desktops while leaving laptops on the base
design. Use it. Add a second tier above ~2600px when scale (not just layout)
needs to step.

## The Two Mechanisms (use these, don't invent a third)

1. **`--shell-w`** (`src/app.css`) — the one content band, shared by SiteHeader,
   SiteFooter, `.editorial`, and every public page shell. Floor 1720px, fluid
   88vw, ceiling 2600px. Consume it as
   `max-width: var(--shell-w, min(1720px, 92vw))`. Never hardcode a band.
2. **The lockstep root ramp** (`src/app.css`, scoped to `html:has(.mkt-shell)`
   and `html:has(.legal-container)`; the guide has its own identical rule in
   `guide.css`) — root font ramps 16px→24px continuously from 1680→3840. Every
   rem/em/ch measure grows by the SAME multiplier, so nothing can outgrow its
   neighbours and the disjointed-4K failure becomes impossible by construction.

**Consequence: express sizes in `rem`, not `px`.** A `max-width: 600px` card is
frozen at 1080p proportions forever; `37.5rem` is the same card that grows with
the ramp. px is correct only for things that must NOT scale: touch-target
floors, hairline borders, and media capped by source resolution (e.g. a 400×400
PNG capped at 360px).

**Consequence: a step-tier that only bumps type/spacing is now redundant** —
delete it and let the ramp do it continuously. Keep a tier only when it
*recomposes* (column counts, grid areas, stacked→side-by-side).

## The Rules

1. **Fill the canvas.** The content band grows with the viewport above its
   floor. A hard `1720px` cap leaves 27% dead rail at 2350px and 55% at 3840px —
   that is the "not at home" feeling. Bands are fluid; only the *floor* is fixed.
2. **Never a row of one.** Column counts are a design decision per tier, not
   whatever `repeat(auto-fill, minmax(Npx, 1fr))` happens to emit. Auto-fill
   against a floor produces *more, thinner* items as the screen grows and
   orphans the last one. Pin the count per breakpoint and pick counts where
   `itemCount % cols != 1`.
3. **One width per page.** Shell, content grid, and CTA all share the band. Three
   stacked widths (full-bleed grid over a 46rem CTA over capped prose) reads as
   three unrelated pages. No `ch`/narrow-`rem` reading caps on public prose —
   see `feedback_no_text_max_width` memory.
4. **Use the vertical too.** A wide screen is also a tall one. Fewer/bigger rows
   beat one thin row with 40% of the viewport empty below the fold. If the page
   dead-ends a third of the way down at 4K, it is not done.
5. **Verify at all three widths.** 1920 / 2350 / 3840 before claiming done.
   Arithmetic about column counts is not verification of composition
   (`verification-protocol.md`).

## Forbidden

- A new `@media (min-width: 2200px)` big-screen tier (dead on 4K@200%). Use 1680,
  plus a ≥2600 tier when scale must step.
- `repeat(auto-fill, minmax(Npx, 1fr))` as the wide-screen grid for a known,
  fixed item count.
- A hard `max-width` cap on a page's content band with no fluid growth above it.
- Shipping a layout change on a public page without checking it at 4K widths.
- "It matches the header" as the sole justification for dead rail — if the header
  is the thing that's wrong, say so.

## Related

- Memory: `feedback_4k_is_home`, `feedback_no_text_max_width`,
  `feedback_design_system_mandatory`
- `no-layout-shift.md`, `never-hand-roll.md`, `verification-protocol.md`
- `src/lib/shared/landing/styles/public-editorial.css` — the shared editorial
  shell and the documented 1680 seam
