import type { PageServerLoad } from "./$types";
import {
  parseSequenceRouteId,
  decodeSequenceWithCompression,
} from "$lib/shared/navigation/services/sequence-encoder";

export const load: PageServerLoad = ({ params, url }) => {
  const parsed = parseSequenceRouteId(params.id);

  let word: string | null = url.searchParams.get("word");
  const creator: string | null = url.searchParams.get("creator");
  const difficulty: string | null = url.searchParams.get("difficulty");
  let stepCount: number | null = null;

  if (parsed.encoded) {
    try {
      const decoded = decodeSequenceWithCompression(parsed.encoded);
      word ??= decoded.word ?? decoded.name ?? null;
      stepCount = decoded.steps?.length ?? null;
    } catch {
      // Decode failure is non-fatal — URL params provide fallback
    }
  }

  const propType = url.searchParams.get("bp") || "staff";
  const thumbnailUrl = word
    ? `https://firebasestorage.googleapis.com/v0/b/the-kinetic-alphabet.appspot.com/o/thumbnails%2F${encodeURIComponent(word)}-${propType}.png?alt=media`
    : null;

  return {
    meta: { word, creator, difficulty, stepCount, thumbnailUrl },
  };
};
