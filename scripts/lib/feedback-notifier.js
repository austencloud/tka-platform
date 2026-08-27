/**
 * Feedback Notification Module
 *
 * Sends notifications when non-admin developers perform actions on feedback items.
 * Two channels:
 *   1. In-app messages (Firestore conversations collection)
 *   2. Email (Firestore mail collection, picked up by Firebase Trigger Email extension)
 *
 * Usage:
 *   import notifier from "./lib/feedback-notifier.js";
 *   await notifier.notifyAdmin(db, FieldValue, { event, actor, feedbackItem, details });
 */

import { ADMIN_USER_ID, ADMIN_USER, NOTIFICATION_EVENTS } from "../../config/feedback.config.js";

// Event Labels

const EVENT_LABELS = {
  claim: "claimed",
  "in-review": "submitted for review",
  "create-feedback": "created",
  note: "added a note to",
};

// Conversation ID

const SYSTEM_CONVERSATION_ID = `feedback-notifications-${ADMIN_USER_ID}`;

// ---------------------------------------------------------------------------
// In-App Message
// ---------------------------------------------------------------------------

/**
 * Write an in-app message to the admin's system conversation.
 *
 * Creates the conversation document if it doesn't exist (idempotent via set+merge),
 * then appends a message to the subcollection.
 */
async function sendInAppMessage(db, FieldValue, { event, actor, feedbackItem, details }) {
  const label = EVENT_LABELS[event] || event;
  const text = `${actor.displayName} ${label} "${feedbackItem.title}"`;

  const conversationRef = db.collection("conversations").doc(SYSTEM_CONVERSATION_ID);

  // Ensure the conversation document exists (merge so we don't overwrite messages)
  await conversationRef.set(
    {
      participants: [ADMIN_USER_ID],
      type: "system",
      label: "Feedback Activity",
      createdAt: FieldValue.serverTimestamp(),
      lastMessageAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Append the message
  await conversationRef.collection("messages").add({
    text,
    senderId: "system",
    senderName: "Feedback System",
    timestamp: FieldValue.serverTimestamp(),
    metadata: {
      type: "feedback-activity",
      event,
      feedbackId: feedbackItem.id,
      actorId: actor.uid,
      actorName: actor.displayName,
      details: details || null,
    },
  });
}

// ---------------------------------------------------------------------------
// Email Notification
// ---------------------------------------------------------------------------

/**
 * Write a document to the `mail` collection for Firebase Trigger Email to pick up.
 */
async function sendEmailNotification(db, { event, actor, feedbackItem, details }) {
  const label = EVENT_LABELS[event] || event;
  const subject = `[TKA] ${actor.displayName} ${label} "${feedbackItem.title}"`;

  const lines = [
    `${actor.displayName} (${actor.email}) ${label} a feedback item.`,
    "",
    `Title: ${feedbackItem.title}`,
    `ID: ${feedbackItem.id}`,
    `Status: ${feedbackItem.status}`,
  ];

  if (details) {
    lines.push(`Details: ${details}`);
  }

  lines.push(
    "",
    `View in app: https://the-kinetic-alphabet.web.app/feedback/${feedbackItem.id}`
  );

  await db.collection("mail").add({
    to: [ADMIN_USER.email],
    message: {
      subject,
      text: lines.join("\n"),
    },
  });
}

// Public API

/**
 * Notify the admin about a feedback event.
 *
 * Skips silently when the actor IS the admin (no self-notifications).
 * Reads channel config from NOTIFICATION_EVENTS in feedback.config.js.
 *
 * @param {FirebaseFirestore.Firestore} db  Firestore instance
 * @param {any} FieldValue  Firestore FieldValue (admin or client SDK)
 * @param {Object} opts
 * @param {"claim"|"in-review"|"create-feedback"|"note"} opts.event
 * @param {{ uid: string, displayName: string, email: string }} opts.actor
 * @param {{ id: string, title: string, status: string }} opts.feedbackItem
 * @param {string} [opts.details]  Optional extra context
 */
async function notifyAdmin(db, FieldValue, { event, actor, feedbackItem, details }) {
  // Don't notify admin about their own actions
  if (actor.uid === ADMIN_USER_ID) return;

  const eventConfig = NOTIFICATION_EVENTS[event];
  if (!eventConfig) return;

  const payload = { event, actor, feedbackItem, details };

  const promises = [];

  if (eventConfig.message) {
    promises.push(sendInAppMessage(db, FieldValue, payload));
  }

  if (eventConfig.email) {
    promises.push(sendEmailNotification(db, payload));
  }

  if (promises.length > 0) {
    await Promise.all(promises);
  }
}

export default { notifyAdmin };
