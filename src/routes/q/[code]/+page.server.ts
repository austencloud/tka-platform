import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, request, platform }) => {
  const parseCoord = (v: string | number | null | undefined): number | null => {
    if (v == null) return null;
    const n = typeof v === "number" ? v : Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };

  // platform.cf is populated by Cloudflare on every Pages request — city/lat/lng
  // come for free, no managed-transform headers needed. Headers stay as fallback
  // (cf-ipcity & friends only exist when the zone's visitor-location transform
  // is on, which it isn't — hence every historical scanEvent has city: null).
  const cf = (platform as { cf?: Record<string, unknown> } | undefined)?.cf ?? {};
  const geo = {
    country: (cf.country as string) || request.headers.get("cf-ipcountry") || null,
    city: (cf.city as string) || request.headers.get("cf-ipcity") || null,
    lat: parseCoord((cf.latitude as string) ?? request.headers.get("cf-iplatitude")),
    lng: parseCoord((cf.longitude as string) ?? request.headers.get("cf-iplongitude")),
  };

  let meta: {
    word: string | null;
    creator: string | null;
    thumbnailUrl: string | null;
    deckId: string | null;
    deckName: string | null;
  } = {
    word: null,
    creator: null,
    thumbnailUrl: null,
    deckId: null,
    deckName: null,
  };

  try {
    const { getAdminDb } = await import("$lib/server/firebaseAdmin");
    const db = getAdminDb();
    const doc = await db.collection("shortcodes").doc(params.code).get();
    if (doc.exists) {
      const data = doc.data();
      meta = {
        word: data?.word || data?.sequenceName || null,
        creator: data?.ownerDisplayName || null,
        thumbnailUrl: data?.thumbnailUrl || null,
        deckId: data?.deckId || null,
        deckName: data?.deckName || null,
      };
    }
  } catch {
    // Firestore lookup failure is non-fatal
  }

  return { geo, meta };
};
