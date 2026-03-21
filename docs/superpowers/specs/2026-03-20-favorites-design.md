# Generate Favorites Design

**Date:** 2026-03-20
**Status:** Draft

## Problem

The current preset system uses localStorage and only shows locally-seeded presets. Users want to save their favorite generation config and browse what other users prefer.

## Solution

Replace "presets" with "favorites": each user has one favorite generation config stored in their Firebase profile. The drawer shows your favorite plus other users' favorites. If you haven't set a favorite, your most recent config is shown as the default.

## Core Concept

- **One favorite per user** — not multiple presets. Simple.
- **Firebase-backed** — stored in `users/{uid}` document alongside other profile data
- **Social browsing** — the drawer shows other users' favorites with name + avatar + config summary
- **Fallback** — if no favorite is set, show the user's current/most-recent config with a "Set as Favorite" prompt

## Data Model

### Firestore: `users/{uid}.favoriteConfig`

Add a new field to the existing user document:

```typescript
interface FavoriteConfig {
  config: UIGenerationConfig;
  startEndOptions?: StartEndOptions | null;
  setAt: Timestamp;  // when they saved it
}
```

This is a single nested object on the user document, not a subcollection. Reads are cheap since we already fetch user profiles for community features.

### Reading other users' favorites

Query: `db.collection("users").where("favoriteConfig", "!=", null).orderBy("lastActiveAt", "desc").limit(20)`

This returns recently-active users who have set a favorite. The drawer shows their displayName, avatar, and config summary.

## UI Changes

### Rename "Preset" to "Favorite"

- **PresetCard** -> shows "My Fav" when active, "Favorite" when not
- **PresetDrawer** -> "Favorites" title, two sections:
  1. **Your Favorite** — your saved config, or "Set as Favorite" button if none
  2. **Community Favorites** — other users' favorites with avatar + name + config summary

### Card behavior (unchanged from preset spec)

- Selecting a favorite fills all cards
- Tapping any card deselects the active favorite
- Generate button works with favorite active

### "Set as Favorite" flow

From the drawer, user taps "Save Current as My Favorite" button. This takes whatever is currently configured in the generate panel and writes it to Firebase as their `favoriteConfig`. No confirmation dialog — it's one tap, and they can always change it.

### "Use This Favorite" flow

Tapping another user's favorite in the drawer applies their config and closes the drawer. Same as current preset selection.

## Architecture

### Service: `IFavoriteConfigRepository`

```typescript
interface IFavoriteConfigRepository {
  // Own favorite
  getMyFavorite(): Promise<FavoriteConfig | null>;
  setMyFavorite(config: UIGenerationConfig, startEndOptions?: StartEndOptions | null): Promise<void>;
  clearMyFavorite(): Promise<void>;

  // Community favorites
  getCommunityFavorites(limit?: number): Promise<CommunityFavorite[]>;
}

interface CommunityFavorite {
  userId: string;
  displayName: string;
  avatar?: string;
  config: UIGenerationConfig;
  startEndOptions?: StartEndOptions | null;
  setAt: Date;
}
```

### State changes

Replace `createPresetState()` with `createFavoriteState()`:

- `myFavorite: FavoriteConfig | null` — loaded from Firebase on mount
- `communityFavorites: CommunityFavorite[]` — loaded from Firebase on mount
- `activeFavoriteId: string | null` — "mine" or a userId
- `isLoading: boolean` — for the initial fetch
- `saveFavorite(config, startEndOptions)` — write to Firebase
- `clearFavorite()` — remove from Firebase
- `activateFavorite(id)` / `deactivateFavorite()` — same pattern as presets

### Fallback behavior

If `myFavorite` is null, the "Your Favorite" section in the drawer shows the current generate panel config with a "Save as My Favorite" button. This way the section is never empty.

## Files to Create

| File | Purpose |
|------|---------|
| `services/contracts/IFavoriteConfigRepository.ts` | Interface |
| `services/implementations/FavoriteConfigRepository.ts` | Firebase read/write |
| `state/favorite-state.svelte.ts` | Reactive state factory (replaces preset-state) |

## Files to Modify

| File | Change |
|------|--------|
| `components/cards/PresetCard.svelte` | Rename display text to "Favorite" / "My Fav" |
| `components/presets/PresetDrawer.svelte` | Two sections (yours + community), avatar display, save button |
| `components/GeneratePanel.svelte` | Replace `createPresetState` with `createFavoriteState` |
| `components/CardBasedSettingsContainer.svelte` | Update prop type from preset to favorite state |
| `shared/domain/card-colors.ts` | Rename `preset` key to `favorite` (optional) |
| `community/domain/models/enhanced-user-profile.ts` | Add `favoriteConfig?: FavoriteConfig` to `UserProfile` |

## Files to Delete

| File | Reason |
|------|--------|
| `state/preset.svelte.ts` | Replaced by `favorite-state.svelte.ts` |

## Not in Scope

- Favorite counts / popularity rankings
- "Featured favorites" curation
- Favorite history (past favorites)
- Notification when someone uses your favorite

## Testing

No earned tests. This is UI + Firebase CRUD. You'll see it if it breaks.
