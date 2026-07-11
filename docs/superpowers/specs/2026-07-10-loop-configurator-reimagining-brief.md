# LOOP Deck Configurator — Bones-Level Reimagining Brief

**Date:** 2026-07-10
**Status:** Research + direction (not a plan). Intended as the Fable handoff.
**Surface:** `src/lib/features/store/LoopDeckConfiguratorPage.svelte` (`/shop/loop-deck`)
**Companion:** interactive artifact (studio brief, dark cosmic) published to claude.ai
for phone reading.

Synthesis of four parallel 2026 web-research passes: configurator UX + purchase
psychology, dark-mode aesthetic trends, discrete-control usability, and
standout-builder inspiration. ~40 cited sources.

## The honest verdict

The current build has **sound bones but is not yet a distinctive object**. The
evidence validates most of its structure. What it lacks is product-as-hero
presence and a reward loop.

**Keep (evidence backs it):**
- Single screen, no wizard — 4 axes × ~3 options is textbook single-page territory.
- The bento grid — still foundational in 2026, not a played-out fad.
- Live preview — the single strongest conversion lever on the page (~40% avg lift).
- Real primitives — `SegmentedControl` + tiles are the correct modern controls.
- Flat $30 — a weapon against the #1 abandonment driver (unexpected cost).

**Change (why it doesn't sing):**
- The image-left / options-right split — the most generic e-commerce shape there is.
- A static fan — the preview sits still; it should be the toy.
- Glass on every tile — 2026-correct glass is modals/frames only.
- No reward loop — nothing springs, settles, or buzzes on a pick.
- No presets, arbitrary axis order — the inert buyer has no one-tap path.

## The sliders question, answered

**No.** For every axis here a slider is an anti-pattern, not a nostalgia win.
Sliders live under the steering law (precise value acquisition is hard by design);
built for exploration, not landing on one of four discrete stops. Dual-point range
sliders were misread by >50% of users in testing; touch handles are too twitchy.
Dials/knobs carry the same precision tax plus discoverability cost. Both fail
`effects-earn-their-slot`.

Per-axis control (all wired to a <150ms live preview — the one real thing a slider
offered, exploration, without the misfires):

| Axis | Values | Control | Why |
|---|---|---|---|
| Prop | ~5 | icon tiles | inherently visual; identity choice → comes first |
| Level | 1/2/3/Mix | segmented | single-select, exactly-one, N=4 fits a phone row at 44px |
| Length | 8/12/16/Mix | segmented | distinct picks, not nudges → not a stepper; tabular figures |
| Flavor | ~8 | selectable tiles | exceeds the ~5 segmented ceiling; icon+label scans + wraps |

Route through the existing `SegmentedControl` + `FilterChipBase`/tile primitives
per `chip-primitives.md`. No sliders, no dials, no dropdowns.

## Four research streams, one direction

1. **Purchase psychology** — constrain, curate, default, sequence. Add 2–3 named
   preset decks as one-tap entry above the grid (biggest single win); forgiving
   defaults so an inert buyer completes in one tap; order axes by consequence
   (Prop → Level → Length → Flavor); flat $30 shown persistently as a value anchor;
   center the "Mix" / "Variety" Goldilocks options.
2. **2026 aesthetics** — bento stays; demote glass to frames/overlays only; break
   the image-left/options-right split (product-as-hero, controls as satellites);
   fix two dark-mode cheap tells: no pure black base, no opacity-grey tiles → deep
   indigo ground, alpha-gradient fills, faint grain, 1–2 luminous nebula orbs.
   Reinterpret "liquid glass," never on text.
3. **Control paradigm** — segmented for discrete numeric axes, icon tiles for
   categorical; pair with sub-150ms preview; 44px targets in the thumb zone.
4. **Standout builders** — the entire custom-deck category is dated (forms + static
   previews) = the opening. A live 3D turntable card that recolors on tap, a
   deal-and-spread payoff, a cosmic diorama the deck floats inside. All achievable
   with Three.js + CSS-transform card-fan techniques; no exotic tech.

## Three concepts

**A — Refined Bento (safe evolution, ship now).** Keep the shape, fix every flagged
item: preset decks, cheap-tell fixes, spring+haptic reward loop, glass demoted to
the preview frame, reorder axes + defaults. Effort ●○○○○ · Risk ●○○○○ · Distinct ●●○○○.

**B — The Turntable (strong contender).** Kill the sidebar split. One representative
card floats center as a real 3D object (drag to spin, foil catches nebula light);
the four controls become satellites orbiting the card / docked on mobile. Recolor
on tap (Nike By You mechanic). Sticky card + live $30 on mobile. Same primitives,
re-staged. Effort ●●●○○ · Risk ●●○○○ · Distinct ●●●●○.

**C — The Dealing Table (the swing).** Deck lives in a reactive cosmic diorama;
picking a flavor riffles the stack; finishing deals into a spread (the "here is your
deck" payoff). Fan mechanic is native to a deck, so the flourish is honest. One
signature spring, GPU transforms, throttle idle. Effort ●●●●● · Risk ●●●○○ · Distinct ●●●●●.

## The Fable non-negotiables

1. Single-screen, real primitives (segmented + tiles; no sliders/dials).
2. Preview is the centerpiece and it moves (spatial card, reacts <150ms).
3. Preset decks + forgiving defaults (one tap to buy; full depth to refine).
4. Fix dark-mode cheap tells + demote glass (deep indigo, alpha-gradient, grain, glow).
5. One reward loop: spring + haptic per commit; restraint, GPU, mobile-first.

**Recommendation:** ship Concept A as the floor; let Fable take a clean swing at
B or C for the ceiling. Controls are settled — spend the boldness on the preview
and the split.

## Key sources

configurator.tech, shopify (decoy/anchoring), forbes tech council (decision fatigue),
studiomeyer.io (2026 trend reality check), awwwards (storytelling/product-as-hero),
endschema (premium dark mode), nngroup (sliders/knobs, input steppers), baymard
(slider interfaces), eleken (radio/tile UI), mobbin (segmented control), nike by you,
teenage.engineering, wearedevelopers (3D card fan), wpconfigurator (2026 examples).
Full URLs in the published artifact.
