# Push Notifications + App Badge Design

**Date:** 2026-02-24
**Status:** Approved

## Goal

Enable push notifications so the PWA icon shows an unread badge count and users receive OS-level notifications for messages and user-selected notification types, even when the app is closed.

## Architecture: Firestore-Triggered Cloud Functions

When a document is created in a message or notification collection, a Cloud Function fires, looks up the recipient's FCM tokens and notification preferences, and sends a push via `firebase-admin.messaging()`. The service worker receives the push, shows a notification, and sets the app badge.

## Data Flow

```
User A sends message
  -> Firestore write: conversations/{id}/messages/{id}
  -> Cloud Function triggers (onDocumentCreated)
  -> Function reads recipient's:
     1. FCM tokens from users/{uid}/fcmTokens/{tokenId}
     2. Notification preferences from users/{uid}.notificationPreferences
  -> If push enabled for this type:
     -> firebase-admin.messaging().sendEachForMulticast(tokens, payload)
  -> Recipient's service worker receives push event
     -> Shows OS notification
     -> Calls navigator.setAppBadge(unreadCount)
```

## Components

### 1. FCM Token Manager (client-side service)

- On login + permission grant: call `getToken()` from `firebase/messaging`
- Store token in `users/{uid}/fcmTokens/{tokenHash}` with device metadata
- Handle token refresh
- On logout: delete the token document
- Multi-device: each device gets its own token document

### 2. Push Permission Prompt (client-side UI)

- One-time contextual prompt when first unread message arrives while in-app
- "Get notified when you receive messages, even when the app is closed?" [Enable / Not now]
- "Not now" = don't ask again for 30 days (stored in localStorage)
- Toggle in existing NotificationPreferencesManager for manual enable/disable later
- Respects `Notification.permission` state (don't prompt if already denied by browser)

### 3. Firebase Messaging Service Worker

- Handles background push events (separate from Workbox SW)
- On push event: show notification with title/body/icon + call `setAppBadge()`
- On notification click: focus or open the app at the relevant route

### 4. Cloud Function: onNewMessage

- `onDocumentCreated("conversations/{conversationId}/messages/{messageId}")`
- Reads message, finds all participants except sender
- For each recipient: check FCM tokens + preferences
- Send push with payload: `{ title, body, data: { type, conversationId, url } }`
- Clean up stale tokens on `messaging/registration-token-not-registered`

### 5. Cloud Function: onNewNotification

- `onDocumentCreated("users/{userId}/notifications/{notificationId}")`
- Reads notification type, checks user's `notificationPreferences`
- If enabled: sends push to user's FCM tokens
- Skips `message-received` type (handled by onNewMessage to avoid duplicates)

### 6. Badge Manager (client-side)

- `$effect` in InboxSubscriptionProvider reacts to `totalUnreadCount`
- Calls `navigator.setAppBadge(count)` on change
- Service worker also sets badge on push receive (app closed)
- `clearAppBadge()` when all read

## Firestore Schema Addition

```
users/{userId}/fcmTokens/{tokenHash}
  - token: string
  - createdAt: Timestamp
  - lastRefreshed: Timestamp
  - device: string
  - userAgent: string
```

No changes to existing collections.

## Push Policy

- **Messages**: Always push (direct and group)
- **Other notification types**: Push only if user has that type enabled in `notificationPreferences`
- Users control via existing notification preferences UI + new "Push notifications" master toggle

## Platform Support

| Platform | Push | Badge |
|----------|------|-------|
| Chrome desktop | Yes | Yes |
| Chrome Android | Yes | Yes |
| Edge | Yes | Yes |
| Safari macOS | Yes | Yes (VAPID key required) |
| Safari iOS 16.4+ | Yes | Yes (must be home screen installed) |
| Firefox | Yes | No badge (push works) |

## Decisions

- Messages always push, other types respect preferences
- Contextual permission prompt on first message + toggle in preferences
- Firestore-triggered Cloud Functions (not client-side topic subscriptions)
- Separate FCM SW coexists with Workbox SW
- VAPID key generated via Firebase Console (stored in env/config)
