import {
  doc,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import { firestoreGet, firestoreList, firestoreSet } from "$lib/shared/firestore";
import { UserWithFavoriteSchema } from "../domain/models/favorite-config-schemas";
import type { FavoriteConfig, CommunityFavorite } from "../domain/models/favorite-config";
import type { UIGenerationConfig } from "../state/generate-config.svelte";
import type { StartEndOptions } from "$lib/shared/create/state/panel-coordination-state.svelte";

const USERS_COLLECTION = "users";

export async function getMyFavorite(userId: string): Promise<FavoriteConfig | null> {
  try {
    const userDoc = await firestoreGet(USERS_COLLECTION, userId, UserWithFavoriteSchema);

    if (!userDoc) return null;

    const fav = userDoc.favoriteConfig;
    if (!fav || !fav.config) return null;

    return {
      config: fav.config as unknown as UIGenerationConfig,
      startEndOptions: (fav.startEndOptions as unknown as StartEndOptions) ?? null,
      setAt: fav.setAt ?? new Date(),
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
  await firestoreSet(
    USERS_COLLECTION,
    userId,
    {
      favoriteConfig: {
        config,
        startEndOptions: startEndOptions ?? null,
        setAt: new Date(),
      },
    } as Record<string, unknown>,
    { merge: true, trackOffline: true, repoName: "favorites" },
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

export async function getCommunityFavorites(limitCount = 20): Promise<CommunityFavorite[]> {
  try {
    const users = await firestoreList(USERS_COLLECTION, UserWithFavoriteSchema, {
      where: [{ field: "favoriteConfig", op: "!=", value: null }],
      orderBy: [{ field: "favoriteConfig" }],
      limit: limitCount,
    });

    const results: CommunityFavorite[] = [];

    for (const user of users) {
      const fav = user.favoriteConfig;
      if (!fav?.config) continue;

      results.push({
        userId: user.id,
        displayName: user.displayName ?? "Unknown",
        avatar: user.photoURL ?? undefined,
        config: fav.config as unknown as UIGenerationConfig,
        startEndOptions: (fav.startEndOptions as unknown as StartEndOptions) ?? null,
        setAt: fav.setAt ?? new Date(),
      });
    }

    return results;
  } catch (error) {
    console.error("[favorite-config-repository] Error loading community favorites:", error);
    return [];
  }
}
