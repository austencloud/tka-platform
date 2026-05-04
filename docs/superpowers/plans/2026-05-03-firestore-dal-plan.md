# Firestore Data Access Layer — Implementation Plan

Date: 2026-05-03
Spec: `docs/specs/firestore-data-access-layer.md`
Status: Ready to execute

## Overview

Build a shared Firestore data access layer with Zod validation at the boundary, then migrate 21 repositories in complexity order. Total estimated reduction: ~5,800 lines to ~2,500 lines. Eliminates all `as MyType` casts and duplicate helpers.

## Pre-conditions

- Zod 4.2.1 already installed (`package.json` confirms)
- Ceremony retirement Phase 5 complete (classes dissolved to functional modules)
- `src/lib/shared/firestore/` does not exist yet (clean slate)
- Existing validation utilities at `$lib/shared/validation/validation-utils.ts`
- Existing Zod schemas at `$lib/shared/foundation/domain/schemas.ts`

---

## Phase A: Shared Firestore Utilities

**Goal:** Create the reusable layer that all repositories will delegate to. No existing code changes.

### Task A1: Core types and helpers

**Files:**
- `src/lib/shared/firestore/firestore-types.ts`
- `src/lib/shared/firestore/firestore-helpers.ts`

**Action:**

`firestore-types.ts` — Define shared types:
```typescript
export interface WhereClause {
  field: string;
  op: WhereFilterOp;
  value: unknown;
}

export interface ListOptions {
  where?: WhereClause[];
  orderBy?: { field: string; direction?: 'asc' | 'desc' }[];
  limit?: number;
  startAfter?: unknown;
}

export interface WriteOptions {
  merge?: boolean;
  trackOffline?: boolean;
  repoName?: string;
}
```

`firestore-helpers.ts` — Consolidate the 3+ independent implementations:
```typescript
export function stripUndefined<T>(obj: T): T  // recursive, handles arrays
export function requireAuth(): string          // returns effectiveUserId or throws
export function buildCollectionRef(db: Firestore, path: string): CollectionReference
export function buildDocRef(db: Firestore, path: string, id: string): DocumentReference
export const firestoreDate = z.preprocess(...)  // Timestamp → Date preprocessor
```

- `stripUndefined` — port from `src/lib/features/compose/services/firebase-composition-repository.ts` (the recursive version that handles nested objects and arrays)
- `requireAuth` — wraps `authState.effectiveUserId` check, throws typed error
- `buildCollectionRef`/`buildDocRef` — thin wrappers that accept a path string
- `firestoreDate` — shared Zod preprocessor: handles Firestore Timestamp `.toDate()`, ISO strings, and Date instances

**Verify:** `npm run check` passes. File exports are importable from `$lib/shared/firestore/firestore-helpers`.

**Done:** Types and helpers exist, zero downstream changes.

---

### Task A2: CRUD functions with Zod validation

**Files:**
- `src/lib/shared/firestore/firestore-crud.ts`
- `src/lib/shared/firestore/index.ts`

**Action:**

`firestore-crud.ts` — The core 5 functions:

```typescript
import { z } from 'zod';

// GET single doc — validates at boundary
export async function firestoreGet<T>(
  collectionPath: string,
  id: string,
  schema: z.ZodType<T>
): Promise<T | null>

// LIST with query constraints — each doc validated
export async function firestoreList<T>(
  collectionPath: string,
  schema: z.ZodType<T>,
  options?: ListOptions
): Promise<T[]>

// SET (create or update) — strips undefined, adds timestamps, tracks offline
export async function firestoreSet<T>(
  collectionPath: string,
  id: string | null,
  data: T,
  options?: WriteOptions
): Promise<string>

// DELETE
export async function firestoreDelete(
  collectionPath: string,
  id: string,
  options?: { trackOffline?: boolean; repoName?: string }
): Promise<void>

// LISTEN (realtime) — validates each snapshot
export function firestoreListen<T>(
  collectionPath: string,
  schema: z.ZodType<T>,
  callback: (items: T[]) => void,
  options?: ListOptions
): () => void  // returns unsubscribe
```

