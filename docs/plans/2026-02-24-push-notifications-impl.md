# Push Notifications + App Badge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable push notifications so the PWA icon shows an unread badge count and users receive OS-level notifications for messages and user-selected notification types, even when the app is closed.

**Architecture:** Firestore-triggered Cloud Functions send FCM push messages when new messages/notifications are created. A Firebase Messaging handler integrated into the existing Workbox service worker receives pushes, shows OS notifications, and updates the app badge. Client-side FCM token management handles registration, refresh, and multi-device support.

**Tech Stack:** Firebase Cloud Messaging (FCM), Firebase Cloud Functions v2, Workbox (existing), Badging API, Svelte 5 runes

**Design doc:** `docs/plans/2026-02-24-push-notifications-design.md`

---

## Task 1: VAPID Key Setup

This is a **user action** - Claude cannot access the Firebase Console.

**Step 1: Generate VAPID key**

Go to Firebase Console > Project Settings > Cloud Messaging > Web Push certificates > "Generate key pair"

Copy the public key (looks like: `BPtL...long-base64-string`).

**Step 2: Create VAPID config file**

**Files:**
- Create: `src/lib/shared/push/config/vapid.ts`

```typescript
/**
 * VAPID public key for Firebase Cloud Messaging.
 * Generated in Firebase Console > Cloud Messaging > Web Push certificates.
 * This is a PUBLIC key - safe to commit.
 */
export const VAPID_KEY = "PASTE_YOUR_VAPID_KEY_HERE";
```

**Step 3: Commit**

```bash
git add src/lib/shared/push/config/vapid.ts
git commit -m "feat(push): add VAPID key config for FCM"
```

---

## Task 2: Firebase Messaging Service Worker Handler

Integrate FCM push handling into the existing Workbox-generated service worker via `importScripts`.

**Files:**
- Create: `static/firebase-messaging-handler.js`
- Modify: `vite.config.ts` (workbox config, ~line 606)

**Step 1: Create the messaging handler script**

This runs inside the service worker context. Uses Firebase compat SDK (required for SW - no ES module support).

```javascript
/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging handler for the service worker.
 * Imported into the Workbox-generated SW via importScripts.
 *
 * Handles:
 * - Background push notifications (app closed/unfocused)
 * - App badge updates
 * - Notification click routing
 */

// Firebase compat SDK (required for service worker context)
importScripts("https://www.gstatic.com/firebasejs/11.4.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.4.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDKUM9pf0e_KgFjW1OBKChvrU75SnR12v4",
  authDomain: "the-kinetic-alphabet.firebaseapp.com",
  projectId: "the-kinetic-alphabet",
  storageBucket: "the-kinetic-alphabet.firebasestorage.app",
  messagingSenderId: "664225703033",
  appId: "1:664225703033:web:62e6c1eebe4fff3ef760a8",
});

const messaging = firebase.messaging();

// Background message handler (fires when app is NOT in foreground)
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const notification = payload.notification || {};

  const title = notification.title || data.title || "TKA Scribe";
  const body = notification.body || data.body || "";

  self.registration.showNotification(title, {
    body,
    icon: "/pwa/icons/icon-192x192.png",
    badge: "/pwa/icons/icon-96x96.png",
    tag: data.tag || "tka-notification",
    data: {
      url: data.url || "/app",
      conversationId: data.conversationId || null,
      notificationId: data.notificationId || null,
      type: data.type || "generic",
    },
    // Vibrate: short-long-short
    vibrate: [100, 200, 100],
  });

  // Update app badge with unread count
  const unreadCount = parseInt(data.unreadCount, 10);
  if (!isNaN(unreadCount) && unreadCount > 0 && self.navigator?.setAppBadge) {
    self.navigator.setAppBadge(unreadCount);
  }
});

// Notification click handler - focus existing window or open new one
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/app";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Try to focus an existing window
      for (const client of windowClients) {
        if (new URL(client.url).pathname.startsWith("/app") && "focus" in client) {
          // Navigate to the specific route if different
          if (url !== "/app" && client.url !== new URL(url, self.location.origin).href) {
            client.navigate(url);
          }
          return client.focus();
        }
      }
      // No existing window - open new one
      return self.clients.openWindow(url);
    })
  );
});
```

**Step 2: Add importScripts to Workbox config**

In `vite.config.ts`, inside the `workbox: { ... }` block (around line 606), add:

```typescript
workbox: {
  // Existing config...
  mode: "production",
  disableDevLogs: true,

  // Import Firebase Messaging handler into the generated SW
  importScripts: ["/firebase-messaging-handler.js"],

  // ... rest of existing config
```

