/**
 * Backfill public-only performance metadata onto publicSequences.
 *
 * Reads only videos whose visibility is exactly "public". Restricted video
 * existence is never copied into a public document or printed. Dry-run is the
 * default; applying corpus-wide writes requires the Admin SDK opt-in.
 *
 *   npx tsx scripts/migrations/backfill-public-performance-metadata.ts
 *   TKA_ADMIN=1 npx tsx scripts/migrations/backfill-public-performance-metadata.ts --apply
 */
import { initFirestore } from "../lib/firestore-provider.js";

type AnyRecord = Record<string, unknown>;

interface DocumentSnapshot {
  readonly id: string;
  readonly ref: unknown;
  data(): AnyRecord;
}

interface PerformanceSummary {
  count: number;
  latestCreatedAt?: unknown;
  latestMillis: number;
}

const APPLY = process.argv.includes("--apply");

if (APPLY && process.env.TKA_ADMIN !== "1") {
  console.error("--apply requires TKA_ADMIN=1.");
  process.exit(1);
}

function timestampMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object" && "toMillis" in value) {
    return (value as { toMillis(): number }).toMillis();
  }
  return Number.NEGATIVE_INFINITY;
}

function sameTimestamp(left: unknown, right: unknown): boolean {
  if (left == null || right == null) return left == null && right == null;
  return timestampMillis(left) === timestampMillis(right);
}

async function main(): Promise<void> {
  const { db, FieldValue, sdk } = (await initFirestore()) as AnyRecord & {
    db: AnyRecord;
    FieldValue: { delete(): unknown };
    sdk: string;
  };
  console.log(`Firestore via ${sdk} — ${APPLY ? "APPLY" : "DRY-RUN"}`);

  const publicVideosQuery = (db.collection as (path: string) => AnyRecord)(
    "videos"
  )["where"]("visibility", "==", "public") as AnyRecord;
  const videoSnapshot = (await publicVideosQuery["get"]()) as {
    docs: DocumentSnapshot[];
  };
  const bySequence = new Map<string, PerformanceSummary>();

  for (const video of videoSnapshot.docs) {
    const data = video.data();
    const sequenceId = data["sequenceId"];
    if (typeof sequenceId !== "string" || sequenceId.length === 0) continue;
    const summary = bySequence.get(sequenceId) ?? {
      count: 0,
      latestMillis: Number.NEGATIVE_INFINITY,
    };
    summary.count += 1;
    const createdMillis = timestampMillis(data["createdAt"]);
    if (createdMillis > summary.latestMillis) {
      summary.latestMillis = createdMillis;
      summary.latestCreatedAt = data["createdAt"];
    }
    bySequence.set(sequenceId, summary);
  }

  const publicSnapshot = (await (db.collection as (path: string) => AnyRecord)(
    "publicSequences"
  )["get"]()) as { docs: DocumentSnapshot[] };
  const changes: Array<{ ref: unknown; patch: AnyRecord }> = [];

  for (const sequence of publicSnapshot.docs) {
    const data = sequence.data();
    const summary = bySequence.get(sequence.id);
    const count = summary?.count ?? 0;
    const latestCreatedAt = summary?.latestCreatedAt;
    if (
      data["publicPerformanceCount"] === count &&
      sameTimestamp(data["latestPublicPerformanceAt"], latestCreatedAt)
    ) {
      continue;
    }

    changes.push({
      ref: sequence.ref,
      patch: {
        publicPerformanceCount: count,
        latestPublicPerformanceAt: latestCreatedAt ?? FieldValue.delete(),
      },
    });
  }

  console.log(
    `public videos=${videoSnapshot.docs.length} public sequences=${publicSnapshot.docs.length} ${APPLY ? "writes" : "would-write"}=${changes.length}`
  );

  if (APPLY) {
    for (let offset = 0; offset < changes.length; offset += 400) {
      const batch = (db["batch"] as () => AnyRecord)();
      for (const change of changes.slice(offset, offset + 400)) {
        batch["update"](change.ref, change.patch);
      }
      await batch["commit"]();
    }
  } else {
    console.log(
      "No writes made. Re-run with TKA_ADMIN=1 and --apply to apply."
    );
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
