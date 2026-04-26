---
status: backlog
value: 3
effort: M
remaining: Full build — user profile screen
depends_on: ""
plan_path: plans/backlog/2026-03-19-profile-screen.md
tags: []
last_triaged: 2026-04-26
---
# Profile Screen: Separate Identity from Account Plumbing

**Date:** 2026-03-19
**Status:** Design

---

## Problem

The Settings module has 9 tabs, and Profile is one of them. Profile currently contains two distinct concerns mashed together:

1. **Identity** — avatar, display name, pronouns, favorite prop. The things that represent *you*.
2. **Account plumbing** — security (MFA), connected accounts, storage/cache, password management, subscription, danger zone (account deletion).

On mobile, the avatar/name row in the module switcher drawer is static and untappable. To edit your identity, you open the switcher, tap Settings, then navigate to the Profile tab via bottom nav. That's two hops with a tab hunt in between.

On desktop, the AccountPopover shows nudges ("Add a profile photo", "Pick your favorite prop") that deep-link to Settings > Profile. But the Profile tab itself buries identity under account cards.

## Solution

Extract identity into a **focused Profile screen** accessible directly from the module switcher. Keep account plumbing in Settings under a renamed "Account" tab.

---

## Profile Screen

### What it is

A single-screen overlay, not a full module. No tabs, no sub-navigation. Opens as a drawer/panel from the module switcher (mobile) or from the account popover (desktop).

### Trigger

- **Mobile:** Tap the avatar/name row in the module switcher drawer footer. Only when authenticated — when unauthenticated, the row shows "Sign In" and tapping triggers the sign-in flow (existing behavior), not the profile screen.
- **Desktop:** Tap the identity header section (avatar + name + email) in the AccountPopover

### Content

1. **Avatar** — large, tappable. Opens the existing `ProfilePhotoPicker` drawer.
2. **Display name** — editable inline (tap to edit, save on blur/enter). Validation: non-empty, max 50 chars. Shows a subtle spinner during save. On failure, reverts to previous value and shows a brief error toast.
3. **Pronouns** — editable inline (same UX pattern as display name). Optional field, can be cleared.
4. **Favorite prop** — uses `createPropPreferenceState(persister, userId)` with `PropPreferencePersister` from DI. Renders a compact icon grid of prop types (staff, fan, club, buugeng, poi). The UI for this is new but simple — a row of tappable prop icons with the selected one highlighted.
5. **"Account settings" link** — navigates to Settings module, Account tab. Styled as a subtle row with chevron-right.

### What it does NOT contain

- Sign out (stays in switcher footer and desktop popover)
- Security, MFA, connected accounts, password management
- Storage/cache, subscription, danger zone
- Any tab navigation

### Presentation

- Uses the same Drawer component as the module switcher
- On mobile: bottom drawer, content-adaptive height (not full-screen)
- On desktop: opens as a centered drawer/modal. The popover is too narrow for editing fields.
- Does NOT reuse `ProfileHeroSection.svelte` directly — that component has a baked-in sign-out button and is designed for the Settings tab layout. Instead, ProfileScreen builds its own layout: large avatar at top, editable name/pronouns below, prop picker, account link. Simpler and purpose-built.
- Entry animation: fade-in, consistent with existing drawer patterns

### Drawer sequencing (mobile)

