import type { PageServerLoad } from "./$types";
import {
  parseSequenceRouteId,
  decodeSequenceWithCompression,
} from "$lib/shared/navigation/services/sequence-encoder";
import {
  buildSequenceSeo,
  cleanSequenceText,
  toPositiveInteger,
  toTrustedThumbnailUrl,
  type SequenceRouteMeta,
} from "./sequence-seo";

type FirestoreRecord = Record<string, unknown>;

interface ReleasedSequenceMatch {
  catalogId: string | null;
  deckName: string | null;
  deckNumber: number | null;
  stepCount: number | null;
}

function createUnverifiedMeta(url: URL): SequenceRouteMeta {
  return {
    word: cleanSequenceText(url.searchParams.get("word"), 120),
    creator: cleanSequenceText(url.searchParams.get("creator"), 120),
    difficulty: cleanSequenceText(url.searchParams.get("difficulty"), 40),
    stepCount: null,
    thumbnailUrl: null,
    source: "unknown",
    curated: false,
    catalogId: null,
    deckName: null,
    deckNumber: null,
  };
}

function firstTrustedThumbnail(record: {
  thumbnails?: unknown;
}): string | null {
  const thumbnails = Array.isArray(record.thumbnails) ? record.thumbnails : [];
  for (const thumbnail of thumbnails) {
    const trustedUrl = toTrustedThumbnailUrl(thumbnail);
    if (trustedUrl) return trustedUrl;
  }
  return null;
}

function readStepCount(
  record: FirestoreRecord,
  releasedStepCount: number | null
): number | null {
  const steps = Array.isArray(record.steps) ? record.steps.length : null;
  return (
    toPositiveInteger(steps) ??
    toPositiveInteger(record.sequenceLength) ??
    releasedStepCount
  );
}

function readDifficulty(record: FirestoreRecord): string | null {
  const level = toPositiveInteger(record.level);
  return (
    cleanSequenceText(record.difficultyLevel, 40) ??
    (level !== null ? String(level) : null)
  );
}

function buildResolvedMeta(
  record: FirestoreRecord,
  source: "catalog" | "public",
  release: ReleasedSequenceMatch | null
): SequenceRouteMeta {
  return {
    word:
      cleanSequenceText(record.word, 120) ??
      cleanSequenceText(record.name, 120),
    creator:
      cleanSequenceText(record.ownerDisplayName, 120) ??
      cleanSequenceText(record.author, 120),
    difficulty: readDifficulty(record),
    stepCount: readStepCount(record, release?.stepCount ?? null),
    thumbnailUrl: firstTrustedThumbnail(record),
    source,
    curated: release !== null,
    catalogId: source === "catalog" ? (release?.catalogId ?? null) : null,
    deckName: release?.deckName ?? null,
    deckNumber: release?.deckNumber ?? null,
  };
}

function getReleasedMatches(
  manifestDocs: readonly { data(): FirestoreRecord }[],
  sequenceId: string
): ReleasedSequenceMatch[] {
  const matches: ReleasedSequenceMatch[] = [];

  for (const manifestDoc of manifestDocs) {
    const manifest = manifestDoc.data();
    const cards = Array.isArray(manifest.sequences) ? manifest.sequences : [];

    for (const rawCard of cards) {
      if (!rawCard || typeof rawCard !== "object") continue;
      const card = rawCard as FirestoreRecord;
      if (card.sequenceId !== sequenceId) continue;

      matches.push({
        catalogId: cleanSequenceText(card.sourceCatalogId, 180),
        deckName: cleanSequenceText(manifest.name, 160),
        deckNumber: toPositiveInteger(manifest.deckNumber),
        stepCount: toPositiveInteger(card.stepCount),
      });
    }
  }

  return matches.sort(
    (left, right) =>
      (left.deckNumber ?? Number.MAX_SAFE_INTEGER) -
      (right.deckNumber ?? Number.MAX_SAFE_INTEGER)
  );
}

function isSafeFirestoreDocumentId(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 1_500 &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/")
  );
}

async function loadPublishedMeta(
  sequenceId: string,
  fallback: SequenceRouteMeta
): Promise<SequenceRouteMeta> {
  if (!isSafeFirestoreDocumentId(sequenceId)) return fallback;

  try {
    const { getAdminDb } = await import("$lib/server/firebaseAdmin");
    const db = getAdminDb();
    const [publicDoc, manifestSnapshot] = await Promise.all([
      db.collection("publicSequences").doc(sequenceId).get(),
      db.collection("deckReleases/counter/manifests").get(),
    ]);
    const releases = getReleasedMatches(manifestSnapshot.docs, sequenceId);

    for (const release of releases) {
      if (!release.catalogId || !isSafeFirestoreDocumentId(release.catalogId)) {
        continue;
      }

      const catalogDoc = await db
        .collection("catalogs")
        .doc(release.catalogId)
        .collection("sequences")
        .doc(sequenceId)
        .get();

      if (catalogDoc.exists) {
        return buildResolvedMeta(
          catalogDoc.data() as FirestoreRecord,
          "catalog",
          release
        );
      }
    }

    if (publicDoc.exists) {
      return buildResolvedMeta(
        publicDoc.data() as FirestoreRecord,
        "public",
        releases[0] ?? null
      );
    }

    if (releases[0]) {
      return {
        ...fallback,
        curated: true,
        deckName: releases[0].deckName,
        deckNumber: releases[0].deckNumber,
      };
    }
  } catch {
    // The viewer can still resolve inline, short-code, and signed-in library data.
  }

  return fallback;
}

export const load: PageServerLoad = async ({ params, url }) => {
  const fallback = createUnverifiedMeta(url);
  let meta = fallback;

  try {
    const parsed = parseSequenceRouteId(params.id);

    if (parsed.encoded) {
      try {
        const decoded = decodeSequenceWithCompression(parsed.encoded);
        meta = {
          ...fallback,
          word:
            cleanSequenceText(decoded.word, 120) ??
            cleanSequenceText(decoded.name, 120) ??
            fallback.word,
          creator:
            cleanSequenceText(decoded.ownerDisplayName, 120) ??
            fallback.creator,
          stepCount: Array.isArray(decoded.steps)
            ? toPositiveInteger(decoded.steps.length)
            : null,
          thumbnailUrl: firstTrustedThumbnail(decoded),
          source: "inline",
        };
      } catch {
        meta = { ...fallback, source: "inline" };
      }
    } else if (parsed.legacyId) {
      meta = await loadPublishedMeta(parsed.legacyId, fallback);
    }
  } catch {
    // A malformed route remains viewable as an error state and stays out of search.
  }

  return {
    meta,
    seo: buildSequenceSeo(params.id, meta),
  };
};