**Step 3: Verify build works**

Run: `npm run build`
Expected: Build succeeds, `build/sw.js` contains `importScripts("/firebase-messaging-handler.js")` near the top.

**Step 4: Commit**

```bash
git add static/firebase-messaging-handler.js vite.config.ts
git commit -m "feat(push): add FCM handler to service worker"
```

---

## Task 3: FCM Token Manager Service

Client-side service that manages FCM registration tokens per device.

**Files:**
- Create: `src/lib/shared/push/services/contracts/IFCMTokenManager.ts`
- Create: `src/lib/shared/push/services/implementations/FCMTokenManager.ts`
- Modify: `src/lib/shared/di/containers/` (add push container or extend core container)
- Modify: `src/lib/shared/di/container-types.ts`
- Modify: `src/lib/shared/di/index.ts`

**Step 1: Create the interface**

```typescript
// src/lib/shared/push/services/contracts/IFCMTokenManager.ts

/**
 * Manages FCM registration tokens for push notifications.
 * Each device/browser gets its own token, stored in Firestore.
 */
export interface IFCMTokenManager {
  /**
   * Initialize FCM and register the current device's token.
   * Call after user grants notification permission.
   * Returns the FCM token string, or null if registration failed.
   */
  registerToken(userId: string): Promise<string | null>;

  /**
   * Delete the current device's FCM token.
   * Call on logout to stop receiving push on this device.
   */
  unregisterToken(userId: string): Promise<void>;

  /**
   * Check if the current browser supports push notifications.
   */
  isSupported(): Promise<boolean>;

  /**
   * Get the current notification permission state.
   * "default" = not asked, "granted" = allowed, "denied" = blocked
   */
  getPermissionState(): NotificationPermission;

  /**
   * Request notification permission from the user.
   * Returns the new permission state.
   */
  requestPermission(): Promise<NotificationPermission>;
}
```

**Step 2: Create the implementation**

```typescript
// src/lib/shared/push/services/implementations/FCMTokenManager.ts

import { getMessaging, getToken, deleteToken, isSupported as fcmIsSupported } from "firebase/messaging";
import { collection, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { getApp } from "firebase/app";
import { VAPID_KEY } from "../../config/vapid";
import type { IFCMTokenManager } from "../contracts/IFCMTokenManager";

const FCM_TOKENS_COLLECTION = "fcmTokens";

export class FCMTokenManager implements IFCMTokenManager {
  private currentToken: string | null = null;

  async registerToken(userId: string): Promise<string | null> {
    try {
      const supported = await this.isSupported();
      if (!supported) {
        console.warn("[FCMTokenManager] Push not supported in this browser");
        return null;
      }

      if (this.getPermissionState() !== "granted") {
        console.warn("[FCMTokenManager] Notification permission not granted");
        return null;
      }

      const app = getApp();
      const messaging = getMessaging(app);

      // Get existing SW registration (the Workbox SW that includes our FCM handler)
      const swRegistration = await navigator.serviceWorker.getRegistration("/");
      if (!swRegistration) {
        console.error("[FCMTokenManager] No service worker registration found");
        return null;
      }

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swRegistration,
      });

      if (!token) {
        console.warn("[FCMTokenManager] Failed to get FCM token");
        return null;
      }

      // Store token in Firestore
      await this.storeToken(userId, token);
      this.currentToken = token;

      console.log("[FCMTokenManager] Token registered successfully");
      return token;
    } catch (error) {
      console.error("[FCMTokenManager] Token registration failed:", error);
      return null;
    }
  }

  async unregisterToken(userId: string): Promise<void> {
    try {
      if (this.currentToken) {
        // Remove from Firestore
        await this.removeToken(userId, this.currentToken);

        // Revoke the FCM token
        const app = getApp();
        const messaging = getMessaging(app);
        await deleteToken(messaging);

        this.currentToken = null;
        console.log("[FCMTokenManager] Token unregistered");
      }
    } catch (error) {
      console.error("[FCMTokenManager] Token unregistration failed:", error);
    }
  }

  async isSupported(): Promise<boolean> {
    if (!("Notification" in window)) return false;
    if (!("serviceWorker" in navigator)) return false;

    try {
      return await fcmIsSupported();
    } catch {
      return false;
    }
  }

  getPermissionState(): NotificationPermission {
    if (!("Notification" in window)) return "denied";
    return Notification.permission;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!("Notification" in window)) return "denied";
    return Notification.requestPermission();
  }

  private async storeToken(userId: string, token: string): Promise<void> {
    const firestore = await getFirestoreInstance();
    // Use a hash of the token as the doc ID to avoid duplicates per device
    const tokenHash = await this.hashToken(token);
    const tokenRef = doc(
      collection(firestore, "users", userId, FCM_TOKENS_COLLECTION),
      tokenHash
    );

    await setDoc(tokenRef, {
      token,
      createdAt: serverTimestamp(),
      lastRefreshed: serverTimestamp(),
      device: this.getDeviceLabel(),
      userAgent: navigator.userAgent,
    });
  }

  private async removeToken(userId: string, token: string): Promise<void> {
    const firestore = await getFirestoreInstance();
    const tokenHash = await this.hashToken(token);
    const tokenRef = doc(
      collection(firestore, "users", userId, FCM_TOKENS_COLLECTION),
      tokenHash
    );
    await deleteDoc(tokenRef);
  }

  private async hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hash = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hash));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  }

  private getDeviceLabel(): string {
    const ua = navigator.userAgent;
    if (ua.includes("Android")) return "Android";
    if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
    if (ua.includes("Windows")) return "Windows";
    if (ua.includes("Mac")) return "macOS";
    if (ua.includes("Linux")) return "Linux";
    return "Unknown";
  }
}
```

