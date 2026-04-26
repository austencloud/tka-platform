# Create Module Offline Persistence Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Make autosave and save-to-library work offline by writing to Dexie first, with background Firestore sync.

**Spec:** `docs/superpowers/specs/2026-03-17-create-offline-persistence-design.md`

---

## Task 1: Autosaver → Dexie-First

**Files:**
- Modify: `src/lib/features/create/shared/services/Autosaver.ts`

- [ ] **Step 1: Add Dexie imports and rewrite saveDraft()**

Add imports:
```typescript
import { db } from "$lib/shared/persistence/database/TKADatabase";
import { UserWorkType } from "$lib/shared/persistence/domain/enums/UserWorkType";
import { networkStatusState } from "$lib/shared/offline/state/network-status-state.svelte";
```

Rewrite `saveDraft()`:
```typescript
async saveDraft(
  sessionId: string,
  sequenceData: SequenceData
): Promise<void> {
  // Step 1: Always write to Dexie (instant, no auth required)
  await db.userWork.put({
    type: UserWorkType.SEQUENCE_DRAFT,
    tabId: "create",
    data: {
      sessionId,
      sequenceData,
      stepCount: sequenceData.steps.length,
      name: sequenceData.name,
    },
    lastModified: new Date(),
    version: 1,
  });

  this.isDirty = false;

  // Step 2: If authenticated, also sync to Firestore (non-blocking)
  const user = getAuthSync().currentUser;
  if (user) {
    const draftData = createDraftSequence(sessionId, user.uid, sequenceData);
    const draft: DraftSequence = {
      ...draftData,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };

    const firestore = await getFirestoreInstance();
    const draftRef = doc(firestore, `users/${user.uid}/drafts/${sessionId}`);
    trackWrite(() => setDoc(draftRef, draft, { merge: true })).catch((err) =>
      console.warn("[Autosaver] Firestore draft sync failed:", err)
    );
  }
}
```

- [ ] **Step 2: Rewrite loadDraft() to check Dexie first**

```typescript
async loadDraft(_sessionId?: string): Promise<DraftSequence | null> {
  // Step 1: Check Dexie first (instant, works offline)
  try {
    const localDraft = await db.userWork
      .where("[type+tabId]")
      .equals([UserWorkType.SEQUENCE_DRAFT, "create"])
      .first();

    if (localDraft?.data) {
      const data = localDraft.data as {
        sessionId: string;
        sequenceData: SequenceData;
        stepCount: number;
        name?: string;
      };
      return {
        sessionId: data.sessionId,
        userId: "",
        sequenceData: data.sequenceData,
        stepCount: data.stepCount,
        name: data.name,
        createdAt: null as unknown as Timestamp,
        updatedAt: null as unknown as Timestamp,
      };
    }
  } catch (err) {
    console.warn("[Autosaver] Dexie draft load failed:", err);
  }

  // Step 2: Fallback to Firestore if authenticated
  const user = getAuthSync().currentUser;
  if (!user || !_sessionId) return null;

  const firestore = await getFirestoreInstance();
  const draftRef = doc(firestore, `users/${user.uid}/drafts/${_sessionId}`);
  const snapshot = await getDoc(draftRef);

  if (!snapshot.exists()) return null;
  return snapshot.data() as DraftSequence;
}
```

- [ ] **Step 3: Verify build**

Run: `npm run check`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(offline): Dexie-first autosave in Autosaver"
```

---

## Task 2: CreateModule.svelte → Immediate Autosave, Lazy Sessions

**Files:**
- Modify: `src/lib/features/create/shared/components/CreateModule.svelte`

- [ ] **Step 1: Read the file and find the session/autosave initialization (around lines 310-350)**

- [ ] **Step 2: Modify the onMount to start autosave immediately**

Replace the session-dependent autosave initialization with:
```typescript
// Generate a local session ID (no Firestore dependency)
const localSessionId = crypto.randomUUID();

// Start autosave immediately — writes to Dexie, no auth needed
autosaver = new Autosaver();
autosaver.startAutosave(
  () => createModuleState?.sequenceState?.currentSequence || null,
  localSessionId,
  30000
);

// Lazy session creation — only when authenticated and online
if (authState.isAuthenticated && networkStatusState.isOnline) {
  try {
    sessionManager = new SessionManager();
    await sessionManager.createSession();
  } catch (sessionError) {
    console.warn("[CreateModule] Session creation deferred:", sessionError);
  }
}
```

Remove the `updateStepCount()` and `markAutosaved()` calls from any autosave-related code paths.

Guard the `abandonSession()` cleanup with `if (sessionManager?.getCurrentSession())`.

- [ ] **Step 3: Add networkStatusState import if not present**

```typescript
import { networkStatusState } from "$lib/shared/offline/state/network-status-state.svelte";
```

- [ ] **Step 4: Verify build**

Run: `npm run check`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(offline): immediate autosave in CreateModule, lazy session creation"
```

---

## Task 3: LibrarySaveService → Optimistic Dexie Save

**Files:**
- Modify: `src/lib/features/library/services/implementations/LibrarySaveService.ts`

- [ ] **Step 1: Add Dexie import**

```typescript
import { db } from "$lib/shared/persistence/database/TKADatabase";
```

- [ ] **Step 2: Modify saveSequence() to write to Dexie first**

After thumbnail generation (Step 1) and before the Firestore write (Step 4), insert the optimistic Dexie save:

```typescript
// Step 2: Optimistic save to Dexie (instant, works offline)
emitProgress(2);
const sequenceToSave = {
  ...sequence,
  name,
  displayName: displayName || undefined,
  tags: [...tags],
  thumbnails: thumbnailUrl ? [thumbnailUrl] : sequence.thumbnails ?? [],
  isFavorite: false,
};
try {
  await db.sequences.put(sequenceToSave);
} catch (dexieError) {
  console.warn("[LibrarySaveService] Dexie optimistic save failed:", dexieError);
  // Continue — Firestore save is the fallback
}
```

Then wrap the Firestore save (Step 4) as non-blocking:

```typescript
// Step 4: Background Firestore sync (non-blocking)
emitProgress(4);
const firestoreSave = async () => {
  try {
    const savedSequence = await this.libraryRepository.saveSequenceWithMetadata(
      sequence,
      { name, displayName: displayName || undefined, visibility, tags, notes, thumbnailUrl }
    );
    return savedSequence;
  } catch (error) {
    if (error instanceof LibraryError && error.code === "ALREADY_EXISTS") {
      toast.info("This exact sequence is already in your library.");
    } else {
      console.warn("[LibrarySaveService] Firestore sync failed (data safe in Dexie):", error);
    }
    return null;
  }
};

// Fire Firestore sync non-blocking
firestoreSave().catch(() => {});
```

Return the sequence ID from the Dexie save (use `sequence.id` or generate one) rather than waiting for Firestore.

- [ ] **Step 3: Verify build**

Run: `npm run check`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(offline): optimistic Dexie save in LibrarySaveService"
```

---

## Task 4: Integration Verification

- [ ] **Step 1: Build check**

Run: `npm run build && npm run check`

- [ ] **Step 2: Manual verification**

1. Open Create module, generate a sequence
2. Check DevTools → Application → IndexedDB → TKADatabase → userWork table
3. Verify a `sequence-draft` / `create` entry exists after 30s
4. Toggle offline in DevTools → Network
5. Generate another sequence, wait 30s — Dexie entry should update
6. Save to library — should succeed with no error modal
7. Check IndexedDB → sequences table — new entry should appear
8. Go back online — Firestore should sync (check Firebase Console)