Implementation details:
- Every `firestoreGet`/`firestoreList` calls `schema.safeParse(rawData)`. On failure: log warning with the path + id + Zod error, return `null` (get) or skip (list). Never throw on validation — repos have been casting unsafely for months; breaking on first parse error would be worse.
- `firestoreSet` calls `stripUndefined()`, merges `serverTimestamp()` for `createdAt` (on create) / `updatedAt` (always), wraps in `trackWrite()` when `trackOffline` is true.
- `firestoreListen` uses `onSnapshot`, validates each doc, skips invalid.
- All functions call `getFirestoreInstance()` internally.

`index.ts` — barrel export:
```typescript
export { firestoreGet, firestoreList, firestoreSet, firestoreDelete, firestoreListen } from './firestore-crud';
export { stripUndefined, requireAuth, firestoreDate } from './firestore-helpers';
export type { WhereClause, ListOptions, WriteOptions } from './firestore-types';
```

**Verify:** `npm run check` passes. Manual import test: a scratch file can `import { firestoreGet } from '$lib/shared/firestore'` without error.

**Done:** All 5 CRUD functions + listen helper exported and type-safe.

---

### Task A3: Unit tests for shared layer

**Files:**
- `tests/unit/shared/firestore/firestore-crud.test.ts`
- `tests/unit/shared/firestore/firestore-helpers.test.ts`

**Action:**

Mock `getFirestoreInstance` and `firebase/firestore` functions. Test:

`firestore-helpers.test.ts`:
- `stripUndefined` — nested objects, arrays, Date preservation, null preservation, undefined removal
- `requireAuth` — throws when no user, returns userId when authenticated
- `firestoreDate` — handles Firestore Timestamp objects, ISO strings, Date instances

`firestore-crud.test.ts`:
- `firestoreGet` — returns validated data, returns null on missing doc, returns null + logs on validation failure
- `firestoreList` — filters invalid docs, applies where/orderBy/limit
- `firestoreSet` — strips undefined, adds timestamps, calls trackWrite when option set
- `firestoreDelete` — calls deleteDoc, optionally tracks

**Verify:** `npx vitest run tests/unit/shared/firestore/ --config tests/config/vitest.config.ts`

**Done:** All tests pass. Coverage on core paths.

---

## Phase B: Simple Repository Migrations (repos 1-9)

**Goal:** Migrate the 9 simplest repos. Each collapses from 50-110 lines to 10-20 lines.

### Task B1: Create Zod schemas for simple domain models

**Files (new schemas, colocated with existing types):**
- `src/lib/features/festivals/domain/models/festival-schemas.ts` (Festival, FestivalAttendance, FestivalSubmission)
- `src/lib/features/festivals/domain/models/festival-tracker-schemas.ts`
- `src/lib/features/festivals/domain/models/workshop-portfolio-schemas.ts`
- `src/lib/features/community/domain/models/user-location-schemas.ts`
- `src/lib/features/loop-labeler/domain/models/loop-label-schemas.ts`
- `src/lib/features/landing/domain/models/spinner-metrics-schemas.ts`
- `src/lib/features/landing/domain/models/broadcast-schemas.ts`
- `src/lib/features/create/generate/domain/models/favorite-config-schemas.ts`

**Action:**

For each model, create a Zod schema that mirrors the existing TypeScript interface. Use the shared `firestoreDate` preprocessor from `$lib/shared/firestore/firestore-helpers` for all Timestamp fields. Keep the existing type exports as `z.infer<typeof Schema>` re-exports for backward compatibility.