**Step 3: Create DI container for push services**

```typescript
// src/lib/shared/di/containers/push-container.ts

import { createContainer } from "iti";
import { FCMTokenManager } from "$lib/shared/push/services/implementations/FCMTokenManager";

export function createPushContainer() {
  return createContainer().add({
    fcmTokenManager: () => new FCMTokenManager(),
  });
}

export type PushContainer = ReturnType<typeof createPushContainer>;
```

**Step 4: Register in container-types.ts and index.ts**

Add to `container-types.ts`:
```typescript
import type { PushContainer } from "./containers/push-container";
type PushItems = ItemsOf<PushContainer>;
// Add PushItems to the IAppContainerItems intersection
```

Wire into `buildAppContainer()` in `index.ts`:
```typescript
import { createPushContainer } from "./containers/push-container";
// Inside buildAppContainer():
const pushContainer = createPushContainer();
// Merge into combined container
```

**Step 5: Commit**

```bash
git add src/lib/shared/push/ src/lib/shared/di/containers/push-container.ts src/lib/shared/di/container-types.ts src/lib/shared/di/index.ts
git commit -m "feat(push): add FCM token manager service with DI registration"
```

---

## Task 4: Badge Manager

Wire `navigator.setAppBadge()` to the reactive `totalUnreadCount` in inbox state.

**Files:**
- Modify: `src/lib/shared/inbox/components/InboxSubscriptionProvider.svelte`

**Step 1: Add badge effect to InboxSubscriptionProvider**

Add an `$effect` that reacts to `totalUnreadCount` changes:

```typescript
// Inside the <script> block, after existing subscription effects:

// Badge API - update app icon badge with unread count
$effect(() => {
  const count = inboxState.totalUnreadCount;

  if ("setAppBadge" in navigator) {
    if (count > 0) {
      navigator.setAppBadge(count).catch(() => {
        // Badge API not supported or permission denied - silent
      });
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  }
});
```

**Step 2: Verify build**

Run: `npm run build`
Expected: No type errors. The Badge API types are in `lib.dom.d.ts` (TypeScript 5.3+).

Note: If TypeScript complains about `setAppBadge` not existing on `Navigator`, we may need to add a type declaration:

```typescript
// src/lib/shared/push/types/badge-api.d.ts
interface Navigator {
  setAppBadge(count?: number): Promise<void>;
  clearAppBadge(): Promise<void>;
}
```

**Step 3: Commit**

```bash
git add src/lib/shared/inbox/components/InboxSubscriptionProvider.svelte
git commit -m "feat(push): wire app badge to inbox unread count"
```

---

## Task 5: Push Permission Prompt

Contextual UI that asks for notification permission at the right moment.

**Files:**
- Create: `src/lib/shared/push/components/PushPermissionPrompt.svelte`
- Modify: `src/lib/shared/inbox/components/InboxSubscriptionProvider.svelte` (add trigger logic)

**Step 1: Create the prompt component**

