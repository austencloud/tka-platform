# Composer page: show the app's range

**Date:** 2026-09-01
**Route:** `/composer` (`src/routes/(public)/composer/`)
**Governed by:** `presentation-guardrails.md` and `feature-truth-matrix.md` in the route folder

## Diagnosis

The 2026-08-25 rewrite cut the page to four beats and made every beat evidence
that the product works. None of it is evidence that the product is beautiful.
Austen's list of what the page fails to show: effects, tunneling at scale,
the library and gallery as an explorable place, and background and theme
switching. The four-beat spine stays. The evidence inside each beat gets bigger.
No new headings, no catalogue.

Decisions taken with Austen on 2026-09-01:

| Beat | Decision |
| --- | --- |
| Hero | Auto-cycle the page background through Cosmic, Ocean, Autumn, Winter with a tap-to-pick swatch row. |
| 3D | An effect strip exposing all 16 registry effects on the live 3D viewer. |
| Tunnel | Promote from a square beside the heading to its own full-width band, 8 performers by default, an arrangement toggle. |
| Gallery | Replace the read-only shelf with the real community gallery grid and live filter chips in a bounded frame. A card opens the real standalone viewer. |

## A. Hero background cycle

**Owner of the chosen background:** new module state
`src/lib/shared/landing/state/marketing-background-state.svelte.ts`. It holds
one `$state` `type: BackgroundType` (default `cosmic`), `set(type)`, and
`reset()`. It never touches `settingsService`, the account preference, or the
`tka-public-theme-index` key.

**MarketingChrome** (`src/lib/shared/landing/components/MarketingChrome.svelte`)
stops hardcoding `cosmic`. It renders `LiveBackground` with
`backgroundType={marketingBackground.type}` and re-runs
`applyThemeForBackground(type)` whenever the type changes, once the calculator
module has loaded. Every other marketing page is unaffected because the state
defaults to cosmic and the composer page resets it on destroy.

**Composer page:** new `_components/ComposerBackgroundCycle.svelte` rendered
under the hero player. It is a `SegmentedControl` (exactly one active) of four
options from `ANIMATED_BACKGROUNDS` in
`src/lib/shared/settings/utils/public-page-backgrounds.ts` (icon + label), in
the order Cosmic, Ocean, Autumn, Winter. Behaviour:

- Auto-advance every 9 seconds while the hero is on screen
  (`IntersectionObserver`), the tab is visible, and reduced motion is off.
- A visitor tap selects that background and stops the auto-cycle for the rest
  of the visit to the page.
- On destroy: `marketingBackground.reset()`.
- One caption line under the row, plain copy: "The app has ten backgrounds.
  Each one retunes the interface colors."

**Verification:** live swap works in the browser (canvas changes and
`--theme-accent` on `:root` changes); the row fits at 375px.

## B. Effect strip on the 3D viewer

Inside `Composer3DViewerDemo.svelte` (the effects context is component-scoped,
so the strip must live in this component), render a wrapping row of 16
`FilterChipBase` chips (`mode="toggle"`, `size="sm"`, `icon` and `chipColor`
from `EFFECTS` in
`src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`)
under the stage. Exactly-one-or-none semantics: tapping the active chip turns
effects off; tapping another switches. This is the routing rule's "at most one
that clears on re-click" case, which is why it is not a `SegmentedControl`.

Wiring: `getEffectsConfigContext().setActiveEffect(id)` and `"none"` to clear.
The `"*"` tip map that `setActiveEffect` writes applies the effect to every
prop on every performer. Default active effect on mount: `fire`.

Copy above the strip, one line: "Effects follow the props."

The feature truth matrix row "Broad 3D effect set" moves from internal/beta to
released, with the condition that every chip is shown and verified on this
page. The verification pass must click every one of the 16 chips and confirm
no console error and a visible change.

## C. Tunnel band

`ComposerTunnelDemo.svelte` gains a `layout: "band"` presentation. The tunnel
renderer is square-only (`AnimatorCanvas` sidecar is a square fill embed), so
the band is a two-column composition: the square stage on the left at
`min(46rem, 62vh)`, and a control column on the right holding the "Tunnel"
title, the caption, the Performers control (2/4/8, default 8), and a new
Arrangement control. Below 960px the columns stack, stage first.

Arrangement is a `SegmentedControl` with three options that map to real
`TunnelConfig` values already shipped in the Create module's Tunnel tab:

| Option | Config |
| --- | --- |
| Ring | `mirror: false, staggerSteps: 0` |
| Mirrored | `mirror: true, staggerSteps: 0` |
| Canon | `mirror: false, staggerSteps: 1` |

The image ceiling in `tunnel-config.ts` allows fold 8 with mirror (16 images),
so 8 + Mirrored is legal. The truth matrix condition "do not add mirrors or
canons unless those controls are shown and verified" is satisfied by showing
the control and verifying it in the browser.

In `+page.svelte`, the `.changing-head` two-column grid goes away. The heading
and intro sit full width, the tunnel band follows, then the 3D viewer band.
The tunnel skeleton placeholder changes shape to match the band.

## D. Gallery frame

New `_components/ComposerGalleryDemo.svelte` replaces `ComposerGalleryShelf`.
It composes `createBrowseEngine({ persistKey: null, initialSource: "community",
sections: false, allowSourceToggle: false, sources: ["community"] })` and
`BrowsePanel` with the filter bar on, sidebar off, and the embedded toolbar
variant, exactly as `src/routes/test/gallery-redesign/+page.svelte` proves the
standalone mount. `engine.initialize()` on mount, `engine.destroy()` on
cleanup. The frame is a bounded product frame with a fixed height of
`min(80vh, 56rem)` and its own internal scroll, so the page never scrolls the
whole community pool.

`onSelect` navigates to `/sequence/{id}`, the real standalone viewer. This is
verified against a real public id during the pass. If that route fails for a
public id, the implementer reports the failure rather than mounting the drawer
host, which depends on URL state and app navigation.

Copy for the "keeping" beat changes because the carried sequence no longer
sits in the shelf:

- Heading stays: "Keep the sequence you made."
- Lede: "Guests keep three sequences on this device. A full account keeps a
  cloud library and collections. The gallery below is everyone's public work,
  with the same filters the app uses."

`ComposerGalleryShelf.svelte`, `composer-gallery-shelf-curation.ts`, and
`tests/unit/composer-gallery-shelf-curation.test.ts` are deleted.

## Out of scope

- The launchpad tile file still points at anchors that do not exist on the
  page. It has one importer, a test route. Left alone.
- No new sections, no closing summary, no roadmap material.

## Verification

Every beat gets the full viewport pass from
`.claude/rules/visual-verification-mandatory.md` on the worktree server, then
`npm run check` and the unit suite. Delivery is the integrated `main` route
opened in the in-app browser.
