import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, request }) => {
  const parseCoord = (v: string | null): number | null => {
    if (!v) return null;
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };

  const geo = {
    country: request.headers.get("cf-ipcountry") || null,
    city: request.headers.get("cf-ipcity") || null,
    lat: parseCoord(request.headers.get("cf-iplatitude")),
    lng: parseCoord(request.headers.get("cf-iplongitude")),
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
