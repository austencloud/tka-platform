# Touch drag-to-aim on the placement board — Handoff (2026-07-29)

> **RESOLVED 2026-07-29, commit `96b7057b52`.** H1 confirmed via raw CDP
> `Input.dispatchTouchEvent`: Chrome does not honour `touch-action: none` on
> the SVG hit circle — a real drag got a `pointercancel` ~20px in (implicit
> capture and all), prop placed, aim silently died. Fix: `touch-action: none`
> on the HTML `.grid-wrapper`. Verified through the real input pipeline:
> drag-north-from-North commits OUT to the parent + localStorage, tap+wobble
> leaves orientation alone, zero cancels. Loose end #2 done too: a
> `dispatchRealTouchDrag` vitest browser command (CDP touch via the playwright
> provider, `tests/helpers/browser-commands/real-touch.ts`) plus a regression
> test that fails with the fix reverted. Loose ends #3–#5 remain open. H2
> (feedback under the finger) and H3 (16px dead zone / no hysteresis) remain
> plausible polish items if the phone still feels imprecise — untestable in
> emulation, need a real fat finger.

## Mission

The Construct tab's **Build** path lets you place the two props on a grid and
aim each one by pressing a point and dragging: drag direction picks the prop's
orientation (IN / OUT / CLOCK / COUNTER). Design spec:
[`docs/superpowers/specs/2026-07-27-start-position-drag-to-aim-design.md`](./2026-07-27-start-position-drag-to-aim-design.md).

**It works correctly with a mouse and is unreliable on a real touch device.**
Austen, 2026-07-28: *"when I'm on my phone on the live website and I tap to
place a staff and then I try to drag as I have already tapped without having
lifted my finger from the screen it certainly does not allow me to change the
orientation in fact the orientation switching on my touch device is really
really buggy and is not really doing what it's supposed to do it works fine
with a mouse."*

Your job is to find out why and fix it. **The bug is in shipped code** — see
"What is live" below; this is not a stale-deploy artifact.

## What is live (checked 2026-07-29)

```
$ curl -s https://tkaflowarts.com/_app/version.json
{"version":"1785301512658"}          → 2026-07-29T05:05:12.658Z
```

All five commits below are ancestors of `origin/main` and predate that build
(`git merge-base --is-ancestor <sha> origin/main` → true for each; last of them
committed 2026-07-28T13:33:09-05:00, build stamped 2026-07-29T05:05Z). So the
phone Austen tested is running this code.

Caveat for later: the most recent `Deploy Pages (gated)` run
(`30444841805`, 2026-07-29T10:44:31Z) was **skipped** because Web App CI was
red, so anything pushed after `4a73fd73e9` is NOT live. See
`reference_prod_stale_deploy_publish_broken` memory — the gate fails silent.

## Done — verified

| # | Commit | What |
|---|---|---|
| 1 | `adb3eaf434` | Board sized from its host's real room; reserved control tray so it stops resizing mid-task |
| 2 | `c89788d1fe` | Prompt + tray share one reserved row on short hosts; picker turns sideways when wide-and-short |
| 3 | `77e2ee25a7` | One pointer owns the aim; drag watched on `window`; props renamed left/right with colour coding |
| 4 | `1b72e16a16` | Board-beside-controls fires on aspect ratio, not only on short hosts (4K) |
| 5 | `6efebae577` | Move/Undo controls relocated into the column beside the board |

Evidence captured at the time:

- **Direction correctness, 64/64.** Every grid point × 8 drag directions
  (4 exact + 4 off-axis by 25–35°) × 2 drag speeds, asserted against the
  orientation the cycler reports. Run in-page against
  `https://localhost:5173/create/construct` at 375×667.
  Result: `{total: 64, failCount: 0, fails: []}`.
- **Edge cases.** Tap with no movement commits no orientation; sub-dead-zone
  wobble commits none; drag-out-and-back holds the last aim; release far off
  the board still commits; 20 rapid taps never latch the board; a second
  pointer mid-drag is ignored and cannot place; `pointercancel` abandons the
  aim; a normal drag works immediately after a cancel.
