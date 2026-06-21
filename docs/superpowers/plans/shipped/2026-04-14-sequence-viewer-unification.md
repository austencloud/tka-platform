# Sequence Viewer Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the guest and signed-in sequence viewer experiences by removing auth-based UI forking, adding a pending-action queue that preserves intent across sign-in, replacing the Get App button with a contextual webview fallback, and consolidating the two duplicated route files.

**Architecture:** Two new DI-registered services (`PendingActionQueue`, `WebviewDetector`) plus one new component (`SignInSheet.svelte`) wired into the existing `SequenceViewerOrchestrator`. The orchestrator owns the replay-on-auth effect and the sheet's open/close state. `ViewerFooter` drops its `isLoggedIn` branches — every user sees every action. `/sequence/[id]` and `/p/[code]` collapse into one shared `SequenceViewerRoute.svelte` shell, with the two route files reduced to thin resolvers.

**Tech Stack:** Svelte 5 runes, TypeScript (strict), Vitest for unit tests, ITI for DI, Firebase Auth (existing `authState`), SvelteKit routing.

**Reference:** Spec at `docs/superpowers/specs/2026-04-14-sequence-viewer-unification-design.md`.

---

## File Structure

**New files:**

```
src/lib/shared/sequence-viewer/services/
├── contracts/
│   ├── IPendingActionQueue.ts
│   └── IWebviewDetector.ts
└── implementations/
    ├── PendingActionQueue.ts
    └── WebviewDetector.ts

src/lib/shared/sequence-viewer/components/
├── SignInSheet.svelte
├── SequenceViewerRoute.svelte
└── RouteViewerHeader.svelte   (moved from src/routes/sequence/[id]/)

src/lib/shared/di/containers/
└── viewer-auth-container.ts

tests/unit/
├── PendingActionQueue.test.ts
└── WebviewDetector.test.ts
```

**Modified files:**

```
src/lib/shared/sequence-viewer/components/ViewerFooter.svelte
src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte
src/routes/sequence/[id]/+page.svelte
src/routes/p/[code]/+page.svelte
src/routes/p/+layout@.svelte
src/lib/shared/di/index.ts
src/lib/shared/di/container-types.ts
```

---

### Task 1: PendingActionQueue contract

**Files:**
- Create: `src/lib/shared/sequence-viewer/services/contracts/IPendingActionQueue.ts`

- [ ] **Step 1: Write the contract**

```ts
// src/lib/shared/sequence-viewer/services/contracts/IPendingActionQueue.ts

export type PendingActionType = 'save' | 'favorite' | 'publish' | 'remix' | 'sendTo';

export interface PendingAction {
  type: PendingActionType;
  sequenceId: string;
  ts: number;
}

/**
 * Holds a single "action the user tried to do before signing in" so it can
 * be replayed automatically once auth completes. Examples:
 * - Guest taps Save while viewing a shared sequence
 * - Guest scans a QR code and taps Favorite in an Instagram in-app browser
 *
 * Entries older than 10 minutes are dropped on read (an action from yesterday
 * has no business firing today). The queue holds at most one entry — newer
 * enqueues replace older ones.
 */
export interface IPendingActionQueue {
  enqueue(action: Omit<PendingAction, 'ts'>): void;
  peek(): PendingAction | null;
  drain(): PendingAction | null;
  clear(): void;
  bootstrapFromUrl(url: URL): void;
  /** Returns the pending type ("save" | "favorite" | …) or null. Used to build `?pending=X`. */
  serializeToUrlParam(): PendingActionType | null;
}

export const PENDING_URL_PARAM = 'pending';
export const PENDING_ACTION_TTL_MS = 10 * 60 * 1000;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/sequence-viewer/services/contracts/IPendingActionQueue.ts
git commit -m "feat(viewer): add IPendingActionQueue contract"
```

---

### Task 2: PendingActionQueue implementation

**Files:**
- Create: `src/lib/shared/sequence-viewer/services/implementations/PendingActionQueue.ts`
- Test: `tests/unit/PendingActionQueue.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/PendingActionQueue.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PendingActionQueue } from "$lib/shared/sequence-viewer/services/implementations/PendingActionQueue";
import {
  PENDING_URL_PARAM,
  PENDING_ACTION_TTL_MS,
} from "$lib/shared/sequence-viewer/services/contracts/IPendingActionQueue";

describe("PendingActionQueue", () => {
  let queue: PendingActionQueue;

  beforeEach(() => {
    queue = new PendingActionQueue();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T12:00:00Z"));
  });

  it("returns null when empty", () => {
    expect(queue.peek()).toBeNull();
    expect(queue.drain()).toBeNull();
  });

  it("enqueues and peeks without removing", () => {
    queue.enqueue({ type: "save", sequenceId: "abc" });
    expect(queue.peek()?.type).toBe("save");
    expect(queue.peek()?.sequenceId).toBe("abc");
    expect(queue.peek()?.type).toBe("save"); // still there
  });

  it("drain returns and clears", () => {
    queue.enqueue({ type: "favorite", sequenceId: "xyz" });
    const drained = queue.drain();
    expect(drained?.type).toBe("favorite");
    expect(queue.peek()).toBeNull();
  });

  it("replaces older entries when newer ones are enqueued", () => {
    queue.enqueue({ type: "save", sequenceId: "old" });
    queue.enqueue({ type: "favorite", sequenceId: "new" });
    expect(queue.peek()?.type).toBe("favorite");
    expect(queue.peek()?.sequenceId).toBe("new");
  });

  it("drops entries older than TTL on read", () => {
    queue.enqueue({ type: "save", sequenceId: "abc" });
    vi.advanceTimersByTime(PENDING_ACTION_TTL_MS + 1);
    expect(queue.peek()).toBeNull();
    expect(queue.drain()).toBeNull();
  });

  it("clear removes pending entry", () => {
    queue.enqueue({ type: "publish", sequenceId: "abc" });
    queue.clear();
    expect(queue.peek()).toBeNull();
  });

  it("bootstrapFromUrl reads ?pending=save", () => {
    const url = new URL("https://tka.app/p/ABC123?pending=save");
    queue.bootstrapFromUrl(url);
    expect(queue.peek()?.type).toBe("save");
  });

  it("bootstrapFromUrl ignores unknown pending types", () => {
    const url = new URL("https://tka.app/p/ABC123?pending=bogus");
    queue.bootstrapFromUrl(url);
    expect(queue.peek()).toBeNull();
  });

  it("bootstrapFromUrl uses sequenceId from URL path segments when available", () => {
    const url = new URL("https://tka.app/p/ABC123?pending=favorite");
    queue.bootstrapFromUrl(url);
    // sequenceId is set to the path code so the replay handler can use it
    expect(queue.peek()?.sequenceId).toBe("ABC123");
  });

  it("serializeToUrlParam returns current pending type", () => {
    queue.enqueue({ type: "remix", sequenceId: "abc" });
    expect(queue.serializeToUrlParam()).toBe("remix");
  });

  it("serializeToUrlParam returns null when empty or expired", () => {
    expect(queue.serializeToUrlParam()).toBeNull();
    queue.enqueue({ type: "save", sequenceId: "abc" });
    vi.advanceTimersByTime(PENDING_ACTION_TTL_MS + 1);
    expect(queue.serializeToUrlParam()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/PendingActionQueue.test.ts
```

