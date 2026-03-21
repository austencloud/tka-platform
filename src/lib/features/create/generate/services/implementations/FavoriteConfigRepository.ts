import {
  doc,
  getDoc,
  updateDoc,
  deleteField,
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import type { IFavoriteConfigRepository } from "../contracts/IFavoriteConfigRepository";
import type { FavoriteConfig, CommunityFavorite } from "../../domain/models/favorite-config";
import type { UIGenerationConfig } from "../../state/generate-config.svelte";
import type { StartEndOptions } from "$lib/features/create/shared/state/panel-coordination-state.svelte";

export class FavoriteConfigRepository implements IFavoriteConfigRepository {
  private readonly USERS_COLLECTION = "users";

  async getMyFavorite(userId: string): Promise<FavoriteConfig | null> {
    try {
      const db = await getFirestoreInstance();
      const userDoc = await getDoc(doc(db, this.USERS_COLLECTION, userId));

      if (!userDoc.exists()) return null;

      const data = userDoc.data();
      const fav = data.favoriteConfig;
      if (!fav || !fav.config) return null;

      return {
        config: fav.config as UIGenerationConfig,
        startEndOptions: (fav.startEndOptions as StartEndOptions) ?? null,
        setAt: fav.setAt?.toDate?.() ?? new Date(),
      };
    } catch (error) {
      console.error("[FavoriteConfigRepository] Error loading favorite:", error);
      return null;
    }
  }

  async setMyFavorite(
    userId: string,
    config: UIGenerationConfig,
    startEndOptions?: StartEndOptions | null
  ): Promise<void> {
    const db = await getFirestoreInstance();

    await trackWrite(
      () =>
        updateDoc(doc(db, this.USERS_COLLECTION, userId), {
          favoriteConfig: {
            config,
            startEndOptions: startEndOptions ?? null,
            setAt: new Date(),
          },
        }),
      "favorites"
    );
  }

  async clearMyFavorite(userId: string): Promise<void> {
    const db = await getFirestoreInstance();

    await trackWrite(
      () =>
        updateDoc(doc(db, this.USERS_COLLECTION, userId), {
          favoriteConfig: deleteField(),
        }),
      "favorites"
    );
  }

  async getCommunityFavorites(limit = 20): Promise<CommunityFavorite[]> {
    try {
      const db = await getFirestoreInstance();
      const q = query(
        collection(db, this.USERS_COLLECTION),
        where("favoriteConfig", "!=", null),
        orderBy("favoriteConfig"),
        firestoreLimit(limit)
      );

      const snapshot = await getDocs(q);
      const results: CommunityFavorite[] = [];

      for (const userDoc of snapshot.docs) {
        const data = userDoc.data();
        const fav = data.favoriteConfig;
        if (!fav?.config) continue;

        results.push({
          userId: userDoc.id,
          displayName: (data.displayName as string) ?? "Unknown",
          avatar: (data.photoURL as string) ?? undefined,
          config: fav.config as UIGenerationConfig,
          startEndOptions: (fav.startEndOptions as StartEndOptions) ?? null,
          setAt: fav.setAt?.toDate?.() ?? new Date(),
        });
      }

      return results;
    } catch (error) {
      console.error("[FavoriteConfigRepository] Error loading community favorites:", error);
      return [];
    }
  }
}
