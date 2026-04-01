# Guest Access Tier Design

**Date:** 2026-04-01
**Status:** Draft
**Philosophy:** Gate the save, not the create.

---

## Overview

Remove the login wall. Let visitors use the app immediately as guests, with restricted modules and beat caps. Sign-up happens organically when guests try to save, export, or access gated features — not as a prerequisite to touching the app.

The login wall currently bounces curious visitors before they experience anything. This design introduces a three-tier access model (Guest → Composer → Scribe) where guests can create sequences, browse the gallery, and feel the product before committing to an account.

---

## Three-Tier Access Model

### Tiers

| Tier | Internal name | User-facing name | Icon | Beat limit |
|------|--------------|-----------------|------|-----------|
| No account | `guest` | Guest | Generic user silhouette | 8 |
| Free account | `user` | Composer | Profile picture | 16 |
| Paid account | `premium` | Scribe | Profile picture + quill | 64 |

### AccessTier Type

```typescript
type AccessTier = "guest" | "user" | "premium";
```

The internal values match `UserRole` vocabulary (`"user"`, `"premium"`), plus `"guest"` for unauthenticated. User-facing names ("Composer", "Scribe") are display-only strings resolved via a lookup — never used in gate logic or comparisons.

```typescript
const ACCESS_TIER_LABELS: Record<AccessTier, string> = {
  guest: "Guest",
  user: "Composer",
  premium: "Scribe",
};
```

### Resolution Logic

```
Not authenticated → "guest"
Authenticated + not premium → "user"
Authenticated + premium → "premium"
```

This complements the existing `UserRole` system (admin, tester, user). `UserRole` controls permissions. `AccessTier` controls capability unlocks through sign-up and payment. Code should never compare `AccessTier` values to `UserRole` values directly — use `getAccessTier()` which reads auth state and role together.

---

## MainApplication Gate Rework

### Current Behavior (line ~480)

```svelte
{:else if !isAuthenticated}
  <LandingPage />
```

Unauthenticated users see the login screen. Full stop.

### New Behavior

```svelte
{:else if !isAuthenticated}
  <MainInterface />  <!-- Same component, guest mode -->
```

Guests enter `MainInterface` directly. Restrictions are enforced downstream by module/tab visibility and action gating — not at the app shell level.

### What Guests Skip

- **LandingPage:** Not shown. Guests go straight to Create.
- **FirstRunWizard:** Skipped on first visit. Runs after sign-up (see Auth Transition Flow).

### What Guests Still Get

- **`initAppMode()` initialization:** Firebase, DI containers, services all load. Guests need the container for Construct/Generate to function.
- **PostHog analytics:** Already initializes before auth in both landing and app modes. Anonymous tracking works out of the box. Session recordings, autocapture, pageviews all flow for guests.
- **Prop selection:** Existing UI button is visible in Create. Selection persists in localStorage.

### Guest-Mode Initialization Considerations

The existing `authState.svelte.ts` already guards Firestore-dependent services behind a `user` check (`childServicesInitialized`, line ~400), so those are safe. Additional considerations:

| Service | Guest behavior |
|---------|---------------|
| `settingsService.loadSettings()` | Must work without Firestore. Use localStorage-only fallback for guests. Settings are already cached locally. |
| Gamification | Skip for guests. No user profile to track progress against. |
| Presence tracking | Skip for guests. No identity to track. |
| `firstRunState.syncFromCloud()` | Skip for guests. No cloud data exists. Wizard only runs after sign-up. |
| DI container services | Load normally. Construct/Generate/Assemble need the container. |
| Firebase Auth listener | Runs but resolves with `user = null`. No Firestore writes. |

### Default Landing

Guests land in **Create → Construct tab** on first visit.

---

## Module & Tab Visibility

### Guest Access Configuration

A static map defines what guests can access:

```typescript
const GUEST_MODULE_ACCESS: Record<string, string[] | "all" | "blocked"> = {
  create:  ["assemble", "construct", "generate"],  // Fuse excluded (admin-only, in development)
  browse:  ["gallery"],                             // Collections and Creators blocked
  // All other modules default to "blocked":
  // social, learn, tika, premium, compose, watch, arena, train,
  // choreo_card, write, feedback, admin, festivals, realm, retro,
  // levels, hand-paths, lab, settings
};
```