Pattern for each:
```typescript
import { z } from 'zod';
import { firestoreDate } from '$lib/shared/firestore';

export const FestivalSchema = z.object({
  id: z.string(),
  name: z.string(),
  // ... all fields from the existing interface
  createdAt: firestoreDate,
  updatedAt: firestoreDate,
});
export type Festival = z.infer<typeof FestivalSchema>;
```

**Verify:** `npm run check` passes — schemas compile, inferred types match existing usage.

**Done:** 8 schema files exist. All using shared `firestoreDate`.

---

### Task B2: Migrate repos 1-5 (festivals cluster + user-location)

**Files (modify):**
- `src/lib/features/festivals/services/festival-repository.ts` (49 lines)
- `src/lib/features/festivals/services/festival-attendance-repository.ts` (54 lines)
- `src/lib/features/festivals/services/festival-tracker-repository.ts` (59 lines)
- `src/lib/features/festivals/services/workshop-portfolio-repository.ts` (46 lines)
- `src/lib/features/community/services/user-location-repository.ts` (194 lines)

**Action:**

Replace each file's implementation with thin delegations to `firestoreGet`/`firestoreList`/`firestoreSet`/`firestoreDelete`. Example (festival-repository.ts):

```typescript
import { firestoreGet, firestoreList, firestoreSet, firestoreDelete } from '$lib/shared/firestore';
import { FestivalSchema, type Festival } from '../domain/models/festival-schemas';

const COLLECTION = 'festivals';

export const getById = (id: string) => firestoreGet(COLLECTION, id, FestivalSchema);
export const list = () => firestoreList(COLLECTION, FestivalSchema);
export const create = (data: Omit<Festival, 'id'>) => firestoreSet(COLLECTION, null, data);
export const update = (id: string, data: Partial<Festival>) => firestoreSet(COLLECTION, id, data, { merge: true });
export const deleteFestival = (id: string) => firestoreDelete(COLLECTION, id);
```

Preserve existing export names so consumers don't break.

Special case: `user-location-repository` (194 lines) has geo queries and `UserLocationWithProfile` join logic. Keep the geo/join as domain code but delegate Firestore reads to shared CRUD.

**Verify:** `npm run check` passes. Grep for `getFirestoreInstance` in modified files returns zero hits.

**Done:** 5 repos migrated. Each under 20 lines (except user-location which keeps domain logic).

---

### Task B3: Migrate repos 6-9 (misc simple)

**Files (modify):**
- `src/lib/features/loop-labeler/services/implementations/LOOPLabelsFirebaseRepository.ts` (276 lines)
- `src/lib/features/landing/services/implementations/SpinnerMetricsRepository.ts` (176 lines)
- `src/lib/features/landing/services/implementations/BroadcastRepository.ts` (235 lines)
- `src/lib/features/create/generate/services/favorite-config-repository.ts` (108 lines)

**Action:**

