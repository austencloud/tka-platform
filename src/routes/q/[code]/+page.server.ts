import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, request }) => {
  const geo = {
    country: request.headers.get("cf-ipcountry") || null,
    city: request.headers.get("cf-ipcity") || null,
  };

  let meta: { word: string | null; creator: string | null; thumbnailUrl: string | null } = {
    word: null,
    creator: null,
    thumbnailUrl: null,
  };

  try {
    const { getAdminDb } = await import("$lib/server/firebaseAdmin");
    const db = getAdminDb();
    const doc = await db.collection("shortcodes").doc(params.code).get();
    if (doc.exists) {
      const data = doc.data();
      meta = {
        word: data?.word || data?.name || null,
        creator: data?.ownerDisplayName || null,
        thumbnailUrl: data?.thumbnailUrl || null,
      };
    }
  } catch {
    // Firestore lookup failure is non-fatal — page still works without OG enrichment
  }

  return { geo, meta };
};
