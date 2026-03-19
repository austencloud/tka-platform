# Profile Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract identity editing (avatar, name, pronouns, favorite prop) from Settings into a focused Profile Screen drawer accessible from the module switcher and desktop popover.

**Architecture:** The Profile Screen is a standalone Drawer component rendered at the app shell level (`MainInterface.svelte`), following the same pattern as `MyPropsDrawer` — a shared signal state (`profileScreenState`) controls open/close, and the component renders outside the sidebar to avoid backdrop-filter containment issues. The existing ProfileTab is renamed to AccountTab and stripped of identity fields. Navigation state maps `profile` → `account` for backwards compatibility.

**Tech Stack:** Svelte 5 (runes), vaul-svelte Drawer, Firebase Auth (`updateProfile`), Firestore (pronouns), ITI DI container, existing `PropPreferenceState`.

**Spec:** `docs/superpowers/specs/2026-03-19-profile-screen-design.md`

---

### Task 1: Make AccountRow drawer variant interactive

**Files:**
- Modify: `src/lib/shared/navigation/components/account/AccountRow.svelte`

- [ ] **Step 1: Fix null-safety in handleClick**

Change `onclick()` (line 29) to `onclick?.()`.

- [ ] **Step 2: Change drawer variant from static div to conditional button**

In `AccountRow.svelte`, replace the `{#if variant === "drawer"}` block (lines 33-48). When `onclick` is provided AND user is authenticated, render a `<button>`. Otherwise keep the static `<div>`.

```svelte
{#if variant === "drawer"}
  {#if onclick && isAuthenticated}
    <button
      class="account-row drawer interactive"
      onclick={handleClick}
      aria-label="Edit profile"
    >
      <RobustAvatar src={photoURL} name={displayName} customSize={32} />
      <span class="account-label">{displayName}</span>
      <i class="fas fa-chevron-right drawer-chevron" aria-hidden="true"></i>
    </button>
  {:else}
    <div class="account-row drawer">
      {#if isAuthenticated}
        <RobustAvatar src={photoURL} name={displayName} customSize={32} />
      {:else}
        <div class="avatar-guest">
          <i class="fas fa-user" aria-hidden="true"></i>
        </div>
      {/if}
      <span class="account-label">{displayName}</span>
    </div>
  {/if}
{:else}
```

- [ ] **Step 3: Add interactive drawer styles**

```css
.account-row.drawer.interactive {
  cursor: pointer;
  border-color: var(--theme-stroke);
  background: var(--theme-card-bg);
}

.account-row.drawer.interactive:hover {
  background: var(--theme-card-hover-bg);
  border-color: var(--theme-stroke-strong);
}

.account-row.drawer.interactive:active {
  transform: scale(0.98);
}

.account-row.drawer.interactive:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
  outline-offset: 2px;
}

.drawer-chevron {
  font-size: var(--font-size-compact, 12px);
  opacity: 0.4;
  margin-left: auto;
}

@media (prefers-reduced-motion: reduce) {
  .account-row.drawer.interactive:active {
    transform: none;
  }
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/navigation/components/account/AccountRow.svelte
git commit -m "feat: make AccountRow drawer variant interactive when onclick provided"
```

---

### Task 2: Create profile screen state signal

**Files:**
- Create: `src/lib/features/profile/profile-screen-state.svelte.ts`

This follows the exact same pattern as `src/lib/shared/navigation/components/account/my-props-drawer-state.svelte.ts` — a module-level `$state` signal for a drawer that must render at the document root.

- [ ] **Step 1: Create the profile feature directory and state file**

```bash
mkdir -p src/lib/features/profile
```

Create `src/lib/features/profile/profile-screen-state.svelte.ts`:

```typescript
/**
 * Shared signal for the Profile Screen drawer.
 *
 * Same pattern as myPropsDrawerState — the drawer renders at the document
 * root (MainInterface.svelte) to avoid backdrop-filter containment from
 * the sidebar. Multiple sources (ModuleSwitcher, AccountPopover) can
 * trigger open via this shared state.
 */

let isOpen = $state(false);

export const profileScreenState = {
  get isOpen() { return isOpen; },
  set isOpen(v: boolean) { isOpen = v; },

  open() { isOpen = true; },
  close() { isOpen = false; },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/profile/profile-screen-state.svelte.ts
git commit -m "feat: add profileScreenState signal for profile drawer"
```

---

### Task 3: Create ProfileScreen component

**Files:**
- Create: `src/lib/features/profile/ProfileScreen.svelte`

- [ ] **Step 1: Build ProfileScreen.svelte**

The component is a Drawer containing:
1. Large avatar (tappable, opens PhotoPicker)
2. Editable display name (tap to edit, blur/enter to save, non-empty validation, max 50 chars, spinner during save, revert + error toast on failure)
3. Editable pronouns (same inline edit pattern, optional field — can be cleared)
4. Favorite prop picker (row of tappable prop icons with selected one highlighted)
5. "Account settings" link row

Props interface:
```typescript
interface Props {
  isOpen: boolean;
  onClose: () => void;
}
```

Key implementation details:
- Uses `bind:isOpen` with the shared `Drawer` component from `$lib/shared/foundation/ui/Drawer.svelte`
- Bottom drawer on mobile (placement="bottom"), same placement for desktop
- Loads pronouns from Firestore `users/{uid}` on mount (lift pattern from ProfileTab lines 126-137)
- Display name save: `updateProfile(user, { displayName })` + `refreshUser()` (lift from ProfileTab)
- Photo flow: opens existing `ProfilePhotoPicker`. Lift `handlePhotoSelected` and `uploadProfilePhoto` from ProfileTab lines 220-295.
- "Account settings" link uses `handleModuleChange("settings" as ModuleId, "account")` from `$lib/shared/navigation-coordinator/navigation-coordinator.svelte` — this already supports the second argument for tab ID. Close the profile drawer first.
- Prop preference: create state via `$effect`, not `$derived.by` (to avoid re-creation on every reactive run):

```typescript
let propState = $state<PropPreferenceState | null>(null);

$effect(() => {
  const uid = authState.user?.uid;
  if (uid) {
    const persister = container.items.propPreferencePersister as IPropPreferencePersister;
    propState = createPropPreferenceState(persister, uid);
  } else {
    propState = null;
  }
});
```

Display name validation and save:
```typescript
const MAX_NAME_LENGTH = 50;

async function saveName() {
  const trimmed = nameInput.trim();
  if (!trimmed || trimmed.length > MAX_NAME_LENGTH) return;
  if (trimmed === user?.displayName) {
    editingName = false;
    return;
  }

  savingName = true;
  const previousName = user?.displayName || "";
  try {
    await updateProfile(user!, { displayName: trimmed });
    await refreshUser();
    editingName = false;
  } catch (error) {
    console.error("Failed to update display name:", error);
    nameInput = previousName; // revert
    // Show brief error feedback (use haptic or inline error text)
    hapticService?.trigger("error");
  } finally {
    savingName = false;
  }
}
```

Pronouns save (similar pattern, but allows empty string to clear):
```typescript
async function savePronouns() {
  const trimmed = pronounsInput.trim();
  if (trimmed === userPronouns) {
    editingPronouns = false;
    return;
  }

  savingPronouns = true;
  const previousPronouns = userPronouns;
  try {
    const firestore = await getFirestoreInstance();
    const userDocRef = doc(firestore, "users", user!.uid);
    await setDoc(userDocRef, { pronouns: trimmed }, { merge: true });
    userPronouns = trimmed;
    editingPronouns = false;
  } catch (error) {
    console.error("Failed to update pronouns:", error);
    pronounsInput = previousPronouns;
    hapticService?.trigger("error");
  } finally {
    savingPronouns = false;
  }
}
```

Add `prefers-reduced-motion` media queries on any transitions/animations in the component.

