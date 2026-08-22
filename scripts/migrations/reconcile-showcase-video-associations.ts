/**
 * Reconcile landing-curator links with the canonical videos collection.
 *
 * Dry-run is the default. It prints a review manifest because `approved`,
 * landing exposure, and canonical visibility currently disagree. Apply mode
 * updates only existing canonical records whose showcase row is explicitly
 * approved and whose linked public sequence ids resolve exactly. It never
 * creates a public video from incomplete curator metadata.
 *
 *   TKA_ADMIN=1 npx tsx scripts/migrations/reconcile-showcase-video-associations.ts
 *   TKA_ADMIN=1 npx tsx scripts/migrations/reconcile-showcase-video-associations.ts --apply
 */
import { initFirestore } from "../lib/firestore-provider.js";

type AnyRecord = Record<string, unknown>;

export interface ReconciliationAssociation {
  subjectType: "sequence";
  subjectId: string;
  relationship: "performance";
  subjectLabel?: string;
}

export type ReconciliationStatus =
  | "ready-update"
  | "blocked-consent"
  | "blocked-excluded"
  | "blocked-no-subject"
  | "blocked-unresolved-subject"
  | "blocked-no-canonical-match"
  | "blocked-duplicate-canonical-match";

export interface ShowcaseReviewRow {
  shortcode: string;
  status: ReconciliationStatus;
  approved: boolean;
  featured: boolean;
  canonicalVideoIds: string[];
  linkedSequenceIds: string[];
  unresolvedSequenceIds: string[];
  performers: Array<{ id: string; displayName: string }>;
  proposedAssociations: ReconciliationAssociation[];
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function identityKeys(record: AnyRecord): string[] {
  return [record.videoUrl, record.storagePath]
    .map(nonEmptyString)
    .filter((value): value is string => value !== null);
}

function linkedSequences(
  record: AnyRecord
): Array<{ id: string; word?: string }> {
  const linked = Array.isArray(record.linkedSequences)
    ? record.linkedSequences.flatMap(
        (value): Array<{ id: string; word?: string }> => {
          if (!value || typeof value !== "object") return [];
          const item = value as AnyRecord;
          const id = nonEmptyString(item.id);
          if (!id) return [];
          const word = nonEmptyString(item.word);
          return [{ id, ...(word ? { word } : {}) }];
        }
      )
    : [];
  if (linked.length > 0) return linked;

  const legacyId = nonEmptyString(record.sequenceId);
  if (!legacyId) return [];
  const legacyWord = nonEmptyString(record.sequenceWord);
  return [{ id: legacyId, ...(legacyWord ? { word: legacyWord } : {}) }];
}

function performerCredits(
  record: AnyRecord
): Array<{ id: string; displayName: string }> {
  if (!Array.isArray(record.performers)) return [];
  return record.performers.flatMap(
    (value): Array<{ id: string; displayName: string }> => {
      if (!value || typeof value !== "object") return [];
      const item = value as AnyRecord;
      const id = nonEmptyString(item.id);
      const displayName = nonEmptyString(item.displayName);
      return id && displayName ? [{ id, displayName }] : [];
    }
  );
}

export function buildShowcaseReviewManifest(
  showcaseRows: Array<{ id: string; data: AnyRecord }>,
  canonicalRows: Array<{ id: string; data: AnyRecord }>,
  publicSequenceIds: ReadonlySet<string>
): ShowcaseReviewRow[] {
  const canonicalByIdentity = new Map<string, string[]>();
  for (const canonical of canonicalRows) {
    for (const key of identityKeys(canonical.data)) {
      const matches = canonicalByIdentity.get(key) ?? [];
      matches.push(canonical.id);
      canonicalByIdentity.set(key, matches);
    }
  }

  return showcaseRows.map(({ id, data }) => {
    const shortcode = nonEmptyString(data.shortcode) ?? id;
    const matches = new Set<string>();
    for (const key of identityKeys(data)) {
      for (const canonicalId of canonicalByIdentity.get(key) ?? []) {
        matches.add(canonicalId);
      }
    }
    const links = linkedSequences(data);
    const unresolvedSequenceIds = links
      .map((link) => link.id)
      .filter((sequenceId) => !publicSequenceIds.has(sequenceId));
    const proposedAssociations = links
      .filter((link) => publicSequenceIds.has(link.id))
      .map((link) => ({
        subjectType: "sequence" as const,
        subjectId: link.id,
        relationship: "performance" as const,
        ...(link.word ? { subjectLabel: link.word } : {}),
      }));

    let status: ReconciliationStatus;
    if (data.excluded === true) status = "blocked-excluded";
    else if (links.length === 0) status = "blocked-no-subject";
    else if (unresolvedSequenceIds.length > 0)
      status = "blocked-unresolved-subject";
    else if (data.approved !== true) status = "blocked-consent";
    else if (matches.size === 0) status = "blocked-no-canonical-match";
    else if (matches.size > 1) status = "blocked-duplicate-canonical-match";
    else status = "ready-update";

    return {
      shortcode,
      status,
      approved: data.approved === true,
      featured: data.featured === true,
      canonicalVideoIds: [...matches],
      linkedSequenceIds: links.map((link) => link.id),
      unresolvedSequenceIds,
      performers: performerCredits(data),
      proposedAssociations,
    };
  });
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  if (process.env.TKA_ADMIN !== "1") {
    throw new Error(
      `${apply ? "--apply" : "A complete dry-run"} requires TKA_ADMIN=1 because the census includes records outside the signed-in user's visibility.`
    );
  }

  const { db, sdk } = (await initFirestore()) as AnyRecord & {
    db: FirebaseFirestore.Firestore;
    sdk: string;
  };
  const [showcaseSnapshot, canonicalSnapshot, publicSequenceSnapshot] =
    await Promise.all([
      db.collection("showcaseVideos").get(),
      db.collection("videos").get(),
      db.collection("publicSequences").get(),
    ]);
  const manifest = buildShowcaseReviewManifest(
    showcaseSnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
    canonicalSnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
    new Set(publicSequenceSnapshot.docs.map((doc) => doc.id))
  );
  const summary = Object.fromEntries(
    [...new Set(manifest.map((row) => row.status))]
      .sort()
      .map((status) => [
        status,
        manifest.filter((row) => row.status === status).length,
      ])
  );

  console.log(
    JSON.stringify(
      {
        sdk,
        mode: apply ? "apply" : "dry-run",
        showcaseVideos: manifest.length,
        canonicalVideos: canonicalSnapshot.size,
        summary,
        review: manifest,
      },
      null,
      2
    )
  );

  if (!apply) return;

  const ready = manifest.filter((row) => row.status === "ready-update");
  for (let offset = 0; offset < ready.length; offset += 400) {
    const batch = db.batch();
    for (const row of ready.slice(offset, offset + 400)) {
      const canonicalId = row.canonicalVideoIds[0]!;
      batch.update(db.doc(`videos/${canonicalId}`), {
        associations: row.proposedAssociations,
        associationKeys: row.proposedAssociations.map(
          (association) => `sequence:${association.subjectId}`
        ),
        ...(row.performers.length > 0 ? { performers: row.performers } : {}),
        updatedAt: new Date(),
      });
    }
    await batch.commit();
  }
}

if (process.argv[1]?.endsWith("reconcile-showcase-video-associations.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
