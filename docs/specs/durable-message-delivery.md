# Durable Message Delivery

## Product promise

Messaging must preserve unfinished work and make every send outcome legible.
Closing the inbox, changing conversations, reloading the page, or temporarily
losing the network must not silently discard a draft or leave the sender
guessing whether a message was delivered.

## Scope

- Keep one user-scoped draft per conversation.
- Persist text, reply context, and the currently selected image, sequence, or
  collection attachment.
- Move a submitted draft into a durable outbox in one IndexedDB transaction.
- Render the outbox item immediately in the thread.
- Expose `Sending`, `Waiting for connection`, `Failed`, and `Sent` states.
- Retry transient failures automatically and offer an explicit retry for
  failures that need user action.
- Use a stable client-generated message ID so a lost response or repeated retry
  cannot create another message or increment unread counts twice.
- Mark conversation rows that contain an unfinished draft.
- Delete this device's message drafts and outbox items when their owning user
  signs out.

Cross-device draft synchronization is intentionally outside this change. Drafts
and unsent attachment bytes stay on the device where they were composed; sent
messages remain server-backed as they are today.

## Capability ownership

Search terms used before implementation:

- `draft`, `autosave`, `unsent`, `restore`
- `outbox`, `queued send`, `pending send`, `retry`
- `IndexedDB`, `Dexie`, `persistent state`, `share intake`

Closest existing owners:

- `TKADatabase` owns durable browser data.
- `Messenger` owns ordinary message delivery and subscriptions.
- `MessageImageSender` plus `finalizeMessageImage` own private image delivery.
- Share intake already demonstrates that attachment bytes can survive cancel,
  reload, and authentication round trips in IndexedDB.

Relationship:

- **Extend** `TKADatabase` with message draft and outbox tables.
- **Extend** the server delivery boundary with an idempotent non-image callable.
- **Compose** the existing messenger, image sender, and short-code manager behind
  one `MessageDeliveryCoordinator`.
- **Create** drawer-scoped message delivery state because no reactive owner
  currently coordinates drafts, outbox transitions, retries, and reconciliation.

No second message renderer is introduced. The existing message bubble and
attachment cards receive local-delivery inputs for optimistic messages.

## Data model

### Message draft

Key: `[userId+conversationId]`

- text content
- canonical reply preview
- persisted attachment
- updated timestamp

Image drafts store a `Blob` plus filename, MIME type, last-modified timestamp,
message ID, and attachment ID. Reconstructing a `File` at the UI/service boundary
keeps the IndexedDB representation portable.

### Outbox item

Key: stable `messageId`

- owning user and conversation
- text, reply preview, and persisted attachment
- any prepared server attachment (for example a resolved sequence short code)
- created and updated timestamps
- status: `queued`, `sending`, `failed`, or `sent`
- attempt count, retry time, and user-safe failure text

`sending` is never trusted across a process restart. Startup normalizes it back
to `queued` and retries it.

## State transitions

```text
draft --Send/IndexedDB transaction--> queued --> sending --> sent
                                             |       |
                                      offline|       |terminal error
                                             v       v
                                           queued  failed
                                             ^       |
                                             +--Retry+
```

The composer clears only after the draft-to-outbox transaction succeeds. A sent
outbox row remains until the Firestore subscription observes the same message
ID, preventing a delivered message from briefly disappearing between the
callable response and the realtime snapshot.

## Server idempotency

The client supplies the message document ID. Delivery runs in a Firestore
transaction that reads the conversation, target message, and optional reply
target before writing anything.

- If the message does not exist, the transaction creates it and increments each
  recipient's unread count once.
- If the message exists with the same sender, delivery returns success without
  another write.
- If the ID belongs to another sender, delivery fails.

This matches the established `finalizeMessageImage` contract. Image retries
continue to use that function; non-image messages use the new equivalent
callable.

## Failure behavior

- Offline or transient Firebase errors remain queued and retry after reconnect
  or bounded backoff.
- Validation, authorization, missing-conversation, and missing-reply failures
  become `Failed` with Retry and Remove controls on the bubble.
- Expected offline behavior is inline, not a toast.
- IndexedDB failures are user-blocking because they invalidate the no-data-loss
  promise, so they use the application error handler and leave the composer
  intact.

## Privacy and cleanup

Every row is keyed and queried by user ID. State is emptied immediately when
the active user changes. Sign-out purges that user's draft and outbox rows before
Firebase authentication is cleared. Successful image sends continue to remove
their staging object; removing an unsent image drops its only outbox/draft Blob.

## Verification

- Unit tests for attachment round trips, user isolation, atomic promotion,
  restart normalization, retry state transitions, and reconciliation.
- Function tests proving a repeated message ID creates once and increments
  unread counts once.
- Component tests for draft restoration, autosave, and atomic composer handoff
  into the outbox; browser proof for draft indicators and optimistic delivery
  controls.
- Functions TypeScript build and the project-wide type/Svelte check.
- Runtime browser verification of draft restoration and the visual delivery
  states at 1920x1080, 2560x1440, 3840x2160, 1440x900, 820x1180, 960x412, and
  375x667.