The prop picker UI: render a row of prop type icons (staff, fan, club, buugeng, poi). Use `propState.setFavorite(propType)` on tap. Highlight the selected one with `propState.favoriteProp`.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors (component not yet mounted).

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/profile/ProfileScreen.svelte
git commit -m "feat: create ProfileScreen drawer with identity editing"
```

---

### Task 4: Render ProfileScreen in MainInterface and wire ModuleSwitcher

**Files:**
- Modify: `src/lib/shared/MainInterface.svelte`
- Modify: `src/lib/shared/navigation/components/ModuleSwitcher.svelte`

- [ ] **Step 1: Add ProfileScreen to MainInterface**

In `MainInterface.svelte`, import and render ProfileScreen after the ModuleSwitcher (around line 347), following the same pattern as MyPropsDrawer (lines 356-363):

```typescript
import ProfileScreen from "$lib/features/profile/ProfileScreen.svelte";
import { profileScreenState } from "$lib/features/profile/profile-screen-state.svelte";
```

After the ModuleSwitcher closing tag:
```svelte
<!-- Profile Screen Drawer (opens via profileScreenState signal) -->
<ProfileScreen
  bind:isOpen={profileScreenState.isOpen}
  onClose={() => profileScreenState.close()}
/>
```

- [ ] **Step 2: Wire ModuleSwitcher to open profile screen**

In `ModuleSwitcher.svelte`, import the state signal:
```typescript
import { profileScreenState } from "$lib/features/profile/profile-screen-state.svelte";
import { userPreviewState } from "../../debug/state/user-preview-state.svelte";
```

Add the handler:
```typescript
function handleProfileOpen() {
  hapticService?.trigger("selection");
  // Close switcher first, open profile after close animation
  isOpen = false;
  // Delay to let drawer close animation complete — avoid stacked drawers
  setTimeout(() => {
    profileScreenState.open();
  }, 250);
}
```

- [ ] **Step 3: Pass onclick to AccountRow (with admin preview guard)**

Change line 183 from:
```svelte
<AccountRow variant="drawer" />
```
to:
```svelte
<AccountRow
  variant="drawer"
  onclick={userPreviewState.isActive ? undefined : handleProfileOpen}
/>
```

When admin preview mode is active, `onclick` is `undefined`, so the AccountRow renders as static (non-interactive), matching the spec requirement.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/MainInterface.svelte src/lib/shared/navigation/components/ModuleSwitcher.svelte
git commit -m "feat: render ProfileScreen in MainInterface, wire ModuleSwitcher"
```

---

### Task 5: Rename ProfileTab to AccountTab

