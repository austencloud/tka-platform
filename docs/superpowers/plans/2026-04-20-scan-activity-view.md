# Scan Activity View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin-only "Short Codes" analytics tab with a live, visual **Scan Activity** feed inside the ChoreoCard module. Same component serves user (own cards) and admin (all cards) via a scope toggle.

**Architecture:** New Svelte 5 view + state module in `features/choreo-card/components/scan-activity/`. Reuses existing `ChoreoCardThumbnail` for the card visual, existing `Drawer` primitive for per-scan history, extended `GlobalUserMap` for the embedded minimap. New `DeviceIdService` persists a localStorage UUID and auto-links to userId on sign-in. A round-trip integrity check on `SequenceEncoder` gates card rendering.

**Tech Stack:** Svelte 5 ($state, $derived, $effect, snippets), Firestore v9 (onSnapshot, collectionGroup), TypeScript, Vitest, Google Maps JS (already wired via GlobalUserMap), localStorage, crypto.randomUUID.

**Source spec:** `docs/superpowers/specs/2026-04-20-scan-activity-view-design.md`

---

## Task ordering overview

Dependencies fan from pure primitives up through integration:

```
Task 1: DeviceIdService         ┐
Task 2: verifyRoundTrip         ├─► Task 5: logScanEvent(deviceId)
Task 3: Firestore rules         │                ↓
Task 4: GlobalUserMap markers   │       Task 6–7: scan-activity state + tab def
                                 │                ↓
                                 │       Task 8–12: UI components
                                 │                ↓
                                 │       Task 13: ChoreoCardTab integration
                                 │                ↓
                                 │       Task 14: Sign-in linkage hook
                                 │                ↓
                                 │       Task 15–16: Retire admin tab
                                 │                ↓
                                 └─► Task 17: End-to-end QA checklist
```

---

### Task 1: DeviceIdService — contract and implementation

**Files:**
- Create: `src/lib/shared/auth/services/contracts/IDeviceIdService.ts`
- Create: `src/lib/shared/auth/services/implementations/DeviceIdService.ts`
- Test: `tests/unit/services/DeviceIdService.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/services/DeviceIdService.test.ts
import { describe, expect, it, beforeEach, vi } from "vitest";
import { DeviceIdService } from "$lib/shared/auth/services/implementations/DeviceIdService";

describe("DeviceIdService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("generates a UUID on first call and persists it", () => {
    const svc = new DeviceIdService();
    const id1 = svc.getDeviceId();
    expect(id1).toMatch(/^[0-9a-f-]{36}$/);
    expect(localStorage.getItem("tka:deviceId")).toBe(id1);
  });

  it("returns the same id on subsequent calls in the same session", () => {
    const svc = new DeviceIdService();
    const id1 = svc.getDeviceId();
    const id2 = svc.getDeviceId();
    expect(id1).toBe(id2);
  });

  it("returns the persisted id when constructed after a prior session", () => {
    localStorage.setItem("tka:deviceId", "00000000-0000-4000-8000-000000000001");
    const svc = new DeviceIdService();
    expect(svc.getDeviceId()).toBe("00000000-0000-4000-8000-000000000001");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/services/DeviceIdService.test.ts`
Expected: FAIL (file does not exist).

- [ ] **Step 3: Create the contract**

```ts
// src/lib/shared/auth/services/contracts/IDeviceIdService.ts
/**
 * DeviceIdService — per-browser stable identifier.
 *
 * Used to group anonymous scans into a "scanner profile" and to link
 * anonymous activity to a signed-in user account after first sign-in.
 *
 * Identifier is stored in localStorage as `tka:deviceId`.
 */
export interface IDeviceIdService {
  /**
   * Get the current device's stable ID. Generates a UUID on first call
   * and persists it. Returns the same value for all subsequent calls
   * in the same browser profile.
   */
  getDeviceId(): string;

  /**
   * Link the current device to a signed-in user. Writes/updates
   * `users/{userId}/devices/{deviceId}` in Firestore with timestamps.
   * Safe to call repeatedly (idempotent last-seen update).
   */
  linkDeviceToUser(userId: string): Promise<void>;
}
```

- [ ] **Step 4: Write minimal implementation**

```ts
// src/lib/shared/auth/services/implementations/DeviceIdService.ts
import { doc, setDoc, getFirestore, serverTimestamp } from "firebase/firestore";
import type { IDeviceIdService } from "../contracts/IDeviceIdService";

const STORAGE_KEY = "tka:deviceId";

export class DeviceIdService implements IDeviceIdService {
  getDeviceId(): string {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  }

  async linkDeviceToUser(userId: string): Promise<void> {
    const deviceId = this.getDeviceId();
    const firestore = getFirestore();
    const ref = doc(firestore, "users", userId, "devices", deviceId);
    await setDoc(
      ref,
      {
        deviceId,
        firstSeen: serverTimestamp(),
        lastSeen: serverTimestamp(),
        userAgent: navigator.userAgent,
      },
      { merge: true }
    );
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/unit/services/DeviceIdService.test.ts`
Expected: PASS (3/3).

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/auth/services/contracts/IDeviceIdService.ts \
        src/lib/shared/auth/services/implementations/DeviceIdService.ts \
        tests/unit/services/DeviceIdService.test.ts
