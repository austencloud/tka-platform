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
import type { FavoriteConfig, CommunityFavorite } from "../domain/models/favorite-config";
import type { UIGenerationConfig } from "../state/generate-config.svelte";
import type { StartEndOptions } from "$lib/features/create/shared/state/panel-coordination-state.svelte";

const USERS_COLLECTION = "users";

export async function getMyFavorite(userId: string): Promise<FavoriteConfig | null> {
  try {
    const db = await getFirestoreInstance();
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));

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
    console.error("[favorite-config-repository] Error loading favorite:", error);
    return null;
  }
}

export async function setMyFavorite(
  userId: string,
  config: UIGenerationConfig,
  startEndOptions?: StartEndOptions | null
): Promise<void> {
  const db = await getFirestoreInstance();

  await trackWrite(
    () =>
      updateDoc(doc(db, USERS_COLLECTION, userId), {
        favoriteConfig: {
          config,
          startEndOptions: startEndOptions ?? null,
          setAt: new Date(),
        },
      }),
    "favorites"
  );
}

export async function clearMyFavorite(userId: string): Promise<void> {
  const db = await getFirestoreInstance();

  await trackWrite(
    () =>
      updateDoc(doc(db, USERS_COLLECTION, userId), {
        favoriteConfig: deleteField(),
      }),
    "favorites"
  );
}

export async function getCommunityFavorites(limit = 20): Promise<CommunityFavorite[]> {
  try {
    const db = await getFirestoreInstance();
    const q = query(
      collection(db, USERS_COLLECTION),
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
    console.error("[favorite-config-repository] Error loading community favorites:", error);
    return [];
  }
}