```svelte
<!-- src/lib/shared/push/components/PushPermissionPrompt.svelte -->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import type { IFCMTokenManager } from "../services/contracts/IFCMTokenManager";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  interface Props {
    userId: string;
    onDismiss: () => void;
  }

  let { userId, onDismiss }: Props = $props();

  let loading = $state(false);

  async function handleEnable() {
    loading = true;
    try {
      const fcmTokenManager = container.items.fcmTokenManager as IFCMTokenManager;
      const permission = await fcmTokenManager.requestPermission();

      if (permission === "granted") {
        await fcmTokenManager.registerToken(userId);
        toast.success("Push notifications enabled");
      } else if (permission === "denied") {
        toast.info("Notifications blocked. You can enable them in browser settings.");
      }
    } catch (error) {
      console.error("[PushPermissionPrompt] Failed:", error);
    } finally {
      loading = false;
      onDismiss();
    }
  }

  function handleNotNow() {
    // Don't ask again for 30 days
    localStorage.setItem(
      "tka-push-prompt-dismissed",
      String(Date.now() + 30 * 24 * 60 * 60 * 1000)
    );
    onDismiss();
  }
</script>

<div class="push-prompt" role="alertdialog" aria-label="Enable push notifications">
  <p class="prompt-text">Get notified when you receive messages, even when the app is closed?</p>
  <div class="prompt-actions">
    <button class="btn-secondary" onclick={handleNotNow} disabled={loading}>
      Not now
    </button>
    <button class="btn-primary" onclick={handleEnable} disabled={loading}>
      {loading ? "Enabling..." : "Enable"}
    </button>
  </div>
</div>

<style>
  .push-prompt {
    position: fixed;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 80px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--theme-card-bg, rgba(30, 30, 46, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    padding: 16px 20px;
    max-width: 380px;
    width: calc(100% - 32px);
    z-index: 9000;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .prompt-text {
    margin: 0 0 12px;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #ffffff);
    line-height: 1.4;
  }

  .prompt-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .btn-secondary,
  .btn-primary {
    padding: 8px 16px;
    border-radius: var(--radius-md, 8px);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    border: none;
    min-height: 44px;
  }

  .btn-secondary {
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .btn-primary {
    background: var(--theme-accent, #6366f1);
    color: #ffffff;
    font-weight: 600;
  }

  .btn-primary:disabled,
  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: no-preference) {
    .push-prompt {
      animation: slideUp 200ms ease-out;
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
</style>
```

**Step 2: Add trigger logic to InboxSubscriptionProvider**

Add state + logic to show the prompt when first unread message arrives:

```typescript
// In InboxSubscriptionProvider.svelte <script>:

import PushPermissionPrompt from "$lib/shared/push/components/PushPermissionPrompt.svelte";
import type { IFCMTokenManager } from "$lib/shared/push/services/contracts/IFCMTokenManager";

let showPushPrompt = $state(false);
let pushPromptChecked = false;

// Show push prompt when unread messages appear (one-time)
$effect(() => {
  const messageCount = inboxState.unreadMessageCount;

  if (messageCount > 0 && !pushPromptChecked && currentUserId) {
    pushPromptChecked = true;

    // Check if we should show the prompt
    void (async () => {
      const fcmTokenManager = container.items.fcmTokenManager as IFCMTokenManager;
      const supported = await fcmTokenManager.isSupported();
      if (!supported) return;

      const permission = fcmTokenManager.getPermissionState();
      if (permission !== "default") return; // Already granted or denied

      // Check cooldown
      const dismissed = localStorage.getItem("tka-push-prompt-dismissed");
      if (dismissed && Date.now() < parseInt(dismissed, 10)) return;

      showPushPrompt = true;
    })();
  }
});
```

And in the template:

```svelte
{#if showPushPrompt && currentUserId}
  <PushPermissionPrompt
    userId={currentUserId}
    onDismiss={() => { showPushPrompt = false; }}
  />
{/if}
```

**Step 3: Commit**

```bash
git add src/lib/shared/push/components/PushPermissionPrompt.svelte src/lib/shared/inbox/components/InboxSubscriptionProvider.svelte
git commit -m "feat(push): add contextual push permission prompt"
```

---

## Task 6: Notification Preferences - Push Toggle

Add a master "Push notifications" toggle to the existing notification preferences system.

**Files:**
- Modify: `src/lib/features/feedback/domain/models/notification-models.ts` (add `pushEnabled` to `NotificationPreferences`)
- Modify: `src/lib/features/feedback/services/implementations/NotificationPreferencesManager.ts` (update defaults)
- Modify: whichever component renders the notification preferences UI (find via grep for `NotificationPreferences` component usage)

**Step 1: Add `pushEnabled` to NotificationPreferences interface**

In `notification-models.ts`, add to the `NotificationPreferences` interface:

```typescript
interface NotificationPreferences {
  // Existing fields...
  pushEnabled: boolean; // Master toggle for push notifications
}
```