- **No layout shift.** Board height measured across zero, one and two
  placements: `253 → 253 → 253` at 375×667; `285 → 285 → 285` at an earlier
  size. Previously `285 → 285 → 269`.
- **Component tests.** `npx vitest run --config
  tests/config/vitest.components.config.ts
  src/lib/shared/pictograph/grid/components/PropPlacementGrid.svelte.test.ts
  src/lib/features/create/construct/start-position-picker/components/StartPositionPicker.svelte.test.ts`
  → `Test Files 2 passed, Tests 4 passed`.
- **Unit tests.** `orientation-from-drag.test.ts` (11 cases) plus
  `tests/unit/create/` → `14 files, 66 tests passed`.
- **Typecheck.** `npm run check` → `0 errors, 5 warnings in 4 files`; grep for
  the four touched filenames in the log returns nothing (all warnings are other
  sessions' files).

### ⚠️ Read this before trusting any of the above

**Every one of those interaction results was produced with synthetic events**:

```js
el.dispatchEvent(new PointerEvent('pointerdown', {...pointerType: 'touch'}));
window.dispatchEvent(new PointerEvent('pointermove', {...}));
```

`dispatchEvent` injects an event object directly into the DOM event path. It
**bypasses the browser's real input pipeline entirely**, which means the suite
above could not possibly have caught this bug. Specifically, synthetic events:

- never trigger **scroll/gesture arbitration**, so they can never produce the
  `pointercancel` a real finger gets when the compositor decides the gesture is
  a pan;
- get no **implicit pointer capture** (real touch pointers are captured on the
  `pointerdown` target automatically);
- are **not subject to `touch-action`** at all;
- carry no coalesced/predicted move batching, no touch slop threshold, and a
  single ideal contact point rather than a ~40px contact patch.

So: the 64/64 result proves the *snap math and the state machine* are right. It
proves **nothing** about touch. Do not re-run that suite expecting it to
reproduce this; it will pass and tell you nothing. Reproduce on a real device or
with CDP `Input.dispatchTouchEvent` (which does go through the input pipeline —
the chrome-devtools MCP does not expose it, so use a raw CDP session).

## Believed done — unverified

- **The 4K / wide-screen layout** (commits 4 and 5) was verified by screenshot
  and measurement at 3840×2160, 2560×1440, 1920×1080, 1440×900, 820×1180,
  960×412 and 375×667 in emulation only. Never seen on physical hardware.
- **Austen's own 4K composition.** He accepted the side-by-side but flagged two
  open preferences (see Loose ends #5).
- **The Learn lesson grid** (`src/lib/features/learn/components/interactive/
  positions/PlacementGrid.svelte`) shares `PropPlacementGrid` and was reasoned
  about, not exercised. It passes `editAfterCompletion={false}` and no
  `onOrientationChange`, so `canAim` is false and the whole drag path is inert
  there — but nobody opened a positions lesson to confirm.

## In flight

Nothing of mine is uncommitted. `git status` at handoff time shows files from
**other concurrent sessions** — do not touch, do not commit:

```
 M docs/superpowers/specs/2026-07-28-notation-playable-archive-handoff.md
 M src/lib/features/browse/shared/components/BrowseModule.svelte
 M src/lib/features/creators/components/profile/stage/ProfileStage.svelte
 M src/lib/features/landing/services/infinite-sequence-generator.ts
 M src/lib/shared/animation-engine/services/sequence-chaining-orchestrator.ts
 M src/lib/shared/animation-engine/state/endless-playback-state.svelte.ts
 M src/lib/shared/navigation-coordinator/navigation-coordinator.svelte.ts
?? scripts/tmp-sort-field-presence.mjs
?? scripts/tmp-thumb-check.mjs
?? src/routes/test/notation-vtg-options/
?? static/images/notation/vtg/figures/
```

`npm run check` currently reports 3 errors on main from those sessions
(`src/lib/shared/transitions/view-transition-name-registry.ts:82`,
`src/routes/endless-spinner/+page.svelte:84` and `:145`). They are not yours
and they will **block the deploy gate** — see "What is live".

All work is on `main` in the primary checkout `E:/tka-platform`. No branches, no
worktrees.

## Loose ends (ranked)

### 1. Find the touch failure — instrument first, theorise second

Do not start from the hypotheses below. Start by getting ground truth off a real
device, because every hypothesis here is cheap to confirm or kill once you can
see the event stream and expensive to reason about without it.

Add a temporary DEV-only log of every pointer event the board sees — `type`,
`pointerId`, `pointerType`, `clientX/Y`, `isPrimary`, and for moves the distance
from the press origin — then reproduce on the phone and read it back. The
question that decides almost everything: **does `pointercancel` arrive?**

Reaching it on device: the dev server is HTTPS/2 on `:5173` bound
`--host 0.0.0.0`, so a phone on the same LAN can hit
`https://<machine-ip>:5173/create/construct` (accept the self-signed cert). Or
use `chrome://inspect` remote debugging over USB, which gets you the real
console.

Ranked hypotheses, with what argues for and against each:

**H1 — `pointercancel` from scroll/gesture arbitration.** `touch-action: none`
is declared on exactly one element, the SVG `<circle class="click-target">`
(`PropPlacementGrid.svelte:944`). Verified computed chain at 375×667:

| element | touch-action |
|---|---|
| `circle.click-target` | **none** |
| `g.click-targets` | auto |
| `svg.interaction-overlay` | auto |
| `div.grid-wrapper` | auto |
| …every ancestor up to `div.construct-scroll-area` | auto |

Per MDN the browser intersects `touch-action` from the touched element up to the
first containing scrolling element, so `none` on the circle *should* be
sufficient — but that note also says it is "typically applied only to top-level
elements", and `touch-action` on SVG **child** elements has a poor track record
across engines. Against H1: at 375×667 in emulation nothing in that chain was
actually scrollable (`document.scrollHeight === innerHeight`, body
`overscroll-behavior: none`). For H1: the ancestor is literally named
`construct-scroll-area` and will be scrollable in other states, on a real device
the URL bar resize changes the picture, and the symptom is a *perfect* match —
`pointerdown` places the prop, then the aim silently never happens, which is
exactly what a `pointercancel` right after press produces.
Fix if confirmed: move/duplicate `touch-action: none` onto `.grid-wrapper` (a
plain HTML div, unambiguously honoured) and/or the `<svg>` root.

**H2 — feedback is under the finger.** The aim ticks are drawn between 72 and
138 SVG units from the pressed point, on a `0 0 950 950` viewBox. On the phone
board measured at 253px that is **19px to 37px** from the contact point — i.e.
entirely beneath a fingertip. The live-previewing prop is centred on that same
point, also covered. So even when the code works perfectly the user sees
nothing happen, which reads exactly as "not really doing what it's supposed to".
This may be the *whole* complaint, or half of it, and it is independent of any
event bug. Fix direction: put the feedback where the finger is not — push the
ticks to a larger radius on touch, and/or surface the pending orientation as
text in the prompt row.

**H3 — dead zone is 16px on a phone.** `DRAG_AIM_DEAD_ZONE = 60`
(`orientation-from-drag.ts:25`) is in SVG units; 60/950 × 253px ≈ **16px** of
travel. Android's touch slop is around 8–16px, so the aim can arm from finger
jitter alone. Worse, past the dead zone the snap picks the nearest of four
directions, so a contact centroid wobbling near a 45° boundary flips between two
orientations — precise with a mouse, noisy with a fingertip. "Really buggy" fits
this exactly. Fix direction: scale the dead zone by `pointerType`, or express it
in physical px via the SVG↔screen ratio rather than in viewBox units, and add
hysteresis so an armed direction needs a larger angular excursion to switch away
than it took to acquire.

**H4 — the parent round-trip strands the preview.** The grid holds
`pendingOrientation` (its optimistic preview) until the parent's committed value
matches, cleared by the `$effect` at `PropPlacementGrid.svelte:~536`. The parent
path is `handleOrientationChange` → `onBlueOrientationChange` →
`await pickerState.setBlueOrientation()` → `persistPreferences()` (a
localStorage write). If that ever fails or lands a different value, the preview
holds forever. Lower likelihood — it would misbehave with a mouse too — but
worth a look because mobile Safari can throw on localStorage writes in some
storage states, which *would* be touch-only in practice.

**H5 — implicit capture interaction.** Commit 3 deliberately removed
`setPointerCapture` and moved move/up/cancel to `<svelte:window>`, on the
grounds that an up event delivered to a node no longer in the document is an up
event nobody hears. Real touch pointers get implicit capture on the press target
and retarget there, and those events still bubble to `window`, so this should be
fine — I rate it low. But we do not listen for `lostpointercapture`, and if that
fires, no `pointerup` ever arrives at all, `dragPointerId` stays set, and **the
board goes permanently dead until remount**. That failure mode is worth ruling
out explicitly because its symptom ("orientation switching just stops working")
is close to what Austen described.

### 2. Add a real touch regression test once the cause is known

The existing component tests use `vitest-browser-svelte` in Chromium; they can
drive real input through CDP rather than `dispatchEvent`. Lock whatever H\* turns
out to be true with a test that goes through the input pipeline — otherwise the
next agent's synthetic suite will "prove" it fixed again. Respect
`component-test-discipline.md`: this is a test-on-fix, exactly the case that rule
sanctions.

### 3. Direct manipulation — drag a placed prop to a different point

Austen asked for it (2026-07-28) and it is not built. Note the reposition path
*does* already exist as the Move left / Move right buttons; if that was not
obvious to him, the labelling is the bug. The design difficulty is that
drag-to-move collides with drag-to-aim — both are press-and-drag from the prop's
own point. Recommended disambiguation, not yet specced or approved: release
within roughly 70 SVG units of a *different* grid point → relocate there keeping
orientation; release anywhere else → aim. Neighbouring points sit ~150 units
apart and the aim ticks live at 72–138, so the two gestures are separable by
distance. Highlight the candidate destination as the finger approaches it.
**Invoke `superpowers:brainstorming` before speccing this** — the snap radius and
the feedback are where it lives or dies, and `brainstorming-gate.md` requires it.

### 4. The app shell does not ramp root font size at 4K

`4k-native-layout.md`'s lockstep root ramp is scoped to
`html:has(.mkt-shell)` and `html:has(.legal-container)` in `src/app.css` — the
app shell is not covered. So at 3840 every control in Construct stays 16px-based
and reads small next to a 1123px board. Bigger than this component; flagged
because it is the reason the right-hand control column still looks slight at 4K
after commit 5.

### 5. Two open preferences Austen named but did not settle

- The **Box** grid-mode toggle still spans the bottom rather than joining the
  right-hand column. It switches the grid for the Presets path too, so it was
  left as page-level chrome. He may want it moved.
- The right-hand control column is **vertically centred**, which leaves space
  above and below the four rows. Alternatives: top-align to the board's top
  edge, or spread the rows down the full height. Centred was chosen as the least
  arbitrary option; he called this out and did not pick.

## Decisions already made

Do not re-litigate these.

- **Left = blue, right = red, and the colour rides along with the word rather
  than replacing it.** Austen, 2026-07-28: *"change blue and red to left and
  right, and color code them like is our POLICY."* Policy is
  `.claude/rules/chip-primitives.md` → Blue/Red Prop Identity; the app already
  defaults this way (`MotionColorChips` uses `blueLabel = "Left"`,
  `redLabel = "Right"`). Prop colour is **identity, not selection state** — the
  Move buttons carry it before you touch them. The orientation cyclers keep the
  word in their accessible name only, because the whole control is already
  unmistakably one prop.
- **Learn's own nouns were deliberately left alone.** It passes `"blue hand"` /
  `"red hand"` explicitly; that is lesson copy, not this component's call.
- **The board gets the room, the buttons get their floor.** Austen, 2026-07-28,
  on the phone layout: *"way too much space for the buttons and way not enough
  space for the actual click and press section with the pictograph."* Every
  control row is at the 44/48px touch floor; the wins came from removing rows,
  not from shrinking controls below the floor.
- **Side-by-side at 4K, not stacked.** Austen, 2026-07-28: *"I feel like it's a
  little weird looking on my layout with a whole bunch of empty space behind it
  ... maybe we want to do a side by side layout instead."* Confirmed by
  screenshot: stacked produced a 1539px board with ~1150px of dead rail each
  side. Then: *"it could probably move more of the buttons to the right side."*
  Both are now built.
- **The board is capped past 2600px.** An uncapped side-by-side produced an
  1801px board. Past roughly 52vmin a bigger board is not a better target, just
  a bigger black field, and it starves the controls beside it.
- **`pointercancel` abandons the aim rather than committing it.** The system
  taking a gesture away is not a choice the person finished making. If H1 turns
  out to be the cause, the fix is to stop the cancel from happening, **not** to
  go back to committing on cancel.

## Gotchas

- **Synthetic pointer events cannot reproduce this.** Restated because it is the
  single most expensive thing to rediscover. See the boxed warning above.
- **Container queries report the CONTENT box.** The board-beside-controls rule
  needed its threshold lowered from `34rem` to `31rem` because
  `.position-builder`'s own horizontal padding comes off the number the query
  sees — at 34rem a 559px column still missed by 9px and the board silently
  stayed stacked. Any future threshold on that element has the same trap.
- **An element cannot be restyled by its own container query.** `container-type`
  and a `flex-direction` change on the same element means the descendant rules
  apply and the direction change is silently dropped. That is why
  `.position-builder` (the container) wraps `.builder-layout` (the flex parent).
  Diagnosed only by dumping computed styles; reasoning about it went in circles.
- **Flex containers discard whitespace-only anonymous items.** The tinted prop
  noun in the prompt rendered as "aim the**left prop**" — the space was in the
  DOM and `textContent` proved it, but the compact prompt is `display: flex` and
  dropped it. The sentence is wrapped in `.prompt-line` for that reason; do not
  unwrap it.
- **`--prop-blue` is `#2e3192`**, a deep navy — not the bright blue the staff
  renders as. Mixing it toward the body text colour produces a washed periwinkle
  that reads as *less* emphatic than the words around it. It is lifted toward
  white instead.
- **`cqh` resolves to 0 in a host with no definite height**, which collapsed the
  board to zero pixels — present in the DOM, unclickable. `.grid-area` carries a
  `min-height: 8rem` floor for exactly that. Two component tests caught it; if
  you see them fail on a sizing change, that is what they are telling you.
- **The layout mode is measured in JS on purpose.** `isRowLayout` in
  `BuildStartPosition.svelte` comes from `bind:clientWidth/clientHeight`, not
  from a container query, because it decides *where the Move/Undo controls
  render*, not only how things are arranged. Its thresholds
  (`>= 496px`, ratio `>= 1.25`) must stay in step with the stylesheet's row
  rule or controls will render in one column while the layout uses the other.
- **`PropPlacementChange` gained a `canUndo` field.** Three component-test
  assertions pin the exact payload shape, so adding a field breaks them. Also:
  after an Undo consumes the only history entry `canUndo` is `false` — that
  assertion is easy to write backwards, and the test suite is what caught it.
- **The composer's `/composer` demo auto-picks a start position on mount**, so
  you cannot reach the picker there normally. Defeat the attract loop by
  navigating with an `initScript` that stubs `window.setTimeout` for delays
  between 0 and 20000ms. Polling and MutationObserver takeovers both failed.
- **Reaching a true 3840 viewport** needs Chrome launched with
  `--force-device-scale-factor=1`, and this profile also applies a 0.9 page
  zoom, so `emulate` viewport values must be multiplied by 0.9 to land on the
  intended CSS size (1728×972 → a real 1920×1080). Always read back
  `innerWidth` to confirm.
- **`:5173` is Austen's dev server** on the primary checkout. Never `npm run
  dev`, never kill it; `curl`/navigate against it read-only, or start your own
  on a free port and reap it when done (`resource-budget.md`).

## Expert file

`.claude/rules/expert-routing.md` routes prop coordinate / orientation work to
`prop-positioning-expert`. This work did not change the positioning pipeline —
it consumes `PropRotAngleManager.calculateRotation` rather than altering it, and
`orientation-from-drag.ts` derives its snap targets from that same table
precisely so the two can never drift. No expert file needed updating. If a fix
here ends up changing how orientations are derived, that changes canon and the
expert file must be updated in the same turn.
