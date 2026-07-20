import type { PageServerLoad } from "./$types";
import { env } from "$env/dynamic/public";
import { parseCloudflareGeo } from "$lib/shared/presence/domain/models/presence-models";

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

// Only the fields the OG tags read. Keeps the response small: shortcode docs
// also carry `encoded` and sometimes an inline `sequenceData` blob.
const META_FIELD_PATHS = [
  "word",
  "sequenceName",
  "ownerDisplayName",
  "thumbnailUrl",
  "deckId",
  "deckName",
] as const;

interface ShortCodeMeta {
  word: string | null;
  creator: string | null;
  thumbnailUrl: string | null;
  deckId: string | null;
  deckName: string | null;
}

const EMPTY_META: ShortCodeMeta = {
  word: null,
  creator: null,
  thumbnailUrl: null,
  deckId: null,
  deckName: null,
};

type FirestoreFields = Record<string, unknown>;

/**
 * Firestore REST wraps every scalar in a typed envelope — a string field comes
 * back as `{ stringValue: "ABC" }`, not `"ABC"`. Missing fields are absent
 * entirely rather than null.
 */
function readString(fields: FirestoreFields, key: string): string | null {
  const field = fields[key];
  if (!field || typeof field !== "object") return null;
  const value = (field as { stringValue?: unknown }).stringValue;
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function fetchShortCodeMeta(code: string): Promise<ShortCodeMeta> {
  const mask = META_FIELD_PATHS.map(
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
  if (response.status === 404) return EMPTY_META;

  if (!response.ok) {
    throw new Error(
      `Firestore REST returned ${response.status} ${response.statusText}`
    );
  }

  const doc = (await response.json()) as { fields?: FirestoreFields };
  const fields = doc.fields ?? {};

  return {
    word: readString(fields, "word") ?? readString(fields, "sequenceName"),
    creator: readString(fields, "ownerDisplayName"),
    thumbnailUrl: readString(fields, "thumbnailUrl"),
    deckId: readString(fields, "deckId"),
    deckName: readString(fields, "deckName"),
  };
}

export const load: PageServerLoad = async ({ params, request, platform }) => {
  const cf = (platform as { cf?: Record<string, unknown> } | undefined)?.cf;
  const geo = parseCloudflareGeo(request.headers, cf) ?? {
    country: null,
    city: null,
    lat: null,
    lng: null,
  };

  let meta: ShortCodeMeta = EMPTY_META;

  try {
    meta = await fetchShortCodeMeta(params.code);
  } catch (error) {
    // Non-fatal: the page still renders and the client resolver takes over.
    // But it must never be silent again — the empty catch that used to live
    // here hid a total, permanent attribution outage. console.error survives
    // the production build; console.log/debug/info are stripped (vite.config).
    console.error(
      `[q-ssr] shortcode meta lookup failed for "${params.code}":`,
      error instanceof Error ? error.message : error
    );
  }

  return { geo, meta };
};