**Step 2: Update defaults in NotificationPreferencesManager**

Add `pushEnabled: true` to the `DEFAULT_PREFERENCES` object. This means push is opt-in (user still needs to grant browser permission), but once granted, it's on by default.

**Step 3: Add toggle to notification preferences UI**

Find the component that renders notification preferences toggles (likely in inbox or settings) and add a "Push notifications" toggle at the top, visually separated from per-type toggles. When toggled off, it should call `fcmTokenManager.unregisterToken()`. When toggled on, it should call `requestPermission()` then `registerToken()`.

**Step 4: Commit**

```bash
git add src/lib/features/feedback/domain/models/notification-models.ts src/lib/features/feedback/services/implementations/NotificationPreferencesManager.ts [preferences-ui-file]
git commit -m "feat(push): add push notifications master toggle to preferences"
```

---

## Task 7: Cloud Function - Push Dispatcher (Shared Utility)

Shared logic for looking up FCM tokens and sending push messages. Used by both onNewMessage and onNewNotification.

**Files:**
- Create: `firebase-functions/src/push/pushDispatcher.ts`
- Create: `firebase-functions/src/push/types.ts`

**Step 1: Create types**

```typescript
// firebase-functions/src/push/types.ts

export interface PushPayload {
  title: string;
  body: string;
  /** Route to open on click, e.g. "/app" or "/app?conversation=abc" */
  url: string;
  /** Notification tag for grouping/replacing */
  tag: string;
  /** Notification type for client routing */
  type: string;
  /** Optional: conversation ID for message pushes */
  conversationId?: string;
  /** Optional: notification document ID */
  notificationId?: string;
}
```

**Step 2: Create push dispatcher**

```typescript
// firebase-functions/src/push/pushDispatcher.ts

import * as admin from "firebase-admin";
import type { PushPayload } from "./types";

const db = admin.firestore();

interface FCMTokenDoc {
  token: string;
  createdAt: admin.firestore.Timestamp;
  lastRefreshed: admin.firestore.Timestamp;
  device: string;
}

/**
 * Look up a user's FCM tokens and send a push notification to all their devices.
 * Automatically cleans up stale/invalid tokens.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  unreadCount: number
): Promise<void> {
  // Get all FCM tokens for this user
  const tokensSnapshot = await db
    .collection("users")
    .doc(userId)
    .collection("fcmTokens")
    .get();

  if (tokensSnapshot.empty) {
    return; // User has no registered devices
  }

  const tokens: string[] = [];
  const tokenDocs: Map<string, admin.firestore.DocumentReference> = new Map();

  for (const tokenDoc of tokensSnapshot.docs) {
    const data = tokenDoc.data() as FCMTokenDoc;
    tokens.push(data.token);
    tokenDocs.set(data.token, tokenDoc.ref);
  }

  if (tokens.length === 0) return;

  // Send to all devices
  const message: admin.messaging.MulticastMessage = {
    tokens,
    data: {
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: payload.tag,
      type: payload.type,
      unreadCount: String(unreadCount),
      ...(payload.conversationId ? { conversationId: payload.conversationId } : {}),
      ...(payload.notificationId ? { notificationId: payload.notificationId } : {}),
    },
    // Use data-only messages for full control in the SW handler.
    // notification field would trigger automatic display we can't customize.
    webpush: {
      headers: {
        Urgency: "high",
      },
      fcmOptions: {
        link: payload.url,
      },
    },
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  // Clean up stale tokens
  if (response.failureCount > 0) {
    const staleDeletes: Promise<admin.firestore.WriteResult>[] = [];

    response.responses.forEach((result, index) => {
      if (result.error) {
        const errorCode = result.error.code;
        // These codes mean the token is permanently invalid
        if (
          errorCode === "messaging/invalid-registration-token" ||
          errorCode === "messaging/registration-token-not-registered"
        ) {
          const staleToken = tokens[index];
          const ref = tokenDocs.get(staleToken);
          if (ref) {
            staleDeletes.push(ref.delete());
            console.log(`[pushDispatcher] Removed stale token for user ${userId}`);
          }
        }
      }
    });

    if (staleDeletes.length > 0) {
      await Promise.all(staleDeletes);
    }
  }

  const successCount = response.successCount;
  if (successCount > 0) {
    console.log(`[pushDispatcher] Sent push to ${successCount} device(s) for user ${userId}`);
  }
}

/**
 * Check if a user has push enabled for a given notification type.
 * Messages always push (returns true). Other types check preferences.
 */
export async function shouldPushForType(
  userId: string,
  notificationType: string
): Promise<boolean> {
  // Messages always push
  if (notificationType === "message") return true;

  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) return false;

  const userData = userDoc.data();
  const prefs = userData?.notificationPreferences;

  // If no preferences set, default to all enabled
  if (!prefs) return true;

  // Check master push toggle
  if (prefs.pushEnabled === false) return false;

  // Map notification type to preference key
  const prefKeyMap: Record<string, string> = {
    "feedback-resolved": "feedbackResolved",
    "feedback-in-progress": "feedbackInProgress",
    "feedback-needs-info": "feedbackNeedsInfo",
    "feedback-response": "feedbackResponse",
    "sequence-liked": "sequenceLiked",
    "user-followed": "userFollowed",
    "achievement-unlocked": "achievementUnlocked",
    "admin-new-user-signup": "adminNewUserSignup",
    "moderation-warning": "moderationWarning",
    "system-announcement": "systemAnnouncement",
  };

  const prefKey = prefKeyMap[notificationType];
  if (!prefKey) return true; // Unknown type, default to push

  return prefs[prefKey] !== false; // Default to true if not explicitly disabled
}

/**
 * Get total unread count for a user (messages + notifications).
 */
export async function getUnreadCount(userId: string): Promise<number> {
  // Count unread notifications
  const notificationsSnapshot = await db
    .collection("users")
    .doc(userId)
    .collection("notifications")
    .where("read", "==", false)
    .count()
    .get();

  const unreadNotifications = notificationsSnapshot.data().count;

  // Count unread messages across conversations
  const conversationsSnapshot = await db
    .collection("conversations")
    .where("participants", "array-contains", userId)
    .get();

  let unreadMessages = 0;
  for (const convDoc of conversationsSnapshot.docs) {
    const unreadCount = convDoc.data().unreadCount;
    if (unreadCount && typeof unreadCount[userId] === "number") {
      unreadMessages += unreadCount[userId];
    }
  }

  return unreadNotifications + unreadMessages;
}
```

