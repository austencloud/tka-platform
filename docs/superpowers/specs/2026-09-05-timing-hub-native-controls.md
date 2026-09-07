# Timing hub: native controls and synchronized playback

## Scope

Make the public timing hub feel like Composer: compact sans-serif hierarchy,
panel-style navigation, restrained element color, and a single playback clock.
Keep the six-mode comparison, readable articles, sources, mobile detail focus,
keyboard scrubbing, and reduced-motion behavior.

## Existing owners

- **Selection and responsive layout:** keep `TimingDirectionAtlas` and its fixed
  two-row grid. Keep native preview buttons and their pressed/check states.
- **Navigation:** extend `PanelButton` with native `href` support. Links retain
  modifier-click and open-in-new-tab behavior. Article, source, and related-page
  links reuse it instead of introducing a separate button-looking-link primitive.
- **Color:** compose the Create front door's whole-surface domain tint and full
  perimeter border using the canonical element colors. Keep theme contrast tokens.
- **Typography:** use the application sans stack; remove the editorial stylesheet
  from this interactive hub. The article pages retain their editorial styling.
- **Playback and input:** extend `InlineAnimationPlayer` with an external step
  source and seek forwarding, passed through `HandMotionPlayer`. Reuse
  `AnimationPlaybackController.calculateStateForStep` for exact sampling.
- **Clock lifecycle:** the first preview keeps its existing `AnimationLoop`.
  Its activity gate covers the whole board, so scrolling the clock preview off
  screen does not freeze the large player. Other players sample its fractional
  step without running their own playback clocks. Mode selection never replaces
  the clock. The large player's existing scrubber seeks that clock and pauses /
  resumes the group using the existing playback intent.
- **Motion:** preserve fixed media geometry and existing reduced-motion behavior.
  Use shared transition tokens for tint/outline changes; no decorative edge rails.

Discovery searched `href`, `navigation`, `PanelButton`, `externalStep`,
`onStepChange`, `onSeekRef`, `calculateStateForStep`, and `RenderActivityGate`.
Closest consumers inspected: `CreateFrontDoor` and `TimingDirectionBoard`.

## Verification

- Svelte compilation of the changed public components and shared controls:
  no warnings.
- Focused regression coverage checks exact fractional sampling, sequence reload,
  no follower clock, and isolation from the workspace playhead.
- 33 focused tests passed across article metadata, canvas lifecycle, playback
  ownership/sampling, and render-activity gating. Full Svelte check passed with
  zero errors and zero warnings.
- Browser checks must cover mode changes, group play/pause, scrubbing, mobile
  scroll-away from the clock preview, link destinations, and reduced motion.
- Shared-control and source-row geometry changes require all seven viewports.

Browser inspection and guarded integration remain pending while other tasks
occupy the agent preview-server budget.
