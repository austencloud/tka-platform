/**
 * UserSearcher - Firestore-based user search
 *
 * Uses prefix query on displayName for efficient server-side filtering,
 * with client-side email search fallback.
 */

import { browser } from "$app/environment";
import { collection, getDocs, query, where, orderBy, limit as firestoreLimit } from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type {
  IUserSearcher,
  UserSearchResult,
  UserSearchOptions,
} from "../contracts/IUserSearcher";

export class UserSearcher implements IUserSearcher {
  async searchUsers(
    queryText: string,
    options: UserSearchOptions = {}
  ): Promise<UserSearchResult[]> {
    const q = queryText.trim();
    if (!q || q.length < 2 || !browser) {
      return [];
    }

    const { excludeUserIds = [], limit = 10 } = options;

    try {
      const firestore = await getFirestoreInstance();

      // Use Firestore prefix query for efficient server-side filtering
      // This requires displayName to be indexed with proper ordering
      const usersQuery = query(
        collection(firestore, "users"),
        orderBy("displayName"),
        where("displayName", ">=", q),
        where("displayName", "<=", q + "\uf8ff"),
        firestoreLimit(limit + excludeUserIds.length) // Fetch extra in case we need to exclude
      );

      const snapshot = await getDocs(usersQuery);

      const results: UserSearchResult[] = [];

      for (const docSnap of snapshot.docs) {
        if (results.length >= limit) break;

        const uid = docSnap.id;
        if (excludeUserIds.includes(uid)) continue;

        const data = docSnap.data();
        results.push({
          uid,
          displayName: data.displayName || data.name || "",
          email: data.email || "",
          photoURL: data.photoURL || data.avatar || undefined,
        });
      }

      // If we didn't get enough results, also search by email client-side
      // This catches users who might match by email but not displayName
      if (results.length < limit) {
        const emailQuery = query(
          collection(firestore, "users"),
          firestoreLimit(50)
        );
        const emailSnapshot = await getDocs(emailQuery);
        const queryLower = q.toLowerCase();

        for (const docSnap of emailSnapshot.docs) {
          if (results.length >= limit) break;

          const uid = docSnap.id;
          if (excludeUserIds.includes(uid)) continue;
          if (results.some(r => r.uid === uid)) continue; // Already have this user

          const data = docSnap.data();
          const email = (data.email || "").toLowerCase();

          if (email.includes(queryLower)) {
            results.push({
              uid,
              displayName: data.displayName || data.name || "",
              email: data.email || "",
              photoURL: data.photoURL || data.avatar || undefined,
            });
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
