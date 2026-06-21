# Card-Scan Attribution Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old deferred-prompt attribution system with a PostHog-native funnel that traces QR card scans through to app opens and signups, with deck metadata.

**Architecture:** Three PostHog events (`card_scanned` → `scan_app_opened` → `user_signed_up`) connected via PostHog's automatic anonymous→identified user merging. Deck metadata baked into shortcode docs at creation time (nullable for non-deck sequences). Session context forwarded via URL params + sessionStorage.

**Tech Stack:** PostHog (existing), Firestore shortcodes collection (existing), SvelteKit page server (existing)

---

### Task 1: Delete Old Attribution System

**Files:**
- Delete: `src/lib/shared/attribution/` (entire directory — 12 files)
- Delete: `src/lib/features/lab/tabs/AttributionLab.svelte`
- Delete: `src/lib/features/admin/components/analytics/AttributionDashboard.svelte`
- Modify: `src/lib/shared/application/components/MainApplication.svelte`
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts`
- Modify: `src/lib/features/admin/components/AdminDashboard.svelte`
- Modify: `src/lib/features/lab/LabModule.svelte`

- [ ] **Step 1: Delete the attribution directory**

```bash
rm -rf src/lib/shared/attribution/
```

- [ ] **Step 2: Delete the lab tab component**

```bash
rm src/lib/features/lab/tabs/AttributionLab.svelte
```

- [ ] **Step 3: Delete the admin attribution dashboard**

```bash
rm src/lib/features/admin/components/analytics/AttributionDashboard.svelte
```

- [ ] **Step 4: Clean MainApplication.svelte**

Remove the commented-out imports and the comment placeholder left from the deactivation. In `src/lib/shared/application/components/MainApplication.svelte`:

Replace the two comment blocks:
```ts
  // Attribution system deactivated — discovery happens via card scanning now
  // import { getAttributionPromptState } from "../../attribution/state/attribution-prompt-state.svelte";
```
→ delete entirely

```ts
  // Attribution system deactivated — discovery happens via card scanning now
  // import { getAttributionPromptTrigger } from "../../attribution/getAttributionPromptTrigger";
```
→ delete entirely

Replace the init comment:
```ts
        // Attribution prompt deactivated — card scanning is the primary discovery channel now
```
→ delete entirely

Replace the template comment:
```html
    <!-- Attribution prompt deactivated — card scanning is the primary discovery channel now -->
```
→ delete entirely

- [ ] **Step 5: Remove attribution tab from admin ADMIN_TABS**

In `src/lib/shared/navigation/config/tab-definitions.ts`, remove the attribution entry from the admin tabs array (lines ~382-389):

```ts
  {
    id: "attribution",
    label: "Attribution",
    icon: '<i class="fas fa-compass" aria-hidden="true"></i>',
    description: "Where users discover TKA Composer",
    color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)",
  },
```

- [ ] **Step 6: Remove attribution lazy-load from AdminDashboard.svelte**

In `src/lib/features/admin/components/AdminDashboard.svelte`:

Remove the `AttributionDashboard` state variable declaration (lines 24-27):
```ts
  let AttributionDashboard:
    | typeof import("./analytics/AttributionDashboard.svelte").default
    | null = $state(null);
```

Remove the lazy-load effect branch (lines 50-57):
```ts
    if (activeSection === "attribution" && !AttributionDashboard) {
      import("./analytics/AttributionDashboard.svelte")
        .then((mod) => {
          AttributionDashboard = mod.default;
        })
        .catch((err) => {
          console.error("Failed to load Attribution Dashboard:", err);
        });
    }
```

Remove the attribution tab panel in the template (the `{:else if activeSection === "attribution"}` block with its content).

- [ ] **Step 7: Clean the lab comment in LabModule.svelte**

In `src/lib/features/lab/LabModule.svelte`, remove the two commented lines:
```ts
    // attribution lab deactivated — discovery happens via card scanning now
    // attribution: () => import("./tabs/AttributionLab.svelte"),
