/**
 * Daily sweep: permanently remove account-deletion tombstones past their
 * 12-month retention window (GDPR Art. 17(3) — minimal audit record, time-
 * boxed). v2 scheduled function: `firebase-functions/v2/scheduler`.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";

const BATCH_SIZE = 400;

export const purgeExpiredTombstones = onSchedule(
  { schedule: "every 24 hours", timeZone: "UTC" },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    let purged = 0;
    for (;;) {
      const snap = await db
        .collection("accountDeletions")
        .where("expireAt", "<=", now)
        .limit(BATCH_SIZE)
        .get();

      if (snap.empty) break;

      const batch = db.batch();
      for (const doc of snap.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
      purged += snap.size;

      if (snap.size < BATCH_SIZE) break;
    }

    functionsV1.logger.info("purgeExpiredTombstones swept accountDeletions", {
      purged,
    });
  }
);