**Step 3: Commit**

```bash
git add firebase-functions/src/push/
git commit -m "feat(push): add push dispatcher utility for Cloud Functions"
```

---

## Task 8: Cloud Function - onNewMessage

Firestore trigger that sends push when a new message is created.

**Files:**
- Create: `firebase-functions/src/push/onNewMessage.ts`
- Modify: `firebase-functions/src/index.ts` (export the function)

**Step 1: Create the function**

```typescript
// firebase-functions/src/push/onNewMessage.ts

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { sendPushToUser, getUnreadCount } from "./pushDispatcher";

const db = admin.firestore();

/**
 * Triggers when a new message is created in any conversation.
 * Sends push notifications to all participants except the sender.
 */
export const onNewMessage = onDocumentCreated(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const messageData = snapshot.data();
    const { conversationId } = event.params;

    const senderId = messageData.senderId as string;
    const senderName = messageData.senderName as string;
    const content = messageData.content as string;

    // Get conversation to find participants
    const conversationDoc = await db
      .collection("conversations")
      .doc(conversationId)
      .get();

    if (!conversationDoc.exists) {
      console.error(`[onNewMessage] Conversation ${conversationId} not found`);
      return;
    }

    const conversationData = conversationDoc.data()!;
    const participants = conversationData.participants as string[];
    const conversationType = conversationData.type || "direct";

    // Send push to each participant except the sender
    const recipients = participants.filter((uid) => uid !== senderId);

    const pushPromises = recipients.map(async (recipientId) => {
      // Check if user wants pushes for messages
      const userDoc = await db.collection("users").doc(recipientId).get();
      if (!userDoc.exists) return;

      const prefs = userDoc.data()?.notificationPreferences;
      if (prefs?.pushEnabled === false) return;
      // messageReceived preference - default true
      if (prefs?.messageReceived === false) return;

      const unreadCount = await getUnreadCount(recipientId);

      // Build title based on conversation type
      let title: string;
      if (conversationType === "group" && conversationData.groupMetadata?.name) {
        title = `${senderName} in ${conversationData.groupMetadata.name}`;
      } else {
        title = senderName;
      }

      await sendPushToUser(recipientId, {
        title,
        body: content.length > 100 ? content.slice(0, 100) + "..." : content,
        url: `/app?conversation=${conversationId}`,
        tag: `message-${conversationId}`, // Group by conversation
        type: "message",
        conversationId,
      }, unreadCount);
    });

    await Promise.allSettled(pushPromises);
  }
);
```

**Step 2: Export from index.ts**