```

- [ ] **Step 8: Verify build**

```bash
npm run check
```

Expected: 0 errors. No file imports the deleted modules.

- [ ] **Step 9: Commit**

```bash
git add -u
git commit -m "chore: remove old attribution prompt system

Card scanning is the primary discovery channel now.
The deferred-prompt attribution system is replaced by
a PostHog funnel tracking scan → app open → signup."
```

---

### Task 2: Add Deck Metadata to ShortCodeURLOptions

**Files:**
- Modify: `src/lib/shared/qr/services/contracts/types.ts:174-187`

- [ ] **Step 1: Add deckId and deckName to ShortCodeURLOptions**

In `src/lib/shared/qr/services/contracts/types.ts`, add two optional fields to the `ShortCodeURLOptions` interface:

```ts
export interface ShortCodeURLOptions {
  /** Blue prop type to append to URL (encoded as single char) */
  bluePropType?: string;
  /** Red prop type to append to URL (encoded as single char) */
  redPropType?: string;
  /** View mode to encode in URL (e.g., "hsb" = hands-solo-blue) */
  viewMode?: string;
  /** Force-embed the full sequenceData in the shortcode record even when
   *  ownerId is set. Use this for URL-sync flows where the sequence may
   *  never be persisted (e.g., playing a generated-but-unsaved sequence);
   *  without it the resolver would fail because users/{uid}/sequences/{id}
   *  doesn't exist yet. */
  embedSequenceData?: boolean;
  /** Deck ID this card belongs to (stamped at deck composition time) */
  deckId?: string;
  /** Human-readable deck name for analytics */
  deckName?: string;
}
```

- [ ] **Step 2: Verify build**

```bash
npm run check
```

Expected: 0 errors. New optional fields break nothing.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/qr/services/contracts/types.ts
git commit -m "feat(attribution): add deckId/deckName to ShortCodeURLOptions"
```

---

### Task 3: Persist Deck Metadata in ShortCodeManager

**Files:**
- Modify: `src/lib/shared/qr/services/implementations/ShortCodeManager.ts:178-242`

- [ ] **Step 1: Stamp deck fields on the Firestore record**

In `ShortCodeManager.createShortCodeInternal()`, after line 227 (`if (encoderHash) record.encoderHash = encoderHash;`), add:

```ts
    if (options?.deckId) record.deckId = options.deckId;
    if (options?.deckName) record.deckName = options.deckName;
```

- [ ] **Step 2: Verify build**

```bash
npm run check
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/qr/services/implementations/ShortCodeManager.ts
git commit -m "feat(attribution): persist deckId/deckName on shortcode Firestore docs"
```

---

### Task 4: Pass Deck Context from Deck Releaser Print Flow

**Files:**
- Modify: `src/lib/shared/qr/services/implementations/QRCodeGenerator.ts:153-193`

The `QRCodeGenerator.generateForSequence()` method is the entry point that creates short codes during card rendering. It already accepts `QRCodeOptions` and forwards prop options to `createShortCode`. We need to pass through deck metadata.

- [ ] **Step 1: Check QRCodeOptions type**

Read `src/lib/shared/qr/services/contracts/types.ts` for the `QRCodeOptions` interface and add deck fields there too:

```ts
export interface QRCodeOptions {
  // ... existing fields ...
  /** Deck ID for attribution tracking */
  deckId?: string;
  /** Human-readable deck name for attribution tracking */
  deckName?: string;
}
```

- [ ] **Step 2: Forward deck fields in QRCodeGenerator.generateForSequence()**

In `src/lib/shared/qr/services/implementations/QRCodeGenerator.ts`, update the `propOptions` object in `generateForSequence()`:

```ts
    const propOptions = {
      bluePropType: options?.bluePropType,
      redPropType: options?.redPropType,
      viewMode: options?.viewMode,
      deckId: options?.deckId,
      deckName: options?.deckName,
    };
```

- [ ] **Step 3: Add deckId/deckName to PrintRenderOptions**