On mobile, tapping the AccountRow closes the module switcher drawer first, then opens the profile screen drawer after the close animation completes (via the Drawer's `onClose` callback). Two drawers must never be open simultaneously — vaul-svelte doesn't handle stacked backdrops or scroll locks well.

### State management

- Pronouns: loaded from Firestore `users/{uid}` document (existing pattern from ProfileTab)
- Display name: `updateProfile(user, { displayName })` + `refreshUser()` (existing pattern)
- Avatar: existing `ProfilePhotoPicker` + `handlePhotoSelected` flow (lifted from ProfileTab)
- Favorite prop: `PropPreferenceState` + `PropPreferencePersister` from DI

No new state factories needed. The profile screen is thin enough to manage its own local state with `$state` and call DI services directly.

---

## Settings Module Changes

### Naming note

There is an existing `ACCOUNT_TABS` array in `tab-definitions.ts` (with tabs: overview, library, preferences, security) used by a separate Account module concept. This spec does NOT touch `ACCOUNT_TABS`. The changes below are exclusively to `SETTINGS_TABS`.

### Remove Profile tab from SETTINGS_TABS

The `profile` entry is removed from `SETTINGS_TABS` in `tab-definitions.ts`.

### Add Account tab to SETTINGS_TABS

A new `account` tab replaces Profile in the first position of `SETTINGS_TABS`. It contains the account plumbing cards that were previously in ProfileTab:

- **Account Settings** card (password change only — display name editing moves to the profile screen)
- **Security** card (MFA, passkeys)
- **Connected Accounts** card
- **Storage** card (cache clearing)
- **Subscription** card (admin-only)
- **Danger Zone** card (account deletion)

The Account tab reuses all existing card components (`AccountSettingsSection`, `AccountSecuritySection`, `ConnectedAccounts`, `StorageSection`, `DangerZone`, `SubscriptionCard`, `GlassCard`).

### Tab count change

Before: 9 tabs (Profile, Release Notes, Props, Theme, Visibility, Keyboard, Notifications, Preferences, Language)

After: 9 tabs (Account, Release Notes, Props, Theme, Visibility, Keyboard, Notifications, Preferences, Language)

The count stays the same, but the cognitive load decreases: "Account" is clearly plumbing, while identity is handled by the profile screen.

### Default tab

Settings default tab changes from `profile` to `account`. Deep links to `settings/profile` MUST redirect to `settings/account` — existing bookmarks and shared links may reference the old path.

---

## Module Switcher Changes

### AccountRow drawer variant becomes interactive

Currently: `<AccountRow variant="drawer" />` renders a static `<div>`. The component already accepts an `onclick` prop but ignores it in drawer mode.

Changes:
1. The drawer variant renders a `<button>` instead of a `<div>` (like the expanded variant), calling the existing `onclick` handler.
2. Fix `handleClick()` to use optional chaining: `onclick?.()` instead of `onclick()` (currently throws if onclick is undefined).

In `ModuleSwitcher.svelte`:
```svelte
<AccountRow variant="drawer" onclick={handleProfileOpen} />
```

Where `handleProfileOpen` closes the module switcher drawer, then opens the profile screen drawer after the close completes (see "Drawer sequencing" above).

### Profile screen drawer

A new `ProfileScreen.svelte` component is rendered inside `ModuleSwitcher.svelte` (or at the app root level) and controlled by an `isProfileOpen` state. It's a separate Drawer instance.

---

## Desktop AccountPopover Changes

The identity header section (avatar + name + email) becomes clickable. Clicking it:
1. Closes the popover
2. Opens the profile screen as a centered drawer/modal

Nudges that currently navigate to Settings > Profile (`handleNudgeNavigate("profile")`) are updated:
- "Add a profile photo" → opens the profile screen directly
- "Pick your favorite prop" → opens the profile screen directly (since favorite prop is now on the profile screen)

---

## Navigation Coordinator

No changes to the module navigation system. The profile screen is not a module — it doesn't appear in `MODULE_DEFINITIONS` or the module list. It's a drawer that can be opened from anywhere the account row appears.

The "Account settings" link on the profile screen calls `handleModuleChange("settings", "account")` using the existing navigation coordinator.

---

## Admin Preview Mode

The existing admin preview mode (`userPreviewState`) currently shows a preview banner + the full ProfileTab content for another user. After this change:

- The **Account tab** in Settings shows the preview version of account plumbing (security, connected accounts, etc.) — same cards, preview data.
- The **Profile screen** is not accessible in preview mode (you can't edit another user's identity). The avatar/name row in the module switcher remains static when preview mode is active.

---

## Files Changed

### New files
- `src/lib/features/profile/ProfileScreen.svelte` — the focused identity screen (feature component, not a navigation primitive)

### Modified files
- `src/lib/shared/navigation/config/tab-definitions.ts` — remove `profile` from SETTINGS_TABS, add `account`
- `src/lib/shared/navigation/components/ModuleSwitcher.svelte` — make AccountRow clickable, render ProfileScreen
- `src/lib/shared/navigation/components/account/AccountRow.svelte` — make drawer variant interactive
- `src/lib/shared/navigation/components/account/AccountPopover.svelte` — make identity header clickable, update nudge targets
- `src/lib/shared/settings/components/tabs/ProfileTab.svelte` — rename to AccountTab.svelte, remove identity hero, keep plumbing cards
- `src/lib/features/settings/SettingsModule.svelte` — update tab rendering to use AccountTab

### Also modified
- `src/lib/shared/navigation/state/navigation-state.svelte.ts` — redirect `profile` tab to `account`
- Deep link / tab resolution — ensure `settings/profile` resolves to `settings/account`

---

## What stays the same

- Module list — Profile does NOT appear as a module
- Desktop sidebar — AccountRow expanded/collapsed variants unchanged
- Sign out — stays in switcher footer and desktop popover
- All existing card components — reused as-is
- ProfilePhotoPicker — reused as-is
- Prop preference system — reused as-is