Add to `firebase-functions/src/index.ts`:

```typescript
// Push notification triggers
export { onNewMessage } from "./push/onNewMessage";
```

**Step 3: Install firebase-functions v2 types if needed**

The v2 Firestore triggers are in `firebase-functions/v2/firestore`. Since `firebase-functions: ^5.0.0` is already installed, this import should work. Verify:

Run: `cd firebase-functions && npx tsc --noEmit`
Expected: No errors related to `firebase-functions/v2/firestore`

**Step 4: Commit**

```bash
git add firebase-functions/src/push/onNewMessage.ts firebase-functions/src/index.ts
git commit -m "feat(push): add onNewMessage Cloud Function trigger"
```

---

## Task 9: Cloud Function - onNewNotification

Firestore trigger that sends push when a new notification is created (likes, follows, etc.).

**Files:**
- Create: `firebase-functions/src/push/onNewNotification.ts`
- Modify: `firebase-functions/src/index.ts` (export)

**Step 1: Create the function**

```typescript
// firebase-functions/src/push/onNewNotification.ts

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { sendPushToUser, shouldPushForType, getUnreadCount } from "./pushDispatcher";

/**
 * Triggers when a new notification document is created for any user.
 * Checks notification preferences before sending push.
 * Skips "message-received" type to avoid duplicating onNewMessage pushes.
 */
export const onNewNotification = onDocumentCreated(
  "users/{userId}/notifications/{notificationId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const { userId, notificationId } = event.params;
    const notificationData = snapshot.data();

    const type = notificationData.type as string;

    // Skip message-received - handled by onNewMessage to avoid double push
    if (type === "message-received") return;

    // Check if user wants push for this type
    const shouldPush = await shouldPushForType(userId, type);
    if (!shouldPush) return;

    const unreadCount = await getUnreadCount(userId);

    // Build notification content
    const message = notificationData.message as string;
    const fromUserName = notificationData.fromUserName as string | undefined;

    const title = fromUserName || "TKA Scribe";
    const body = message || "You have a new notification";

    await sendPushToUser(userId, {
      title,
      body: body.length > 100 ? body.slice(0, 100) + "..." : body,
      url: "/app?tab=notifications",
      tag: `notification-${type}`,
      type,
      notificationId,
    }, unreadCount);
  }
);
```

**Step 2: Export from index.ts**

Add to `firebase-functions/src/index.ts`:

```typescript
export { onNewNotification } from "./push/onNewNotification";
```

**Step 3: Commit**

```bash
git add firebase-functions/src/push/onNewNotification.ts firebase-functions/src/index.ts
git commit -m "feat(push): add onNewNotification Cloud Function trigger"
```

---

## Task 10: Auth Integration - Token Lifecycle

Wire FCM token registration into the login/logout flow.

**Files:**
- Modify: `src/lib/shared/auth/state/authState.svelte.ts` (or wherever the auth listener handles login/logout side effects)
- Modify: `src/lib/shared/inbox/components/InboxSubscriptionProvider.svelte` (alternative: register token here since it already has userId)

**Step 1: Register token on login (when permission already granted)**

The cleanest place is `InboxSubscriptionProvider.svelte` since it already runs when the user is authenticated and has their userId. Add an effect:

```typescript
// Auto-register FCM token if permission already granted
$effect(() => {
  if (!currentUserId) return;

  void (async () => {
    const fcmTokenManager = container.items.fcmTokenManager as IFCMTokenManager;
    const supported = await fcmTokenManager.isSupported();
    if (!supported) return;

    const permission = fcmTokenManager.getPermissionState();
    if (permission === "granted") {
      await fcmTokenManager.registerToken(currentUserId);
    }
  })();
});
```

**Step 2: Unregister token on logout**

Find the logout handler (likely in auth state or a logout button component). Add:

```typescript
// Before signing out:
const fcmTokenManager = container.items.fcmTokenManager as IFCMTokenManager;
await fcmTokenManager.unregisterToken(userId);
// Then proceed with Firebase signOut()
```

**Step 3: Commit**

```bash
git add src/lib/shared/inbox/components/InboxSubscriptionProvider.svelte [logout-handler-file]
git commit -m "feat(push): wire FCM token lifecycle to auth flow"
```

---

## Task 11: Foreground Message Handler

When the app is open and focused, FCM messages arrive via the client SDK (not the SW). Handle them to avoid showing OS notifications when the user is already looking at the app.

**Files:**
- Create: `src/lib/shared/push/services/implementations/ForegroundMessageHandler.ts`
- Modify: `src/lib/shared/inbox/components/InboxSubscriptionProvider.svelte`

