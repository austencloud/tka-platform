# VisualSpinner3D Software History Page — Handoff (2026-08-31)

## Mission

Give the agent redesigning `/roots/software` a source-audited account of
VisualSpinner3D, along with replacement copy and media guidance that fit the
approved Flow Arts Software History Redesign. Its in-flight spec is
`E:/tka-platform-software-history-redesign/docs/superpowers/specs/active/2026-08-31-flow-arts-software-history-redesign.md`.
This is a research handoff, not a second implementation of the page.

## Done — verified

- **Upstream source downloaded and pinned.** Research clone:
  `E:/visual-spinner-3d`. Upstream source SHA:
  `6bda9172c14404da45d3eaca5cb7a24ee637c839`. Evidence:
  `git -C E:/visual-spinner-3d rev-parse HEAD` and
  `git -C E:/visual-spinner-3d ls-remote origin HEAD` returned the same SHA;
  `git status --short --branch` returned clean `master...origin/master`.
- **Project dates established from Git history.** Source SHA:
  `6bda9172c14404da45d3eaca5cb7a24ee637c839`. Evidence:
  `git log --reverse` begins with `e8a44f592faa71a150a3a3d9f1d82cd6f6f8b8a3`
  on 2014-04-06. The latest commit is the pinned SHA on 2023-04-12. The
  repository therefore supports “published in 2014” and “last updated in
  2023.” It does not support “still maintained.”
- **Engine behavior traced to source.** Source SHA:
  `6bda9172c14404da45d3eaca5cb7a24ee637c839`. The active path is
  `index.html` or `demo.html` → `VS3D.Player` → `PropWrapper.refit()` → move
  recipes and fitting → `spin()` → `ThreeRenderer.render()`. The core files are
  `E:/visual-spinner-3d/scripts/vs3d.js`, `vs3d-moves.js`, and
  `vs3d-render.js`.
- **Core model audited.** Source SHA:
  `6bda9172c14404da45d3eaca5cb7a24ee637c839`. A prop is a six-node
  articulated chain: body, pivot, helper, hand, grip, and head. Moves can set
  node radius and angles, angular or linear motion, acceleration, arbitrary
  plane vectors, bend, twist, beats, and continuity with adjacent moves. The
  bundled recipes include flowers, isolations, pendulums, C-CAPs, snakes, and
  toroids. This is a kinematic authoring model, not a physics simulation.
- **Public demo controls audited.** Source SHA:
  `6bda9172c14404da45d3eaca5cb7a24ee637c839`. `demo.html` creates four props
  and gives each one selectors for model, plane, entry angle, orientation,
  spin direction, and move. The underlying `Player.addProp()` path is not
  limited to four. The existing redesign copy saying “each hand” and “the two
  animated paths” is inaccurate.
- **Experimental editor audited.** Source SHA:
  `6bda9172c14404da45d3eaca5cb7a24ee637c839`. `react-vs3d.html` loads an
  unfinished React/Redux editor that can edit node values, queue moves, add or
  remove props, import/export JSON, scrub playback, and attach YouTube or local
  MP4 reference timing. Present this as an experiment, not a polished shipped
  application.
- **Core runtime smoke-tested.** Source SHA:
  `6bda9172c14404da45d3eaca5cb7a24ee637c839`. Node 24.8.0 parsed all three
  active core scripts. Executing a four-beat antispin flower through the core
  engine produced 90 ticks per beat, 360 total ticks, and different hand/head
  poses at the start and midpoint.
- **Live status checked.** Source SHA:
  `6bda9172c14404da45d3eaca5cb7a24ee637c839`. On 2026-08-31, the project
  homepage, `demo.html`, and `react-vs3d.html` each returned HTTP 200. This
  proves the pages remain hosted, not that they remain actively maintained.
- **Current redesign inspected without modification.** TKA branch head at the
  time of inspection: `8b7c2b13a43587c805627a67b9734179387fbf94` on
  `codex/software-history-redesign`. The VisualSpinner entry is currently in
  `src/routes/(public)/roots/software/+page.svelte` around lines 484–531. Its
  current media is `static/roots/software/visualspinner3d.webp`, a 1734×917
  capture of the blue project homepage and embedded renderer. It does not show
  the four-column demo controls.

## Believed done — unverified

- The replacement copy below has been checked against the cloned source and
  Git history, but it has not been inserted or rendered in the redesign.
- The live demo and editor returned HTTP 200, but this research session did not
  take control of the browser or perform an interactive visual pass. Capture
  new documentary images only after the redesign agent confirms the pages
  render correctly in its task-owned browser tab.
- The experimental editor is substantial enough to mention in an expanded
  gallery caption, but its age and runtime CDN dependencies may make it less
  reliable than the main demo. Verify it before making it a primary image.

## In flight

- The implementation lives in `E:/tka-platform-software-history-redesign` on
  `codex/software-history-redesign`. At the 2026-08-31 inspection it had
  uncommitted changes to the route, route-local components, submission form and
  API, Firestore rules/tests, shared header/footer, rate limiting, and Wrangler
  configuration. Do not edit that worktree from another task.
