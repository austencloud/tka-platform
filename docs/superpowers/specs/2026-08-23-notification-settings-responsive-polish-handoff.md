# Notification Settings Responsive Polish Handoff

## Mission

Take ownership of feedback `F4vf4hSnNHqJiqGzdIxf` and finish the notification
settings page to a genuinely polished, app-native standard at every supported
screen size and in every theme.

Austen's instruction is to use your own visual judgment. The current redesign is
a strong functional and architectural floor, not a visual ceiling. Inspect it in
the browser, make it feel intentional at desktop, 4K, tablet, landscape mobile,
and narrow mobile sizes, and keep iterating until the hierarchy, density,
contrast, rhythm, and state communication all feel at home in Flow Arts
Composer.

The governing design spec is
[`2026-08-21-notification-delivery-preferences-design.md`](active/2026-08-21-notification-delivery-preferences-design.md).
The feedback item is currently `in-review` in Firestore.

## Done - verified

All work below is **uncommitted in the shared working tree** on `main`, based on
commit `fca6c4a2b7` (`docs: hand off tunnel creator phase one`). There is no
feature commit SHA yet.

### The page has been redesigned around the app's canonical interaction language

- Independent binary notification preferences use a full-row, visibly labeled
  `On`/`Off` control instead of an iOS track-and-thumb toggle.
- The underlying control keeps native switch semantics (`role="switch"` and
  `aria-checked`) because the settings are independent booleans.
- The whole preference row is the target, with a filled accent mark and tinted
  surface for `On`, and a neutral outlined mark and transparent surface for
  `Off`.
- Push setup remains an action/status control because it has more than two real
  states: `Set up`, `Retry`, `Blocked`, `Unavailable`, `On`, and `Off`.
- Email delivery is a binary switch. Email topics remain unavailable until the
  email channel is enabled.
- The page uses the shared `SettingToggleButton` owner. The 3D Planes popover was
  migrated to that owner so the repository does not retain competing switch
  implementations.

Evidence:

- Focused component suite: 6 tests passed in
  `NotificationPreferencesPanel.svelte.test.ts`.
- Notification state/unit suites: 10 tests passed across 3 files.
- Runtime inspection found 16 switches, zero checkboxes, a 68 px minimum switch
  height, no horizontal overflow, and a 12 px minimum rendered text size on
  mobile.
- Accessibility regression tests cover switch semantics, the non-admin view,
  email-topic gating, push setup states, and heading stability during loading.

### Loading no longer shifts the page heading

- The outer page grid now anchors content with `align-content: start`.
- Loading and loaded states use the same heading geometry.
- A component regression test defers preference loading, measures the heading
  before and after resolution, and allows no more than a 1 px delta.
- Runtime measurement on the real page recorded an H1 top of `64.44 px` during
  loading and `64.44 px` after loading: delta `0`.
- The 4K layout uses a deliberate responsive top inset rather than accidental
  centering.

### On and off states have been strengthened without changing layout

- Active rows use a stronger accent-tinted background and border.
- Active state marks use a filled accent treatment with the theme's
  text-on-accent color.
- Off rows stay neutral with an outlined mark.
- Runtime comparison of `Feedback Resolved` (on) and `Being Worked On` (off)
  confirmed `aria-checked` values of `true` and `false`, distinct surfaces and
  marks, equal 68 px heights, and zero layout delta.

### The current active theme has passed the required viewport sweep

Chrome DevTools emulation was checked at:

- `1920x1080`
- `2560x1440`
- `3840x2160`
- `1440x900`
- `820x1180`
- `960x412`
- `375x667`

No tested viewport had horizontal overflow. Recorded heading positions after the
latest spacing pass were:

| Viewport  | Heading top | Horizontal overflow |
| --------- | ----------: | ------------------: |
| 2560x1440 |   159.35 px |                0 px |
| 3840x2160 |   207.96 px |                0 px |
| 1440x900  |    53.02 px |                0 px |
| 820x1180  |    43.38 px |                0 px |
| 960x412   |    37.58 px |                0 px |
| 375x667   |       26 px |                0 px |

Lighthouse on the mobile snapshot scored Accessibility 100, Best Practices 100,
and SEO 100. The task-owned tab had no console warnings or errors.

Ephemeral full-page screenshots from that pass are in:

- `C:\Users\Austen\AppData\Local\Temp\tka-notifications-polish\notifications-1920-on-off.webp`
- `C:\Users\Austen\AppData\Local\Temp\tka-notifications-polish\notifications-2560x1440.webp`
- `C:\Users\Austen\AppData\Local\Temp\tka-notifications-polish\notifications-3840x2160.webp`
- `C:\Users\Austen\AppData\Local\Temp\tka-notifications-polish\notifications-1440x900.webp`
- `C:\Users\Austen\AppData\Local\Temp\tka-notifications-polish\notifications-820x1180.webp`
- `C:\Users\Austen\AppData\Local\Temp\tka-notifications-polish\notifications-960x412.webp`
- `C:\Users\Austen\AppData\Local\Temp\tka-notifications-polish\notifications-375x667.webp`

These are temporary evidence and may be cleaned by Windows. Generate fresh
screenshots for the final visual pass.

### Independent audit found no open implementation violations

The post-redesign audit graded Architecture, Code Quality, Accessibility, UX
States, UI Consistency, Performance, and Security at A+. Its only visual note
was that email-topic cards become narrow and wrap at tablet width, though they
remain readable and tappable. The latest contrast and heading-stability changes
were applied after that audit and verified directly.

### Formatting and scoped source checks passed

- Prettier passed for the notification files.
- `git diff --check` passed for the notification files.
- Vite transformed both `SettingToggleButton.svelte` and
  `NotificationPreferencesPanel.svelte` successfully with HTTP 200 responses.

## Believed done - unverified

- The new token-based contrast should travel well across themes, but the final
  active-versus-inactive distinction has only been visually inspected in the
  theme Austen showed. A full theme sweep is still required.
- The responsive rules are structurally sound across the seven required
  viewports, but Austen has explicitly delegated final aesthetic judgment. Do
  not treat the existing screenshots as design approval.
- The delivery preference persistence and push-state wiring were covered by
  focused tests and existing runtime behavior, but no real notification was
  sent as part of the visual redesign pass.
- `messages/en.json` contains the revised notification copy, but it is a shared,
  already-dirty file. Inspect the scoped diff before editing or committing so
  unrelated work is not included.

## In flight

The notification redesign is present in the working tree in these paths:

- `src/lib/features/feedback/components/NotificationPreferencesPanel.svelte`
- `src/lib/features/feedback/components/NotificationPreferencesPanel.svelte.test.ts`
- `src/lib/features/feedback/components/notifications/NotificationChannelCard.svelte`
- `src/lib/features/feedback/components/notifications/NotificationDeliverySection.svelte`
- `src/lib/features/feedback/components/notifications/PreferenceGroup.svelte`
- `src/lib/features/feedback/components/notifications/PreferenceItemCard.svelte`
- `src/lib/shared/settings/components/SettingToggleButton.svelte` (new/untracked)
- `src/lib/shared/3d/components/PlanesPopover.svelte`
- `messages/en.json`
- `docs/superpowers/specs/active/2026-08-21-notification-delivery-preferences-design.md`

At handoff, the scoped diff was 619 insertions and 444 deletions across the
tracked files, plus the new shared toggle component. The rest of the repository
is also dirty from parallel sessions. Preserve all unrelated work.

## Loose ends, ranked

### 1. Do the final visual design pass with your own judgment

Open the real page and inspect it at full resolution. Refine whatever prevents
it from feeling cohesive with the rest of the app: content hierarchy, spacing,
surface treatment, group rhythm, typography, card density, visual focus, and
the balance between delivery-method controls and individual alert types.

Pay particular attention to:

- whether `On` and `Off` remain immediately distinguishable in every theme;
- whether the tablet email-topic layout should remain a wrapped card grid or
  become a more deliberate stack;
- whether the 4K vertical placement feels composed rather than merely safe;
- whether landscape mobile remains dense but calm;
- whether narrow mobile preserves clear grouping deep into the long page;
- whether admin-only preferences visually overwhelm normal-user preferences.

You have permission to change the visual composition with your own judgment,
provided the behavioral and architectural decisions below remain intact.

### 2. Run a real theme sweep

The latest user concern may be theme-specific. Test all canonical app themes at
representative desktop and mobile sizes. Confirm state differentiation through
more than hue alone: text, mark fill, border, and surface should work together.
Keep contrast accessible and preserve identical geometry between states.

### 3. Re-verify loading and asynchronous states after visual changes

The heading must not jump when preferences resolve. Do not hide geometry changes
with animation. If motion is added, use the canonical motion/crossfade primitive,
respect reduced-motion preferences, and keep the measured layout stable.