In `src/lib/features/choreo-card/services/types.ts`, add to the `PrintRenderOptions` interface:

```ts
  /** Deck ID for QR attribution tracking */
  deckId?: string;
  /** Deck name for QR attribution tracking */
  deckName?: string;
```

- [ ] **Step 4: Forward deck info in PrintCardRenderer**

In `src/lib/features/choreo-card/services/PrintCardRenderer.ts`, where it calls the QR code generator, pass the deck fields from options through to the QR generation call.

- [ ] **Step 5: Pass deck context from DeckReleaserTab → PrintPreviewPages**

In the deck releaser flow (`src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte`), when it renders `PrintPreviewPages`, pass the current deck's ID and name so they flow through to QR generation.

- [ ] **Step 6: Verify build**

```bash
npm run check
```

- [ ] **Step 7: Commit**

```bash
git add -u
git commit -m "feat(attribution): pass deck metadata through QR generation pipeline"
```

---

### Task 5: Enrich Server-Side Data with Deck Fields

**Files:**
- Modify: `src/routes/q/[code]/+page.server.ts`

- [ ] **Step 1: Add deckId/deckName to server load return**

```ts
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, request }) => {
  const geo = {
    country: request.headers.get("cf-ipcountry") || null,
    city: request.headers.get("cf-ipcity") || null,
  };

  let meta: {
    word: string | null;
    creator: string | null;
    thumbnailUrl: string | null;
    deckId: string | null;
    deckName: string | null;
  } = {
    word: null,
    creator: null,
    thumbnailUrl: null,
    deckId: null,
    deckName: null,
  };

  try {
    const { getAdminDb } = await import("$lib/server/firebaseAdmin");
    const db = getAdminDb();
    const doc = await db.collection("shortcodes").doc(params.code).get();
    if (doc.exists) {
      const data = doc.data();
      meta = {
        word: data?.word || data?.sequenceName || null,
        creator: data?.ownerDisplayName || null,
        thumbnailUrl: data?.thumbnailUrl || null,
        deckId: data?.deckId || null,
        deckName: data?.deckName || null,
      };
    }
  } catch {
    // Firestore lookup failure is non-fatal
  }

  return { geo, meta };
};
```

- [ ] **Step 2: Verify build**

```bash
npm run check
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/q/[code]/+page.server.ts
git commit -m "feat(attribution): expose deckId/deckName from shortcode server load"
```

---

### Task 6: Update Scan Page Event and CTA

**Files:**
- Modify: `src/routes/q/[code]/+page.svelte`

- [ ] **Step 1: Update the Props interface to include deck fields**

In the `Props` interface at the top of the script, update the `data.meta` type to include:
```ts
        deckId: string | null;
        deckName: string | null;
```

- [ ] **Step 2: Rename and enrich the PostHog event**

Replace the existing event capture block (~line 302-308):

```ts
      if (!isInlineEncoded(shortCode) && isGenuineScan(shortCode)) {
        captureEvent("card_scanned", {
          short_code: shortCode,
          sequence_word: word,
          deck_id: data?.meta?.deckId || null,
          deck_name: data?.meta?.deckName || null,
          country: data?.geo?.country || null,
          city: data?.geo?.city || null,
        });
      }
```

- [ ] **Step 3: Update the "Open TKA" CTA links**

There are two instances of the CTA (one for desktop layout, one for mobile). Both currently read:
```html
<a href="/browse/gallery" class="grid-btn cta">
```

Replace with:
```html
<a href="/browse/gallery?from=scan&code={shortCode}" class="grid-btn cta">
```

Do this for BOTH instances (lines ~442 and ~518).

- [ ] **Step 4: Verify build**

```bash
npm run check
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/q/[code]/+page.svelte
git commit -m "feat(attribution): enrich card_scanned event with deck/geo, add scan context to CTA"
```

---

### Task 7: App-Entry Scan Detection

**Files:**
- Create: `src/lib/shared/analytics/scan-attribution.ts`
- Modify: `src/lib/shared/application/components/MainApplication.svelte`

