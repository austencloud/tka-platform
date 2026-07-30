import type { PageServerLoad } from "./$types";
import { env } from "$env/dynamic/public";
import { parseCloudflareGeo } from "$lib/shared/presence/domain/models/presence-models";
import {
  fromFirestoreFields,
  type FirestoreFields,
} from "$lib/server/firestore/firestore-value-codec";
import type { ShortCodeData } from "$lib/shared/qr/services/types";
import {
  isInlineEncoded,
  parsePropsFromURL,
} from "$lib/shared/navigation/services/sequence-encoder";
import {
  prepareScanPayload,
  type PreparedScanPayload,
} from "$lib/server/scan/scan-card-preparer";

// Why REST instead of firebase-admin: the admin SDK never worked here. Its
// credential/gRPC path doesn't run on Cloudflare's workerd runtime, so the
// lookup threw on every production request and an empty catch swallowed it —
// every scan ever recorded shipped meta:{word:null,...} while geo was fine.
// The REST API is plain fetch (native on workerd) and needs no credentials:
// shortcodes are world-readable by rule (firestore.rules `match
// /shortcodes/{code}` -> `allow read: if true`).
const FIRESTORE_HOST = "https://firestore.googleapis.com/v1";

// The project id lives in the public env; the value below is the same one the
// client Firebase config uses (src/lib/shared/auth/firebase.ts) and only
// applies when the deploy environment doesn't define the var.
const PROJECT_ID = env.PUBLIC_FIREBASE_PROJECT_ID || "the-kinetic-alphabet";

// SSR renders with or without meta — it must never hang on a slow lookup.
const LOOKUP_TIMEOUT_MS = 2500;

// Complete resolver/attribution shape, excluding write-only counters such as
// dailyScans and lastScannedAt. `encoded` plus `sequenceData` are both retained:
// legacy blobs need the embedded data to restore fields their wire format did
// not preserve.
const RECORD_FIELD_PATHS = [
  "sequence",
  "sequenceId",
  "ownerId",
  "encoderHash",
  "createdAt",
  "createdBy",
  "scanCount",
  "sequenceName",
  "payloadWord",
  "payloadStepCount",
  "payloadSchemaVersion",
  "payloadKind",
  "payloadTitle",
  "payloadContentHash",
  "authoredHand",
  "sourceSoloPropId",
  "soloData",
  "sourceSequenceId",
  "sourceProjectionRevision",
  "sequenceData",
  "encoded",
  "deckId",
  "deckName",
  "bluePropType",
  "redPropType",
  "catDogMode",
  "thumbnailUrl",
  "ownerDisplayName",
] as const;

interface ShortCodeMeta {
  word: string | null;
  payloadKind: "word" | "solo";
  authoredHand: "left" | "right" | null;
  creator: string | null;
  thumbnailUrl: string | null;
  deckId: string | null;
  deckName: string | null;
  bluePropType: string | null;
  redPropType: string | null;
}

const EMPTY_META: ShortCodeMeta = {
  word: null,
  payloadKind: "word",
  authoredHand: null,
  creator: null,
  thumbnailUrl: null,
  deckId: null,
  deckName: null,
  bluePropType: null,
  redPropType: null,
};

function readString(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function deriveMeta(record: ShortCodeData | null): ShortCodeMeta {
  if (!record) return EMPTY_META;
  const values = record as unknown as Record<string, unknown>;
  const payloadKind =
    readString(values, "payloadKind") === "solo" ? "solo" : "word";
  const authoredHandValue = readString(values, "authoredHand");
  const authoredHand =
    authoredHandValue === "left" || authoredHandValue === "right"
      ? authoredHandValue
      : null;

  return {
    // Schema-3 solos carry a human title, never a fabricated TKA word.
    // Schema-2 words and legacy records retain the historical fallbacks.
    word:
      (payloadKind === "solo"
        ? readString(values, "payloadTitle")
        : readString(values, "payloadWord")) ??
      readString(values, "word") ??
      readString(values, "sequenceName"),
    payloadKind,
    authoredHand,
    creator: readString(values, "ownerDisplayName"),
    thumbnailUrl: readString(values, "thumbnailUrl"),
    deckId: readString(values, "deckId"),
    deckName: readString(values, "deckName"),
    bluePropType: readString(values, "bluePropType"),
    redPropType: readString(values, "redPropType"),
  };
}

async function fetchShortCodeRecord(
  code: string
): Promise<ShortCodeData | null> {
  const mask = RECORD_FIELD_PATHS.map(
    (path) => `mask.fieldPaths=${encodeURIComponent(path)}`
  ).join("&");
  const url =
    `${FIRESTORE_HOST}/projects/${PROJECT_ID}/databases/(default)/documents` +
    `/shortcodes/${encodeURIComponent(code)}?${mask}`;

  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });

  // An unknown code is a normal outcome (typo, retired card), not a failure.
  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(
      `Firestore REST returned ${response.status} ${response.statusText}`
    );
  }

  const doc = (await response.json()) as { fields?: FirestoreFields };
  const decoded = fromFirestoreFields(doc.fields ?? {});

  // A malformed public document must not enter the client hydrator. Falling
  // back to its Firestore/snapshot ladder retains the existing recovery path.
  if (typeof decoded["sequence"] !== "string") return null;
  return decoded as unknown as ShortCodeData;
}

function stripPreparedPayload(
  record: ShortCodeData | null,
  prepared: PreparedScanPayload | null
): ShortCodeData | null {
  if (!record || !prepared) return record;

  // The hydrated sequence now carries the payload. Keep the small attribution
  // envelope for analytics and later actions, but do not serialize a duplicate
  // 30–100 KB embedded sequence into the HTML.
  const {
    sequenceData: _sequenceData,
    soloData: _soloData,
    ...clientRecord
  } = record;
  return clientRecord;
}

export const load: PageServerLoad = async ({
  params,
  request,
  platform,
  url,
}) => {
  const cf = (platform as { cf?: Record<string, unknown> } | undefined)?.cf;
  const geo = parseCloudflareGeo(request.headers, cf) ?? {
    country: null,
    city: null,
    lat: null,
    lng: null,
  };

  let meta: ShortCodeMeta = EMPTY_META;
  let record: ShortCodeData | null = null;
  let prepared: PreparedScanPayload | null = null;

  if (!isInlineEncoded(params.code)) {
    try {
      record = await fetchShortCodeRecord(params.code);
      meta = deriveMeta(record);
    } catch (error) {
      // Non-fatal: the page still renders and the client resolver takes over.
      // But it must never be silent again — the empty catch that used to live
      // here hid a total, permanent attribution outage. console.error survives
      // the production build; console.log/debug/info are stripped (vite.config).
      console.error(
        `[q-ssr] shortcode lookup failed for "${params.code}":`,
        error instanceof Error ? error.message : error
      );
    }
  }

  try {
    prepared = await prepareScanPayload(
      params.code,
      record,
      parsePropsFromURL(url.searchParams)
    );
  } catch (error) {
    // Non-fatal: legacy/user-doc records retain the browser resolver. A broken
    // self-contained payload is visible in server logs instead of silently
    // regressing every scanner to a blank screen.
    console.error(
      `[q-ssr] scan payload preparation failed for "${params.code}":`,
      error instanceof Error ? error.message : error
    );
  }

  return {
    geo,
    meta,
    record: stripPreparedPayload(record, prepared),
    preparedSequence: prepared?.sequence ?? null,
    scanCard: prepared?.card ?? null,
    preparedPropConfig: prepared?.propConfig ?? null,
  };
};
