/**
 * Syncs shortcode OG metadata from Firestore → Cloudflare KV.
 *
 * Uses the Firebase CLI's stored refresh token for Firestore access
 * and wrangler's stored OAuth for KV writes. No service accounts needed.
 *
 * Run:
 *   npx tsx scripts/sync-shortcodes-to-kv.ts
 *
 * Prerequisites:
 *   - `firebase login` (already done)
 *   - `npx wrangler login` (already done)
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const PROJECT_ID = "the-kinetic-alphabet";
const KV_NAMESPACE_ID = "c06e4b192f3c49f2a4e11cc44d012277";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const PAGE_SIZE = 300;
const KV_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

interface KVEntry {
  key: string;
  value: string;
  expiration_ttl?: number;
}

interface OGMeta {
  word: string | null;
  creator: string | null;
  thumbnailUrl: string | null;
  deckName: string | null;
}

function getFirebaseAccessToken(): string {
  const configPath = join(
    process.env.USERPROFILE || process.env.HOME || "",
    ".config",
    "configstore",
    "firebase-tools.json"
  );
  const config = JSON.parse(readFileSync(configPath, "utf-8"));
  const refreshToken = config.tokens?.refresh_token;
  if (!refreshToken) throw new Error("No Firebase refresh token found. Run `firebase login`.");

  const resp = execSync(
    `curl -s -X POST "https://oauth2.googleapis.com/token" ` +
    `-H "Content-Type: application/x-www-form-urlencoded" ` +
    `-d "grant_type=refresh_token&refresh_token=${refreshToken}&client_id=563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com&client_secret=j9iVZfS8kkCEFUPaAeJV0sAi"`,
    { encoding: "utf-8" }
  );
  const data = JSON.parse(resp);
  if (!data.access_token) throw new Error("Failed to refresh access token");
  return data.access_token;
}

function extractStringValue(field: any): string | null {
  if (!field) return null;
  return field.stringValue ?? null;
}

function buildThumbnailUrl(word: string | null): string | null {
  if (!word) return null;
  return `https://firebasestorage.googleapis.com/v0/b/the-kinetic-alphabet.appspot.com/o/thumbnails%2F${encodeURIComponent(word)}-staff.png?alt=media`;
}

async function fetchAllShortcodes(accessToken: string): Promise<KVEntry[]> {
  const entries: KVEntry[] = [];
  let pageToken: string | undefined;
  let page = 0;

  while (true) {
    const params = new URLSearchParams({
      pageSize: String(PAGE_SIZE),
      "mask.fieldPaths": "word",
      "mask.fieldPaths": "sequenceName",
    });
    // Firestore REST API doesn't support multiple mask.fieldPaths via URLSearchParams well,
    // so we build the URL manually
    let url = `${FIRESTORE_BASE}/shortcodes?pageSize=${PAGE_SIZE}`;
    url += "&mask.fieldPaths=word&mask.fieldPaths=sequenceName&mask.fieldPaths=ownerDisplayName&mask.fieldPaths=thumbnailUrl&mask.fieldPaths=deckName";
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Firestore list failed (${resp.status}): ${body}`);
    }

    const data = await resp.json();
    const docs = data.documents || [];

    for (const doc of docs) {
      const docId = doc.name.split("/").pop();
      const fields = doc.fields || {};

      const word = extractStringValue(fields.word) || extractStringValue(fields.sequenceName);
      const meta: OGMeta = {
        word,
        creator: extractStringValue(fields.ownerDisplayName),
        thumbnailUrl: extractStringValue(fields.thumbnailUrl) || buildThumbnailUrl(word),
        deckName: extractStringValue(fields.deckName),
      };
      entries.push({ key: docId, value: JSON.stringify(meta), expiration_ttl: KV_TTL_SECONDS });
    }

    page++;
    console.log(`  page ${page}: ${docs.length} docs (${entries.length} total)`);

    pageToken = data.nextPageToken;
    if (!pageToken || docs.length === 0) break;
  }

  return entries;
}

async function main() {
  const start = Date.now();

  console.log("[kv-sync] Getting Firebase access token...");
  const accessToken = getFirebaseAccessToken();

  console.log("[kv-sync] Fetching shortcodes from Firestore...");
  const entries = await fetchAllShortcodes(accessToken);
  console.log(`[kv-sync] Found ${entries.length} shortcodes`);

  // Write to temp file for wrangler bulk put
  const tmpFile = join(process.cwd(), ".kv-bulk-shortcodes.json");
  writeFileSync(tmpFile, JSON.stringify(entries, null, 0));
  console.log(`[kv-sync] Wrote bulk file: ${tmpFile} (${(readFileSync(tmpFile).length / 1024).toFixed(0)} KB)`);

  console.log("[kv-sync] Uploading to Cloudflare KV via wrangler...");
  try {
    const result = execSync(
      `npx wrangler kv bulk put "${tmpFile}" --namespace-id ${KV_NAMESPACE_ID} --remote`,
      { encoding: "utf-8", cwd: process.cwd(), timeout: 120_000 }
    );
    console.log(result);
  } finally {
    // Clean up temp file
    try { require("fs").unlinkSync(tmpFile); } catch {}
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[kv-sync] Done in ${elapsed}s — ${entries.length} entries synced`);
}

main().catch((err) => {
  console.error("[kv-sync] Fatal:", err);
  process.exit(1);
});