**Step 1: Create foreground handler**

```typescript
// src/lib/shared/push/services/implementations/ForegroundMessageHandler.ts

import { getMessaging, onMessage } from "firebase/messaging";
import { getApp } from "firebase/app";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";

let unsubscribe: (() => void) | null = null;

/**
 * Listen for FCM messages when the app is in the foreground.
 * Shows a toast instead of an OS notification (user is already in the app).
 */
export function startForegroundMessageListener(): void {
  if (unsubscribe) return; // Already listening

  try {
    const app = getApp();
    const messaging = getMessaging(app);

    unsubscribe = onMessage(messaging, (payload) => {
      const data = payload.data || {};
      const title = data.title || "New notification";
      const body = data.body || "";

      // Show in-app toast instead of OS notification
      toast.info(`${title}: ${body}`, 5000);
    });
  } catch (error) {
    console.error("[ForegroundMessageHandler] Failed to start listener:", error);
  }
}

export function stopForegroundMessageListener(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
```

**Step 2: Start listener in InboxSubscriptionProvider**

```typescript
import { startForegroundMessageListener, stopForegroundMessageListener } from "$lib/shared/push/services/implementations/ForegroundMessageHandler";

// In an $effect after auth check:
$effect(() => {
  if (currentUserId) {
    startForegroundMessageListener();
  }
  return () => {
    stopForegroundMessageListener();
  };
});
```

**Step 3: Commit**

```bash
git add src/lib/shared/push/services/implementations/ForegroundMessageHandler.ts src/lib/shared/inbox/components/InboxSubscriptionProvider.svelte
git commit -m "feat(push): add foreground message handler with toast display"
```

---

## Task 12: Build, Deploy, and Verify

**Step 1: Build the client**

Run: `npm run build`
Expected: Clean build, no type errors.

**Step 2: Build Cloud Functions**

Run: `cd firebase-functions && npm run build`
Expected: Clean TypeScript compilation.

**Step 3: Deploy Cloud Functions**

Run: `firebase deploy --only functions:onNewMessage,functions:onNewNotification`
Expected: Functions deployed successfully.

**Step 4: Verify VAPID key**

Replace the placeholder in `src/lib/shared/push/config/vapid.ts` with the real key from Firebase Console.

**Step 5: Test end-to-end**

1. Open the app, log in
2. Open notification preferences, enable push
3. Browser should ask for notification permission
4. Send a message from another account
5. Verify: OS notification appears, app badge shows count
6. Click notification - app opens to the conversation
7. Mark messages as read - badge clears

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat(push): complete push notification system with badge support"
```

---

## File Tree Summary

```
src/lib/shared/push/
  config/
    vapid.ts                          # VAPID public key
  components/
    PushPermissionPrompt.svelte       # Contextual permission UI
  services/
    contracts/
      IFCMTokenManager.ts             # Interface
    implementations/
      FCMTokenManager.ts              # Token lifecycle management
      ForegroundMessageHandler.ts     # In-app message handling
  types/
    badge-api.d.ts                    # (if needed) Navigator badge types

firebase-functions/src/push/
  types.ts                            # Push payload types
  pushDispatcher.ts                   # Shared: token lookup, send, cleanup
  onNewMessage.ts                     # Firestore trigger: new message
  onNewNotification.ts                # Firestore trigger: new notification

static/
  firebase-messaging-handler.js       # SW push handler (imported by Workbox SW)

Modified:
  vite.config.ts                      # importScripts for FCM handler
  src/lib/shared/inbox/components/InboxSubscriptionProvider.svelte  # Badge + prompt + token lifecycle
  src/lib/shared/di/containers/push-container.ts                     # DI registration
  src/lib/shared/di/container-types.ts                               # Type registration
  src/lib/shared/di/index.ts                                         # Container wiring
  firebase-functions/src/index.ts                                    # Export new functions
  src/lib/features/feedback/domain/models/notification-models.ts     # pushEnabled preference
  src/lib/features/feedback/services/implementations/NotificationPreferencesManager.ts  # defaults
```

## Testing Notes

Per the "earned tests" philosophy, the Cloud Functions (Tasks 7-9) are the prime candidates for tests since they contain logic that could silently send wrong notifications to wrong people. Write tests for:

1. `shouldPushForType()` - preference checking logic
2. `onNewMessage` - correct recipient filtering (sender excluded)
3. `onNewNotification` - `message-received` type skip, preference respect

The client-side code is mostly wiring (visible when broken) and doesn't warrant tests.
