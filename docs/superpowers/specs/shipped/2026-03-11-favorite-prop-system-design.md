# Favorite Prop System Design

## Problem

Props are currently 100% viewer-side preferences. There's no concept of "I'm a staff spinner" on a creator's profile, no way to know what prop a sequence was designed for, and no way to browse creators by prop. The onboarding step that asks "favorite prop" collects the answer and throws it away.

## Goals

1. Creators can declare what props they spin with and pick a favorite
2. Sequences silently capture the intended prop at save time
3. Viewers can toggle between creator's intent and their own prop settings
4. Creators list supports filtering by prop type
5. Zero friction throughout. No nagging, no required steps, no interruptions.

---

## Data Model

### User Profile (Firestore `users/{uid}`) — New Fields

```typescript
propsISpinWith: PropType[]          // e.g. ["staff", "fan", "club"]
favoriteProp: PropType | null       // their primary identity prop
favoriteCatdog: {                   // optional catdog combo as favorite
  bluePropType: PropType
  redPropType: PropType
} | null
```

**Constraints:**
- `favoriteProp` must be an item in `propsISpinWith`
- If `favoriteCatdog` is set, both prop types must be in `propsISpinWith`
- `favoriteCatdog` and `favoriteProp` are independent. `favoriteProp` is the single-prop identity. `favoriteCatdog` is an optional "this is my preferred combo" on top of that.
- All fields default to empty/null for existing users. No migration needed.

### Sequence Document (Firestore `sequences/{id}`) — New Field

```typescript
intendedProp: {
  bluePropType: PropType
  redPropType: PropType
  catDogMode: boolean
} | null
```

- `null` for legacy sequences — no backfill required
- Captures the full prop rendering config at time of save

### Firestore Index

`propsISpinWith` needs an `array-contains` index for creator filtering queries. Firestore auto-creates single-field indexes for `array-contains`, so no manual index creation required unless combined with orderBy (e.g. `where('propsISpinWith', 'array-contains', 'fan').orderBy('lastActiveAt')`), which will need a composite index.

---

## Feature 1: Account UI — "My Props"

### Location

New section in the Account popover. A card with visual appeal that users want to interact with.

### UI Elements

- **Props I spin with** — grid of all prop type icons. Tap to toggle on/off. Multi-select. Selected props get a highlight ring.
- **My favorite** — once at least one prop is selected, tap one to crown it. Gets a distinct badge/crown/star indicator.
- **Catdog favorite** (optional) — toggle to enable. When on, pick blue prop + red prop as a combo favorite. Both must already be in "props I spin with."

### Behavior

- Changes persist immediately to Firestore profile (optimistic local update, background sync)
- If the user removes a prop from "props I spin with" and it was the favorite, clear the favorite. Show a subtle prompt to pick a new one.
- If both catdog props are removed, clear the catdog favorite.
- No validation dialogs. Keep it lightweight.

### Non-Goals

- This section never interrupts the user. No modals, no required flows.
- It lives in Account as optional personalization.

---

## Feature 2: Onboarding Persistence

### Current State

The onboarding flow has a "favoriteProp" step that collects a PropType choice. This currently just sets the initial viewer prop setting. The data doesn't persist to the user profile.

### Change

Wire the onboarding "favoriteProp" step to also persist:
- `propsISpinWith: [chosenProp]`
- `favoriteProp: chosenProp`

on the user's Firestore profile document. First-time users get their profile seeded without extra steps.

---

## Feature 3: Sequence Save — Intended Prop

### On Save (New or Update)

Silently capture the current prop rendering config:

```typescript
intendedProp: {
  bluePropType: currentSettings.bluePropType,
  redPropType: currentSettings.redPropType,
  catDogMode: currentSettings.catDogMode
}
```

No dialog, no extra step. Whatever the user is viewing when they save is what gets recorded.

### Legacy Sequences

`intendedProp: null` means no intent was recorded. System treats these the same as today — render with viewer's settings.

### Thumbnail Cache

No changes needed. The cloud thumbnail cache already keys on prop type combo. Viewing a sequence with the creator's intended prop naturally generates/retrieves the correct cached thumbnail.

---

## Feature 4: Sequence Viewer Prop Switcher

### Location