Expected: FAIL — "Cannot find module 'PendingActionQueue'".

- [ ] **Step 3: Implement**

```ts
// src/lib/shared/sequence-viewer/services/implementations/PendingActionQueue.ts
import type {
  IPendingActionQueue,
  PendingAction,
  PendingActionType,
} from "../contracts/IPendingActionQueue";
import {
  PENDING_URL_PARAM,
  PENDING_ACTION_TTL_MS,
} from "../contracts/IPendingActionQueue";

const VALID_TYPES: ReadonlySet<PendingActionType> = new Set([
  "save",
  "favorite",
  "publish",
  "remix",
  "sendTo",
]);

function isValidType(value: string): value is PendingActionType {
  return VALID_TYPES.has(value as PendingActionType);
}

export class PendingActionQueue implements IPendingActionQueue {
  private pending: PendingAction | null = null;

  enqueue(action: Omit<PendingAction, "ts">): void {
    this.pending = { ...action, ts: Date.now() };
  }

  peek(): PendingAction | null {
    return this.readFresh();
  }

  drain(): PendingAction | null {
    const fresh = this.readFresh();
    this.pending = null;
    return fresh;
  }

  clear(): void {
    this.pending = null;
  }

  bootstrapFromUrl(url: URL): void {
    const raw = url.searchParams.get(PENDING_URL_PARAM);
    if (!raw || !isValidType(raw)) return;

    const sequenceId = this.deriveSequenceIdFromUrl(url);
    if (!sequenceId) return;

    this.enqueue({ type: raw, sequenceId });
  }

  serializeToUrlParam(): PendingActionType | null {
    return this.readFresh()?.type ?? null;
  }

  private readFresh(): PendingAction | null {
    if (!this.pending) return null;
    if (Date.now() - this.pending.ts > PENDING_ACTION_TTL_MS) {
      this.pending = null;
      return null;
    }
    return this.pending;
  }

  /**
   * The short-code route (`/p/[code]`) and the deep-link route
   * (`/sequence/[id]`) both carry the sequence reference in the last path
   * segment. This lets us recover the sequence reference after a webview
   * handoff into a real browser, where only the URL survives.
   */
  private deriveSequenceIdFromUrl(url: URL): string | null {
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    return last && last.length > 0 ? decodeURIComponent(last) : null;
  }
}
```

- [ ] **Step 4: Run tests — should pass**

```bash
npm test -- tests/unit/PendingActionQueue.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/services/implementations/PendingActionQueue.ts tests/unit/PendingActionQueue.test.ts
git commit -m "feat(viewer): add PendingActionQueue service with TTL-based expiry"
```

---

### Task 3: WebviewDetector contract and implementation

**Files:**
- Create: `src/lib/shared/sequence-viewer/services/contracts/IWebviewDetector.ts`
- Create: `src/lib/shared/sequence-viewer/services/implementations/WebviewDetector.ts`
- Test: `tests/unit/WebviewDetector.test.ts`

- [ ] **Step 1: Write the contract**

```ts
// src/lib/shared/sequence-viewer/services/contracts/IWebviewDetector.ts

/**
 * Detects in-app browsers (Instagram, Facebook, TikTok, etc.) where Google
 * OAuth popup-based sign-in is blocked. When true, the sign-in sheet offers
 * an "Open in browser" path instead of the usual sign-in button.
 *
 * Strategy: UA-based detection. Not comprehensive — errs toward false-
 * negative (real Chrome misclassified as webview = annoying redirect) over
 * false-positive (IG webview misclassified as real browser = broken sign-in,
 * but user can retry).
 */
export interface IWebviewDetector {
  readonly isInAppWebview: boolean;
}
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/unit/WebviewDetector.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebviewDetector } from "$lib/shared/sequence-viewer/services/implementations/WebviewDetector";

function setUa(ua: string) {
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent: ua },
    writable: true,
    configurable: true,
  });
}

describe("WebviewDetector", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    // [label, userAgent]
    ["Instagram iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Instagram 300.0.0.0.0 (iPhone14,3; iOS 17_0)"],
    ["Instagram Android", "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Instagram 300.0.0.0.0 Android"],
    ["Facebook (FBAN)", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/450.0]"],
    ["Facebook (FB_IAB)", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 [FB_IAB/FB4A;FBAV/450.0]"],
    ["TikTok", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 musical_ly_30.0.0"],
    ["Twitter", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Twitter for iPhone"],
    ["LinkedIn", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 LinkedInApp"],
    ["Pinterest", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Pinterest/iOS"],
    ["Snapchat", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Snapchat/12.0.0"],
  ])("detects %s as in-app webview", (_label, ua) => {
    setUa(ua);
    const d = new WebviewDetector();
    expect(d.isInAppWebview).toBe(true);
  });

  it.each([
    ["Desktop Chrome", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0"],
    ["Mobile Safari", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"],
    ["Firefox", "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0"],
    ["Edge", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Edg/120.0"],
    ["Android Chrome", "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0"],
  ])("does NOT flag %s as in-app webview", (_label, ua) => {
    setUa(ua);
    const d = new WebviewDetector();
    expect(d.isInAppWebview).toBe(false);
  });

  it("returns false when navigator is undefined (SSR)", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const d = new WebviewDetector();
    expect(d.isInAppWebview).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- tests/unit/WebviewDetector.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

```ts
// src/lib/shared/sequence-viewer/services/implementations/WebviewDetector.ts
import type { IWebviewDetector } from "../contracts/IWebviewDetector";