Same pattern as B2. Special cases:
- `LOOPLabelsFirebaseRepository` (276 lines) has localStorage caching — keep the cache layer but delegate Firestore calls to shared CRUD. The localStorage logic stays (it's not Firestore plumbing).
- `BroadcastRepository` (235 lines) uses realtime listeners — use `firestoreListen` for the subscription path.
- `SpinnerMetricsRepository` (176 lines) — straightforward CRUD delegation.
- `favorite-config-repository` (108 lines) — user-scoped (`users/{uid}/favoriteConfigs`). Uses `requireAuth()` + `firestoreGet`/`firestoreSet`.

**Verify:** `npm run check` passes. No `as MyType` casts remain in these 4 files.

**Done:** 9/21 repos migrated. All simple repos complete.

---

## Phase C: Medium Repository Migrations (repos 10-16)

**Goal:** Migrate repos with 100-365 lines. These have more consumers, realtime listeners, and auth guards.

### Task C1: Create Zod schemas for medium domain models

**Files (new):**
- `src/lib/shared/pictograph/arrow/positioning/prop-geometry/domain/prop-geometry-schemas.ts`
- `src/lib/shared/pictograph/arrow/positioning/global/domain/arrow-adjustment-schemas.ts`
- `src/lib/features/compose/compose/domain/composition-schemas.ts`
- `src/lib/shared/voice-control/domain/voice-session-schemas.ts`
- `src/lib/shared/foundation/domain/models/hand-path-schemas.ts`
- `src/lib/shared/foundation/domain/models/solo-prop-schemas.ts`
- `src/lib/features/tika/domain/models/tika-session-schemas.ts`
- `src/lib/features/arena/domain/models/arena-schemas.ts`

**Action:**

Same schema-creation pattern as B1. For complex nested types (VoiceSession has `events[]` and nested `stats`), define sub-schemas and compose. Use `.passthrough()` on schemas where documents may have extra fields from older versions (prevents data loss on re-save).

For auth-gated repos (voice-sessions, hand-paths, solo-props, tika, compositions), the collection path is dynamic: `users/${userId}/subcollection`. The shared CRUD already accepts path strings, so these repos will call `requireAuth()` to get the userId and construct the path.

**Verify:** `npm run check` passes.

**Done:** 8 schema files exist for medium repos.

---

### Task C2: Migrate repos 10-13

**Files (modify):**
- `src/lib/shared/pictograph/arrow/positioning/prop-geometry/services/implementations/PropGeometryAdjustmentPersister.ts` (129 lines)
- `src/lib/shared/pictograph/arrow/positioning/global/services/implementations/GlobalArrowAdjustmentPersister.ts` (365 lines)
- `src/lib/features/compose/services/firebase-composition-repository.ts` (241 lines)
- `src/lib/features/voice-sessions/services/voice-session-repository.ts` (276 lines)

**Action:**

- `PropGeometryAdjustmentPersister` and `GlobalArrowAdjustmentPersister` — straightforward delegation. GlobalArrow is larger (365 lines) due to caching and batch operations; keep cache logic, delegate individual Firestore calls.
- `firebase-composition-repository` (241 lines) — remove the local `stripUndefined` (now in shared), remove `compositionToFirestoreDoc`/`firestoreDocToComposition` manual mappers (Zod handles this). Keep fire-and-forget pattern by using `firestoreSet` with `trackOffline: true`.
- `voice-session-repository` (276 lines) — remove local `toDate`, `sanitizeForFirestore`, `getUserId`, `mapDocToSession`, `mapDocToPreview`, `mapStats`. These all become: Zod schema parsing. Keep `enforceSessionLimit` as domain logic but have it call `firestoreList` + `firestoreDelete` instead of raw Firestore.

**Verify:** `npm run check` passes. `VoiceSessionError` still exported (consumers may catch it). Grep these 4 files for `as ` casts returns zero.

**Done:** 4 medium repos migrated. `stripUndefined` exists in exactly 1 place (shared).

---

### Task C3: Migrate repos 14-16

**Files (modify):**
- `src/lib/shared/foundation/services/implementations/HandPathRepository.ts` (179 lines)
- `src/lib/shared/foundation/services/implementations/SoloPropRepository.ts` (178 lines)
- `src/lib/features/tika/services/tika-session-repository.ts` (638 lines)

**Action:**

- `HandPathRepository` and `SoloPropRepository` — have visibility filters and user-scoped paths. Delegate queries to `firestoreList` with `where` clauses. Keep visibility toggling as domain logic.
- `tika-session-repository` (638 lines — much larger than originally estimated) — has realtime listeners and transactions. Use `firestoreListen` for the realtime path. For transactions, keep raw Firestore `runTransaction` (the shared layer doesn't wrap transactions — they're too domain-specific). But the schema validation still applies on reads within the transaction. Expected reduction: ~638 to ~350 (plumbing gone, domain logic stays).

**Verify:** `npm run check` passes. All realtime listeners still function (test by confirming `onSnapshot` usage routes through `firestoreListen` or direct firebase import for transactions).

**Done:** 16/21 repos migrated.

---

## Phase D: Complex Repository Migrations (repos 17-21)

**Goal:** Migrate the 5 heaviest repositories. These won't fully collapse but their Firestore calls become validated.

### Task D1: Migrate arena-repository

**Files (modify):**
- `src/lib/features/arena/services/arena-repository.ts` (342 lines)

**Schemas:** Use `arena-schemas.ts` from C1.

**Action:**

Multi-collection repo (arenaRatings, arenaVotes, arenaSnapshots). Each collection gets its own schema. Batch writes stay as-is (shared layer doesn't wrap `writeBatch`). Individual reads use `firestoreGet`/`firestoreList` with appropriate schemas.

**Verify:** `npm run check` passes.

**Done:** 17/21 repos migrated.

---

### Task D2: Migrate feedback service files

**Files (modify — feedback is split across 12 Firestore-calling services, NOT a single repo):**
- `src/lib/features/feedback/services/implementations/FeedbackQuerier.ts`
- `src/lib/features/feedback/services/implementations/FeedbackStatusManager.ts`
- `src/lib/features/feedback/services/implementations/FeedbackSubscriber.ts`
- `src/lib/features/feedback/services/implementations/FeedbackTesterWorkflow.ts`
- `src/lib/features/feedback/services/feedback-submission-service.ts`
- `src/lib/features/feedback/services/feedback-subtask-manager.ts`
- `src/lib/features/feedback/services/version-service.ts`
- `src/lib/features/feedback/services/contributor-loader.ts`
- `src/lib/features/feedback/services/notification-preferences-manager.ts`
- `src/lib/features/feedback/services/notification-trigger-service.ts`
- `src/lib/features/feedback/services/implementations/ArchiveLoader.ts`
- `src/lib/features/feedback/services/implementations/Notifier.ts`

**Schemas (new):**
- `src/lib/features/feedback/domain/models/feedback-schemas.ts`

**Action:**

The `FeedbackRepository.ts` file (218 lines) is actually a **facade class** that delegates to the above services — it has zero direct Firestore calls. The migration target is the 12 service files, not the facade.

Strategy: Create `FeedbackItemSchema` etc., then update each service file to use `firestoreGet`/`firestoreList`/`firestoreSet` instead of raw Firestore. The facade stays unchanged (it doesn't touch Firestore).

**Verify:** `npm run check` passes.

**Done:** 18/21 repos migrated.

---

### Task D3: Migrate user-repository and SequenceRepository

**Files (modify):**
- `src/lib/shared/community/services/user-repository.ts` (827 lines)
- `src/lib/features/create/shared/services/implementations/SequenceRepository.ts` (258 lines)

**Schemas (new):**
- `src/lib/shared/community/domain/models/user-schemas.ts`
- Reuse existing `SequenceDataSchema` from `$lib/shared/foundation/domain/schemas.ts`

**Action:**

`user-repository` (827 lines) — complex queries, pagination, realtime listeners, transactions:
  - Simple reads (getById, getByUsername) → `firestoreGet` with UserSchema
  - List queries (search, paginate) → `firestoreList` with pagination options
  - Realtime presence → `firestoreListen`
  - Follow/unfollow transactions → keep raw `runTransaction`
  - Keep pagination cursor logic as domain code, but validate each page of results
  - Note: `implementations/UserRepository.ts` (957 lines) also exists — check if it duplicates the facade or extends it. Migrate whichever contains the Firestore calls; the other may become dead code.

`SequenceRepository` (258 lines) — hybrid Dexie + Firestore. Only the Firestore portion migrates:
  - Remote read paths → `firestoreGet`/`firestoreList` with existing `SequenceDataSchema`
  - Remote write paths → `firestoreSet` with `trackOffline: true`
  - Dexie paths stay unchanged (different backend, out of scope per spec)

**Verify:** `npm run check` passes. Dexie imports untouched.

**Done:** 20/21 repos migrated.

---

### Task D4: Migrate LibraryRepository

**Files (modify):**
- `src/lib/features/library/services/implementations/LibraryRepository.ts` (1,555 lines)

**Schemas (new):**
- `src/lib/features/library/domain/models/library-sequence-schemas.ts`

**Action:**

This is the largest repository. Strategy: separate domain logic from Firestore plumbing.

1. Remove the local `stripUndefined` (already in shared)
2. Create `LibrarySequenceSchema` for read validation
3. Replace individual `getDoc`/`getDocs` calls with `firestoreGet`/`firestoreList`
4. Replace individual `setDoc`/`addDoc` calls with `firestoreSet`
5. Keep batch operations (`writeBatch`) as raw Firestore — batches are domain-coordinated
6. Keep `onSnapshot` listeners — use `firestoreListen` where possible, raw for complex multi-doc listeners
7. Keep all domain logic (hydration, tag migration, hash computation, public index sync, conflict resolution)

Expected reduction: ~1,555 to ~800-1,000 lines (domain logic stays, plumbing disappears).

**Verify:** `npm run check` passes. `stripUndefined` no longer defined locally. All `getDoc`/`setDoc` calls that don't involve transactions or batches are replaced.

**Done:** 21/21 repos migrated.

---

## Phase E: Cleanup and Verification

### Task E1: Remove dead code, verify no regressions

**Action:**

1. Grep entire codebase for orphaned `toDate` helper functions — delete all
2. Grep for `stripUndefined` — should only exist in `$lib/shared/firestore/firestore-helpers.ts`
3. Grep for `as Festival`, `as VoiceSession`, etc. (the old unsafe casts) — should be zero in repository files
4. Run full typecheck: `npm run check`
5. Run full test suite: `npm test`
6. Count remaining `?.` usages downstream of repositories (for metrics, not to fix now)

**Verify:** `npm run check` and `npm test` both pass. Zero `toDate` helpers outside shared. Zero `stripUndefined` outside shared.

**Done:** Codebase clean. Spec success metrics met (or measurably improved).

---

## The 21 Repositories — Corrected Reference

| # | Actual path | Lines | Phase | Complexity |
|---|-------------|-------|-------|------------|
| 1 | `features/festivals/services/festival-repository.ts` | 49 | B2 | Simple CRUD |
| 2 | `features/festivals/services/festival-attendance-repository.ts` | 54 | B2 | Simple CRUD |
| 3 | `features/festivals/services/festival-tracker-repository.ts` | 59 | B2 | Simple CRUD |
| 4 | `features/festivals/services/workshop-portfolio-repository.ts` | 46 | B2 | Simple CRUD |
| 5 | `features/community/services/user-location-repository.ts` | 194 | B2 | CRUD + geo |
| 6 | `features/loop-labeler/services/implementations/LOOPLabelsFirebaseRepository.ts` | 276 | B3 | CRUD + localStorage cache |
| 7 | `features/landing/services/implementations/SpinnerMetricsRepository.ts` | 176 | B3 | Simple CRUD |
| 8 | `features/landing/services/implementations/BroadcastRepository.ts` | 235 | B3 | CRUD + realtime |
| 9 | `features/create/generate/services/favorite-config-repository.ts` | 108 | B3 | CRUD + auth |
| 10 | `shared/pictograph/arrow/positioning/prop-geometry/services/implementations/PropGeometryAdjustmentPersister.ts` | 129 | C2 | Simple CRUD |
| 11 | `shared/pictograph/arrow/positioning/global/services/implementations/GlobalArrowAdjustmentPersister.ts` | 365 | C2 | CRUD + cache + batch |
| 12 | `features/compose/services/firebase-composition-repository.ts` | 241 | C2 | CRUD + stripUndefined |
| 13 | `features/voice-sessions/services/voice-session-repository.ts` | 276 | C2 | CRUD + auth + dates |
| 14 | `shared/foundation/services/implementations/HandPathRepository.ts` | 179 | C3 | CRUD + filters + visibility |
| 15 | `shared/foundation/services/implementations/SoloPropRepository.ts` | 178 | C3 | CRUD + filters + visibility |
| 16 | `features/tika/services/tika-session-repository.ts` | 638 | C3 | CRUD + realtime + transactions |
| 17 | `features/arena/services/arena-repository.ts` | 342 | D1 | Multi-collection + batch |
| 18 | `features/feedback/services/` (12 service files) | ~1,200 | D2 | Distributed CRUD across facade |
| 19 | `shared/community/services/user-repository.ts` | 827 | D3 | Read-heavy + pagination + realtime |
| 20 | `features/create/shared/services/implementations/SequenceRepository.ts` | 258 | D3 | Hybrid Dexie + Firestore |
| 21 | `features/library/services/implementations/LibraryRepository.ts` | 1,555 | D4 | Complex domain + batch + realtime |

**Total actual lines: ~5,800** (not ~4,500 as originally estimated)

---

## Dependency Graph

```
A1 (types + helpers)
 └─→ A2 (CRUD functions)
      └─→ A3 (unit tests)
           └─→ B1 (simple schemas)
                ├─→ B2 (repos 1-5)
                └─→ B3 (repos 6-9)
                     └─→ C1 (medium schemas)
                          ├─→ C2 (repos 10-13)
                          └─→ C3 (repos 14-16)
                               └─→ D1 (arena)
                                    └─→ D2 (feedback services)
                                         └─→ D3 (user + sequence)
                                              └─→ D4 (library)
                                                   └─→ E1 (cleanup)
```

B2 and B3 can run in parallel after B1. C2 and C3 can run in parallel after C1.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Zod validation rejects existing Firestore data (field drift over time) | Repos return null instead of data | Use `.passthrough()` on schemas + log warnings (not throw). Fix schemas iteratively based on warning logs. |
| Consumer code relies on the `as MyType` shape including undefined fields | Type errors downstream | Each migration includes `npm run check`. Fix type errors before moving to next repo. |
| `z.coerce.date()` doesn't handle Firestore Timestamp objects | Dates come back as raw objects | Use custom `firestoreDate` preprocessor that checks for `.toDate()` method first. |
| LibraryRepository (1,555 lines) migration introduces subtle behavior change | Library features break | Migrate in sub-steps: helpers first, then reads, then writes. Test each sub-step. |
| Realtime listeners (`onSnapshot`) have different error semantics | Silent failures | `firestoreListen` includes an `onError` callback parameter with sensible default (log + continue). |
| Batch operations can't use the shared layer | Inconsistent validation on batch paths | Accept this for now — batch writes are already validated by TypeScript at the call site. Add batch helpers in a follow-up if pattern repeats. |
| Feedback is 12 files, not 1 | Larger Phase D2 than expected | Migrate in batches of 3-4 files. Schema is shared across all 12. |
| user-repository has facade + implementation (827 + 957 lines) | Possible duplication or dead code | Audit both files before migrating to determine which holds the Firestore calls. May consolidate during migration. |
| tika-session-repository is 638 lines (not ~300) | Longer C3 than expected | Split into: transaction paths (keep raw), read/write paths (migrate), realtime (use firestoreListen). |

## Execution Notes

- Each task is independently committable. Commit after each task passes `npm run check`.
- The shared layer (Phase A) is the foundation — nothing else starts until A3 passes.
- Phases B/C can be split across sessions if context gets heavy. Each repo migration is atomic.
- The `firestoreDate` preprocessor is the key insight — it eliminates ALL custom `toDate()` implementations in one move.
- Use `.passthrough()` liberally on schemas during migration. Tighten later once all repos are migrated and you can audit what fields actually exist in production data.
- All paths in this plan verified against codebase as of 2026-05-03.
