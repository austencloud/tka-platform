/**
 * UserSearcher - Firestore-based user search
 *
 * Uses prefix query on displayName for efficient server-side filtering,
 * with comprehensive client-side fuzzy search fallback.
 */

import { browser } from "$app/environment";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { UserSearchResult, UserSearchOptions } from "../contracts/types";

export class UserSearcher {
  /**
   * Fuzzy match - checks if ALL query terms appear anywhere in text
   * Case insensitive, matches partial words
   */
  private fuzzyMatch(text: string, queryTerms: string[]): boolean {
    const normalizedText = text.toLowerCase();
    return queryTerms.every((term) => normalizedText.includes(term));
  }

  async searchUsers(
    queryText: string,
    options: UserSearchOptions = {}
  ): Promise<UserSearchResult[]> {
    const q = queryText.trim();
    if (!q || q.length < 2 || !browser) {
      return [];
    }

    const { excludeUserIds = [], limit = 10 } = options;
    const queryTerms = q.toLowerCase().split(/\s+/).filter(Boolean);

    try {
      const firestore = await getFirestoreInstance();
      const results: UserSearchResult[] = [];
      const addedUids = new Set<string>();

      // PHASE 1: Server-side prefix query (fast, for exact prefix matches)
      // e.g., searching "Sky" finds "Sky Guy's Quest"
      const prefixQuery = query(
        collection(firestore, "users"),
        orderBy("displayName"),
        where("displayName", ">=", q),
        where("displayName", "<=", q + "\uf8ff"),
        firestoreLimit(limit + excludeUserIds.length)
      );

      const prefixSnapshot = await getDocs(prefixQuery);

      for (const docSnap of prefixSnapshot.docs) {
        if (results.length >= limit) break;

        const uid = docSnap.id;
        if (excludeUserIds.includes(uid) || addedUids.has(uid)) continue;

        const data = docSnap.data();
        results.push({
          uid,
          displayName: data.displayName || data.name || "",
          username: data.username || undefined,
          photoURL: data.photoURL || data.avatar || undefined,
        });
        addedUids.add(uid);
      }

      // PHASE 2: Client-side fuzzy search (for contains/partial matches)
      // e.g., searching "sky" finds "Robert Bershadsky" (contains "sky")
      // Fetch more users for client-side filtering
      if (results.length < limit) {
        const allUsersQuery = query(
          collection(firestore, "users"),
          firestoreLimit(100) // Fetch enough for comprehensive client-side search
        );
        const allUsersSnapshot = await getDocs(allUsersQuery);

        for (const docSnap of allUsersSnapshot.docs) {
          if (results.length >= limit) break;

          const uid = docSnap.id;
          if (excludeUserIds.includes(uid) || addedUids.has(uid)) continue;

          const data = docSnap.data();
          const displayName = data.displayName || data.name || "";
          const username = data.username || "";

          // Combine searchable fields (no email - privacy)
          const searchableText = `${displayName} ${username}`;

          if (this.fuzzyMatch(searchableText, queryTerms)) {
            results.push({
              uid,
              displayName,
              username: username || undefined,
              photoURL: data.photoURL || data.avatar || undefined,
            });
            addedUids.add(uid);
          }
        }
      }

      return results;
    } catch (error) {
      console.error("[UserSearcher] Failed to search users:", error);
      return [];
    }
  }
}
