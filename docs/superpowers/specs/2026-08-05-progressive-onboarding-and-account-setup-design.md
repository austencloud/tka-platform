# Progressive Onboarding and Account Setup

**Date:** 2026-08-05
**Status:** Approved
**Owner:** Austen Cloud

## Problem

Flow Arts Composer currently asks new users to start the Construct guide in a
full-screen modal before they can use the workspace. Full-screen account setup
can also appear before the application. Both surfaces interrupt the reason the
person opened the app.

The current alternative is incomplete. Profile photo and favorite prop nudges
live in the desktop account popover, so mobile users do not see them, progress
is not durable, and there is no single place that explains what remains.

## Outcome

Open directly into the application. Learning and account completion remain
easy to find, but neither blocks the workspace.

Account setup becomes a durable four-step checklist:

1. Add a display name.
2. Add a profile photo.
3. Choose a favorite prop.
4. Choose a theme.

The checklist lives in Profile settings on every viewport. The desktop account
popover shows a compact progress summary. Construct offers its guide inline in
the empty workspace, and the existing replay control remains in Preferences.

## Interaction Model

### First entry

- Do not mount `AccountSetupWizard` automatically.
- Do not mount `TutorialPrompt` automatically.
- Do not replace either with another launch-time overlay.
- Preserve the existing Construct tutorial itself and its explicit replay path.

### Construct guide

When Construct is empty and the tutorial is not active, show a small inline
card beside the start-position prompt. It has two actions:

- **Show guide** starts the existing Construct tutorial.
- **Not now** dismisses the inline offer without completing or skipping the
  account checklist.

The guide is product learning, not account data. It does not affect the setup
progress bar.

The feature-flagged guest first-save account prompt also uses an actionable
toast. Enabling that rollout must not reintroduce a modal after the first value
moment.

### Account setup surfaces

Profile settings owns the complete checklist. Each row shows completion state
and takes the person to the existing editor for that field. The progress bar
reserves its final width so completion never shifts surrounding layout.

The desktop account popover shows the same completed count and a single
**Finish setup** action. It does not duplicate the four editors.

### Reminder

The checklist is the system of record. A toast is only a doorway back to it.

An automatic reminder may be requested after an intentional Construct action,
not on application launch. The reminder:

- waits until the existing toast queue is clear;
- uses a polite live-region announcement;
- appears at most once per browser session;
- is suppressed while setup is complete or still loading;
- snoozes for seven days when closed or allowed to expire;
- stops automatically after two dismissals; and
- does not count opening Profile settings as a dismissal.

The message states the current count, for example, `Finish setup: 2 of 4 done`.
Its action is **Open profile**.

## State and Persistence

Create account-setup state with the project factory-and-context pattern. The
state factory receives persistence and prop-loading dependencies. Components
consume it through application context.

Task completion comes from canonical user data:

| Task          | Completion source                                            |
| ------------- | ------------------------------------------------------------ |
| Display name  | Auth profile `displayName`, trimmed and non-empty            |
| Profile photo | Auth profile `photoURL`, trimmed and non-empty               |
| Favorite prop | Community prop preference `favoriteProp` or `favoriteCatdog` |
| Theme         | Explicit theme selection marker                              |

Theme settings have a default value, so the current theme cannot prove that a
person made a choice. Store an explicit marker instead. The persisted
`backgroundChosenAt` field keeps its existing name for compatibility.

Extend the existing onboarding status document and local fallback with:

```ts
accountSetup: {
  backgroundChosenAt: string | null;
  reminderDismissals: number;
  reminderSnoozedUntil: string | null;
}
```

Cloud/local merges keep the explicit theme choice, the highest dismissal
count, and the latest snooze time. Existing onboarding documents normalize to
the default structure without migration work.

## Accessibility

- No focus trap or inert application content is introduced.
- Checklist actions use native buttons.
- Completion icons have text equivalents.
- Progress exposes `aria-valuemin`, `aria-valuemax`, and `aria-valuenow`.
- The reminder toast uses `role="status"` and `aria-live="polite"`.
- Essential text remains at least 14px; supporting text remains at least 12px.
- Reduced-motion preferences disable decorative transitions.

## Files and Systems

- Application entry orchestration in `MainApplication.svelte`
- Construct entry in `CreateModule.svelte` and Construct child components
- Onboarding persistence and account-setup state/context
- Profile settings, Theme settings, My Props, and desktop account popover
- Toast state and container dismissal semantics
- Focused unit tests for state transitions, persistence normalization, merge
  policy, and toast dismissal callbacks

The old prompt and wizard components may remain temporarily for isolated admin
previews or test fixtures, but production application entry no longer mounts
them.

## Risks

- Auth profile updates may arrive after a settings save. Account-setup state
  therefore reads identity fields reactively and exposes a focused refresh for
  prop preferences.
- Existing onboarding documents lack `accountSetup`. All reads normalize
  unknown or partial data before use.
- A reminder could compete with another toast. The coordinator waits for an
  empty queue and drops the request when policy no longer permits it.
- A default theme could be mistaken for an explicit choice. Only the new
  marker completes that task.

## Verification

1. Focused unit tests for account-setup state, persistence merge behavior, and
   toast dismissal versus action behavior.
2. Targeted TypeScript/Svelte check output for touched files, followed by the
   repository check once focused failures are clear.
3. Runtime verification that a fresh profile enters the app without either
   full-screen onboarding surface.
4. Visual screenshots at 1920×1080, 2560×1440, 3840×2160, 1440×900,
   820×1180, 960×412, and 375×667 for Profile settings, the desktop account
   popover where applicable, and the empty Construct offer.
5. Interaction proof that closing the toast snoozes it, opening Profile does
   not increment dismissals, and all four completed tasks remove setup prompts.

## First-Visit Simulator

`/test/onboarding-first-visit` provides a safe walkthrough of the approved
experience. It keeps identity and setup progress inside the page, never writes
to the signed-in account, and reuses the production Construct guide offer,
account checklist, buttons, transitions, and toast container.

The walkthrough covers direct entry, the optional guide branch, the first
intentional Construct action, the delayed reminder, and all four account tasks.
It also explains the product rule behind each moment so the pacing can be
reviewed without resetting a real account.
