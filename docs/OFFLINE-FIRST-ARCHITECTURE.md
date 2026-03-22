# World-Class Offline-First Architecture for TKA Composer

**Feedback ID:** `HrimAyPGCzzbz1yIazCt`

## Goal

Transform TKA Composer into the gold standard for offline-first web apps - users should never know or care whether they're online.

---

## Current State (What's Already Working)

| Component | Status | Location |
|-----------|--------|----------|
| Firestore offline cache | ✅ Enabled | `firebase.ts:329-335` - `persistentLocalCache` + `persistentMultipleTabManager()` |
| PWA service worker | ✅ Workbox | `vite.config.ts:250-353` - precaching + runtime strategies |
| Dexie IndexedDB | ✅ Working | `TKADatabase.ts` - sequences, pictographs, tab state |
| Settings offline queue | ✅ Partial | `SettingsState.svelte.ts:420-446` - localStorage queue |
| Connection quality | ✅ Detected | `connection-quality.ts` - Network Information API |

## What's Missing

1. **Universal sync engine** - Only settings have offline queue
2. **Background Sync API** - Mutations don't survive app close
3. **Offline UI indicators** - Users don't know sync status
4. **Optimistic updates with rollback** - All mutations wait for server
5. **Conflict resolution** - Only last-write-wins (Firestore default)
6. **Service worker callbacks** - `onOfflineReady`, `onNeedRefresh` empty

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Svelte 5 UI   │────▶│   Sync Engine   │────▶│    Firestore    │
│   (Optimistic)  │     │   (IndexedDB)   │     │    (Cloud)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                        │
        ▼                       ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Rollback Handler│     │ Background Sync │     │ Real-time Sync  │
│ (on failure)    │     │ (Service Worker)│     │ (onSnapshot)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Key Principle**: Local-first. Write to IndexedDB immediately, sync to Firestore in background.

---

## Implementation Plan

### Phase 1: Sync Engine Foundation

**New files to create:**

```
src/lib/shared/offline/
├── domain/
│   └── models/
│       └── SyncOperation.ts          # Operation queue model
├── services/
│   ├── contracts/
│   │   ├── IOperationQueue.ts        # Queue interface
│   │   ├── ISyncEngine.ts            # Engine interface
│   │   └── INetworkStatusMonitor.ts  # Network detection
│   └── implementations/
│       ├── OperationQueue.ts         # IndexedDB-backed queue
│       ├── SyncEngine.ts             # Orchestrates sync
│       └── NetworkStatusMonitor.ts   # Online/offline + quality
├── state/
│   └── network-status-state.svelte.ts  # Reactive network state
└── components/
    ├── SyncStatusIndicator.svelte    # Header sync pill
    └── OfflineBanner.svelte          # "You're offline" toast
```

**Modify existing:**
- `src/lib/shared/persistence/database/TKADatabase.ts` - Add `syncOperations` table
- `src/lib/shared/di/containers/` - Add `offline-container.ts`
- `src/lib/shared/di/index.ts` - Export offline container

**SyncOperation model:**
```typescript
interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  collection: string;           // 'library', 'feedback', etc.
  documentId: string;
  payload: unknown;
  version: number;              // Optimistic locking
  createdAt: number;
  retryCount: number;
  status: 'pending' | 'in-flight' | 'failed';
  previousValue?: unknown;      // For rollback
}
```

### Phase 2: Network Status UI

**SyncStatusIndicator** (header component):
- Cloud icon with status: synced (✓), syncing (↻), offline (✕), error (!)
- Shows pending count on hover/click
- Uses `$derived` for reactive updates

**OfflineBanner** (toast-like):
- Slides in when going offline: "You're offline. Changes will sync when you reconnect."
- Auto-dismisses when back online: "Back online! Syncing X changes..."

**Wire into:**
- `src/lib/shared/modules/ModuleRenderer.svelte` or app layout

### Phase 3: Optimistic Updates

