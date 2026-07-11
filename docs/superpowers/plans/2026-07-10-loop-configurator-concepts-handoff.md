# LOOP Configurator Concepts — Fresh-Head Handoff

**Purpose:** let a clean instance pick up the LOOP Deck configurator redesign cold,
without the conversation that produced it. Read this top to bottom before touching code.

**Surface:** `src/lib/features/store/LoopDeckConfiguratorPage.svelte` → route
`/shop/loop-deck`.

## READ FIRST — the hard-won lesson this session

Visual work shipped **blind** missed the mark twice and was only fixed after opening
the page in a real browser and iterating. **Do not one-shot visual changes.** The
workflow that works:

1. Make a change.
2. Load Chrome MCP tools (`ToolSearch` → `mcp__claude-in-chrome__*`), open
   `https://localhost:5173/shop/loop-deck` (user's dev server, HTTPS/2, use `https://`),
   wait ~3-4s for Firestore products to load, screenshot.
3. Judge against the research (below). Adjust. Re-shoot. Repeat until it actually looks right.
4. `npm run check` (capture once to a log, grep it — never re-run to re-filter) must be
   0/0 before commit. Commit with explicit pathspec (`git commit -- <file>`), never bare.

Automation viewport is pinned ~1477px wide; `resize_window` moves the window but the
capture stays desktop-width, so the sub-860px mobile branch **cannot be screenshotted**
here — verify mobile by reading the CSS, and ask the user to confirm on his sim.

## Current state (shipped this session)

- `70c6ccaa33` — configurator on the bento language: Level/Length `StepperCard`s,
  Flavor full-width gold hero `BaseCard`, Prop/Size/Bundle trio, drill-down modals
  (Flavor grid + `PropPicker`) reusing the deck-releaser modal chrome.
- Verdict after eyes-on: **sound bones, not yet distinctive.** Controls are correct.
  Distinctiveness must come from the preview + breaking the split, not the controls.
- Research brief: `docs/superpowers/specs/2026-07-10-loop-configurator-reimagining-brief.md`
  (verdict, sliders answer, 3 concepts, ~40 sources). Companion interactive artifact
  published to claude.ai.

## Non-negotiables (from 2026 research — do not violate)

1. **Single screen, no wizard.** 4 axes × ~3 options belongs on one page.
2. **Real primitives, no sliders/dials.** Segmented (`SegmentedControl`) for Level/Length;
   tiles (`FilterChipBase`/`BaseCard`) for Flavor/Prop. Sliders are a proven anti-pattern
   here (steering-law mis-taps, >50% misread). Dials = novelty tax. Dropdowns read as a form.
3. **Preview reacts <150ms** on every pick. It is the top conversion lever + endowment engine.
4. **Fix dark-mode cheap tells:** no pure black base, no opacity-grey tiles. Deep indigo
   ground, alpha-gradient fills, faint grain, 1–2 nebula orbs. Glass demoted to frames/overlays only.
5. **One reward loop:** spring-settle + haptic per commit. Restraint, GPU transforms, mobile-first.
6. Presets + forgiving defaults so an inert buyer completes in one tap.
7. Order axes by consequence: **Prop → Level → Length → Flavor.**
8. Flat $30 persistent as a value anchor; keep it visible.

## Key files + primitives

| Need | Path |
|---|---|
| The configurator (edit target) | `src/lib/features/store/LoopDeckConfiguratorPage.svelte` |
| Domain axes + availability | `src/lib/features/store/domain/loop-config.ts` (`AVAILABLE_LEVELS`, `AVAILABLE_LENGTHS`, `availableFlavors`, `flavorSlugFromComponents`, mix-copy consts) |
| Bento tile primitives | `src/lib/features/create/generate/components/cards/BaseCard.svelte`, `.../StepperCard/StepperCard.svelte` (BaseCard already has ripple + spring press + haptic on click) |
| Level colors | `src/lib/shared/config/difficulty-styles.ts` → `DIFFICULTY_LEVELS[n].cssBg/.text` |
| Card palette | `src/lib/shared/create/domain/card-colors.ts` → `getCardColors(BackgroundType.COSMIC)` |
| Segmented / chips | `src/lib/shared/3d/components/controls/SegmentedControl.svelte`, `src/lib/shared/browse/components/filter-chips/FilterChipBase.svelte` |
| Shop prop set (5 props) | `src/lib/features/store/domain/shop-prop-options.ts` (`SHOP_PROP_OPTIONS`, `shopPropImage/Label`, `DEFAULT_SHOP_PROP`) |
| Prop modal picker | `src/lib/features/store/components/PropPicker.svelte` |
| Preview fan | `src/lib/features/store/components/DeckFanCover.svelte` (2D canvas card renders) |
| Crossfade | `src/lib/shared/components/Crossfade.svelte` (`fill` mode for sized stages) |
| Haptics | `getHapticFeedback()` → `.trigger("selection")` |
| Deck-releaser reference (same bento language, admin) | `src/lib/features/choreo-card/components/deck-releaser/LoopBentoBoard.svelte` |
| 3D stack (for B/C) | Threlte/Three already in the app (ocean scene, `Viewer3DCanvas`, 3D environments). Blender-first rule for static geometry; procedural OK for parametric. |

**Do not touch:** checkout / `loopConfig` metadata / SKU (`loop-deck-custom`) / firebase
whitelist. All three concepts are presentation only.

---

## Concept A — Refined Bento (SAFE EVOLUTION — SHIPPED `d882677301`)

Keep the current shape; fix everything the verdict flagged. Lowest risk, real lift,
the fallback floor. Built + verified eyes-on this session.

Ledger:
- [x] **Preset row** — 3 one-tap builds (Beginner's Loop L1·8·Variety, The Sampler
  Mix·8·Variety, Deep Cuts L2·8·Rotated), each sets all axes + highlights when active.
  Verified in-browser: applying a preset recolors the level tile, swaps the flavor hero,
  re-renders the fan. Haptic on tap.
- [x] **Nebula glow** painted into the preview-box background layers (violet + faint
  teal) — background-layer approach avoids the crossfade z-index fight. Secondary
  Size/Bundle tiles moved from opacity-grey to violet alpha-gradient.
- [x] **Reward loop:** haptic on preset/flavor/prop commits (spring already in `BaseCard`).
- [~] **Reorder axes** — SKIPPED. The stepper-pair → hero → trio rhythm reads better than
  leading with the prop drill-down. Revisit only if review disagrees.
- [x] **Defaults** forgiving (L1/8/Variety/Staff). Confirmed.
- [x] Eyes-on verify + `npm run check` 0/0 + commit `d882677301`.

Remaining A polish (optional, not blocking): preset-usage instrumentation needs a new
event type in `activity-event.ts` (skipped to avoid the model edit); faint grain overlay;
spring on the stepper ± beyond BaseCard's press.

## Concept B — The Turntable (STRONG CONTENDER — for Fable / next session)

Kill the image-left/options-right split. One representative card floats center as a real
3D object (drag to spin, foil/holo catches nebula light); the four controls become
satellites orbiting the card, or docked along the bottom on mobile.

Basic spec:
- Render one card as a texture on a plane in Threlte (2D card render already exists →
  use as `map`); add a subtle material + light rig so it reads as an object, not a decal
  (this is the main risk — a flat textured plane looks cheap; needs a material/lighting pass).
- Recolor/re-prop on tap = the existing prop swap re-textures the card instantly (<150ms).
- Card + live `$30` sticky on mobile; controls scroll beneath.
- Same primitives (segmented + tiles), re-staged around the object.
- Effort ●●●○○ · Risk ●●○○○ · Distinct ●●●●○. Expect several eyes-on rounds to make the
  card feel physical.

## Concept C — The Dealing Table (THE SWING — for Fable, high effort)

Configuration as play. The deck lives in a reactive cosmic diorama; picking a flavor
riffles the stack; finishing deals into a spread (the "here is your deck" payoff).

Basic spec:
- Cosmic diorama scene (Threlte) the deck floats inside; selections drive lighting/particle
  drift.
- Card physics for riffle + deal-and-spread. **This is the hard part** — timing/easing of
  card motion is the exact class of thing that misses on first attempts and needs heavy
  eyes-on tuning (same failure mode as crossfades). Budget for it.
- Deal-and-spread = the confirmation moment (replaces a plain "added to cart").
- Enforce restraint: one signature spring, GPU transforms only, throttle when idle, test on
  a budget phone not an emulator.
- Effort ●●●●● · Risk ●●●○○ · Distinct ●●●●●. Multi-session; real chance of
  functional-but-off until tuned. Best given to a fresh high-effort pass (Fable).

## Recommendation

Ship **A** as the floor now. Hand **B or C** to Fable with the research brief as the
ceiling swing. Controls are settled — spend boldness on the preview and the split.
