/**
 * Read-only production census for the Browse restructuring program.
 *
 * The output contains aggregate counts only. It never prints user ids, names,
 * sequence words, collection ids, media URLs, or storage paths.
 *
 *   $env:TKA_ADMIN="1"
 *   pnpm exec tsx scripts/diagnostics/browse-program-census.ts
 *   pnpm exec tsx scripts/diagnostics/browse-program-census.ts --as-of=2026-08-22
 */

import { initFirestore } from "../lib/firestore-provider.js";

type AnyRecord = Record<string, unknown>;

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function timestampMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as AnyRecord;
  if (typeof record["toMillis"] === "function") {
    return (record["toMillis"] as () => number)();
  }
  const seconds = record["seconds"];
  return typeof seconds === "number" ? seconds * 1000 : null;
}

export function mediaTimestamp(record: AnyRecord): number | null {
  const candidates = [
    record["publishedAt"],
    record["createdAt"],
    record["uploadedAt"],
    record["importedAt"],
    record["dateAdded"],
    record["updatedAt"],
  ]
    .map(timestampMillis)
    .filter((value): value is number => value !== null);
  return candidates.length > 0 ? Math.max(...candidates) : null;
}

export function subjectLinkCount(record: AnyRecord): number {
  if (Array.isArray(record["associations"])) {
    return record["associations"].length;
  }
  if (Array.isArray(record["linkedSequences"])) {
    return record["linkedSequences"].length;
  }
  return nonEmptyString(record["sequenceId"]) ? 1 : 0;
}

function performerKeys(record: AnyRecord): string[] {
  if (!Array.isArray(record["performers"])) return [];
  return record["performers"].flatMap((value): string[] => {
    if (!value || typeof value !== "object") return [];
    const performer = value as AnyRecord;
    const id = nonEmptyString(performer["id"]);
    const name = nonEmptyString(performer["displayName"]);
    return id ? [`id:${id}`] : name ? [`name:${name.toLowerCase()}`] : [];
  });
}

function ownerFromUserSubcollection(doc: {
  ref: { parent: { parent?: { id: string; parent?: { id: string } } } };
}): string | null {
  const owner = doc.ref.parent.parent;
  return owner?.parent?.id === "users" ? owner.id : null;
}

function parseAsOf(): Date {
  const raw = process.argv.find((argument) => argument.startsWith("--as-of="));
  const value = raw?.slice("--as-of=".length);
  if (!value) return new Date();
  const parsed = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid --as-of date: ${value}`);
  }
  return parsed;
}

async function main(): Promise<void> {
  if (process.env.TKA_ADMIN !== "1") {
    throw new Error(
      "The complete aggregate census requires TKA_ADMIN=1. This script is read-only."
    );
  }

  const asOf = parseAsOf();
  const recentCutoff = asOf.getTime() - 90 * 24 * 60 * 60 * 1000;
  const { db, sdk } = (await initFirestore()) as AnyRecord & {
    db: FirebaseFirestore.Firestore;
    sdk: string;
  };

  const [
    publicSequences,
    allCollections,
    tunnels,
    mandalas,
    scenes,
    videos,
    showcaseVideos,
  ] = await Promise.all([
    db.collection("publicSequences").get(),
    db.collectionGroup("collections").get(),
    db.collectionGroup("tunnel-collection").get(),
    db.collectionGroup("mandala-collection").get(),
    db.collectionGroup("scene-3d-collection").get(),
    db.collection("videos").get(),
    db.collection("showcaseVideos").get(),
  ]);

  const publicCollectionDocs = allCollections.docs.filter((doc) => {
    const ownerId = ownerFromUserSubcollection(doc);
    const data = doc.data() as AnyRecord;
    return ownerId && data["isPublic"] === true && !data["systemType"];
  });
  const canonicalRows = videos.docs.map((doc) => doc.data() as AnyRecord);
  const showcaseRows = showcaseVideos.docs.map(
    (doc) => doc.data() as AnyRecord
  );

  const canonicalCreatorIds = new Set(
    canonicalRows
      .map((row) => nonEmptyString(row["creatorId"]))
      .filter((value): value is string => value !== null)
  );
  const showcasePerformers = new Set(showcaseRows.flatMap(performerKeys));

  const report = {
    schemaVersion: 1,
    sdk,
    mode: "read-only",
    asOf: asOf.toISOString(),
    recentWindowDays: 90,
    publicDiscovery: {
      sequences: publicSequences.size,
      sequenceCreators: new Set(
        publicSequences.docs
          .map((doc) => nonEmptyString(doc.data()["ownerId"]))
          .filter((value): value is string => value !== null)
      ).size,
      collections: publicCollectionDocs.length,
      collectionCreators: new Set(
        publicCollectionDocs
          .map(ownerFromUserSubcollection)
          .filter((value): value is string => value !== null)
      ).size,
    },
    privateVisualArtifacts: {
      tunnels: tunnels.size,
      tunnelOwners: new Set(
        tunnels.docs
          .map(ownerFromUserSubcollection)
          .filter((value): value is string => value !== null)
      ).size,
      mandalas: mandalas.size,
      mandalaOwners: new Set(
        mandalas.docs
          .map(ownerFromUserSubcollection)
          .filter((value): value is string => value !== null)
      ).size,
      scenes: scenes.size,
      sceneOwners: new Set(
        scenes.docs
          .map(ownerFromUserSubcollection)
          .filter((value): value is string => value !== null)
      ).size,
    },
    canonicalMedia: {
      records: canonicalRows.length,
      publicRecords: canonicalRows.filter(
        (row) => row["visibility"] === "public"
      ).length,
      recordsWithSubjects: canonicalRows.filter(
        (row) => subjectLinkCount(row) > 0
      ).length,
      subjectLinks: canonicalRows.reduce(
        (sum, row) => sum + subjectLinkCount(row),
        0
      ),
      creators: canonicalCreatorIds.size,
      recordsWithRecognizedTimestamp: canonicalRows.filter(
        (row) => mediaTimestamp(row) !== null
      ).length,
      recentRecords: canonicalRows.filter((row) => {
        const timestamp = mediaTimestamp(row);
        return timestamp !== null && timestamp >= recentCutoff;
      }).length,
    },
    showcaseMedia: {
      records: showcaseRows.length,
      approvedRecords: showcaseRows.filter((row) => row["approved"] === true)
        .length,
      featuredRecords: showcaseRows.filter((row) => row["featured"] === true)
        .length,
      recordsWithSubjects: showcaseRows.filter(
        (row) => subjectLinkCount(row) > 0
      ).length,
      subjectLinks: showcaseRows.reduce(
        (sum, row) => sum + subjectLinkCount(row),
        0
      ),
      performerIdentities: showcasePerformers.size,
      recordsWithRecognizedTimestamp: showcaseRows.filter(
        (row) => mediaTimestamp(row) !== null
      ).length,
      recentRecords: showcaseRows.filter((row) => {
        const timestamp = mediaTimestamp(row);
        return timestamp !== null && timestamp >= recentCutoff;
      }).length,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1]?.endsWith("browse-program-census.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
