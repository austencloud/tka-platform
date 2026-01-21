/**
 * Searches for sequences matching a TKA word
 */
import type { ISequenceMatcher } from "../contracts/ISequenceMatcher";
import type { MatchedSequence } from "../../types";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";

// Known user ID for Austen (primary sequence creator)
const AUSTEN_USER_ID = "PBp3GSBO6igCKPwJyLZNmVEmamI3";

export class SequenceMatcher implements ISequenceMatcher {
  async searchByWord(word: string): Promise<MatchedSequence[]> {
    const { collection, getDocs, query, where } = await import("firebase/firestore");
    const db = await getFirestoreInstance();

    const normalizedWord = word.toUpperCase();
    const results: MatchedSequence[] = [];

    // Search in publicSequences (has open read access)
    const publicQuery = query(
      collection(db, "publicSequences"),
      where("word", "==", normalizedWord)
    );
    const publicSnapshot = await getDocs(publicQuery);

    for (const doc of publicSnapshot.docs) {
      const data = doc.data();
      results.push({
        id: doc.id,
        word: data.word || "",
        name: data.name || data.word || "Untitled",
        ownerId: data.ownerId || "",
        ownerName: data.author || data.ownerName || "Unknown",
        thumbnail: data.thumbnails?.[0] || null,
        isPublic: true,
      });
    }

    // Also search Austen's sequences directly
    const austenQuery = query(
      collection(db, `users/${AUSTEN_USER_ID}/sequences`),
      where("word", "==", normalizedWord)
    );
    const austenSnapshot = await getDocs(austenQuery);

    for (const doc of austenSnapshot.docs) {
      const data = doc.data();
      // Avoid duplicates
      if (!results.some((r) => r.id === doc.id)) {
        results.push({
          id: doc.id,
          word: data.word || "",
          name: data.name || data.word || "Untitled",
          ownerId: AUSTEN_USER_ID,
          ownerName: data.author || "Austen",
          thumbnail: data.thumbnails?.[0] || null,
          isPublic: data.visibility === "public",
        });
      }
    }

    return results;
  }
}
