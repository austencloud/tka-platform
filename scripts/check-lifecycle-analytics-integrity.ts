/**
 * Daily lower-bound integrity check for durable save telemetry.
 *
 * Every cloud document created in the UTC window must have at least one
 * corresponding PostHog lifecycle event. Sequence updates collapse to one
 * document, so PostHog may legitimately be higher; PostHog being lower is a
 * definite delivery gap. Tunnel saves create one document per action and are
 * therefore an exact comparison.
 */

import { appendFile, readFile } from "node:fs/promises";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { runHogQl } from "./lib/posthog-hogql.js";

try {
  process.loadEnvFile();
} catch {
  // CI supplies environment variables directly.
}

function previousUtcDay(): { start: Date; end: Date; label: string } {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1_000);
  return { start, end, label: start.toISOString().slice(0, 10) };
}

async function initializeFirestore() {
  const path =
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    "serviceAccountKey.json";
  const serviceAccount = JSON.parse(await readFile(path, "utf8"));
  return getFirestore(initializeApp({ credential: cert(serviceAccount) }));
}

function countByEvent(rows: unknown[][]): Map<string, number> {
  return new Map(
    rows.map((row) => [String(row[0]), Number(row[1] ?? 0)] as const)
  );
}

async function countUserSubcollectionDocuments(options: {
  firestore: ReturnType<typeof getFirestore>;
  collection: "sequences" | "tunnel-collection";
  field: "createdAt";
  start: Timestamp | number;
  end: Timestamp | number;
}): Promise<number> {
  const users = await options.firestore.collection("users").listDocuments();
  let nextIndex = 0;
  let total = 0;

  // Per-user collection queries use Firestore's automatic single-field
  // indexes. A collection-group range would require a production index solely
  // for this audit and makes a missing index indistinguishable from a telemetry
  // outage. Ten workers keep the daily scan bounded without serial round trips.
  const workers = Array.from(
    { length: Math.min(10, users.length) },
    async () => {
      while (nextIndex < users.length) {
        const user = users[nextIndex++];
        if (!user) continue;
        const snapshot = await user
          .collection(options.collection)
          .where(options.field, ">=", options.start)
          .where(options.field, "<", options.end)
          .get();
        total += snapshot.size;
      }
    }
  );
  await Promise.all(workers);
  return total;
}

async function run(): Promise<void> {
  const { start, end, label } = previousUtcDay();
  const firestore = await initializeFirestore();
  const [userSequenceDocs, userTunnelDocs, eventRows] = await Promise.all([
    countUserSubcollectionDocuments({
      firestore,
      collection: "sequences",
      field: "createdAt",
      start: Timestamp.fromDate(start),
      end: Timestamp.fromDate(end),
    }),
    countUserSubcollectionDocuments({
      firestore,
      collection: "tunnel-collection",
      field: "createdAt",
      start: start.getTime(),
      end: end.getTime(),
    }),
    runHogQl(`
      SELECT event, count()
      FROM events
      WHERE timestamp >= toDateTime('${start.toISOString()}')
        AND timestamp < toDateTime('${end.toISOString()}')
        AND properties.durability = 'cloud'
        AND event IN ('sequence_save', 'tunnel_save')
      GROUP BY event
    `),
  ]);

  const events = countByEvent(eventRows);
  const sequenceEvents = events.get("sequence_save") ?? 0;
  const tunnelEvents = events.get("tunnel_save") ?? 0;
  const failures = [
    ...(sequenceEvents < userSequenceDocs
      ? [
          `sequence_save: ${sequenceEvents} events for ${userSequenceDocs} created documents`,
        ]
      : []),
    ...(tunnelEvents !== userTunnelDocs
      ? [
          `tunnel_save: ${tunnelEvents} events for ${userTunnelDocs} created documents`,
        ]
      : []),
  ];

  const lines = [
    "## Lifecycle analytics integrity",
    "",
    `- UTC day: ${label}`,
    `- Sequence lifecycle events: ${sequenceEvents}`,
    `- User sequence documents created: ${userSequenceDocs}`,
    `- Tunnel lifecycle events: ${tunnelEvents}`,
    `- Tunnel documents created: ${userTunnelDocs}`,
    `- Result: ${failures.length === 0 ? "pass" : "fail"}`,
    ...(failures.length
      ? ["", ...failures.map((failure) => `- ${failure}`)]
      : []),
    "",
  ];
  const summary = lines.join("\n");
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
  }
  if (failures.length > 0) process.exitCode = 1;
}

run().catch((error: unknown) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error
  );
  process.exitCode = 1;
});