In the sequence viewer, which is accessible from everywhere (browse gallery, creator profile, direct link, shared URL).

### Modes

A toggle/button that lets the viewer cycle between:

1. **Creator's intent** — render with the sequence's `intendedProp`. Label shows the prop name(s).
2. **My settings** — render with the viewer's own prop config from their settings.
3. **Quick-switch** — tap to pick any prop on the fly for this viewing session. Doesn't affect saved settings.

### Default Behavior

- If `intendedProp` exists on the sequence: default to creator's intent
- If no `intendedProp`: default to viewer's settings

### "Set as Intended" for Sequence Owners

When the sequence creator is viewing their own sequence and switches props via quick-switch, offer a "Set as intended" option. This updates the sequence's `intendedProp` without going through a full re-save flow. In-context editing — you see it with fans, you like it, you mark it.

### Non-Owners

Non-owners see the toggle and quick-switch but not "Set as intended." Their prop choice is ephemeral (session only).

---

## Feature 5: Creator Profile & Cards

### Creator Cards (Browse Creators List)

- Show creator's `favoriteProp` as a small prop icon on the card
- If `favoriteCatdog` is set, show both prop icons (blue/red tinted)
- If no favorite set: no icon. Clean card, no placeholder.

### Creator Profile View (Full)

- Row of prop icons showing `propsISpinWith`
- Favorite prop highlighted with badge/indicator
- Catdog favorite shown if set

### Rendering Cascade for Creator's Sequences

When browsing someone's sequences, the prop rendering follows this cascade:

1. Sequence has `intendedProp`? Use that.
2. No intent, but creator has `favoriteProp`? Use creator's favorite.
3. Neither? Use viewer's own settings.

The viewer can always override via the prop switcher in the sequence viewer.

---

## Feature 6: Creator Prop Filtering

### Creators List Filter

Horizontally scrollable row of prop type chips (icon for each prop). Behavior:

- Tap a chip to filter to creators who have that prop in `propsISpinWith`
- Tap again to deselect
- Multi-select supported: "show me people who spin staves AND fans"
- Filter combines with existing search and sort controls

### Sort Enhancement

New sort option: "Group by favorite prop" — clusters creators by their `favoriteProp`. Staff spinners together, fan dancers together, etc. Creators with no favorite appear at the end.

### Empty State

When a prop filter returns no results: "No one's picked [prop] yet." Keep it friendly, not scolding.

### Query

```typescript
// Single prop filter
db.collection('users')
  .where('propsISpinWith', 'array-contains', 'fan')
  .orderBy('lastActiveAt', 'desc')

// Multi-prop requires client-side intersection
// (Firestore doesn't support multiple array-contains)
// Fetch by first prop, filter client-side for additional props
```

For multi-prop filtering: query Firestore with the first selected prop via `array-contains`, then filter the results client-side for additional props. This is efficient enough given the expected user count.

---

## Architecture Notes

### Service Structure

Following project conventions (DI, interface + implementation, no "Service" suffix):

| Responsibility | Interface | Implementation |
|---------------|-----------|----------------|
| Persist prop preferences to profile | `IPropPreferencePersister` | `PropPreferencePersister` |
| Read/resolve intended prop for sequences | `IIntendedPropResolver` | `IntendedPropResolver` |
| Prop filter queries for creators list | `ICreatorPropFilter` | `CreatorPropFilter` |

### State

Following the factory + context pattern:

- `prop-preference-state.svelte.ts` — reactive state for the "My Props" UI in Account
- Sequence viewer prop toggle state lives within the existing viewer state factory
- Creator filter state lives within the existing creators data state

### What's NOT Changing

- Viewer's own prop settings (AppSettings.bluePropType, redPropType, presets) — untouched
- Prop rendering pipeline — still uses the same prop types, same renderer
- Thumbnail cache system — already handles arbitrary prop combos
- Sequence data model — `intendedProp` is additive, no migration

---

## Success Criteria

1. A user can pick their props and favorite in Account with zero friction
2. Onboarding favorite prop actually persists to their profile
3. Sequences silently capture intended prop on save
4. Sequence viewer shows a prop switcher that works from any entry point
5. Creator cards show favorite prop icon
6. Creators list can be filtered by prop type
7. Everything degrades gracefully when data is missing (null/empty = use viewer settings)