const WEBVIEW_PATTERNS: readonly RegExp[] = [
  /Instagram/i,
  /FBAN|FBAV|FB_IAB|FB4A/i,           // Facebook family
  /musical_ly|TikTok|Bytedance/i,     // TikTok
  /Twitter for/i,                      // Twitter/X in-app
  /LinkedInApp/i,                      // LinkedIn
  /Pinterest\//i,                      // Pinterest
  /Snapchat\//i,                       // Snapchat
];

export class WebviewDetector implements IWebviewDetector {
  get isInAppWebview(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent ?? "";
    return WEBVIEW_PATTERNS.some((re) => re.test(ua));
  }
}
```

- [ ] **Step 5: Run tests — should pass**

```bash
npm test -- tests/unit/WebviewDetector.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/sequence-viewer/services/contracts/IWebviewDetector.ts src/lib/shared/sequence-viewer/services/implementations/WebviewDetector.ts tests/unit/WebviewDetector.test.ts
git commit -m "feat(viewer): add WebviewDetector with UA pattern matching"
```

---

### Task 4: Viewer-auth DI container + registration

**Files:**
- Create: `src/lib/shared/di/containers/viewer-auth-container.ts`
- Modify: `src/lib/shared/di/index.ts`
- Modify: `src/lib/shared/di/container-types.ts`

- [ ] **Step 1: Create the container**

```ts
// src/lib/shared/di/containers/viewer-auth-container.ts
/**
 * Viewer Auth Container
 *
 * Services that manage the guest → signed-in transition inside the sequence
 * viewer: pending-action preservation and in-app-webview detection.
 */

import { createContainer } from "iti";
import { PendingActionQueue } from "$lib/shared/sequence-viewer/services/implementations/PendingActionQueue";
import { WebviewDetector } from "$lib/shared/sequence-viewer/services/implementations/WebviewDetector";

export const viewerAuthContainer = createContainer().add({
  pendingActionQueue: () => new PendingActionQueue(),
  webviewDetector: () => new WebviewDetector(),
});