- This handoff owns only
  `docs/superpowers/specs/2026-08-31-visualspinner-software-page-handoff.md`.
  It does not modify the page or the other agent's active spec.
- The standalone research clone remains at `E:/visual-spinner-3d`, clean on
  upstream `master`, for source inspection by the redesign agent.

## Loose ends (ranked)

1. **Correct the VisualSpinner entry.** Replace the unsupported “still
   maintains it” claim and the incorrect two-hand description. Recommended
   public copy:

   > Glenn Wright’s VisualSpinner3D put a general-purpose prop simulator in the
   > browser. The demo exposes four independent prop lanes. Each can choose a
   > prop model, motion plane, entry angle, orientation, spin direction, and
   > move, then the 3D view animates them together.
   >
   > Under that interface is a more open-ended engine. It represents each prop
   > as an articulated chain, fits one move into the next, and supports flowers,
   > isolations, pendulums, C-CAPs, snakes, toroids, bend, twist, and arbitrary
   > motion planes. The GitHub history begins in April 2014. Its last commit was
   > April 2023, and the live demo remains online.

   Optional technical closing sentence:

   > The model is kinematic: it draws authored paths rather than simulating
   > forces, collisions, or the limits of a human body.

2. **Use a more informative primary image.** The existing capture documents
   the project homepage, but most of the frame is empty blue page. Prefer a
   current capture of `demo.html` that shows both the four control lanes and
   the rendered props. Keep the old capture as a secondary archival image if
   the gallery benefits from showing the original site design. Suggested
   captions: “VisualSpinner3D demo with four independently configured props”
   and “VisualSpinner3D project page with its embedded renderer.”
3. **Choose an honest period label.** Recommended:
   `Browser simulator · published 2014 · last updated 2023`. If that is too
   long for the era component, use `Browser simulator · published 2014` and
   retain the last-commit date in the prose.
4. **Consider one secondary editor image.** If `react-vs3d.html` survives an
   interactive pass, it demonstrates that the project went beyond canned
   patterns into raw motion authoring, move queues, JSON, and reference-video
   timing. Label it “Experimental VisualSpinner3D move editor” so the page does
   not imply product-level polish.
5. **Keep the historical distinction clear.** VisualSpinner3D was not a TKA
   notation engine and should not be framed as an ancestor of Composer's
   notation stack. Its historical contribution was a permissive,
   browser-native kinematic engine. Composer is notation-first and connects
   movement to pictographs, teaching, saving, sharing, avatars, effects, and
   production export.

## Decisions already made

- On 2026-08-31, Austen asked for this repository audit to be turned into a
  handoff for the agent already updating and beautifying the Flow Arts Software
  page. This task supplies evidence and copy; it does not take ownership of the
  redesign.
- The active redesign spec says to preserve researched claims, keep outbound
  credits, avoid unverified dates, and keep route-specific presentation inside
  route-local components. The corrections above follow those guardrails.
- Do not create a second renderer or port VisualSpinner3D into TKA as part of
  this page work. The relevant outcome here is accurate historical coverage.

## Gotchas

- **GPL boundary:** the repository is still GPLv3. TKA's application layer is
  Elastic License 2.0 with separate MIT packages. Do not copy code, recipes, or
  implementation details into TKA. Treat the clone as historical and
  behavioral research unless separate licensing is obtained.
- **The old licensing explanation is inaccurate:** `index.html` says GPL means
  a program incorporating the engine cannot be sold. GPL does allow commercial
  distribution, subject to its source and licensing obligations. Avoid
  repeating the project's wording on the public page.
- **Known rendering defect:** the project page reports incorrect rendering for
  some plane-bent toroids using flat-symmetry props such as hoops and fans.
  Do not describe the simulator as physically accurate or complete.
- **Four is a demo choice, not an engine limit:** `demo.html` creates four
  props. The engine's `Player` accepts arbitrary props. Avoid both “two hands”
  and “limited to four props.”
- **Hosted is not maintained:** the last commit is 2023-04-12. Say the live
  demo remains online; do not say the author still maintains it without a
  newer primary source.
- **Current screenshot is not the main demo:**
  `visualspinner3d.webp` shows the project homepage and embedded renderer. Its
  existing alt text calls it a browser-simulator screenshot, which is broadly
  true but does not tell readers that it omits the actual demo controls.
- **VisualSpinner is not a physics engine:** authored props can pass through
  one another or occupy physically implausible positions. Its value is motion
  parameterization and visualization.

## Primary sources

- Repository: <https://github.com/infiniteperplexity/visual-spinner-3d>
- Live project: <https://infiniteperplexity.github.io/visual-spinner-3d/>
- Main demo: <https://infiniteperplexity.github.io/visual-spinner-3d/demo.html>
- Experimental editor:
  <https://infiniteperplexity.github.io/visual-spinner-3d/react-vs3d.html>
- Local core engine: `E:/visual-spinner-3d/scripts/vs3d.js`
- Local recipes: `E:/visual-spinner-3d/scripts/vs3d-moves.js`
- Local renderer: `E:/visual-spinner-3d/scripts/vs3d-render.js`
- License: `E:/visual-spinner-3d/LICENSE.txt`
