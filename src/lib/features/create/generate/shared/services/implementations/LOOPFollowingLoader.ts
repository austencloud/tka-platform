/**
 * LOOPFollowingLoader
 *
 * Loads LOOP presets from users that the current user follows.
 * Aggregates and deduplicates presets across all followed users.
 */

import {
  collection,
  getDocs,
  query,
  orderBy,
  limit as firestoreLimit,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { ILOOPFollowingLoader } from "../contracts/ILOOPFollowingLoader";
import type { IUserRepository } from "$lib/shared/community/services/contracts/IUserRepository";
import type { FollowingPreset } from "../../domain/models/loop-selection-types";
import type { LOOPComponent } from "../../domain/models/generate-models";
import type { Timestamp } from "firebase/firestore";

export class LOOPFollowingLoader implements ILOOPFollowingLoader {
  constructor(private readonly userRepository: IUserRepository) {}

  async loadFollowingPresets(
    userId: string,
    limit: number = 20
  ): Promise<FollowingPreset[]> {
    // Get users that the current user follows
    const followedUsers = await this.userRepository.getFollowing(userId);

    if (followedUsers.length === 0) {
      return [];
    }

    // Load presets from each followed user in parallel
    const presetPromises = followedUsers.map((user) =>
      this.loadPresetsFromUserInternal(user.id, user.displayName, user.avatar)
    );

    const allPresets = (await Promise.all(presetPromises)).flat();

    // Sort by usage count descending and limit
    return allPresets
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  async loadPresetsFromUser(followedUserId: string): Promise<FollowingPreset[]> {
    // Need to fetch user profile to get display name and avatar
    const userProfile = await this.userRepository.getUserProfile(followedUserId);

    if (!userProfile) {
      return [];
    }

    return this.loadPresetsFromUserInternal(
      followedUserId,
      userProfile.displayName,
      userProfile.avatar
    );
  }

  async hasPresets(userId: string): Promise<boolean> {
    const firestore = await getFirestoreInstance();
    const presetsRef = collection(
      firestore,
      "users",
      userId,
      "loopPresets"
    );
    const q = query(presetsRef, firestoreLimit(1));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  /**
   * Internal method to load presets with known user info
   */
  private async loadPresetsFromUserInternal(
    userId: string,
    displayName: string,
    avatarUrl?: string
  ): Promise<FollowingPreset[]> {
    const firestore = await getFirestoreInstance();
    const presetsRef = collection(
      firestore,
      "users",
      userId,
      "loopPresets"
    );
    const q = query(presetsRef, orderBy("usageCount", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name as string,
        components: data.components as LOOPComponent[],
        icon: data.icon as string | undefined,
        createdAt: data.createdAt as Timestamp,
        usageCount: (data.usageCount as number) || 0,
        creatorId: userId,
        creatorName: displayName,
        creatorAvatarUrl: avatarUrl,
      };
    });
  }
}
