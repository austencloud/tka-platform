/**
 * Daily sweep keeping Instagram publishing tokens alive.
 *
 * An Instagram long-lived token lasts 60 days and can be traded for another 60
 * once it is at least 24 hours old. Nobody notices that clock until a post
 * fails, so this refreshes inside a 7-day window — a week of daily retries
 * before a connection would actually lapse.
 *
 * Facebook Page tokens are deliberately NOT refreshed here. A Page token
 * derived from a long-lived user token does not expire on its own; when the
 * user token behind it does lapse, the fix is a re-consent, which only the
 * person can give.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as functions from "firebase-functions";
import { refreshInstagramLongLivedToken } from "./metaGraphClient";
import {
  listInstagramConnections,
  updateInstagramToken,
} from "./metaConnectionStore";
import { shouldRefreshToken } from "./metaPublishPolicy";

export const refreshMetaPublishTokens = onSchedule(
  { schedule: "every 24 hours", timeZone: "UTC", secrets: [] },
  async () => {
    const connections = await listInstagramConnections();
    const now = Date.now();

    let refreshed = 0;
    let failed = 0;

    for (const { uid, instagram } of connections) {
      const due = shouldRefreshToken(
        {
          issuedAtMs: instagram.issuedAt.toMillis(),
          expiresAtMs: instagram.expiresAt.toMillis(),
        },
        now
      );
      if (!due) continue;

      try {
        const token = await refreshInstagramLongLivedToken(
          instagram.accessToken
        );
        const issuedAtMs = Date.now();
        await updateInstagramToken(uid, {
          accessToken: token.accessToken,
          issuedAtMs,
          expiresAtMs: issuedAtMs + token.expiresIn * 1000,
        });
        refreshed++;
      } catch (error) {
        // A single dead token must not stop the sweep — the next person in the
        // list has a working one that still needs extending.
        failed++;
        functions.logger.warn("Could not refresh an Instagram publish token", {
          uid,
          error: error instanceof Error ? error.name : "unknown",
        });
      }
    }

    functions.logger.info("Meta publish token sweep finished", {
      considered: connections.length,
      refreshed,
      failed,
    });
  }
);
