# Notification Delivery Preferences

**Status:** Approved for implementation in feedback `F4vf4hSnNHqJiqGzdIxf`

## Outcome

Notification settings show chats as a real preference, report whether push is
ready on the current device, and let each user opt into email for chats,
feedback outcomes, and product updates.

Email is off until the user enables it. Existing in-app notifications and push
preferences keep their current defaults.

The page uses the same workspace language as the account settings surface: one
opaque, bordered workspace over the animated app background; icon-led section
headers; descriptive toggle rows; and fixed responsive compositions instead of
an auto-filling card wall.

## Page composition

The settings tab has three levels of hierarchy:

1. A compact page header names the surface and explains the single job.
2. The workspace separates **Delivery** from **In-app alerts**. Delivery owns
   push readiness, email opt-in, and subordinate email topics. In-app alerts
   owns event preferences and its local bulk actions.
3. Alert topics are grouped by meaning. Messages, feedback, and community
   activity use a deliberately balanced two-column composition on wide
   screens. Admin alerts are a separate role-gated section and never appear to
   ordinary users.

At narrow widths, every region becomes one column without changing the
reading order. At wide widths, delivery and alerts sit side by side. The
workspace consumes `--shell-w`, uses container queries for internal
recomposition, and follows the settings font ramp at the 1680 and 2600 seams.

Bulk actions change event alerts only. Push and email remain explicit channel
decisions, so a convenience button cannot request browser permission or opt a
user into email.

## Existing owners

- `users/{uid}/settings/notificationPreferences` owns notification choices.
- `NotificationPreferencesPanel.svelte` owns the settings presentation.
- `FCMTokenManager` owns browser permission, token registration, and token
  removal for the current device.
- `onNewMessage` and `onNewNotification` own push delivery. Retryable email-only
  listeners observe the same source events without changing push behavior.
- The installed `firebase/firestore-send-email` extension owns SMTP delivery
  from the `mail` collection.
- `versions/{version}` owns published product-update data.

This work extends those owners. It does not add another push or SMTP transport.

## Preference contract

The existing event preferences continue to govern in-app and push delivery.
The settings panel adds a visible Messages group containing the existing
`messageReceived` preference.

Email uses a separate opt-in channel:

- `emailEnabled`: account-level email switch
- `emailMessages`: new chat messages
- `emailFeedback`: feedback progress, requests, responses, and outcomes
- `emailPlatformUpdates`: new version records published to the app

All four email fields default to `false`. Enabling email for the first time
selects the three categories so the master switch has an observable result.
Users can then turn individual categories off.

## Push readiness contract

`pushEnabled` remains the account preference. The panel also checks the current
device:

- unsupported browser or runtime
- browser permission blocked
- setup available but not completed
- registered and ready
- registration failed

The panel says push is active only after permission is granted and token
registration returns a token. If the account preference is already on but this
device is not registered, the action sets up this device instead of turning the
account preference off.

## Email delivery contract

Cloud Functions check the requested email category and the email master switch
immediately before queueing. The recipient must still have an enabled Firebase
Auth account with a verified email address.

Email bodies contain enough context to identify the event and a direct app
link. Chat email does not copy private message text into the email. Every email
links back to notification settings.

Queue document IDs are deterministic from the source event and recipient.
Firestore triggers are delivered at least once, so a repeated invocation writes
the same mail document instead of creating another email. The Firebase email
extension remains responsible for delivery state and retries.

## Product-update fanout

Creating a version document queues email only for users who explicitly enabled
`emailPlatformUpdates`. The pre-release sentinel version `0.0.0` is excluded.
Recipient lookup uses the notification preference documents rather than
scanning every account.

## Failure behavior

- Push registration failure leaves the device in a visible setup-failed state
  and does not claim that push is active.
- Missing or unverified email skips email delivery without exposing an address
  in logs.
- A mail queue write failure rejects its retryable email-only trigger so
  Firebase can surface and retry the failed invocation without repeating push.
- Push and email are independent. One channel failing does not block the other.

## Verification

- Unit tests cover email opt-in policy, notification-type routing, email content
  privacy, and deterministic queue IDs.
- Function tests cover chat and feedback queue decisions with injected
  Firestore/Auth dependencies.
- Frontend tests cover the push device-state decisions and the visible Messages
  preference group.
- Firebase Functions TypeScript build and a browser component suite provide
  integration proof. The project-wide check is recorded separately when
  unrelated dirty-worktree failures prevent a clean baseline.
- Browser verification covers the notification panel at 1920x1080, 2560x1440,
  3840x2160, 1440x900, 820x1180, 960x412, and 375x667.