**Browse tabs reference:** `BROWSE_TABS` contains `gallery`, `collections`, and `creators`. Guests access `gallery` only. Collections requires curation context (account-based). Creators is social (account-based).

### Behavior by Scenario

| Scenario | What happens |
|----------|-------------|
| Guest enters allowed module (Create) | Tabs filtered to allowed list. Module works normally. |
| Guest enters allowed module, taps blocked tab (Browse > Collections) | AuthNudge appears in tab content area. |
| Guest enters blocked module (Learn, Social, etc.) | AuthNudge appears where module content would render. Module component doesn't load. |
| Guest taps Settings | AuthNudge appears. |
| Guest taps Premium module | AuthNudge appears (can't pay without an account). |

### Nav Visibility

**All main modules are visible in the nav.** No hidden modules, no lock icons. Guests can tap anything. Gating happens internally when they try to interact, not by hiding options. This creates curiosity-driven exploration.

### Filtering Location

A `GuestAccessFilter` checks the access config before rendering module/tab content. This lives in one place (likely wrapping or checked by `ModuleRenderer`). Individual module components don't need to know about guest access.

**Keyboard shortcuts:** Module-switching shortcuts (Ctrl+1 through Ctrl+6) pass through the same `GuestAccessFilter`. If the target module is blocked for guests, the shortcut triggers the AuthNudge inline rather than switching modules.

---

## AuthNudge Component

An inline explanation card (not a modal) that appears when a guest hits a gate. Two-step flow: explain what they can do if they sign up, then let them choose.

### Layout

```
┌─────────────────────────────────────┐
│                                     │
│  [Context-specific explanation]     │
│                                     │
│  ┌──────────────────────┐           │
│  │ Create Account — free │  Not now  │
│  └──────────────────────┘           │
└─────────────────────────────────────┘
```

### Props

```typescript
interface AuthNudgeProps {
  trigger: AuthNudgeTrigger;
  onCreateAccount: () => void;  // Opens AuthDrawer
  onDismiss: () => void;        // Closes nudge, guest keeps playing
}
```

### Trigger Texts

| Trigger ID | Text |
|------------|------|
| `save` | "Create a free account to save your sequences. Takes about 10 seconds." |
| `beat-cap-guest` | "Guests can create sequences up to 8 beats. Sign up free for up to 16." |
| `beat-cap-composer` | "Composers can create up to 16 beats. Become a Scribe for up to 64." |
| `export` | "Create a free account to export your sequences." |
| `module:learn` | "Sign up free to start learning TKA notation." |
| `module:library` | "Your saved sequences live here. Create a free account to start your library." |
| `module:settings` | "Create a free account to customize your settings." |
| `edit-community` | "Create a free account to edit and remix sequences." (Triggered in Browse > Gallery sequence detail view when tapping Edit/Remix) |
| `generate-cap` | "Guests can generate sequences up to 8 beats. Sign up free for up to 16." |

### Button Labels

- **Guest triggers:** "Create Account — free" + "Not now"
- **Composer triggers** (beat cap at 17): "Become a Scribe" + "Not now"

### Behavior

- "Not now" dismisses the card. No punishment. Guest keeps playing.
- "Create Account" opens the AuthDrawer overlay.
- The nudge appears inline — in the module content area, tab content area, or next to the gated action, depending on context.

---

## AuthDrawer Component

A drawer overlay containing the sign-up form. Slides in from the right on desktop, from the bottom on mobile (matching existing drawer patterns). MainInterface stays mounted behind it.

### Contents

1. **Tier progression display** (minimal, not a feature matrix):
   ```
   Guest → Composer → Scribe
   You're here   Free    Coming soon
   ```

2. **Auth form** (reuses existing components):
   - `SocialAuthCompact` (Google, Facebook)
   - `EmailAuthTabs` (email sign-up/sign-in)
   - Google One Tap (if configured)

### Reuse Strategy

AuthDrawer **composes** existing LandingPage auth components. It does not rebuild auth flows. The LandingPage component itself stays untouched for any direct URL access patterns.

### Scribe Tier Display

"Coming soon" until premium features are built. This sets the expectation that a paid tier exists without gating anything prematurely.

---

## Auth Transition Flow

The full sequence when a guest decides to sign up:

```
1. Guest hits a gate (save, beat 9, blocked module, etc.)
2. AuthNudge appears (inline explanation card)
3. Guest taps "Create Account — free"
4. AuthDrawer slides in (overlay, MainInterface stays mounted behind)
5. Guest signs up via Google / Facebook / Email
6. Auth succeeds → AuthDrawer closes
7. FirstRunWizard appears (full screen)
   - Header message: "Your sequence will be here when you're done."
   - Set preferences, prop type, display name, etc.
8. Wizard completes → back to MainInterface as Composer
9. Sequence is still there — component tree never unmounted
```

### Svelte Template Strategy: Unconditional MainInterface

Svelte's `{#if}/{:else}` destroys and recreates branches when conditions change. If MainInterface is inside an `{:else}` block, it remounts when auth state flips — killing in-progress sequence state.

**Solution:** Render MainInterface unconditionally. Auth overlays (AuthDrawer, FirstRunWizard) render on top. Guest restrictions are controlled via context/props, not by swapping which component branch renders.

```svelte
<!-- Simplified MainApplication template strategy -->
{#if initializationError}
  <ErrorScreen ... />
{:else if authLoading}
  <Spinner />
{:else}
  <!-- Always mounted, regardless of auth state -->
  <MainInterface />

  <!-- Overlays on top when needed -->
  {#if showFirstRunWizard}
    <FirstRunWizard ... />
  {/if}
{/if}

<!-- AuthDrawer is a portal/overlay, triggered by AuthNudge -->
{#if authDrawerOpen}
  <AuthDrawer ... />
{/if}
```

MainInterface receives access tier via context. When auth state changes from `"guest"` to `"user"`, the context updates, module filters react, but the component tree and its state (including in-progress sequences) remain intact.

### FirstRunWizard Adaptation

The existing wizard renders as a full-screen overlay on top of MainInterface (not a branch swap). For new users, `firstRunState.syncFromCloud()` resolves quickly (no cloud data exists), so the loading gap is brief.

The wizard gets one addition: a reassurance message at the top or in the intro step telling the user their in-progress work is preserved. This message should appear even during the brief cloud sync spinner. Without it, users will think their sequence vanished.

---

## Guest Nav Indicator

### Mobile (Module Switcher Bar)

Where the profile picture icon normally appears, guests see:
- Generic user silhouette icon
- "Sign up" label underneath
- Tapping opens AuthDrawer directly (skips AuthNudge — this is an intentional action, not a gate)

### Desktop (Sidebar)

Same concept in the sidebar's profile/settings area:
- Generic icon + "Sign up" text
- Click opens AuthDrawer

### After Sign-Up (Composer)

- Profile picture appears
- Label shows display name
- Normal authenticated behavior

### Scribe Indicator (Future)

When premium launches, Scribes get a subtle quill icon next to their profile picture.

---

## Beat Cap Enforcement

### The Function

```typescript
function getMaxBeats(tier: AccessTier): number {
  switch (tier) {
    case "guest": return 8;
    case "user": return 16;
    case "premium": return 64;
  }
}
```

Single source of truth. No duplicated magic numbers.

### Enforcement Points

**Construct:** When the guest has placed 8 beats and triggers "add beat," the AuthNudge appears instead of adding a beat. Existing beats stay on screen. If dismissed with "Not now," they keep editing their 8 beats.

**Generate:** Two enforcement points. (1) The length/beat count input is capped by tier — guest can't set it above 8. (2) If a guest types a word that would require more than 8 beats, Generate caps the output at 8 beats and shows the AuthNudge after generation. Unlike Construct/Assemble, Generate **truncates then nudges** rather than blocking, because the generation has already happened server-side.

**Assemble:** Same as Construct — blocks. When 8 beats are placed on the grid, further grid clicks trigger the nudge.

### Cap Interaction with Tiers

| Action | Guest (8) | Composer (16) | Scribe (64) |
|--------|-----------|---------------|-------------|
| Add beat 9 | AuthNudge (sign up) | Allowed | Allowed |
| Add beat 17 | AuthNudge (sign up) | AuthNudge (become Scribe) | Allowed |
| Add beat 65 | AuthNudge (sign up) | AuthNudge (become Scribe) | Hard cap, no nudge |
| Generate > cap | Capped + nudge | Capped + nudge | Capped, no nudge |

---

## PostHog Analytics

### Anonymous Tracking (Already Working)

PostHog initializes before auth in `+layout.svelte`. It assigns a random `distinct_id` to unidentified users and tracks all events: pageviews, autocapture clicks, session recordings.

### Identity Merge on Sign-Up

When a guest signs up, the existing `identifyUser()` function calls `posthog.identify(userId)`, which automatically merges the anonymous session into the real user profile.

### Conversion Funnel Visibility

After this change, PostHog will show the full journey:

```
Guest arrives → browses gallery → opens Create → builds 6-beat sequence
→ hits save gate → signs up → completes wizard → saves sequence
```

No code changes needed for analytics. The existing PostHog integration handles anonymous → identified transitions out of the box.

---

## Integration with Premium Gating

The `PremiumGateChecker` already handles unauthenticated users (resolution step 0: "User is not authenticated → treat as free user"). The guest access tier extends this with a clear resolution order.

### Gate Resolution Order

Auth gates run **before** premium gates. You can't pay without an account.

```
1. Is the user authenticated?
   NO  → AuthNudge ("Create Account — free")
   YES → continue
2. Is this a premium-gated capability?
   YES → PremiumGateChecker.check() as today
   NO  → allowed
```

**Implementation:** Modify `PremiumGateChecker.check()` to return an `AuthNudge`-typed result (not a `PremiumNudge`) when `!isAuthenticated`. The existing step 0 already returns `notAllowed()` for unauthenticated users — it just needs to return a different nudge type so the UI knows to show AuthNudge instead of PremiumNudge.

```typescript
// Extended PremiumGateResult
interface PremiumGateResult {
  allowed: boolean;
  reason?: "auth_required" | "premium_required" | "capability_disabled";
  nudge?: NudgeConfig;
  nudgeType?: "auth" | "premium";  // Determines which nudge component to show
}
```

This keeps a single gate checker with a single `check()` call. No separate `AuthGateChecker` needed. Components call `check()` and render either `AuthNudge` or `PremiumNudge` based on `nudgeType`.

### Shared Nudge Pattern

| Gate type | Component | Button text | Action |
|-----------|-----------|-------------|--------|
| Auth (guest) | AuthNudge | "Create Account — free" | Opens AuthDrawer |
| Premium (composer) | PremiumNudge | "Become a Scribe" | Navigates to premium module |

---

## User-Facing Naming

| Internal value (`AccessTier`) | Display name | Where display name appears |
|-------------------------------|-------------|---------------------------|
| `"guest"` | Guest | Nav indicator, tier progression |
| `"user"` | Composer | Profile area, tier progression |
| `"premium"` | Scribe | Profile area, nudge text, tier progression |

Display names are resolved via `ACCESS_TIER_LABELS` lookup. Never use `"composer"` or `"scribe"` as code values.

| Other naming | Notes |
|-------------|-------|
| `isPremiumOrAbove()` | Unchanged. Code only. |
| Premium module label | Changes to "Become a Scribe" in UI |
| Crown icon | Replaced by quill icon for Scribe badge and gated action indicators |

---

## File Locations (Anticipated)

| File | Purpose |
|------|---------|
| `src/lib/shared/auth/domain/AccessTier.ts` | `AccessTier` type + `getAccessTier()` + `getMaxBeats()` |
| `src/lib/shared/auth/domain/guest-access-config.ts` | Static module/tab visibility map |
| `src/lib/shared/auth/components/AuthNudge.svelte` | Two-step explanation card |
| `src/lib/shared/auth/components/AuthDrawer.svelte` | Drawer wrapping existing auth components |
| `src/lib/shared/auth/components/GuestNavIndicator.svelte` | Sign-up button for nav |
| `src/lib/shared/application/components/MainApplication.svelte` | Gate rework (remove LandingPage for guests) |
| `src/lib/shared/modules/ModuleRenderer.svelte` | Guest access filtering |
| `src/lib/shared/navigation/components/*` | Nav indicator integration |

---

## What This Design Does NOT Cover

- **Premium feature implementation** — Scribe capabilities are "coming soon." This design builds the tier structure and auth gating. Premium gating is a separate spec (`2026-03-11-premium-gating-system-design.md`).
- **Browse restructure** — Moving Creators tab to a Community/Social module. Separate scope.
- **Rate limiting for guests** — Generation count limits, abuse prevention. Can be added later if needed.
- **Guest data cleanup** — What happens to localStorage data if a guest never returns. Low priority.
- **LandingPage removal** — The marketing landing page at `/` is unaffected. The `LandingPage` component used inside MainApplication for auth may become unused after this change, but cleanup is a follow-up.