Exercise push states and the disabled email-topic state. Loading, failure, and
permission-blocked views must look intentional at all widths.

### 4. Repeat the complete visual and focused verification loop

Use the repository's shared debug Chrome launcher and a task-owned background
tab. Recheck all seven required viewport sizes, console output, horizontal
overflow, touch targets, text sizes, switch semantics, and loading stability.
Capture fresh screenshots. Run the focused component and notification unit
suites again after the final CSS/component changes.

The last known passing commands were:

```powershell
pnpm exec vitest run --config tests/config/vitest.components.config.ts src/lib/features/feedback/components/NotificationPreferencesPanel.svelte.test.ts

pnpm exec vitest run --config tests/config/vitest.config.ts tests/unit/feedback/notification-preferences-manager.test.ts tests/unit/feedback/notification-preference-group.test.ts tests/unit/push/fcm-token-manager-state.test.ts
```

Repository-wide `pnpm run check:fast` is not green: the last run reported 382
pre-existing diagnostics, none in the scoped notification files. Do not claim a
globally green check unless that repository baseline has changed.

### 5. Keep the feedback lifecycle accurate

The Firestore document `feedback/F4vf4hSnNHqJiqGzdIxf` is currently
`in-review`. Leave it there until Austen accepts the result. Follow the `done`
workflow only after approval.

## Decisions already made

- **Do not restore an iOS track-and-thumb toggle.** Austen called out that visual
  language specifically. The semantic switch pattern is correct; the visual
  expression must be Flow Arts Composer's.
- **Keep one shared behavior owner.** `SettingToggleButton.svelte` owns this
  app-wide binary setting treatment. Extend it if needed. Do not fork another
  local switch implementation.
- **Keep switch semantics for binary preferences.** Retain keyboard behavior,
  `role="switch"`, `aria-checked`, visible state text, and a whole-row target.
- **Keep push multistate.** Push registration is not a boolean before setup, so
  it must not be forced into the same binary control as email.
- **Keep loading geometry stable.** The heading and content origin must not move
  when asynchronous preferences resolve.
- **Use canonical theme tokens.** Do not hardcode a dark-theme surface to match
  the supplied screenshot.
- **Keep essential type at least 14 px and supplemental type at least 12 px.**
  Interactive targets must remain at least 44 px; current rows are 68 px.
- **Do not mutate Austen's live notification preferences for visual comparison.**
  Use existing differing states, component fixtures, or a DOM-only simulation.
- **System announcements remain mandatory.** They can be explained but not
  disabled.
- **Admin-only notification preferences remain conditional.** The non-admin
  component test must continue to prove they are absent for ordinary users.

## Gotchas

- Work on the existing `main` checkout. Do not create a branch or worktree unless
  Austen explicitly asks for one.
- The git index and working tree are shared with parallel sessions. Never use
  `git add -A`, `git add .`, a bare `git commit`, or a broad revert. Scope every
  commit to explicit paths and inspect `messages/en.json` carefully.
- Port 5173 is Austen's HTTPS/2 development server. Never start, stop, restart,
  or kill it. Use `https://localhost:5173/settings/notifications`.
- Browser verification must use `scripts/launch-chrome-debug.ps1`, the persistent
  shared Chrome process, and a task-owned tab. Use per-page emulation, then clear
  emulation and close only your tab.
- The signed-in runtime account is an admin, so the live page includes the Admin
  Notifications group. Do not mistake that for ordinary-user behavior.
- Do not convert preference cards into checkboxes. The app's `no-checkboxes`
  rule applies, and these controls represent immediate settings rather than a
  pending form submission.
- Do not duplicate existing primitives or hand-roll a parallel interaction
  owner. Search by behavior before introducing any new component.
- The screenshot flower/background imagery is environmental and can produce
  unrelated network noise. Judge the notification surface itself and check the
  console for new errors caused by your changes.
- The feedback status transition helper rejected an attempted `in-review` to
  `in-review` update. Do not retry a no-op status transition.

## Definition of done

The handoff is complete when the page looks deliberately composed in every
canonical theme at all seven required viewports, `On` and `Off` are unmistakable
without relying on hue alone, loading produces no heading shift, all interactive
states remain accessible and truthful, the focused tests pass, fresh browser
evidence shows no overflow or console regressions, and Austen has a result ready
for review.
