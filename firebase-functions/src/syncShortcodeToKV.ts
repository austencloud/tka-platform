/**
 * Firestore write-through trigger: shortcode → Cloudflare KV.
 *
 * Fires on every shortcode create or update. Writes the OG-relevant
 * metadata to Cloudflare KV so the edge worker can serve social
 * previews without hitting SvelteKit SSR.
 *
 * KV entries expire after 7 days (refreshed by the daily snapshot sync
 * and by this trigger on every write). Stale entries fall back to the
 * 302 redirect — no broken cards, just slower social previews.
 */

import * as functions from "firebase-functions";
import { defineSecret } from "firebase-functions/params";

const cfAccountId = defineSecret("CLOUDFLARE_ACCOUNT_ID");
const cfApiToken = defineSecret("CLOUDFLARE_API_TOKEN");
const kvNamespaceId = defineSecret("KV_NAMESPACE_ID");

const KV_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

interface OGMeta {
  word: string | null;
  creator: string | null;
  thumbnailUrl: string | null;
  deckName: string | null;
}

function buildThumbnailUrl(word: string | null): string | null {
  if (!word) return null;
  return `https://firebasestorage.googleapis.com/v0/b/the-kinetic-alphabet.appspot.com/o/thumbnails%2F${encodeURIComponent(word)}-staff.png?alt=media`;
}

export const syncShortcodeToKV = functions
  .runWith({
    secrets: [cfAccountId, cfApiToken, kvNamespaceId],
  })
  .region("us-central1")
  .firestore.document("shortcodes/{code}")
  .onWrite(async (change, context) => {
    const code = context.params.code;

    if (!change.after.exists) {
      // Deletion — remove from KV
      const url = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId.value()}/storage/kv/namespaces/${kvNamespaceId.value()}/values/${code}`;
      await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${cfApiToken.value()}` },
      });
      console.log(`[kv-sync] Deleted ${code}`);
      return;
    }

    const data = change.after.data();
    if (!data) return;

    const word = data.word || data.sequenceName || null;
    const meta: OGMeta = {
      word,
      creator: data.ownerDisplayName || null,
      thumbnailUrl: data.thumbnailUrl || buildThumbnailUrl(word),
      deckName: data.deckName || null,
    };

    const url = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId.value()}/storage/kv/namespaces/${kvNamespaceId.value()}/values/${code}?expiration_ttl=${KV_TTL_SECONDS}`;
    const resp = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${cfApiToken.value()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(meta),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(`[kv-sync] Failed to write ${code}: ${resp.status} ${body}`);
      return;
    }

    console.log(`[kv-sync] Synced ${code} → KV (word: ${word})`);
  });