- [ ] **Step 1: Create scan attribution helper**

Create `src/lib/shared/analytics/scan-attribution.ts`:

```ts
import { browser } from "$app/environment";
import { captureEvent } from "./services/posthog";
import { replaceState } from "$app/navigation";

const SCAN_SOURCE_CODE_KEY = "tka_scan_source_code";
const SCAN_SOURCE_DECK_KEY = "tka_scan_source_deck";

export function detectAndCaptureScanEntry(): void {
  if (!browser) return;

  const url = new URL(window.location.href);
  const fromScan = url.searchParams.get("from");
  const code = url.searchParams.get("code");

  if (fromScan !== "scan" || !code) return;

  sessionStorage.setItem(SCAN_SOURCE_CODE_KEY, code);

  captureEvent("scan_app_opened", {
    short_code: code,
  });

  url.searchParams.delete("from");
  url.searchParams.delete("code");
  replaceState(url.pathname + url.search + url.hash, {});
}

export function getScanSourceCode(): string | null {
  if (!browser) return null;
  return sessionStorage.getItem(SCAN_SOURCE_CODE_KEY);
}

export function getScanSourceDeck(): string | null {
  if (!browser) return null;
  return sessionStorage.getItem(SCAN_SOURCE_DECK_KEY);
}
```

- [ ] **Step 2: Call detection from MainApplication init**

In `src/lib/shared/application/components/MainApplication.svelte`, in the init function where the old attribution triggers used to be, add:

```ts
import { detectAndCaptureScanEntry } from "../../analytics/scan-attribution";
```

And in the init block (after the app finishes initializing, where the old attribution code was):

```ts
        detectAndCaptureScanEntry();
```

- [ ] **Step 3: Verify build**

```bash
npm run check
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/analytics/scan-attribution.ts src/lib/shared/application/components/MainApplication.svelte
git commit -m "feat(attribution): detect scan entry params, fire scan_app_opened event"
```

---

### Task 8: Enrich Signup Event with Scan Source

**Files:**
- Modify: `src/lib/shared/auth/state/authState.svelte.ts`

- [ ] **Step 1: Import scan source helper**

Add import at top of `src/lib/shared/auth/state/authState.svelte.ts`:

```ts
import { getScanSourceCode } from "../../analytics/scan-attribution";
```

- [ ] **Step 2: Enrich the identifyUser call for new users**

In the auth state listener where `identifyUser()` is called (~line 412), add a `captureEvent` call for new signups. The challenge: we need to detect if this is a *new* user (first auth) vs returning. Firebase provides `user.metadata.creationTime` — if it's within the last 60 seconds, it's a signup.

After the existing `identifyUser()` call, add:

```ts
        const creationTime = user.metadata.creationTime
          ? new Date(user.metadata.creationTime).getTime()
          : 0;
        const isNewSignup = Date.now() - creationTime < 60_000;

        if (isNewSignup) {
          const scanCode = getScanSourceCode();
          if (scanCode) {
            captureEvent("user_signed_up", {
              scan_source_code: scanCode,
            });
          }
        }
```

- [ ] **Step 3: Verify build**

```bash
npm run check
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/auth/state/authState.svelte.ts
git commit -m "feat(attribution): enrich signup event with scan source code"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Full build check**

```bash
npm run check
npm run build
```

Both must pass with 0 errors.

- [ ] **Step 2: Verify no dangling imports to deleted attribution module**

```bash
grep -r "shared/attribution" src/ --include="*.ts" --include="*.svelte"
```

Expected: 0 results.

- [ ] **Step 3: Verify the scan page loads**

Test locally by visiting `/q/TEST123` (or any known short code). Confirm:
- Page renders without console errors
- PostHog event would fire (check network tab for `posthog.com/capture`)
- "Open TKA" button href includes `?from=scan&code=...`

- [ ] **Step 4: Commit any fixes, then final commit message**

If all clean, no additional commit needed. Tag the work:

```bash
git log --oneline -9
```

Confirm 8 atomic commits covering the full pipeline.