**Pattern for repositories:**
```typescript
async saveSequence(sequence: SequenceData): Promise<LibrarySequence> {
  // 1. Optimistic: update local immediately
  const libSeq = createLibrarySequence(sequence, userId);
  await db.sequences.put(libSeq);

  // 2. Queue for server sync
  await syncEngine.enqueue({
    type: 'create',
    collection: 'library',
    documentId: sequence.id,
    payload: sequence,
    previousValue: null,  // For rollback
  });

  // 3. Return immediately (UI shows new data)
  return libSeq;
}
```

**Rollback on failure:**
- SyncEngine emits `onOperationFailed`
- Repository listens and reverts local change using `previousValue`
- Toast: "Failed to save. Change reverted."

### Phase 4: Service Worker Background Sync

**Modify `src/hooks.client.ts`:**
```typescript
onRegisteredSW(swScriptUrl, registration) {
  // Register for background sync
  if ('sync' in registration) {
    registration.sync.register('tka-sync-queue');
  }
},
onOfflineReady() {
  toast.success("App ready for offline use");
},
onNeedRefresh() {
  toast.info("Update available. Refresh to apply.", 0); // Persistent
},
```

**Modify `vite.config.ts` Workbox:**
```typescript
workbox: {
  // ... existing
  runtimeCaching: [
    // ... existing
    {
      // Queue failed POST/PUT/DELETE for background sync
      urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
      handler: 'NetworkOnly',
      options: {
        backgroundSync: {
          name: 'tka-firestore-queue',
          options: { maxRetentionTime: 24 * 60 }, // 24 hours
        },
      },
    },
  ],
}
```

### Phase 5: Conflict Resolution

**Strategy by collection:**
| Collection | Strategy | Rationale |
|------------|----------|-----------|
| `settings` | Last-write-wins | Non-critical |
| `library/sequences` | Client-wins offline, merge online | User's work is precious |
| `feedback` | Server-wins | Admin controls state |
| `gamification` | Server-wins | Prevent manipulation |

**For sequences (most important):**
1. Track `_version` field on each sequence
2. On sync, compare versions
3. If server version > local version AND local has changes: **prompt user**
4. Dialog: "This sequence was updated elsewhere. Keep your changes / Use server version / View diff"

---

## Critical Files to Modify

| File | Change |
|------|--------|
| `TKADatabase.ts` | Add `syncOperations` table |
| `LibraryRepository.ts` | Use optimistic pattern + sync engine |
| `hooks.client.ts` | Wire Background Sync + PWA callbacks |
| `vite.config.ts` | Add Workbox backgroundSync config |
| `app.html` or layout | Add SyncStatusIndicator |

---

## Verification Plan

1. **Offline mutation test:**
   - Go offline (DevTools Network tab)
   - Create/edit a sequence
   - Verify it appears locally
   - Go online
   - Verify syncs to Firestore

2. **Background sync test:**
   - Go offline, make changes
   - Close browser completely
   - Reopen browser (while online)
   - Verify queued changes sync

3. **Conflict resolution test:**
   - Edit sequence on device A
   - Edit same sequence on device B (offline)
   - Bring device B online
   - Verify conflict UI appears

4. **UI indicator test:**
   - Toggle offline/online
   - Verify status indicator updates
   - Verify banner appears/dismisses

---

## Confirmed Decisions

- **Conflict resolution**: User decides via dialog (diff view, choose local/server/merge)
- **First repository**: Library (sequences) - most important user data

## Phased Rollout

| Phase | Scope | Duration |
|-------|-------|----------|
| 1 | Sync engine + operation queue | 3-4 sessions |
| 2 | Network status UI | 1-2 sessions |
| 3 | Optimistic updates for LibraryRepository | 2-3 sessions |
| 4 | Service worker Background Sync | 1-2 sessions |
| 5 | Conflict resolution dialog (user decides) | 2-3 sessions |

**Total estimate:** 10-15 focused sessions

---

## Sources

- [MDN: Offline and background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)
- [Firebase: Firestore offline persistence](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [LogRocket: Offline-first frontend apps 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
- [Workbox: Background Sync](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync/)
- [@vite-pwa/sveltekit](https://vite-pwa-org.netlify.app/frameworks/sveltekit.html)