export type ViewerAuthContainer = typeof viewerAuthContainer;
```

- [ ] **Step 2: Wire into composition root**

Open `src/lib/shared/di/index.ts`. Find the block of container imports (around line 25-80). Add:

```ts
import { viewerAuthContainer } from "./containers/viewer-auth-container";
```

Find the container composition (grep for `.upsert(` or `.add(` in `buildAppContainer` / similar). Merge `viewerAuthContainer.items` into the main container alongside the other simple containers (pattern: follow how `keyboardContainer` or `platformContainer` is wired — they're simple const containers like this one).

If there's a `container.upsert(viewerAuthContainer.items)` style line, add one for `viewerAuthContainer`. If containers are composed with `.add({ ...simpleContainer.items })`, follow that pattern.

- [ ] **Step 3: Update container-types**

Open `src/lib/shared/di/container-types.ts`. Find `ItemsOf` imports and the `IAppContainerItems` intersection. Add:

```ts
import type { ViewerAuthContainer } from "./containers/viewer-auth-container";
type ViewerAuthItems = ItemsOf<ViewerAuthContainer>;
```

And add `& ViewerAuthItems` to the `IAppContainerItems` intersection.

- [ ] **Step 4: Verify TypeScript**

```bash
npm run check
```

Expected: no new errors. `container.items.pendingActionQueue` and `container.items.webviewDetector` should be typed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/di/containers/viewer-auth-container.ts src/lib/shared/di/index.ts src/lib/shared/di/container-types.ts
git commit -m "feat(di): register viewer-auth container"
```

---

### Task 5: SignInSheet component

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/SignInSheet.svelte`

- [ ] **Step 1: Locate existing sign-in handler**

Before writing this component, grep for the existing Google sign-in entry point:

```bash
grep -rn "signInWithGoogle\|signInWithPopup\|GoogleAuthProvider" src/lib/shared/auth/
```

Note the exact function name and file — call it from the sheet. The sheet must NOT duplicate Firebase auth logic.

- [ ] **Step 2: Implement the sheet**

```svelte
<!-- src/lib/shared/sequence-viewer/components/SignInSheet.svelte -->
<script lang="ts">
  import type { PendingActionType } from "$lib/shared/sequence-viewer/services/contracts/IPendingActionQueue";

  interface Props {
    open: boolean;
    reason: PendingActionType | null;
    /** True when user is in an in-app browser (Instagram, Facebook, TikTok, etc.). */
    webviewMode: boolean;
    /** Callback when the user taps the primary button. For webview mode, this triggers the browser handoff. */
    onPrimaryAction: () => void;
    /** Callback when the sheet is dismissed (backdrop tap, Escape, close button). Must clear the pending queue. */
    onDismiss: () => void;
  }

  let { open, reason, webviewMode, onPrimaryAction, onDismiss }: Props = $props();

  const REASON_COPY: Record<PendingActionType, string> = {
    save: "Sign in to save this to your library.",
    favorite: "Sign in to favorite this sequence.",
    publish: "Sign in to publish this sequence.",
    remix: "Sign in to remix this sequence.",
    sendTo: "Sign in to send this to someone.",
  };

  const REASON_COPY_WEBVIEW: Record<PendingActionType, string> = {
    save: "Saving works best in your browser. We'll open this sequence in Chrome so you can sign in — your save will happen automatically.",
    favorite: "Favoriting works best in your browser. We'll open this sequence in Chrome so you can sign in — your favorite will apply automatically.",
    publish: "Publishing works best in your browser. We'll open this sequence in Chrome so you can sign in — your publish will go through automatically.",
    remix: "Remixing works best in your browser. We'll open this sequence in Chrome so you can sign in — you'll land in the editor.",
    sendTo: "Sending works best in your browser. We'll open this sequence in Chrome so you can sign in.",
  };

  const message = $derived(() => {
    if (!reason) return "";
    return webviewMode ? REASON_COPY_WEBVIEW[reason] : REASON_COPY[reason];
  });

  const primaryLabel = $derived(webviewMode ? "Continue in browser" : "Sign in with Google");

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      onDismiss();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div
    class="backdrop"
    role="button"
    tabindex="-1"
    aria-label="Close sign-in"
    onclick={onDismiss}
    onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") onDismiss(); }}
  ></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="signin-title">
    <button type="button" class="close-btn" onclick={onDismiss} aria-label="Close">
      <i class="fas fa-xmark" aria-hidden="true"></i>
    </button>
    <h2 id="signin-title" class="title">Sign in</h2>
    <p class="message">{message}</p>
    <button type="button" class="primary-btn" onclick={onPrimaryAction}>
      {#if !webviewMode}
        <i class="fab fa-google" aria-hidden="true"></i>
      {:else}
        <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
      {/if}
      <span>{primaryLabel}</span>
    </button>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 9000;
    cursor: pointer;
  }
  .sheet {
    position: fixed;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(480px, 100vw);
    background: var(--theme-panel-bg, #1a1a1a);
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
    padding: 24px 20px 32px;
    z-index: 9001;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.4);
    color: var(--theme-text, #fff);
  }
  @media (min-width: 768px) {
    .sheet {
      bottom: auto;
      top: 50%;
      transform: translate(-50%, -50%);
      border-radius: 16px;
      padding: 32px 28px;
    }
  }
  .close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    background: transparent;
    border: none;
    color: inherit;
    font-size: 18px;
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
  }
  .close-btn:hover { background: rgba(255,255,255,0.08); }
  .title {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 8px;
  }
  .message {
    font-size: 14px;
    line-height: 1.5;
    margin: 0 0 20px;
    opacity: 0.85;
  }
  .primary-btn {
    width: 100%;
    padding: 14px 20px;
    border-radius: 10px;
    border: none;
    background: var(--semantic-primary, #4f8cff);
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .primary-btn:hover { filter: brightness(1.1); }
</style>
```

- [ ] **Step 3: Verify compilation**

```bash
npm run check
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SignInSheet.svelte
git commit -m "feat(viewer): add SignInSheet component with webview-mode variant"
```

---

### Task 6: Orchestrator — rename handleGetApp and accept pending-param URL

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte:1571-1584`

Background: `handleGetApp` currently opens `window.location.href` in a real browser via an Android intent URI. We rename it and extend it to accept a `PendingActionType` so the URL it opens includes `?pending=<type>`.

- [ ] **Step 1: Replace `handleGetApp` with `handleOpenInBrowser`**

Find lines 1571-1584 (the current `handleGetApp` function). Replace with:

```ts
  /**
   * Escape an in-app webview (Instagram, Facebook, etc.) into a real browser
   * so sign-in can complete. Optionally attaches `?pending=<type>` so the
   * pending-action queue on the destination page picks it up and replays the
   * action after auth.
   */
  function handleOpenInBrowser(pendingType: PendingActionType | null = null) {
    hapticService?.trigger("selection");
    const baseUrl = browser ? window.location.href : "";
    if (!baseUrl) return;

    let url = baseUrl;
    if (pendingType) {
      const parsed = new URL(baseUrl);
      parsed.searchParams.set("pending", pendingType);
      url = parsed.toString();
    }

    try {
      window.location.href = `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;end`;
    } catch {
      window.open(url, "_blank");
    }
  }
```

- [ ] **Step 2: Add import for `PendingActionType`**

Near the top of the `<script lang="ts">` block (alongside other type imports):

```ts
import type { PendingActionType } from "$lib/shared/sequence-viewer/services/contracts/IPendingActionQueue";
```

- [ ] **Step 3: Update all existing references**

Grep for `handleGetApp` in the file and update any remaining references (there should be the one inside `ViewerFooter` prop binding — see Task 8).

```bash
grep -n "handleGetApp\|onGetApp" src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte
```

Rename any occurrences. If the orchestrator passes `onGetApp={handleGetApp}` to `ViewerFooter`, the footer prop itself will be deleted in Task 8 — you can delete this prop-passing line now.

- [ ] **Step 4: Verify compilation**

```bash
npm run check
```

Expected: may show "unused variable" if the old prop passing remains; clean those up. No new errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte
git commit -m "refactor(viewer): rename handleGetApp to handleOpenInBrowser, accept pending type"
```

---

### Task 7: Orchestrator — wire pending queue bootstrap and auth replay

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte`

- [ ] **Step 1: Add DI service imports**

In the `<script lang="ts">` section, import the container and any needed types (after existing DI imports):

```ts
import { container } from "$lib/shared/di";
import type { PendingAction } from "$lib/shared/sequence-viewer/services/contracts/IPendingActionQueue";
```

- [ ] **Step 2: Get service handles near other `container.items` usage**

Near the top of the script block where other services are resolved (grep for existing `container.items.` assignments):

```ts
  const pendingActionQueue = container.items.pendingActionQueue;
  const webviewDetector = container.items.webviewDetector;
```

- [ ] **Step 3: Bootstrap queue from URL on mount**

Find the existing `onMount` block (or add one). Add at the top of `onMount`:

```ts
  onMount(() => {
    if (browser) {
      pendingActionQueue.bootstrapFromUrl(new URL(window.location.href));
      if (pendingActionQueue.peek()) {
        // Show the sheet immediately so the user sees we captured their intent
        openSignInSheet(pendingActionQueue.peek()!.type);
      }
    }
    // ... existing onMount body stays
  });
```

(If `onMount` already exists, merge these lines at the top.)

- [ ] **Step 4: Add sign-in sheet state**

Add component-local `$state` near other reactive state:

```ts
  let signInSheetOpen = $state(false);
  let signInSheetReason = $state<PendingActionType | null>(null);

  function openSignInSheet(reason: PendingActionType) {
    signInSheetReason = reason;
    signInSheetOpen = true;
  }

  function closeSignInSheet() {
    signInSheetOpen = false;
    signInSheetReason = null;
    pendingActionQueue.clear();
    // Clean `?pending=` from the URL so a reload won't re-trigger
    if (browser) {
      const parsed = new URL(window.location.href);
      if (parsed.searchParams.has("pending")) {
        parsed.searchParams.delete("pending");
        window.history.replaceState({}, "", parsed.toString());
      }
    }
  }
```

- [ ] **Step 5: Add the gated-action handler**

Add a function that each footer action routes through when the user isn't signed in:

```ts
  /**
   * Called when a guest taps Save/Favorite/Publish/etc. Captures intent,
   * writes ?pending= to the URL, and opens the sign-in sheet. If the user is
   * already signed in, just calls through to the real handler.
   */
  function invokeGatedAction(
    type: PendingActionType,
    realHandler: (() => void) | (() => Promise<void>) | undefined
  ) {
    if (authState.isAuthenticated) {
      realHandler?.();
      return;
    }
    const sequenceId = activeSequence?.id ?? activeSequence?.word ?? "";
    if (!sequenceId) return;

    pendingActionQueue.enqueue({ type, sequenceId });
    // Reflect in URL for cross-browser survival
    if (browser) {
      const parsed = new URL(window.location.href);
      parsed.searchParams.set("pending", type);
      window.history.replaceState({}, "", parsed.toString());
    }
    openSignInSheet(type);
  }
```

Note: `activeSequence` is the current sequence object — use whichever variable the orchestrator already exposes. Grep for the variable name and substitute.

- [ ] **Step 6: Wire the primary-action callback**

```ts
  function onSignInSheetPrimary() {
    if (webviewDetector.isInAppWebview) {
      // Hand off to real browser with ?pending= preserving intent
      handleOpenInBrowser(signInSheetReason);
      return;
    }
    // Normal browser: kick off the actual Google sign-in
    // (replace with the real method name found in Task 5 Step 1)
    void authState.signInWithGoogle();
    // The auth replay effect (next step) fires when auth flips true.
    // Close the sheet optimistically; onDismiss clears the queue, so don't
    // call closeSignInSheet here — keep the queue intact for replay.
    signInSheetOpen = false;
  }
```

If the real sign-in method is named differently (e.g. `authState.signIn`, `authState.googleSignIn`), use that — do NOT invent a new method.

- [ ] **Step 7: Add replay-on-auth `$effect`**

Near other `$effect` blocks (end of the script is fine):

```ts
  $effect(() => {
    if (!authState.isAuthenticated) return;
    const pending = pendingActionQueue.drain();
    if (!pending) return;

    // Clean URL param now that we're replaying
    if (browser) {
      const parsed = new URL(window.location.href);
      if (parsed.searchParams.has("pending")) {
        parsed.searchParams.delete("pending");
        window.history.replaceState({}, "", parsed.toString());
      }
    }

    // Dispatch to the appropriate handler. Names below use what the
    // orchestrator exposes today (handleSave, handleFavorite, etc.) — adjust
    // to match the real handler names.
    try {
      switch (pending.type) {
        case "save":     handleSave?.(); break;
        case "favorite": handleFavorite?.(); break;
        case "publish":  handlePublish?.(); break;
        case "remix":    handleRemix?.(); break;
        case "sendTo":   handleSendTo?.(); break;
      }
      signInSheetOpen = false;
    } catch (err) {
      container.items.errorHandler?.showUserError({
        message: "Couldn't finish what you started — please try again.",
        technicalDetails: String(err),
        context: { module: "sequence-viewer", action: "pending-replay", pendingType: pending.type },
      });
    }
  });
```

Before committing, grep the orchestrator for the real handler names and replace the `handleSave`/`handleFavorite`/etc. placeholders with the actual names. Names like `onSave`, `handleToggleFavorite`, etc. are common — the correct name is whatever already exists in this file.

- [ ] **Step 8: Render the sheet in the template**

At the end of the template (after existing markup):

```svelte
<SignInSheet
  open={signInSheetOpen}
  reason={signInSheetReason}
  webviewMode={webviewDetector.isInAppWebview}
  onPrimaryAction={onSignInSheetPrimary}
  onDismiss={closeSignInSheet}
/>
```

Import at top of script:

```ts
import SignInSheet from "./SignInSheet.svelte";
```

- [ ] **Step 9: Verify compilation**

```bash
npm run check
```

Fix any remaining type errors before proceeding.

- [ ] **Step 10: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte
git commit -m "feat(viewer): wire pending-action queue and sign-in sheet into orchestrator"
```

---

### Task 8: ViewerFooter — remove auth branching and Get App button

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte`

The footer has three layouts (landscape aside at ~197, mid at ~314, desktop at ~451). Each has `{#if isLoggedIn}` / `{:else}` branching. After this task the branching is gone — action buttons render for everyone, delete is gated on ownership (`isOwned`) only.

- [ ] **Step 1: Remove `onGetApp` prop and `isLoggedIn` input**

In the `<script lang="ts">` block, find the `Props` interface and remove `onGetApp` and `isLoggedIn`. The orchestrator will stop passing them.

- [ ] **Step 2: Rewrite landscape actions (around line 197-260)**

Replace the whole `{#if isLoggedIn} … {/if}` block that wraps favorite/save/edit/video/publish/delete buttons. The new version renders the same buttons but without the auth branching:

```svelte
    {#if onFavorite}
      <button
        type="button"
        class="landscape-btn"
        class:favorited={isFavorite}
        onclick={onFavorite}
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        <i class="fas fa-heart" aria-hidden="true"></i>
      </button>
    {/if}
    {#if !isSaved}
      <button
        type="button"
        class="landscape-btn save"
        onclick={onSave}
        aria-label="Save"
      >
        <i class="fas fa-floppy-disk" aria-hidden="true"></i>
      </button>
    {/if}
    <button
      type="button"
      class="landscape-btn edit"
      onclick={onEdit}
      aria-label="Remix"
    >
      <i class="fas fa-pen-to-square" aria-hidden="true"></i>
    </button>
    {#if onVideoUpload}
      <button
        type="button"
        class="landscape-btn video"
        onclick={onVideoUpload}
        aria-label="Upload video"
      >
        <i class="fas fa-video" aria-hidden="true"></i>
        {#if videoCount && videoCount > 0}
          <span class="video-badge video-badge-sm">{videoCount}</span>
        {/if}
      </button>
    {/if}
    {#if isOwned && isSaved}
      <button
        type="button"
        class="landscape-btn"
        onclick={isPublished ? onUnpublish : onPublish}
        aria-label={isPublished ? "Make Private" : "Make Public"}
      >
        <i class="fas {isPublished ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>
      </button>
      {#if onDeleteRequest}
        <button
          type="button"
          class="landscape-btn delete"
          onclick={onDeleteRequest}
          aria-label="Delete sequence"
        >
          <i class="fas fa-trash" aria-hidden="true"></i>
        </button>
      {/if}
    {/if}
```

Notes on changes from original:
- The old `{#if isOwned && !isSaved}` gate around Save is loosened to `{#if !isSaved}` — a non-owner who wants to save a copy of someone else's sequence should be allowed (the downstream save handler decides the destination). If `isOwned` gating is actually desired for Save as a product decision, keep it; the important change is the removal of `isLoggedIn`.
- Delete remains behind `isOwned && isSaved` — ownership, not authentication.

- [ ] **Step 3: Rewrite mid-layout actions (around line 313-358)**

Find the `<div class="mid-actions-group">` block. Replace the `{#if isLoggedIn} … {:else} <Get App button> {/if}` chunk with:

```svelte
        <div class="mid-actions-group">
          {#if onFavorite}
            <button
              type="button"
              class="mid-action-btn"
              class:favorited={isFavorite}
              onclick={onFavorite}
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <i class="fas fa-heart" aria-hidden="true"></i>
            </button>
          {/if}

          {#if !isSaved}
            <button
              type="button"
              class="mid-action-btn save"
              onclick={onSave}
              aria-label="Save sequence"
            >
              <i class="fas fa-floppy-disk" aria-hidden="true"></i>
            </button>
          {/if}

          {#if isOwned && isSaved}
            <button
              type="button"
              class="mid-action-btn edit"
              onclick={onEdit}
              aria-label="Remix"
            >
              <i class="fas fa-pen-to-square" aria-hidden="true"></i>
            </button>
          {/if}

          {#if onVideoUpload}
            <button
              type="button"
              class="mid-action-btn video"
              onclick={onVideoUpload}
              aria-label="Upload video"
            >
              <i class="fas fa-video" aria-hidden="true"></i>
              {#if videoCount && videoCount > 0}
                <span class="video-badge video-badge-sm">{videoCount}</span>
              {/if}
            </button>
          {/if}
```

(The `mid-get-app-btn` markup is deleted entirely.)

- [ ] **Step 4: Rewrite desktop actions (around line 451)**

Repeat the same pattern — remove the `{#if isLoggedIn}` wrapper around the action buttons, delete any `{:else}` branch containing Get App markup. Keep `isOwned`-based gates for Delete and Publish.

- [ ] **Step 5: Delete Get App CSS**

Find and delete `.mid-get-app-btn`, `.get-app-btn`, or any similarly named styles in the `<style>` block. Leave action-button styles untouched.

- [ ] **Step 6: Verify compilation**

```bash
npm run check
```

Expected: no new errors. May surface "prop 'onGetApp' declared but not used" from the orchestrator — that's handled in the next step.

- [ ] **Step 7: Clean the orchestrator's footer prop-binding**

Open `SequenceViewerOrchestrator.svelte`, find where `ViewerFooter` is rendered, and delete the `onGetApp={handleOpenInBrowser}` prop (if it still exists from Task 6) and the `isLoggedIn={...}` prop. The footer no longer accepts them.

- [ ] **Step 8: Verify compilation again**

```bash
npm run check
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerFooter.svelte src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte
git commit -m "refactor(viewer): remove isLoggedIn branching and Get App button from footer"
```

---

### Task 9: ViewerFooter — route action clicks through gated handler

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte`

The footer now always calls `onSave`, `onFavorite`, etc. — but if the user is a guest, those real handlers would fail silently or throw. We route them through `invokeGatedAction` from Task 7.

- [ ] **Step 1: Find the orchestrator's footer render call**

Grep for `<ViewerFooter` in the orchestrator. Look at the current prop bindings like `onSave={handleSave}`, `onFavorite={handleToggleFavorite}`, etc.

- [ ] **Step 2: Wrap each gated prop through `invokeGatedAction`**

Change the bindings to route through the gated wrapper. Example — the real handler names will vary; substitute as appropriate:

```svelte
<ViewerFooter
  onSave={() => invokeGatedAction("save", handleSave)}
  onFavorite={onFavoriteHandler ? () => invokeGatedAction("favorite", onFavoriteHandler) : undefined}
  onPublish={() => invokeGatedAction("publish", handlePublish)}
  onUnpublish={() => invokeGatedAction("publish", handleUnpublish)}
  onEdit={() => invokeGatedAction("remix", handleRemix)}
  onVideoUpload={...}
  onDeleteRequest={...}
  {...otherExistingProps}
/>
```

`onVideoUpload` and `onDeleteRequest` stay unwrapped — Delete is owner-only (already authenticated) and video upload is a separate flow.

`onFavorite` is wrapped only when the underlying handler exists (`onFavoriteHandler ? … : undefined`) — if no favorite handler is registered the button isn't shown anyway.

- [ ] **Step 3: Verify build and manual smoke test the guest path**

```bash
npm run check
```

Then navigate to `/p/[code]?guest=1` in the browser (the debug flag forces guest view). Click Save — the sign-in sheet should appear.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte
git commit -m "feat(viewer): route footer actions through pending-action gate"
```

---

### Task 10: Move RouteViewerHeader to shared location

**Files:**
- Move: `src/routes/sequence/[id]/RouteViewerHeader.svelte` → `src/lib/shared/sequence-viewer/components/RouteViewerHeader.svelte`

- [ ] **Step 1: Use git mv**

```bash
git mv src/routes/sequence/[id]/RouteViewerHeader.svelte src/lib/shared/sequence-viewer/components/RouteViewerHeader.svelte
```

- [ ] **Step 2: Update import in `/sequence/[id]/+page.svelte`**

Change:
```ts
import RouteViewerHeader from "./RouteViewerHeader.svelte";
```
to:
```ts
import RouteViewerHeader from "$lib/shared/sequence-viewer/components/RouteViewerHeader.svelte";
```

- [ ] **Step 3: Update cross-import in `/p/[code]/+page.svelte`**

`/p/[code]/+page.svelte:52` currently cross-imports from the sibling route:
```ts
import RouteViewerHeader from "../../sequence/[id]/RouteViewerHeader.svelte";
```
Change to:
```ts
import RouteViewerHeader from "$lib/shared/sequence-viewer/components/RouteViewerHeader.svelte";
```

- [ ] **Step 4: Verify compilation**

```bash
npm run check
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(viewer): move RouteViewerHeader to shared location"
```

---

### Task 11: Create SequenceViewerRoute shared shell

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/SequenceViewerRoute.svelte`

The two route files (`/sequence/[id]` and `/p/[code]`) are ~90% identical. Extract the shared body into a shell component. Each route file becomes a thin resolver that loads the sequence and hands it to this shell.

- [ ] **Step 1: Study the two route files to identify the shared body**

```bash
diff src/routes/sequence/[id]/+page.svelte src/routes/p/[code]/+page.svelte
```

Expected: ~20-40 lines differ (resolver logic, URL-param persistence, IAB banner padding constant). Everything else is shared.

- [ ] **Step 2: Write the shell**

```svelte
<!-- src/lib/shared/sequence-viewer/components/SequenceViewerRoute.svelte -->
<script lang="ts">
  import { browser } from "$app/environment";
  import type { SequenceData } from "$lib/shared/types/sequence";
  import SequenceViewerOrchestrator from "./SequenceViewerOrchestrator.svelte";
  import RouteViewerHeader from "./RouteViewerHeader.svelte";
  import ViewerSplitPane from "./ViewerSplitPane.svelte";
  import ViewerFooter from "./ViewerFooter.svelte";
  import Viewer3DFullscreen from "$lib/shared/3d/components/Viewer3DFullscreen.svelte";
  // … plus every other import that both route files share today
  // (ExportVideoDrawer, ExportImagePanel, VideoPreviewPanel, PracticeProgressIndicator,
  // ChoreoCardContextMenuHost, CardSettingsModal — grep the two route files and take
  // the union of their imports)

  interface Props {
    sequence: SequenceData;
    sequenceOwnerId?: string;
    initialRenderMode?: "2d" | "3d";
    iabPaddingPx?: number;
    /** Callback that updates a URL param (e.g. ?bpm=180). Route decides whether
     *  to actually write the URL or no-op. */
    updateUrlParam: (key: string, value: string | null) => void;
  }

  let {
    sequence,
    sequenceOwnerId,
    initialRenderMode = "2d",
    iabPaddingPx = 0,
    updateUrlParam,
  }: Props = $props();

  // Body identical to what the two route files share today — copy the markup
  // block that renders RouteViewerHeader, SequenceViewerOrchestrator inside
  // a ViewerSplitPane, the Viewer3DFullscreen overlay, and all the drawers/
  // modals. Use the `/sequence/[id]/+page.svelte` version as the source of
  // truth because it's the one that has the mobile 3D overlay.
</script>

<!-- Markup identical to the current /sequence/[id]/+page.svelte body
     (lines ~471-690 per spec), with:
     - `sequence` instead of the route's local `sequence` variable
     - `updateUrlParam` from props instead of inline
     - `initialRenderMode` from props
     - IAB padding applied via `iabPaddingPx` prop
-->
```

**Practical tip:** literally copy the body of `/sequence/[id]/+page.svelte` (lines 471 to end) into this new file, then replace each differing identifier with its prop equivalent. Don't try to write this from scratch.

- [ ] **Step 3: Verify compilation**

```bash
npm run check
```

Expected: errors in the route files (which still have the old body) — those get fixed in Tasks 12 and 13. This task's goal is just a compilable shell component.

If the shell itself has errors, fix them before proceeding.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/SequenceViewerRoute.svelte
git commit -m "feat(viewer): add SequenceViewerRoute shared shell component"
```

---

### Task 12: Refactor /sequence/[id] to thin resolver

**Files:**
- Modify: `src/routes/sequence/[id]/+page.svelte`

- [ ] **Step 1: Extract the resolver logic**

Identify the parts of the current `+page.svelte` that are NOT in the shared shell: URL decoding, sequence loading from the long ID, `updateUrlParam` function (the real one that writes `history.replaceState`), IAB banner detection, `?render=3d` initial render mode parsing.

- [ ] **Step 2: Rewrite as a thin resolver**

The new file should be ~80-120 lines. Structure:

```svelte
<script lang="ts">
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import SequenceViewerRoute from "$lib/shared/sequence-viewer/components/SequenceViewerRoute.svelte";
  // …existing loaders/services for decoding the sequence ID and fetching the sequence

  // Keep all the existing logic that:
  // - decodes the URL-encoded sequence ID from $page.params.id
  // - loads the sequence (owner + ID)
  // - parses ?render=3d, ?bpm=, ?t=, etc. on mount
  // - detects IAB banner

  const initialRenderMode = $derived(/* existing logic */);
  const iabPaddingPx = $derived(/* existing logic */);

  function updateUrlParam(key: string, value: string | null) {
    if (!browser) return;
    const parsed = new URL(window.location.href);
    if (value === null) parsed.searchParams.delete(key);
    else parsed.searchParams.set(key, value);
    window.history.replaceState({}, "", parsed.toString());
  }
</script>

{#if sequence}
  <SequenceViewerRoute
    {sequence}
    sequenceOwnerId={ownerId}
    {initialRenderMode}
    {iabPaddingPx}
    {updateUrlParam}
  />
{:else if loading}
  <!-- existing loading UI -->
{:else}
  <!-- existing error UI -->
{/if}
```

- [ ] **Step 3: Delete now-unused imports**

Every import that's been moved into the shell (RouteViewerHeader, SequenceViewerOrchestrator, ViewerSplitPane, ViewerFooter, etc.) can come out.

- [ ] **Step 4: Verify**

```bash
npm run check
```

Manually smoke test: navigate to an existing `/sequence/[encoded-id]` URL, confirm playback works, BPM persists in URL on change, 3D toggle works, mobile fullscreen 3D works.

- [ ] **Step 5: Commit**

```bash
git add src/routes/sequence/[id]/+page.svelte
git commit -m "refactor(viewer): reduce /sequence/[id] to thin resolver"
```

---

### Task 13: Refactor /p/[code] to thin resolver + enable URL persistence

**Files:**
- Modify: `src/routes/p/[code]/+page.svelte`

- [ ] **Step 1: Mirror Task 12's structure**

The resolver body is almost the same as `/sequence/[id]` except the sequence loader resolves a short code via Firebase (the existing `ShortCodeManager` path, currently embedded in `/p/[code]/+page.svelte`). Keep that logic; replace the view body with `<SequenceViewerRoute />`.

- [ ] **Step 2: Enable real URL param persistence**

The current `updateUrlParam` in this file is a no-op (`/p/[code]/+page.svelte:414`). Replace it with the real implementation:

```ts
function updateUrlParam(key: string, value: string | null) {
  if (!browser) return;
  const parsed = new URL(window.location.href);
  if (value === null) parsed.searchParams.delete(key);
  else parsed.searchParams.set(key, value);
  window.history.replaceState({}, "", parsed.toString());
}
```

- [ ] **Step 3: Delete imports now in the shell**

Remove imports for the components now living inside `SequenceViewerRoute`. Remove the cross-import from the sibling route (should already be gone from Task 10).

- [ ] **Step 4: Verify**

```bash
npm run check
```

Manual: navigate to a `/p/[code]` URL, confirm it renders with theme background (Task 14), playback works, BPM persists, mobile 3D overlay appears.

- [ ] **Step 5: Commit**

```bash
git add src/routes/p/[code]/+page.svelte
git commit -m "refactor(viewer): reduce /p/[code] to thin resolver, enable URL persistence"
```

---

### Task 14: /p/ layout — add theme background

**Files:**
- Modify: `src/routes/p/+layout@.svelte`

Currently bare (16 lines, no theme). Align with `/sequence/+layout.svelte`.

- [ ] **Step 1: Read `/sequence/+layout.svelte`**

```bash
cat src/routes/sequence/+layout.svelte
```

Copy the theme-canvas rendering logic — or switch the `/p/` layout to re-use `src/routes/sequence/+layout.svelte` directly if the routes layouts are composable. If not, inline the same markup.

- [ ] **Step 2: Apply**

Either:

(a) Simple copy: replace `/p/+layout@.svelte` body with the body of `/sequence/+layout.svelte`.

(b) Shared layout: if there's an existing `BackgroundLayout.svelte` or similar, use it in both places.

- [ ] **Step 3: Manual verification**

Navigate to `/p/[code]` — confirm theme background renders the same as the in-app viewer.

- [ ] **Step 4: Commit**

```bash
git add src/routes/p/+layout@.svelte
git commit -m "fix(viewer): add theme background to /p/ layout"
```

---

### Task 15: Integration test — pending-action survives URL reload

**Files:**
- Create: `tests/unit/PendingActionQueueIntegration.test.ts`

This tests the cross-session flow: an orchestrator mounts with `?pending=save` in the URL, the queue picks it up, and when auth flips true the drain yields the expected action.

- [ ] **Step 1: Write the test**

```ts
// tests/unit/PendingActionQueueIntegration.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PendingActionQueue } from "$lib/shared/sequence-viewer/services/implementations/PendingActionQueue";

describe("PendingActionQueue — URL bootstrap and replay", () => {
  let queue: PendingActionQueue;

  beforeEach(() => {
    queue = new PendingActionQueue();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T12:00:00Z"));
  });

  it("survives a webview → real-browser handoff via URL", () => {
    // Simulate: user in Instagram clicked Save on /p/ABC123, we opened the
    // real browser at /p/ABC123?pending=save
    const landedUrl = new URL("https://tka.app/p/ABC123?pending=save");
    queue.bootstrapFromUrl(landedUrl);

    // User signs in, auth flips true, replay effect drains the queue
    const drained = queue.drain();
    expect(drained).not.toBeNull();
    expect(drained?.type).toBe("save");
    expect(drained?.sequenceId).toBe("ABC123");
    expect(queue.peek()).toBeNull();
  });

  it("expires pending action from URL bootstrap after TTL", () => {
    const landedUrl = new URL("https://tka.app/p/ABC123?pending=save");
    queue.bootstrapFromUrl(landedUrl);
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect(queue.drain()).toBeNull();
  });

  it("gracefully handles URL without pending param", () => {
    const url = new URL("https://tka.app/p/ABC123?bpm=180");
    queue.bootstrapFromUrl(url);
    expect(queue.peek()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test**

```bash
npm test -- tests/unit/PendingActionQueueIntegration.test.ts
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/PendingActionQueueIntegration.test.ts
git commit -m "test(viewer): integration test for pending-action URL bootstrap"
```

---

### Task 16: Manual verification and cleanup

**Files:** None new

- [ ] **Step 1: Run the full check suite**

```bash
npm run check
npm test
```

Expected: all green. Fix any regressions.

- [ ] **Step 2: Manual verification checklist**

Use a real browser against the user's running dev server at `localhost:5173`:

1. **Signed-in Save (baseline):** Sign in normally, navigate to Browse → open a sequence. Click Save — confirm save works without any sign-in sheet appearing.
2. **Guest Save → sign-in replay:** Sign out. Navigate to any `/sequence/[id]` URL. Click Save — sheet appears with "Sign in to save this to your library" copy. Sign in with Google. Sheet closes automatically, save fires, toast appears. Confirm sequence is in My Library.
3. **Guest dismiss:** Open an incognito window. Navigate to a `/p/[code]` URL. Click Save — sheet appears. Dismiss via backdrop. Confirm URL no longer contains `?pending=save`.
4. **URL bootstrap:** In incognito, navigate to `/p/[code]?pending=favorite`. Confirm sheet appears automatically with "Sign in to favorite this sequence."
5. **Theme background on /p/:** Confirm `/p/[code]` renders the same theme background as `/sequence/[id]` and the in-app drawer.
6. **Mobile 3D fullscreen on /p/:** On a mobile viewport (or Chrome DevTools device emulation), open a `/p/[code]` URL, toggle 3D — confirm fullscreen overlay appears.
7. **URL param persistence on /p/:** Open `/p/[code]`, change BPM, observe URL updates to `/p/[code]?bpm=180`. Reload — BPM stays at 180.
8. **`?guest=1` debug flag still works:** Navigate to `/sequence/[id]?guest=1` while signed in — forces guest UI, Save click triggers the sheet.

If any fails, fix and re-verify.

- [ ] **Step 3: Final commit**

```bash
git add -A
git status  # confirm clean
git commit --allow-empty -m "chore(viewer): viewer unification verified manually"
```

- [ ] **Step 4: Update memory entry**

Open `C:/Users/Austen/.claude/projects/E--tka-platform/memory/project_viewer_unification.md`. Change the first line to reflect completion:

```
Sequence viewer unification — shipped 2026-04-14. Spec at `docs/superpowers/specs/2026-04-14-sequence-viewer-unification-design.md`. Guest and signed-in viewers unified; pending-action queue preserves intent across auth; /sequence/[id] and /p/[code] consolidated through SequenceViewerRoute shell.
```

---

## Self-Review Notes

- **Spec coverage:** Every spec section (pending queue, sign-in sheet, webview detection, route consolidation, drift fixes, DI wiring) has at least one task.
- **Type consistency:** `PendingActionType` used in contract, impl, test, orchestrator, sheet — all match. Handler names (`handleSave`, `handleFavorite`, etc.) are flagged with a grep-and-substitute note in Task 7 since the actual names live in the orchestrator and can't be hardcoded from outside.
- **Handler-name caveat:** Task 7 explicitly tells the implementer to grep for the real handler names before committing. This is the one place the plan can't fully inline code — the orchestrator is 1800+ lines and the handlers are named by existing conventions.
- **Delete button semantics:** `isOwned` alone gates Delete now, without an AND on `isLoggedIn`. If a non-authenticated user somehow became `isOwned` (they can't — ownership derives from user ID), that's a deeper bug than this spec addresses.
- **No TDD for Svelte components:** PendingActionQueue and WebviewDetector get unit tests; SignInSheet and SequenceViewerRoute are UI components whose correctness is verified manually per the project's testing philosophy ("tests that catch what eyes can't").
