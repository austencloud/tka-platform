/**
 * Pulse triggers — ambient user-activity alerts for admins.
 *
 * Four server-side detection points, all funneling through notifyAdmins()
 * → notification doc → existing onNewNotification → FCM push.
 *
 * Design notes (spec: docs/superpowers/specs/2026-07-09-pulse-activity-system-design.md):
 * - Returning-user detection rides `lastActivityDate` on the user doc (written
 *   exactly once per auth refresh by createOrUpdateUserDocument) instead of an
 *   RTDB presence trigger, which would fire on every interaction and bill
 *   thousands of no-op invocations.
 * - Admin-caused events never notify (no self-noise while Austen tests).
 * - Guests don't trigger "returning" pings; their upgrade to a full account is
 *   the signal that matters.
 */

import {
  onDocumentCreated,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { notifyAdmins, isAdminData } from "./notifyAdmins";

const db = admin.firestore();

/** Minimum gap between "user is back" pings for the same user. */
const RETURN_THROTTLE_MS = 6 * 60 * 60 * 1000;

/** Firestore Timestamp | ISO string | undefined → epoch millis. */
function toMillis(v: unknown): number | null {
  if (!v) return null;
  const maybeTs = v as { toMillis?: () => number };
  if (typeof maybeTs.toMillis === "function") return maybeTs.toMillis();
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

function displayNameOf(
  d: FirebaseFirestore.DocumentData | undefined | null
): string {
  if (!d) return "Someone";
  return (
    (d.displayName as string) ||
    (d.username as string) ||
    (d.isAnonymous === true ? "A guest" : "Someone")
  );
}

async function lookupEmail(userId: string): Promise<string | null> {
  try {
    const user = await admin.auth().getUser(userId);
    return user.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Signups, guest→full upgrades, and returning users — one trigger, three
 * signals, all derived from writes createOrUpdateUserDocument already makes.
 */
export const pulseUserActivity = onDocumentWritten(
  "users/{userId}",
  async (event) => {
    const { userId } = event.params;
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    if (!after) return; // deletion — not a Pulse event

    const name = displayNameOf(after);

    // (a) New full-account doc = signup.
    if (!before) {
      if (after.isAnonymous === true) return; // guest provisioning ≠ signup
      const email = await lookupEmail(userId);
      await notifyAdmins({
        type: "admin-new-user-signup",
        message: email
          ? `New user signed up: ${name} (${email})`
          : `New user signed up: ${name}`,
        fromUserId: userId,
        fromUserName: name,
        data: {
          newUserId: userId,
          newUserEmail: email,
          newUserDisplayName: name,
        },
      });
      return;
    }

    // (b) Guest → full account upgrade.
    if (before.isAnonymous === true && after.isAnonymous === false) {
      const email = await lookupEmail(userId);
      await notifyAdmins({
        type: "admin-new-user-signup",
        message: email
          ? `Guest upgraded to a full account: ${name} (${email})`
          : `Guest upgraded to a full account: ${name}`,
        fromUserId: userId,
        fromUserName: name,
        data: {
          newUserId: userId,
          newUserEmail: email,
          newUserDisplayName: name,
        },
      });
      return;
    }

    // (c) Returning user — lastActivityDate advanced (one write per session).
    if (after.isAnonymous === true) return;
    if (isAdminData(after)) return;
    const beforeTs = toMillis(before.lastActivityDate);
    const afterTs = toMillis(after.lastActivityDate);
    if (!afterTs || afterTs === beforeTs) return; // not a session-start write

    // Fresh accounts already pinged via (a)/(b).
    const createdTs = toMillis(after.createdAt);
    if (createdTs && afterTs - createdTs < RETURN_THROTTLE_MS) return;

    // Per-user throttle. State is set BEFORE notifying so a racing second
    // write sees the fresh timestamp; a rare duplicate ping is harmless.
    const stateRef = db.collection("pulseState").doc(userId);
    const state = await stateRef.get();
    const lastNotified = toMillis(state.data()?.lastReturnNotifiedAt);
    if (lastNotified && Date.now() - lastNotified < RETURN_THROTTLE_MS) return;
    await stateRef.set(
      { lastReturnNotifiedAt: admin.firestore.Timestamp.now() },
      { merge: true }
    );

    await notifyAdmins({
      type: "admin-user-returned",
      message: `${name} is back in the app`,
      fromUserId: userId,
      fromUserName: name,
      data: { returnedUserId: userId },
    });
  }
);

/**
 * QR scans — fires for fully anonymous scanners too (the client on the bare
 * /q route has no auth and could never have written an admin notification).
 */
export const pulseScanActivity = onDocumentCreated(
  "shortcodes/{code}/scanEvents/{eventId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const scan = snap.data();
    const { code } = event.params;

    // A signed-in admin scanning their own cards is not news.
    if (scan.userId) {
      const scanner = await db
        .collection("users")
        .doc(scan.userId as string)
        .get();
      if (isAdminData(scanner.data())) return;
    }

    const parent = await db.collection("shortcodes").doc(code).get();
    const p = parent.data() ?? {};
    const label =
      (p.sequenceName as string) || (p.word as string) || code;

    const where = [scan.city, scan.country]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .join(", ");

    await notifyAdmins({
      type: "admin-qr-scan",
      message: where
        ? `QR scan: "${label}" scanned in ${where}`
        : `QR scan: "${label}" scanned`,
      fromUserId: (scan.userId as string | null) ?? null,
      data: {
        shortCode: code,
        scanCity: (scan.city as string | null) ?? null,
        scanCountry: (scan.country as string | null) ?? null,
      },
    });
  }
);

/** A user saved a sequence to their library. */
export const pulseSequenceCreated = onDocumentCreated(
  "users/{userId}/sequences/{sequenceId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const { userId, sequenceId } = event.params;
    const seq = snap.data();

    const owner = await db.collection("users").doc(userId).get();
    const o = owner.data();
    if (isAdminData(o)) return;

    const name = displayNameOf(o);
    const word =
      (seq.word as string) ||
      (seq.name as string) ||
      (seq.title as string) ||
      "a sequence";

    await notifyAdmins({
      type: "admin-content-created",
      message: `${name} saved "${word}"`,
      fromUserId: userId,
      fromUserName: name,
      data: { contentType: "sequence", sequenceId, word },
    });
  }
);

/** A user created a collection (system_favorites provisioning excluded). */
export const pulseCollectionCreated = onDocumentCreated(
  "users/{userId}/collections/{collectionId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const { userId, collectionId } = event.params;
    if (collectionId === "system_favorites") return;
    const col = snap.data();

    const owner = await db.collection("users").doc(userId).get();
    const o = owner.data();
    if (isAdminData(o)) return;

    const name = displayNameOf(o);
    const colName =
      (col.name as string) || (col.title as string) || "a collection";
    const kind = col.kind === "smart" ? "smart collection" : "collection";

    await notifyAdmins({
      type: "admin-content-created",
      message: `${name} created ${kind} "${colName}"`,
      fromUserId: userId,
      fromUserName: name,
      data: { contentType: "collection", collectionId, collectionName: colName },
    });
  }
);