**Files:**
- Create: `src/lib/shared/settings/components/tabs/AccountTab.svelte` (from ProfileTab)
- Delete: `src/lib/shared/settings/components/tabs/ProfileTab.svelte`
- Modify: `src/lib/features/settings/SettingsModule.svelte`
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts`
- Modify: `src/lib/shared/navigation/state/navigation-state.svelte.ts`

- [ ] **Step 1: Copy ProfileTab to AccountTab**

```bash
cp src/lib/shared/settings/components/tabs/ProfileTab.svelte src/lib/shared/settings/components/tabs/AccountTab.svelte
```

- [ ] **Step 2: Strip identity from AccountTab**

In `AccountTab.svelte`:
- Remove `ProfileHeroSection` import and usage (the avatar/name/signout hero)
- Remove photo picker imports and all related state/functions: `showPhotoPicker`, `handleOpenPhotoPicker`, `handlePhotoSelected`, `uploadProfilePhoto`, `ProfilePhotoPicker`
- Remove pronouns loading logic (lines 94, 126-137)
- Remove `ProfilePhotoPicker` component at the bottom of the template
- Keep all account plumbing cards: `AccountSettingsSection`, `AccountSecuritySection`, `ConnectedAccounts`, `StorageSection`, `SubscriptionCard`, `DangerZone`, `GlassCard`
- Keep admin preview mode for account plumbing cards
- The `.profile-content` div starts directly with the settings grid (no hero)
- Add a sign-out button somewhere in the account tab since it was removed with the hero — a simple text button at the bottom of the grid, or within the existing AccountSettingsSection
- Update the component comment at top: "AccountTab.svelte - Account Security & Management Settings"

- [ ] **Step 3: Update SETTINGS_TABS in tab-definitions.ts**

Change the first entry in `SETTINGS_TABS` (lines 369-376) from:
```typescript
{
  id: "profile",
  label: "Profile",
  icon: '<i class="fas fa-user" aria-hidden="true"></i>',
  description: "Account and profile settings",
  color: "#6366f1",
  gradient: "linear-gradient(135deg, #818cf8 0%, #6366f1 100%)",
},
```
to:
```typescript
{
  id: "account",
  label: "Account",
  icon: '<i class="fas fa-user-cog" aria-hidden="true"></i>',
  description: "Security, connected accounts, and account management",
  color: "#6366f1",
  gradient: "linear-gradient(135deg, #818cf8 0%, #6366f1 100%)",
},
```

- [ ] **Step 4: Update SettingsModule.svelte**

Replace the ProfileTab import (line 37):
```typescript
import AccountTab from "$lib/shared/settings/components/tabs/AccountTab.svelte";
```

Replace tab rendering — change `activeTab === "profile"` (line 248) to `activeTab === "account"` and use `AccountTab`. Also update the fallback (lines 272-278) to use `AccountTab`. Update the component comment (line 7).

- [ ] **Step 5: Add profile→account tab redirect in navigation state**

In `src/lib/shared/navigation/state/navigation-state.svelte.ts`, in the `setActiveTab` function (around line 471), add a redirect at the top of the function body, before the tab existence check:

```typescript
// Redirect legacy "profile" tab to "account"
if (currentModule === "settings" && tabId === "profile") {
  tabId = "account";
}
```

Note: `tabId` is a parameter, so it needs to be `let` not `const` (or use a local variable). Check the function signature.

- [ ] **Step 6: Delete old ProfileTab**

```bash
rm src/lib/shared/settings/components/tabs/ProfileTab.svelte
```

- [ ] **Step 7: Search for remaining ProfileTab references**

Run: `npm run build`

If build fails due to stale ProfileTab imports, fix them. Also search:
```bash
grep -r "ProfileTab" src/ --include="*.svelte" --include="*.ts"
```

Expected: No matches.

- [ ] **Step 8: Commit**

```bash
git add src/lib/shared/settings/components/tabs/AccountTab.svelte src/lib/features/settings/SettingsModule.svelte src/lib/shared/navigation/config/tab-definitions.ts src/lib/shared/navigation/state/navigation-state.svelte.ts
git rm src/lib/shared/settings/components/tabs/ProfileTab.svelte
git commit -m "refactor: rename ProfileTab to AccountTab, strip identity fields"
```

---

### Task 6: Update AccountPopover to open ProfileScreen

**Files:**
- Modify: `src/lib/shared/navigation/components/account/AccountPopover.svelte`
- Modify: `src/lib/shared/navigation/components/DesktopNavigationSidebar.svelte`

- [ ] **Step 1: Add onOpenProfile prop to AccountPopover**

```typescript
let { isOpen, onClose, anchorElement, onOpenProfile } = $props<{
  isOpen: boolean;
  onClose: () => void;
  anchorElement: HTMLElement | null;
  onOpenProfile?: () => void;
}>();
```

- [ ] **Step 2: Make identity header clickable**

When authenticated and `onOpenProfile` is provided, render the identity header as a `<button>`:

```svelte
{#if isAuthenticated && onOpenProfile}
  <button
    class="identity-header interactive"
    onclick={() => { onClose(); onOpenProfile?.(); }}
    aria-label="Edit profile"
  >
    <RobustAvatar src={photoURL} name={displayName} size="md" customSize={40} />
    <div class="identity-info">
      <span class="identity-name">{displayName}</span>
      {#if email}
        <span class="identity-email">{email}</span>
      {/if}
    </div>
    <i class="fas fa-chevron-right identity-chevron" aria-hidden="true"></i>
  </button>
{:else}
  <div class="identity-header">
    <!-- existing unauthenticated content -->
  </div>
{/if}
```

- [ ] **Step 3: Update nudge targets**

Both nudges ("Add a profile photo" and "Pick your favorite prop") currently call `handleNudgeNavigate("profile")` and `handleNudgeNavigate("props")` which navigate to Settings tabs. Change both to open the profile screen instead:

```typescript
function handleNudgeClick() {
  onClose();
  onOpenProfile?.();
}
```

Update both nudge buttons to call `handleNudgeClick()` instead of `handleNudgeNavigate(...)`.

- [ ] **Step 4: Add interactive identity header styles**

```css
.identity-header.interactive {
  width: 100%;
  border: none;
  cursor: pointer;
  transition: background var(--duration-fast, 150ms) ease;
  border-radius: 0;
}

.identity-header.interactive:hover {
  background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
}

.identity-header.interactive:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
  outline-offset: -2px;
}

.identity-chevron {
  font-size: var(--font-size-compact, 12px);
  opacity: 0.3;
  flex-shrink: 0;
}

@media (prefers-reduced-motion: reduce) {
  .identity-header.interactive {
    transition: none;
  }
}
```

- [ ] **Step 5: Wire onOpenProfile in DesktopNavigationSidebar**

In `DesktopNavigationSidebar.svelte`, find where `AccountPopover` is rendered and add the `onOpenProfile` prop:

```typescript
import { profileScreenState } from "$lib/features/profile/profile-screen-state.svelte";
```

```svelte
<AccountPopover
  {isOpen}
  {onClose}
  {anchorElement}
  onOpenProfile={() => profileScreenState.open()}
/>
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/navigation/components/account/AccountPopover.svelte src/lib/shared/navigation/components/DesktopNavigationSidebar.svelte
git commit -m "feat: wire AccountPopover identity header to ProfileScreen"
```

---

### Task 7: Manual verification and fixes

**Files:** None initially (testing only)

- [ ] **Step 1: Run TypeScript check**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 2: Verify mobile flow**

On mobile (or mobile emulation via user's dev server at localhost:5173):
1. Open module switcher
2. Verify AccountRow shows name + chevron (when authenticated)
3. Tap AccountRow → switcher closes, profile drawer opens after animation
4. Verify: avatar (tappable), name (tappable to edit), pronouns, prop picker, "Account settings" link
5. Tap avatar → photo picker opens
6. Edit display name → verify save (spinner, success) and validation (empty rejected)
7. Tap "Account settings" → navigates to Settings > Account tab
8. Close profile drawer → returns to previous state

- [ ] **Step 3: Verify desktop flow**

On desktop:
1. Click AccountRow in sidebar → popover appears
2. Click identity header (name/email) → popover closes, profile screen opens
3. Click a nudge → profile screen opens
4. Verify inline editing works for name and pronouns

- [ ] **Step 4: Verify Settings Account tab**

1. Navigate to Settings
2. Verify first tab is "Account" (not "Profile")
3. Verify Account tab shows: Account Settings, Security, Connected Accounts, Storage, Danger Zone
4. Verify no avatar/name hero section in Account tab

- [ ] **Step 5: Verify deep link redirect**

Navigate to Settings with `profile` tab → should resolve to `account` tab.

- [ ] **Step 6: Verify unauthenticated state**

1. Sign out
2. Open module switcher
3. Verify AccountRow shows "Sign In" and is NOT interactive (no chevron)

- [ ] **Step 7: Verify admin preview mode**

If admin: activate preview mode for another user. Verify the AccountRow in module switcher is static (non-interactive).

- [ ] **Step 8: Commit any fixes**

If verification found issues, fix and commit:
```bash
git add <specific-files>
git commit -m "fix: address profile screen verification issues"
```
