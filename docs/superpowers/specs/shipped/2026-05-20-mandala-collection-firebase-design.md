# Mandala Collection Firebase Persistence

## Problem

Mandala collection stores in localStorage (`tka:mandala-collection`). Data is lost on cache clear, doesn't sync across devices. Must persist in Firebase user accounts.

## Design

### Firestore Path

```
users/{uid}/mandala-collection/{mandalaId}
```

Each document = one `CollectedMandala`. Fields match the existing interface:
- `name: string`
- `steps: StepData[]` (serialized as JSON array)
- `variant: "blue" | "red" | "both"`
- `bluePropType: string`
- `redPropType: string`
- `createdAt: Timestamp` (Firestore server timestamp on create)
- `updatedAt: Timestamp` (Firestore server timestamp on every write)

Document ID = the mandala's UUID (generated client-side via `crypto.randomUUID()`).

### Access Control

Auth-gated only. No guest fallback. Must be signed in to save/load mandalas.

### Files Changed

1. **New: `src/lib/features/mandala-collection/services/FirebaseMandalaCollectionRepository.ts`**
   - `load(userId: string): Promise<CollectedMandala[]>` — firestoreList, orderBy createdAt desc
   - `save(userId: string, mandala: CollectedMandala): Promise<void>` — firestoreSet with mandala.id
   - `remove(userId: string, mandalaId: string): Promise<void>` — firestoreDelete
   - Uses `requireAuth()` guard from firestore-helpers

2. **New: `src/lib/features/mandala-collection/data/firestore-paths.ts`**
   - `getUserMandalaCollectionPath(userId: string)` → `users/${userId}/mandala-collection`
   - `getUserMandalaPath(userId, mandalaId)` → `users/${userId}/mandala-collection/${mandalaId}`

3. **Modified: `src/lib/features/mandala-collection/state/mandala-collection-state.svelte.ts`**
   - Remove constructor localStorage load
   - Add `init(userId: string)` — loads from Firebase, runs migration
   - Add `teardown()` — clears state on sign-out
   - `add()` / `remove()` write to Firebase instead of localStorage
   - Wire into auth state change listener

4. **Modified: `src/lib/features/mandala-collection/domain/mandala-collection-types.ts`**
   - Add Zod schema for Firestore document validation (firestoreCrud requires SchemaLike)

5. **Kept: `LocalMandalaCollectionRepository.ts`** — used only for one-time migration

### Migration

On first authenticated `init()`:
1. Load from Firebase
2. Check localStorage for existing entries
3. If localStorage has entries not in Firebase → push each to Firestore
4. Clear localStorage
5. Migration is idempotent (checks by ID)

### What Doesn't Change

- `CollectedMandala` interface (same fields)
- `SequenceMandala` component
- `MandalaCollectionGallery`, `MandalaCollectionCard` components
- Playground page (reads from state)
- Save entry points in StandardGrid/TimelineGrid (call `mandalaCollectionState.add()`)
