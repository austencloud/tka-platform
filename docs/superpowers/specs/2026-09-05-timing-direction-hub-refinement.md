# Timing and direction hub refinement

## Approved direction

Address the six findings from the September 5 hub audit. Retain the six article
routes and the historical archive. The public hub is a reference and article
directory with an immediate demonstration.

## Layout and interaction

- The six previews stay in the same two direction rows. Shared timing column
  headings replace repeated full mode names in narrow tiles.
- Each preview is a selection button, with a separate, always-visible article
  link. Selection has both a full outline and a check mark, plus aria-pressed.
- A permanent large player starts on Together-Same, beside the matrix on wide
  screens and below it on phones. Changing modes updates that player without
  moving or remounting the six previews. Its title and controls reserve space.
- Small previews are noninteractive animations without playback chrome. The
  large player owns scrubbing. Pause all remains labeled on phones.
- The heading is compact, the preview panels opaque, and the introductory copy
  identifies the two hands. Detailed notation stays in the existing articles.
- History includes direct 2002 community sources and Noel Yee's 2009 transition
  article, with links to the broader history and the VTG record.

## Ownership

Searched timing, direction, motion, player, progressBar, externalPlaying, and
interactive in the capability index and existing consumers. Closest owners:
TimingDirectionBoard, HandMotionPlayer, InlineAnimationPlayer, the hand-path
reference cards, and the article data.

Compose HandMotionPlayer in a route-local public presentation. It retains the
existing renderer, seek/playback implementation, visibility gating, sequence
transition handling, and canonical six sequences. Reuse PanelButton and the
shared reduced-motion preference. The lesson board's expanding study layout
remains owned by TimingDirectionBoard; the public directory needs stable rows
and native article links instead. No parallel renderer or timing definitions.

Visual verification also exposed blank canvases after resizing while paused.
CanvasLifecycleManager now requests a redraw after the asynchronous resize
finishes, guarded against a player being disposed in the meantime. Regression
tests cover both completion and disposal while pending.

## Verification

Inspect overview and changed selection at 375×667, 960×412, 820×1180, 1440×900,
1920×1080, 2560×1440, and 3840×2160. Check 200% zoom, reduced motion, keyboard
selection, reachable article links, global pause, and the large player's seek
bar. Check all six article routes, run existing article/data tests, formatting,
and the integration type gate. Do not add source-text rendering tests.

### Results

- Inspected all seven CSS viewport sizes, plus 720×450 reflow (the CSS space
  available on a 1440×900 display at 200% zoom). No horizontal page overflow.
- Six native article links remain present and labeled at every size; each has
  a 44px CSS minimum height. All six article routes returned HTTP 200, and the
  Quarter-Same article opened through the visible link.
- The previews expose no seek sliders. The large player exposes one: pointer
  seeking reached 50%, Home reached 0%, and ArrowRight advanced to 25%.
- Keyboard selection updated the large player, and narrow-screen selection
  moved focus to its heading. The two comparison rows retained their order.
- Reduced-motion first load paused the players. A paused resize retained the
  hands after the redraw fix; no browser errors were logged in the inspected
  runtime.
- Eighteen focused tests passed across article data, canonical hand-path cards,
  resize observation, and lifecycle completion/disposal. Both changed Svelte
  components compiled without warnings. Integration runs the full type gate.