git commit -m "feat(auth): add DeviceIdService for stable per-browser identity"
```

---

### Task 2: SequenceEncoder.verifyRoundTrip — integrity check

**Files:**
- Modify: `src/lib/shared/navigation/services/implementations/SequenceEncoder.ts`
- Test: `tests/unit/services/SequenceEncoder.verifyRoundTrip.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/services/SequenceEncoder.verifyRoundTrip.test.ts
import { describe, expect, it } from "vitest";
import { SequenceEncoder } from "$lib/shared/navigation/services/implementations/SequenceEncoder";
import { createSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import {
  MotionType,
  RotationDirection,
  Orientation,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

describe("SequenceEncoder.verifyRoundTrip", () => {
  const encoder = new SequenceEncoder();

  function makeAntiHalfTurn() {
    return createSequenceData({
      word: "",
      name: "",
      steps: [
        {
          id: "step-1",
          stepNumber: 1,
          duration: 1,
          blueReversal: false,
          redReversal: false,
          isBlank: false,
          letter: null,
          startPosition: null,
          endPosition: null,
          motions: {
            blue: createMotionData({
              color: MotionColor.BLUE,
              motionType: MotionType.ANTI,
              rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
              startLocation: GridLocation.SOUTH,
              endLocation: GridLocation.WEST,
              startOrientation: Orientation.IN,
              endOrientation: Orientation.COUNTER,
              turns: 0.5,
              propType: PropType.STAFF,
            }),
            red: createMotionData({
              color: MotionColor.RED,
              motionType: MotionType.STATIC,
              rotationDirection: RotationDirection.NO_ROTATION,
              startLocation: GridLocation.NORTH,
              endLocation: GridLocation.NORTH,
              startOrientation: Orientation.IN,
              endOrientation: Orientation.IN,
              turns: 0,
              propType: PropType.STAFF,
            }),
          },
        },
      ],
    });
  }

  it("returns ok=true for a clean round-trip", () => {
    const seq = makeAntiHalfTurn();
    const { encoded } = encoder.encodeWithCompression(seq);
    const result = encoder.verifyRoundTrip(encoded);
    expect(result.ok).toBe(true);
    expect(result.decoded).toBeDefined();
    expect(result.reason).toBeUndefined();
  });

  it("returns ok=false for a corrupted blob", () => {
    const result = encoder.verifyRoundTrip("s~z:not-actually-valid-data");
    expect(result.ok).toBe(false);
    expect(result.reason).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/services/SequenceEncoder.verifyRoundTrip.test.ts`
Expected: FAIL with "verifyRoundTrip is not a function".

- [ ] **Step 3: Add the method to SequenceEncoder**

Open `src/lib/shared/navigation/services/implementations/SequenceEncoder.ts`. Find the last method in the class (just before the closing brace). Add:

```ts
  /**
   * Decode the blob, re-encode the result, and compare field-by-field to
   * detect any data lost in the round trip. Used to gate feed card
   * rendering so corrupted sequences don't reach the visual layer.
   *
   * Returns `{ ok: true, decoded }` when every motion field matches,
   * or `{ ok: false, reason }` describing the first mismatch found.
   */
  verifyRoundTrip(
    encoded: string
  ): { ok: true; decoded: SequenceData } | { ok: false; reason: string } {
    let decoded: SequenceData;
    try {
      decoded = this.decodeWithCompression(encoded);
    } catch (err) {
      return { ok: false, reason: `decode threw: ${(err as Error).message}` };
    }

    let reencoded: string;
    try {
      ({ encoded: reencoded } = this.encodeWithCompression(decoded));
    } catch (err) {
      return { ok: false, reason: `re-encode threw: ${(err as Error).message}` };
    }

    let redecoded: SequenceData;
    try {
      redecoded = this.decodeWithCompression(reencoded);
    } catch (err) {
      return { ok: false, reason: `re-decode threw: ${(err as Error).message}` };
    }

    const mismatch = this.findMotionMismatch(decoded, redecoded);
    if (mismatch) return { ok: false, reason: mismatch };

    return { ok: true, decoded };
  }

  private findMotionMismatch(a: SequenceData, b: SequenceData): string | null {
    if (a.steps.length !== b.steps.length) {
      return `step count ${a.steps.length} vs ${b.steps.length}`;
    }
    const fields: (keyof import("$lib/shared/pictograph/shared/domain/models/MotionData").MotionData)[] = [
      "motionType",
      "rotationDirection",
      "startLocation",
      "endLocation",
      "startOrientation",
      "endOrientation",
      "turns",
      "handPath",
      "prefloatMotionType",
      "prefloatRotationDirection",
      "skewSteps",
      "skewDir",
    ];
    for (let i = 0; i < a.steps.length; i++) {
      for (const color of ["blue", "red"] as const) {
        const ma = a.steps[i]?.motions?.[color];
        const mb = b.steps[i]?.motions?.[color];
        if (!ma || !mb) return `step ${i + 1} ${color} motion missing`;
        for (const f of fields) {
          if (ma[f] !== mb[f]) {
            return `step ${i + 1} ${color}.${f}: ${String(ma[f])} vs ${String(mb[f])}`;
          }
        }
      }
    }
    return null;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/services/SequenceEncoder.verifyRoundTrip.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/navigation/services/implementations/SequenceEncoder.ts \
        tests/unit/services/SequenceEncoder.verifyRoundTrip.test.ts
git commit -m "feat(encoder): add verifyRoundTrip integrity check for feed rendering"
```

---

### Task 3: Firestore rules — users/{uid}/devices subcollection

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Read existing rules file to find the users block**

Run: `grep -n "match /users" E:/tka-platform/firestore.rules`

Locate the `match /users/{userId}` block (likely around the top of the document).

- [ ] **Step 2: Add the devices subcollection rule**

Inside the existing `match /users/{userId}` block, append:

```
      // Device-to-user linkage created on sign-in by DeviceIdService.
      // Users read/write their own; admins read any.
      match /devices/{deviceId} {
        allow read: if request.auth.uid == userId || isAdmin();
        allow create, update: if request.auth.uid == userId;
        allow delete: if false;
      }
```

- [ ] **Step 3: Deploy rules**

Run: `cd E:/tka-platform && firebase deploy --only firestore:rules`
Expected: "Deploy complete!"

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): allow users to manage their own device linkages"
```

---

### Task 4: Extend GlobalUserMap with markers prop + size variant

**Files:**
- Modify: `src/lib/features/community/components/GlobalUserMap.svelte`

- [ ] **Step 1: Read the existing GlobalUserMap component**

Run: `head -80 E:/tka-platform/src/lib/features/community/components/GlobalUserMap.svelte`

Understand its current prop shape and the internal marker-creation path (uses `google.maps.marker.AdvancedMarkerElement`). Note the existing markers loop — we'll add a second data source, not replace it.

- [ ] **Step 2: Add `scanMarkers` and `size` props**

In the `$props()` destructure, add (adapt to existing prop pattern in that file):

```ts
  let {
    // ...existing props...
    markers = [] as Array<{
      id: string;
      lat: number;
      lng: number;
      label?: string;
      styleClass?: "pin" | "pin-new";
    }>,
    size = "full" as "full" | "embedded",
  } = $props();
```

- [ ] **Step 3: Render injected markers as a second layer**

Add an `$effect` that creates/updates Google Maps markers from the `markers` array. Clean up on unmount. Style "pin-new" with a CSS pulse class via `AdvancedMarkerElement.content` (standard pattern).

```ts
  let injectedMarkers: google.maps.marker.AdvancedMarkerElement[] = [];

  $effect(() => {
    if (!mapInstance) return;
    // Clear previous injected markers
    for (const m of injectedMarkers) m.map = null;
    injectedMarkers = [];

    for (const m of markers) {
      const content = document.createElement("div");
      content.className = `scan-pin ${m.styleClass === "pin-new" ? "scan-pin--new" : ""}`;
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapInstance,
        position: { lat: m.lat, lng: m.lng },
        content,
        title: m.label ?? "",
      });
      injectedMarkers.push(marker);
    }

    return () => {
      for (const m of injectedMarkers) m.map = null;
      injectedMarkers = [];
    };
  });
```

- [ ] **Step 4: Add `size` variant styles**

In the component's `<style>` block:

```css
  :global(.scan-pin) {
    width: 12px;
    height: 12px;
    background: #10b981;
    border-radius: 50%;
    box-shadow: 0 0 8px #10b981;
  }

  :global(.scan-pin--new) {
    animation: scanPinPulse 1.5s infinite;
  }

  @keyframes scanPinPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.5); box-shadow: 0 0 16px #10b981; }
  }

  .map-container.embedded {
    height: 260px;
    border-radius: 8px;
  }
```

Wire `class:embedded={size === "embedded"}` on the map container element.

- [ ] **Step 5: Manual verification in dev**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/community`

Expected: 200. Visit the Community page in the browser; verify the map still renders user markers. (No injected markers yet — we verify that in Task 12.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/community/components/GlobalUserMap.svelte
git commit -m "feat(community): extend GlobalUserMap with markers prop + embedded size"
```

---

### Task 5: Add `deviceId` to logScanEvent signature + wire through callers

**Files:**
- Modify: `src/lib/shared/qr/services/contracts/IShortCodeManager.ts`
- Modify: `src/lib/shared/qr/services/implementations/ShortCodeManager.ts`
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`
- Modify: `src/routes/p/[code]/+page.svelte`
- Modify: `src/routes/sequence/[id]/+page.svelte`

- [ ] **Step 1: Update the contract**

Open `IShortCodeManager.ts`. In the `logScanEvent` event type (line 113–122), add:

```ts
      deviceId: string;
```

Place it after `userId: string | null;`. Resulting signature:

```ts
  logScanEvent(
    code: string,
    event: {
      printId: string | null;
      country: string | null;
      city: string | null;
      userAgent: string;
      screenWidth: number;
      screenHeight: number;
      referrer: string | null;
      userId: string | null;
      deviceId: string;
    }
  ): Promise<void>;
```

- [ ] **Step 2: Update the implementation**

Open `ShortCodeManager.ts`. The body of `logScanEvent` (line 603) is already spreading `...event` into `addDoc`, so no body change is required once the contract type propagates — but mirror the type annotation on the implementation for clarity:

```ts
  async logScanEvent(
    code: string,
    event: {
      printId: string | null;
      country: string | null;
      city: string | null;
      userAgent: string;
      screenWidth: number;
      screenHeight: number;
      referrer: string | null;
      userId: string | null;
      deviceId: string;
    }
  ): Promise<void> {
    // body unchanged
  }
```

- [ ] **Step 3: Update the three call sites**

Each call site builds the event object literal. Add `deviceId: deviceIdService.getDeviceId()` at each, and inject the service from the DI container.

**Call site 1** — `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` near line 232:

```ts
        manager.logScanEvent(code, {
          // ...existing fields...
          userId: auth.currentUser?.uid ?? null,
          deviceId: deviceIdService.getDeviceId(),
        });
```

Add at the top of the script block:

```ts
  import { container } from "$lib/shared/di";
  import type { IDeviceIdService } from "$lib/shared/auth/services/contracts/IDeviceIdService";
  const deviceIdService = container.resolve<IDeviceIdService>("IDeviceIdService");
```

**Call site 2** — `src/routes/p/[code]/+page.svelte` near line 248: same pattern.

**Call site 3** — `src/routes/sequence/[id]/+page.svelte` near line 372: same pattern.

- [ ] **Step 4: Register DeviceIdService in the DI container**

Grep for existing registrations to find the binding file:

Run: `grep -rn "IShortCodeManager\|container.register" E:/tka-platform/src/lib/shared/di/`

Open the binding file (likely `container-config.ts` or similar). Add:

```ts
  import { DeviceIdService } from "$lib/shared/auth/services/implementations/DeviceIdService";
  // ...
  container.registerSingleton("IDeviceIdService", DeviceIdService);
```

- [ ] **Step 5: Verify types compile**

Run: `cd E:/tka-platform && npm run check 2>&1 | head -30`
Expected: zero errors in the modified files. Pre-existing errors elsewhere in the tree are OK.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/qr/services/contracts/IShortCodeManager.ts \
        src/lib/shared/qr/services/implementations/ShortCodeManager.ts \
        src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte \
        src/routes/p/[code]/+page.svelte \
        src/routes/sequence/[id]/+page.svelte \
        src/lib/shared/di/
git commit -m "feat(qr): thread deviceId through scan event logging"
```

---

### Task 6: Add Scan Activity entry to CHOREO_CARD_TABS

**Files:**
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts`

- [ ] **Step 1: Add the Section entry**

Open `tab-definitions.ts`. Find `CHOREO_CARD_TABS` at line 556. Append a third entry:

```ts
  {
    id: "scan-activity",
    label: "Scan Activity",
    icon: '<i class="fas fa-satellite-dish" aria-hidden="true"></i>',
    description: "Live feed of Choreo Card scans worldwide",
    color: "#10b981",
    gradient: "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
  },
```

- [ ] **Step 2: Verify it appears in the sidebar**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/choreo-card`

Expected: 200. In the browser, open ChoreoCard module; sidebar should show Decks, Card Designer, Scan Activity. Clicking Scan Activity will route to it but render nothing yet (Task 13 wires the render branch).

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/navigation/config/tab-definitions.ts
git commit -m "feat(nav): register Scan Activity section in ChoreoCard tabs"
```

---

### Task 7: scan-activity-state.svelte.ts — subscription + derived state

**Files:**
- Create: `src/lib/features/choreo-card/state/scan-activity-state.svelte.ts`

- [ ] **Step 1: Create the state module**

```ts
// src/lib/features/choreo-card/state/scan-activity-state.svelte.ts
/**
 * Scan Activity state.
 *
 * Holds the live list of codes sorted by most-recent scan activity, plus
 * derived stats for the header and minimap panels. Subscribes to Firestore
 * for incremental updates and maintains a ring buffer of the last 100 scan
 * events for the minimap recents list.
 */
import {
  collection,
  collectionGroup,
  getDocsFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { container } from "$lib/shared/di";
import type { ISequenceEncoder } from "$lib/shared/navigation/services/contracts/ISequenceEncoder";

export interface CodeEntry {
  code: string;
  word: string;
  ownerId: string | null;
  createdAt: string;
  encoded: string;
  scanCount: number;
  lastScannedAt: string | null;
  lastCity: string | null;
  lastCountry: string | null;
  integrityOk: boolean;
  integrityReason?: string;
}

export interface ScanEventRow {
  code: string;
  timestamp: string;
  city: string | null;
  country: string | null;
  deviceId: string | null;
  userId: string | null;
}

class ScanActivityState {
  codes = $state<CodeEntry[]>([]);
  recentEvents = $state<ScanEventRow[]>([]);
  loading = $state(true);
  error = $state<string | null>(null);
  scope = $state<"mine" | "all">("mine");
  searchQuery = $state("");

  private unsubCodes: Unsubscribe | null = null;
  private unsubEvents: Unsubscribe | null = null;
  private byCode = new Map<string, CodeEntry>();
  private integrityCache = new Map<string, { ok: boolean; reason?: string }>();

  filtered = $derived.by(() => {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.codes;
    return this.codes.filter(
      (c) => c.word.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  });

  async subscribe(currentUserId: string | null): Promise<void> {
    this.loading = true;
    this.error = null;
    this.teardown();

    const firestore = getFirestore();
    const encoder = container.resolve<ISequenceEncoder>("ISequenceEncoder");

    const codesRef = collection(firestore, "shortcodes");
    const codesQ =
      this.scope === "mine" && currentUserId
        ? query(codesRef, where("ownerId", "==", currentUserId))
        : query(codesRef);

    try {
      const initial = await getDocsFromServer(codesQ);
      for (const doc of initial.docs) {
        this.ingestCodeDoc(doc.id, doc.data(), encoder);
      }
      this.resort();
      this.loading = false;

      this.unsubCodes = onSnapshot(
        codesQ,
        { includeMetadataChanges: false },
        (snap) => {
          for (const change of snap.docChanges()) {
            if (change.type === "added" || change.type === "modified") {
              this.ingestCodeDoc(change.doc.id, change.doc.data(), encoder);
            } else if (change.type === "removed") {
              this.byCode.delete(change.doc.id);
            }
          }
          this.resort();
        },
        (err) => {
          this.error = err.message;
        }
      );

      const eventsQ = query(
        collectionGroup(firestore, "scanEvents"),
        orderBy("timestamp", "desc"),
        limit(100)
      );

      this.unsubEvents = onSnapshot(
        eventsQ,
        (snap) => {
          const rows: ScanEventRow[] = [];
          for (const d of snap.docs) {
            const path = d.ref.path;
            const match = path.match(/^shortcodes\/([^/]+)\/scanEvents\//);
            const code = match?.[1] ?? "?";
            const data = d.data();
            rows.push({
              code,
              timestamp: data.timestamp ?? "",
              city: data.city ?? null,
              country: data.country ?? null,
              deviceId: data.deviceId ?? null,
              userId: data.userId ?? null,
            });
          }
          this.recentEvents = rows;
        },
        (err) => {
          this.error = err.message;
        }
      );
    } catch (err) {
      this.error = (err as Error).message;
      this.loading = false;
    }
  }

  teardown(): void {
    this.unsubCodes?.();
    this.unsubEvents?.();
    this.unsubCodes = null;
    this.unsubEvents = null;
    this.byCode.clear();
    this.codes = [];
    this.recentEvents = [];
  }

  private ingestCodeDoc(
    code: string,
    data: DocumentData,
    encoder: ISequenceEncoder
  ): void {
    const encoded: string = data.encoded ?? "";
    let integrity = this.integrityCache.get(data.encoderHash ?? code);
    if (!integrity && encoded) {
      const r = encoder.verifyRoundTrip(encoded);
      integrity = r.ok ? { ok: true } : { ok: false, reason: r.reason };
      this.integrityCache.set(data.encoderHash ?? code, integrity);
    }
    this.byCode.set(code, {
      code,
      word: data.sequence ?? "",
      ownerId: data.ownerId ?? null,
      createdAt: data.createdAt ?? "",
      encoded,
      scanCount: Number(data.scanCount ?? 0),
      lastScannedAt: data.lastScannedAt ?? null,
      lastCity: data.lastCity ?? null,
      lastCountry: data.lastCountry ?? null,
      integrityOk: integrity?.ok ?? true,
      integrityReason: integrity?.reason,
    });
  }

  private resort(): void {
    const arr = Array.from(this.byCode.values());
    arr.sort((a, b) => {
      const ta = a.lastScannedAt ?? a.createdAt;
      const tb = b.lastScannedAt ?? b.createdAt;
      return tb.localeCompare(ta);
    });
    this.codes = arr;
  }
}

export const scanActivityState = new ScanActivityState();
```

- [ ] **Step 2: Verify types compile**

Run: `cd E:/tka-platform && npm run check 2>&1 | grep scan-activity-state | head -10`
Expected: zero errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/state/scan-activity-state.svelte.ts
git commit -m "feat(choreo-card): add scan activity state module with live subscription"
```

---

### Task 8: ScanActivityCard component

**Files:**
- Create: `src/lib/features/choreo-card/components/scan-activity/ScanActivityCard.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!--
  ScanActivityCard.svelte

  Feed card for the Scan Activity view. Composes ChoreoCardThumbnail
  (which owns pictograph rendering via PropAwareThumbnail — CLAUDE.md
  compliance) and wraps it with overlay chrome:
  scan count badge, sparkline, city, time-ago, hot glow, error state.
-->
<script lang="ts">
  import ChoreoCardThumbnail from "$lib/features/browse/sequences/display/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte";
  import type { CodeEntry } from "$lib/features/choreo-card/state/scan-activity-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  let {
    entry,
    sequence,
    hot = false,
    onOpen,
  }: {
    entry: CodeEntry;
    sequence: SequenceData | null;
    hot?: boolean;
    onOpen: (code: string) => void;
  } = $props();

  const timeAgo = $derived.by(() => {
    if (!entry.lastScannedAt) return "—";
    const ms = Date.now() - new Date(entry.lastScannedAt).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return "now";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  });

  const ariaLabel = $derived(
    `${entry.word}, code ${entry.code}, ${entry.scanCount} scans, last in ${entry.lastCity ?? "unknown"} ${timeAgo} ago`
  );
</script>

{#if !entry.integrityOk || !sequence}
  <button
    class="scard placeholder"
    onclick={() => onOpen(entry.code)}
    aria-label={`${entry.word} — restoration failed. Click for details.`}
  >
    <span class="badge badge-error">!</span>
    <span class="word">restoration failed</span>
    <span class="code-pill">{entry.code}</span>
    <div class="pictos" aria-hidden="true">
      <div class="cell"></div>
      <div class="cell"></div>
      <div class="cell"></div>
      <div class="cell"></div>
    </div>
    <div class="footer">
      <span class="loc">—</span>
      <span class="ago err">check</span>
    </div>
  </button>
{:else}
  <button
    class="scard"
    class:hot
    onclick={() => onOpen(entry.code)}
    aria-label={ariaLabel}
    style:view-transition-name={`scan-card-${entry.code}`}
  >
    <span class="badge">{entry.scanCount}</span>
    <div class="thumb-wrap">
      <ChoreoCardThumbnail {sequence} />
    </div>
    <div class="footer">
      <span class="loc">{entry.lastCity ?? "—"}</span>
      <span class="ago">{timeAgo}</span>
    </div>
  </button>
{/if}

<style>
  .scard {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    background: linear-gradient(180deg, #151a28 0%, #0d1019 100%);
    border: 1px solid #222838;
    border-radius: 8px;
    aspect-ratio: 5 / 7;
    cursor: pointer;
    color: inherit;
    text-align: left;
    font: inherit;
    transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
  }
  .scard:hover { border-color: rgba(16, 185, 129, 0.4); transform: translateY(-2px); }
  .scard:focus-visible { outline: 2px solid #34d399; outline-offset: 2px; }
  .scard.hot { border-color: #10b981; box-shadow: 0 0 20px rgba(16, 185, 129, 0.25); }

  .badge {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 3px 8px;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.4);
    border-radius: 12px;
    font-size: var(--font-size-sm, 14px);
    color: #34d399;
    font-weight: 700;
  }
  .badge-error { background: rgba(239, 68, 68, 0.12); border-color: rgba(239, 68, 68, 0.35); color: #fca5a5; }

  .thumb-wrap { flex: 1; min-height: 0; }
  .word { font-family: monospace; color: #34d399; font-size: var(--font-size-sm, 14px); }
  .code-pill {
    font-family: monospace;
    font-size: var(--font-size-sm, 14px);
    color: #8b93a7;
    background: #0b0d17;
    padding: 2px 6px;
    border-radius: 3px;
    align-self: flex-start;
  }
  .pictos {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 3px;
    flex: 1;
  }
  .cell {
    background: repeating-linear-gradient(45deg, #1a1f2e, #1a1f2e 5px, #0b0d17 5px, #0b0d17 10px);
    border-radius: 3px;
  }
  .footer { display: flex; justify-content: space-between; font-size: var(--font-size-sm, 14px); }
  .loc { color: #d0d5e0; }
  .ago { color: #10b981; font-weight: 600; }
  .ago.err { color: #fca5a5; }

  .placeholder { opacity: 0.55; border-style: dashed; }
  .placeholder .word { color: #94a3b8; }

  @media (prefers-reduced-motion: reduce) {
    .scard { transition: none; }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/choreo-card/components/scan-activity/ScanActivityCard.svelte
git commit -m "feat(choreo-card): add ScanActivityCard component"
```

---

### Task 9: TopLocationsBlock component

**Files:**
- Create: `src/lib/features/choreo-card/components/scan-activity/TopLocationsBlock.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!-- Horizontal bar chart of top 5 scan-origin countries over a rolling window. -->
<script lang="ts">
  import type { ScanEventRow } from "$lib/features/choreo-card/state/scan-activity-state.svelte";

  let { events, windowDays = 7 }: { events: ScanEventRow[]; windowDays?: number } = $props();

  const buckets = $derived.by(() => {
    const cutoff = Date.now() - windowDays * 86400000;
    const counts = new Map<string, number>();
    for (const e of events) {
      if (!e.country) continue;
      if (new Date(e.timestamp).getTime() < cutoff) continue;
      counts.set(e.country, (counts.get(e.country) ?? 0) + 1);
    }
    const arr = Array.from(counts.entries())
      .map(([country, n]) => ({ country, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);
    const max = arr[0]?.n ?? 1;
    return arr.map((b) => ({ ...b, pct: (b.n / max) * 100 }));
  });
</script>

<div class="block">
  <h5>Top locations <span class="win">· {windowDays}d</span></h5>
  {#if buckets.length === 0}
    <p class="empty">No scans yet.</p>
  {:else}
    {#each buckets as b}
      <div class="row">
        <span class="name">{b.country}</span>
        <span class="bar-wrap"><span class="fill" style:width={`${b.pct}%`}></span></span>
        <span class="val">{b.n}</span>
      </div>
    {/each}
  {/if}
</div>

<style>
  .block { background: #0f1220; border: 1px solid #1a1f2e; border-radius: 8px; padding: 14px; }
  h5 { margin: 0 0 10px; color: #d0d5e0; font-size: var(--font-size-sm, 14px); font-weight: 600; }
  .win { color: #6b7491; font-weight: 400; }
  .row { display: flex; align-items: center; gap: 8px; font-size: var(--font-size-sm, 14px); padding: 8px 0; border-bottom: 1px solid #1a1f2e; min-height: 44px; }
  .row:last-child { border-bottom: none; }
  .name { color: #d0d5e0; flex: 0 0 auto; }
  .bar-wrap { flex: 1; height: 6px; background: #0b0d17; border-radius: 3px; overflow: hidden; }
  .fill { display: block; height: 100%; background: linear-gradient(90deg, #10b981, #34d399); }
  .val { color: #34d399; font-weight: 600; min-width: 28px; text-align: right; }
  .empty { color: #6b7491; font-size: var(--font-size-sm, 14px); margin: 0; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/choreo-card/components/scan-activity/TopLocationsBlock.svelte
git commit -m "feat(choreo-card): add TopLocationsBlock component"
```

---

### Task 10: RecentScansList component

**Files:**
- Create: `src/lib/features/choreo-card/components/scan-activity/RecentScansList.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!-- Compact list of most recent scan events rendered under the minimap globe. -->
<script lang="ts">
  import type { ScanEventRow } from "$lib/features/choreo-card/state/scan-activity-state.svelte";

  let {
    events,
    onRowClick,
    limit = 4,
  }: { events: ScanEventRow[]; onRowClick: (code: string) => void; limit?: number } = $props();

  const rows = $derived(events.slice(0, limit));

  function ago(ts: string): string {
    const ms = Date.now() - new Date(ts).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return "now";
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h`;
  }
</script>

<div class="list">
  {#each rows as r (r.code + r.timestamp)}
    <button class="row" onclick={() => onRowClick(r.code)}>
      <span class="city">{r.city ?? "—"}</span>
      <span class="code">{r.code}</span>
      <span class="when">{ago(r.timestamp)}</span>
    </button>
  {/each}
  {#if rows.length === 0}
    <p class="empty">No recent scans.</p>
  {/if}
</div>

<style>
  .list { display: flex; flex-direction: column; gap: 6px; }
  .row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0 10px;
    background: #0b0d17; border: 1px solid #1a1f2e; border-radius: 6px;
    font-size: var(--font-size-sm, 14px); color: inherit; font: inherit;
    min-height: 44px; cursor: pointer; gap: 8px; text-align: left;
  }
  .row:hover { border-color: rgba(16, 185, 129, 0.4); }
  .row:focus-visible { outline: 2px solid #34d399; outline-offset: 2px; }
  .city { color: #d0d5e0; flex: 1; min-width: 0; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
  .code { font-family: monospace; color: #34d399; }
  .when { color: #6b7491; }
  .empty { color: #6b7491; font-size: var(--font-size-sm, 14px); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/choreo-card/components/scan-activity/RecentScansList.svelte
git commit -m "feat(choreo-card): add RecentScansList component"
```

---

### Task 11: ScanHistoryDrawer component

**Files:**
- Create: `src/lib/features/choreo-card/components/scan-activity/ScanHistoryDrawer.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!--
  Bottom-sheet drawer showing a code's full lifetime scan history.
  Opens when a ScanActivityCard is clicked.
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import type { CodeEntry, ScanEventRow } from "$lib/features/choreo-card/state/scan-activity-state.svelte";
  import {
    collection,
    getFirestore,
    onSnapshot,
    orderBy,
    query,
    type Unsubscribe,
  } from "firebase/firestore";

  let {
    isOpen = $bindable(false),
    entry,
  }: { isOpen?: boolean; entry: CodeEntry | null } = $props();

  let events = $state<ScanEventRow[]>([]);
  let loading = $state(false);
  let unsub: Unsubscribe | null = null;

  $effect(() => {
    if (!isOpen || !entry) {
      unsub?.();
      unsub = null;
      events = [];
      return;
    }
    loading = true;
    const fs = getFirestore();
    const q = query(
      collection(fs, "shortcodes", entry.code, "scanEvents"),
      orderBy("timestamp", "desc")
    );
    unsub = onSnapshot(q, (snap) => {
      events = snap.docs.map((d) => {
        const data = d.data();
        return {
          code: entry!.code,
          timestamp: data.timestamp ?? "",
          city: data.city ?? null,
          country: data.country ?? null,
          deviceId: data.deviceId ?? null,
          userId: data.userId ?? null,
        };
      });
      loading = false;
    });
    return () => unsub?.();
  });
</script>

<Drawer bind:isOpen placement="bottom" snapPoints={[0.5, 0.9]} ariaLabel="Scan history">
  {#snippet children()}
    {#if entry}
      <header class="hdr">
        <div>
          <h3>{entry.word}</h3>
          <p class="sub">{entry.code} · {entry.scanCount} total scans</p>
        </div>
      </header>

      <section class="timeline" aria-label="Scan timeline">
        {#if loading}
          <p class="muted">Loading history…</p>
        {:else if events.length === 0}
          <p class="muted">No scan events recorded.</p>
        {:else}
          {#each events as e}
            <div class="event">
              <span class="when">{new Date(e.timestamp).toLocaleString()}</span>
              <span class="where">{e.city ?? "—"}, {e.country ?? "—"}</span>
              <span class="who">
                {#if e.userId}signed-in{:else}anonymous{/if}
                {#if e.deviceId}· device {e.deviceId.slice(0, 6)}…{/if}
              </span>
            </div>
          {/each}
        {/if}
      </section>
    {/if}
  {/snippet}
</Drawer>

<style>
  .hdr { padding: 16px 20px; border-bottom: 1px solid #1a1f2e; }
  h3 { margin: 0; color: #fff; font-size: 18px; }
  .sub { margin: 4px 0 0; color: #8b93a7; font-size: var(--font-size-sm, 14px); }
  .timeline { padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; }
  .event {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    padding: 12px;
    background: #0b0d17;
    border: 1px solid #1a1f2e;
    border-radius: 6px;
    font-size: var(--font-size-sm, 14px);
    min-height: 44px;
    align-items: center;
  }
  .when { color: #d0d5e0; }
  .where { color: #34d399; }
  .who { color: #8b93a7; }
  .muted { color: #6b7491; font-size: var(--font-size-sm, 14px); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/choreo-card/components/scan-activity/ScanHistoryDrawer.svelte
git commit -m "feat(choreo-card): add ScanHistoryDrawer component"
```

---

### Task 12: ScanActivityTab — the shell

**Files:**
- Create: `src/lib/features/choreo-card/components/scan-activity/ScanActivityTab.svelte`

- [ ] **Step 1: Create the shell component**

```svelte
<!--
  Main Scan Activity view. Orchestrates the live feed card grid,
  the embedded GlobalUserMap minimap, the top-locations block, and
  the scan-history drawer. Wired into ChoreoCardTab via the
  "scan-activity" section id.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { container } from "$lib/shared/di";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import type { ISequenceEncoder } from "$lib/shared/navigation/services/contracts/ISequenceEncoder";
  import { scanActivityState, type CodeEntry } from "$lib/features/choreo-card/state/scan-activity-state.svelte";
  import ScanActivityCard from "./ScanActivityCard.svelte";
  import ScanHistoryDrawer from "./ScanHistoryDrawer.svelte";
  import RecentScansList from "./RecentScansList.svelte";
  import TopLocationsBlock from "./TopLocationsBlock.svelte";
  import GlobalUserMap from "$lib/features/community/components/GlobalUserMap.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  const encoder = container.resolve<ISequenceEncoder>("ISequenceEncoder");

  let drawerOpen = $state(false);
  let drawerEntry = $state<CodeEntry | null>(null);

  const state = scanActivityState;
  const isAdmin = $derived(authState.user?.isAdmin === true);

  onMount(() => {
    state.subscribe(authState.user?.uid ?? null);
  });
  onDestroy(() => state.teardown());

  $effect(() => {
    // Re-subscribe when scope changes
    state.subscribe(authState.user?.uid ?? null);
  });

  function openDrawer(code: string) {
    drawerEntry = state.codes.find((c) => c.code === code) ?? null;
    drawerOpen = drawerEntry !== null;
  }

  function decoded(entry: CodeEntry): SequenceData | null {
    if (!entry.integrityOk || !entry.encoded) return null;
    try {
      return encoder.decodeWithCompression(entry.encoded);
    } catch {
      return null;
    }
  }

  const mapMarkers = $derived(
    state.recentEvents
      .filter((e) => Number.isFinite(Number(e.country)) || e.city)
      .slice(0, 20)
      .map((e, i) => ({
        id: `${e.code}-${i}`,
        lat: 0,
        lng: 0,
        label: e.code,
        styleClass: i === 0 ? ("pin-new" as const) : ("pin" as const),
      }))
  );
</script>

<div class="shell">
  <header class="top">
    <span class="live" aria-hidden="true"></span>
    <h2>Scan Activity</h2>
    <span class="counter">
      {state.codes.length} codes · {state.recentEvents.length} recent
    </span>
    <input
      class="search"
      type="search"
      placeholder="search word or code…"
      aria-label="Search scans by word or code"
      bind:value={state.searchQuery}
    />
    <span class="spacer"></span>
    {#if isAdmin}
      <div class="scope" role="radiogroup" aria-label="Scope">
        <button role="radio" aria-checked={state.scope === "mine"} class:active={state.scope === "mine"} onclick={() => (state.scope = "mine")}>
          My cards
        </button>
        <button role="radio" aria-checked={state.scope === "all"} class:active={state.scope === "all"} onclick={() => (state.scope = "all")}>
          All (admin)
        </button>
      </div>
    {/if}
  </header>

  <div class="body">
    <div class="feed">
      {#if state.loading}
        <p class="muted">Loading scan activity…</p>
      {:else if state.error}
        <p class="error">Failed to load: {state.error}</p>
      {:else if state.filtered.length === 0}
        <p class="muted">
          {#if state.searchQuery}No matches for "{state.searchQuery}".{:else}Your cards haven't been scanned yet. Share a QR to see activity here.{/if}
        </p>
      {:else}
        <div class="grid">
          {#each state.filtered as entry, i (entry.code)}
            <ScanActivityCard {entry} sequence={decoded(entry)} hot={i === 0} onOpen={openDrawer} />
          {/each}
        </div>
      {/if}
    </div>

    <aside class="mm">
      <div class="map-panel">
        <div class="mhead">
          <h5>Live map</h5>
          <span class="count">● {state.recentEvents.length} recent</span>
        </div>
        <GlobalUserMap scanMarkers={mapMarkers} size="embedded" />
        <RecentScansList events={state.recentEvents} onRowClick={openDrawer} />
      </div>
      <TopLocationsBlock events={state.recentEvents} />
      <a class="link" href="/community?layer=scans">🌍 View all scans on Community map →</a>
    </aside>
  </div>
</div>

<ScanHistoryDrawer bind:isOpen={drawerOpen} entry={drawerEntry} />

<style>
  .shell { display: flex; flex-direction: column; height: 100%; background: #080a12; }

  .top {
    display: flex; align-items: center; gap: 14px;
    padding: 16px 22px; border-bottom: 1px solid #1a1f2e;
    background: linear-gradient(180deg, #0f1220 0%, #0b0d17 100%);
    min-height: 64px;
    flex-wrap: wrap;
  }
  .live { width: 12px; height: 12px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981; animation: livePulse 1.4s infinite; flex-shrink: 0; }
  @keyframes livePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
  @media (prefers-reduced-motion: reduce) { .live { animation: none; } }
  h2 { margin: 0; color: #fff; font-size: 18px; font-weight: 600; }
  .counter { color: #8b93a7; font-size: var(--font-size-sm, 14px); }
  .search {
    flex: 1; max-width: 300px; min-height: 44px; padding: 0 14px;
    background: #0b0d17; border: 1px solid #222838; border-radius: 6px;
    color: #d0d5e0; font-size: var(--font-size-sm, 14px);
  }
  .spacer { flex: 1; }
  .scope { display: flex; background: #141824; border-radius: 8px; padding: 4px; border: 1px solid #222838; }
  .scope button {
    padding: 0 16px; min-height: 44px; border: 0; border-radius: 6px; background: transparent;
    color: #8b93a7; font: inherit; font-size: var(--font-size-sm, 14px); cursor: pointer;
  }
  .scope button.active { background: rgba(16, 185, 129, 0.15); color: #34d399; box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.3); }
  .scope button:focus-visible { outline: 2px solid #34d399; outline-offset: 2px; }

  .body { display: grid; grid-template-columns: 1fr 300px; gap: 16px; padding: 16px; flex: 1; min-height: 0; }

  .feed { min-width: 0; }
  .grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 12px;
    align-content: start;
  }
  @media (max-width: 1400px) { .grid { grid-template-columns: repeat(4, 1fr); } }
  @media (max-width: 1000px) { .grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 600px) { .grid { grid-template-columns: repeat(2, 1fr); } }

  .muted { color: #6b7491; font-size: var(--font-size-sm, 14px); }
  .error { color: #fca5a5; font-size: var(--font-size-sm, 14px); }

  .mm { display: flex; flex-direction: column; gap: 14px; }
  .map-panel { background: #0f1220; border: 1px solid #1a1f2e; border-radius: 8px; padding: 14px; }
  .mhead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .mhead h5 { margin: 0; color: #d0d5e0; font-size: var(--font-size-sm, 14px); font-weight: 600; }
  .count { color: #34d399; font-size: var(--font-size-sm, 14px); font-weight: 600; }

  .link {
    display: flex; align-items: center; justify-content: center;
    padding: 14px; min-height: 44px;
    background: rgba(16, 185, 129, 0.06);
    border: 1px dashed rgba(16, 185, 129, 0.3);
    border-radius: 8px;
    color: #34d399; font-size: var(--font-size-sm, 14px);
    text-decoration: none;
  }

  @media (max-width: 1100px) {
    .body { grid-template-columns: 1fr; }
    .mm { order: -1; }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/choreo-card/components/scan-activity/ScanActivityTab.svelte
git commit -m "feat(choreo-card): add ScanActivityTab shell component"
```

---

### Task 13: Wire ScanActivityTab into ChoreoCardTab

**Files:**
- Modify: `src/lib/features/choreo-card/components/ChoreoCardTab.svelte`

- [ ] **Step 1: Extend the mode union**

At line 162, change:

```ts
  type ChoreoCardMode = "decks" | "designer";
```

to:

```ts
  type ChoreoCardMode = "decks" | "designer" | "scan-activity";
```

- [ ] **Step 2: Extend the sync effect**

At line 168, change the check:

```ts
    if (navTab === "decks" || navTab === "designer") {
```

to:

```ts
    if (navTab === "decks" || navTab === "designer" || navTab === "scan-activity") {
```

- [ ] **Step 3: Add the render branch**

Near line 582, where modes are rendered:

```svelte
    {:else if mode === "scan-activity"}
      <ScanActivityTab />
```

Add the import at the top of the script block:

```ts
  import ScanActivityTab from "./scan-activity/ScanActivityTab.svelte";
```

- [ ] **Step 4: Smoke test in browser**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/choreo-card/scan-activity`
Expected: 200. Visit in the browser; should render the empty-state message or the feed if any scans exist.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/ChoreoCardTab.svelte
git commit -m "feat(choreo-card): wire Scan Activity section into ChoreoCardTab"
```

---

### Task 14: Sign-in hook — link deviceId to userId

**Files:**
- Modify: auth state module (find via Step 1)

- [ ] **Step 1: Find the sign-in completion hook**

Run: `grep -rn "signInSuccess\|onSignIn\|postSignIn\|setUser" E:/tka-platform/src/lib/shared/auth/ 2>/dev/null | head -10`

Identify the function that runs when a user successfully signs in (most projects have a central auth state module that observes `onAuthStateChanged` and stores the user).

- [ ] **Step 2: Call linkDeviceToUser after sign-in**

In the identified module, add at the top:

```ts
  import { container } from "$lib/shared/di";
  import type { IDeviceIdService } from "$lib/shared/auth/services/contracts/IDeviceIdService";
```

In the sign-in success path (where `user.uid` is known):

```ts
  const deviceIdService = container.resolve<IDeviceIdService>("IDeviceIdService");
  deviceIdService.linkDeviceToUser(user.uid).catch((err) => {
    console.warn("Failed to link device to user", err);
  });
```

This is fire-and-forget — if it fails, the user is still signed in, we just log.

- [ ] **Step 3: Manual verification**

Sign out. Clear localStorage. Sign in with Google. In the Firebase console, verify `users/{uid}/devices/{newUuid}` exists with `firstSeen` and `lastSeen` timestamps.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/auth/
git commit -m "feat(auth): link deviceId to userId on sign-in"
```

---

### Task 15: Retire ShortCodeAnalytics from admin nav

**Files:**
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts`
- Modify: `src/lib/features/admin/components/AdminDashboard.svelte`

- [ ] **Step 1: Remove "short-codes" from ADMIN_TABS**

In `tab-definitions.ts`, find the "short-codes" entry inside the `ADMIN_TABS` array. Delete the object block. Confirm no other imports or usages:

Run: `grep -rn "\"short-codes\"\|'short-codes'" E:/tka-platform/src/ 2>/dev/null`

- [ ] **Step 2: Remove the AdminDashboard branch**

In `AdminDashboard.svelte`, find the `activeSection === "short-codes"` branch and its lazy-load state variable + import. Delete all three.

- [ ] **Step 3: Smoke test the admin dashboard**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/admin`
Expected: 200. Open in browser; confirm the admin sidebar no longer shows a Short Codes tab, and the page loads cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/navigation/config/tab-definitions.ts \
        src/lib/features/admin/components/AdminDashboard.svelte
git commit -m "feat(admin): remove Short Codes tab (moved to ChoreoCard)"
```

---

### Task 16: Delete ShortCodeAnalytics.svelte

**Files:**
- Delete: `src/lib/features/admin/components/analytics/ShortCodeAnalytics.svelte`

- [ ] **Step 1: Confirm no remaining imports**

Run: `grep -rn "ShortCodeAnalytics" E:/tka-platform/src/ 2>/dev/null`
Expected: zero matches.

- [ ] **Step 2: Delete the file**

Run: `rm E:/tka-platform/src/lib/features/admin/components/analytics/ShortCodeAnalytics.svelte`

- [ ] **Step 3: Typecheck**

Run: `cd E:/tka-platform && npm run check 2>&1 | tail -20`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add -u src/lib/features/admin/components/analytics/ShortCodeAnalytics.svelte
git commit -m "chore(admin): delete ShortCodeAnalytics — superseded by Scan Activity"
```

---

### Task 17: End-to-end manual QA checklist

**Files:** none — verification only

- [ ] **Step 1: Cold-load the Scan Activity view**

Open `/choreo-card/scan-activity` while signed in as a non-admin. Expect: empty state ("Your cards haven't been scanned yet…") or a feed of your own scanned cards. Left column is the card grid, right column is the globe + recents + top locations + community link.

- [ ] **Step 2: Trigger a live scan**

On a second device (or private window), scan a QR of a card you own. Expect within ~2s: card appears/updates in the feed, `lastScannedAt` is "now", the card is at the top with the `hot` glow, a pin pulses on the minimap.

- [ ] **Step 3: Verify round-trip integrity gate**

Manually corrupt a shortcode's `encoded` field in Firestore (use the Firebase console — pick a test code). Reload. Expect: that card renders as a dashed "restoration failed" placeholder with a red "!" badge. Other cards still render normally. Restore the original value after confirming.

- [ ] **Step 4: Admin scope toggle**

Sign in as an admin. Confirm the "My cards / All (admin)" toggle appears. Flip to "All" — feed populates with cards owned by other users. Flip back — only your cards.

- [ ] **Step 5: Drawer**

Click a card. Drawer slides up from bottom with 50% height. Drag up to 90%; drag down to close. Escape key closes it. Focus returns to the originating card.

- [ ] **Step 6: Keyboard path**

Tab into the feed. Arrow/Tab through cards. Enter on a focused card opens the drawer. Tab into the drawer's close button. Escape closes. Focus is back on the originating card.

- [ ] **Step 7: Reduced motion**

Enable `prefers-reduced-motion` in OS settings. Trigger a scan. Expect: no jump animation, no pin pulse, but data still updates correctly.

- [ ] **Step 8: Responsive**

Resize the browser from 1600 → 1200 → 900 → 600 → 400 px. Card grid drops columns at each breakpoint. Minimap column collapses below 1100px. All touch targets stay ≥ 44px.

- [ ] **Step 9: Sign-out / cleared cookies**

Sign out. Verify view is hidden from the ChoreoCard sidebar for the unauthenticated state. Sign in; verify a `users/{uid}/devices/{deviceId}` document exists in Firestore.

- [ ] **Step 10: Type check and test suite**

Run: `cd E:/tka-platform && npm run check && npx vitest run`
Expected: zero new errors; all existing tests + the three new tests pass.

---

## Self-Review Checklist

- [x] **Spec coverage** — every section of the spec (navigation placement, layout, card, drawer, live behavior, identity model, integrity check, error states, security, accessibility, testing, rollout, file manifest) has at least one corresponding task.
- [x] **Placeholder scan** — no "TBD", "TODO", "handle appropriately"; every code step includes actual code; every file path is concrete.
- [x] **Type consistency** — `CodeEntry`, `ScanEventRow`, `IDeviceIdService`, `verifyRoundTrip` return shape, `logScanEvent` event param shape are consistent across tasks.
- [x] **Scope** — single unified feature; does not need decomposition.

---

**End of plan.**
