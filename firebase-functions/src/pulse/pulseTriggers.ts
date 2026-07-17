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
import {
  notifyAdmins,
  notifyAdminsScanDigest,
  isAdminData,
} from "./notifyAdmins";
import { simplifyRepeatedWord } from "./wordSimplifier";

const db = admin.firestore();

/** Coalescing window for QR-scan digests. */
const SCAN_DIGEST_WINDOW_MINUTES = 10;
const SCAN_DIGEST_WINDOW_MS = SCAN_DIGEST_WINDOW_MINUTES * 60 * 1000;

/** unknown → finite number | null (scan lat/lng arrive as number | string | null). */
function toFinite(v: unknown): number | null {
  const n = typeof v === "string" ? Number.parseFloat(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : null;
}

/** Non-empty string | null. */
function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

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

    // Resolve the scanner's identity: an admin scanning their own cards is not
    // news (volume = "all except your own"), and a signed-in non-admin gets
    // named attribution in the message.
    let scannerName: string | null = null;
    if (scan.userId) {
      const scanner = await db
        .collection("users")
        .doc(scan.userId as string)
        .get();
      const sd = scanner.data();
      if (isAdminData(sd)) return; // own-scan — suppressed
      scannerName =
        (sd?.displayName as string) ||
        (sd?.username as string) ||
        (sd?.isAnonymous === true ? "A guest" : null);
    }

    const parent = await db.collection("shortcodes").doc(code).get();
    const p = parent.data() ?? {};
    const rawLabel = (p.sequenceName as string) || (p.word as string) || code;
    // LOOP words repeat by construction — always show the smallest form.
    const label = simplifyRepeatedWord(rawLabel);

    await notifyAdminsScanDigest({
      code,
      label,
      scannerName,
      fromUserId: (scan.userId as string | null) ?? null,
      city: strOrNull(scan.city),
      country: strOrNull(scan.country),
      lat: toFinite(scan.lat),
      lng: toFinite(scan.lng),
      windowMs: SCAN_DIGEST_WINDOW_MS,
      windowMinutes: SCAN_DIGEST_WINDOW_MINUTES,
      now: Date.now(),
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

/** A visitor submitted a tool for the /roots/software lineage list. */
export const pulseSoftwareSubmission = onDocumentCreated(
  "software_submissions/{submissionId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const sub = snap.data();
    const name = (sub.name as string) || "an unnamed tool";
    const url = (sub.url as string) || "";

    await notifyAdmins({
      type: "admin-software-submission",
      message: `Software list submission: "${name}"${url ? ` (${url})` : ""}`,
      data: {
        submissionId: event.params.submissionId,
        toolName: name,
        toolUrl: url,
      },
    });
  }
);
