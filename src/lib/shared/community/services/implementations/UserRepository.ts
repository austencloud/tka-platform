/**
 * User Service Implementation
 *
 * Fetches user data from Firebase Firestore with gamification data and social features.
 * Includes follow/unfollow functionality with atomic Firestore transactions.
 */

import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  documentId,
  startAfter,
} from "firebase/firestore";
import type { Timestamp, DocumentData, DocumentSnapshot } from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import { getUserAchievementsPath } from "$lib/shared/gamification/data/firestore-collections";
import { ALL_ACHIEVEMENTS } from "$lib/shared/gamification/domain/constants/achievement-definitions";
import type {
  Achievement,
  UserAchievement,
} from "$lib/shared/gamification/domain/models/achievement-models";
import type {
  IUserRepository,
  PaginatedUsersResult,
  PaginatedQueryOptions,
} from "../contracts/IUserRepository";
import type {
  EnhancedUserProfile,
  UserProfile,
  CreatorQueryOptions,
  CreatorSortCriteria,
} from "../../domain/models/enhanced-user-profile";

import type { UserRole } from "$lib/shared/auth/domain/models/UserRole";

/**
 * Type definition for Firestore user document data
 */
interface FirestoreUserData extends DocumentData {
  displayName?: string;
  name?: string;
  username?: string;
  email?: string;
  photoURL?: string;
  avatar?: string;
  sequenceCount?: number;
  collectionCount?: number;
  followerCount?: number;
  followingCount?: number;
  createdAt?: Timestamp;
  totalXP?: number;
  currentLevel?: number;
  achievementCount?: number;
  currentStreak?: number;
  longestStreak?: number;
  isFeatured?: boolean;
  bio?: string;
  instagramUsername?: string;
  pronouns?: string;
  lastActivityDate?: Timestamp;
  // Profile accent color
  profileColor?: string;
  // Admin-related fields
  role?: UserRole;
  isDisabled?: boolean;
  isHidden?: boolean;
  adminLabel?: string;
  adminNotes?: string;
}

/**
 * Follow document structure in Firestore
 */
interface FollowDocument {
  createdAt: Timestamp;
}

export class UserRepository implements IUserRepository {
  private readonly USERS_COLLECTION = "users";

  // ============================================================================
  // USER PROFILE METHODS
  // ============================================================================

  /**
   * Get enhanced user profile by ID
   */
  async getUserProfile(
    userId: string,
    currentUserId?: string
  ): Promise<EnhancedUserProfile | null> {
    try {
      const firestore = await getFirestoreInstance();
      const userDocRef = doc(firestore, this.USERS_COLLECTION, userId);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        return null;
      }

      // Check follow status if current user is provided
      let isFollowing = false;
      if (currentUserId && currentUserId !== userId) {
        isFollowing = await this.isFollowing(currentUserId, userId);
      }

      const user = await this.mapFirestoreToEnhancedProfile(
        userDoc.id,
        userDoc.data() as FirestoreUserData,
        isFollowing
      );
      return user;
    } catch (error) {
      console.error(`[UserRepository] Error fetching user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get multiple enhanced user profiles (for creator browsing)
   */
  async getUsers(
    options?: CreatorQueryOptions,
    currentUserId?: string
  ): Promise<EnhancedUserProfile[]> {
    try {
      const firestore = await getFirestoreInstance();
      const usersRef = collection(firestore, this.USERS_COLLECTION);
      let q = query(usersRef);

      // Apply limit (default to 100)
      const limitValue = options?.limit ?? 100;
      q = query(q, firestoreLimit(limitValue));

      const querySnapshot = await getDocs(q);

      // Get list of users current user is following (for batch check)
      let followingSet = new Set<string>();
      if (currentUserId) {
        followingSet = await this.getFollowingIds(currentUserId);
      }

      const users: EnhancedUserProfile[] = [];

      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data() as FirestoreUserData;
        const isFollowing =
          currentUserId !== docSnap.id && followingSet.has(docSnap.id);
        // Skip achievements fetch in list views to avoid N+1 queries
        const user = await this.mapFirestoreToEnhancedProfile(
          docSnap.id,
          data,
          isFollowing,
          true // skipAchievements
        );
        if (user) {
          users.push(user);
        }
      }

      // Apply client-side filtering and sorting
      let filteredUsers = this.applyFilters(users, options);
      filteredUsers = this.applySorting(filteredUsers, options);

      return filteredUsers;
    } catch (error) {
      console.error("[UserRepository] Error fetching users:", error);
      toast.error("Failed to load creators.");
      throw error;
    }
  }

  /**
   * Map sort criteria to Firestore field names
   */
  private readonly SORT_FIELD_MAP: Record<CreatorSortCriteria, string> = {
    lastActive: "lastActivityDate",
    joinedDate: "createdAt",
    favoriteProp: "favoriteProp",
  };

  /**
   * Get paginated users with cursor-based pagination
   * Server-side sorting for scalability
   */
  async getUsersPaginated(
    options: PaginatedQueryOptions,
    currentUserId?: string
  ): Promise<PaginatedUsersResult> {
    try {
      const firestore = await getFirestoreInstance();
      const usersRef = collection(firestore, this.USERS_COLLECTION);

      // Get the Firestore field name for sorting
      const sortField = this.SORT_FIELD_MAP[options.sortBy] || "lastActivityDate";
      const sortDirection = options.sortDirection === "asc" ? "asc" : "desc";

      // Build query with server-side ordering
      let q = query(
        usersRef,
        orderBy(sortField, sortDirection),
        firestoreLimit(options.limit + 1) // Fetch one extra to check if there's more
      );

      // Apply cursor if provided (for pagination)
      if (options.cursor) {
        q = query(
          usersRef,
          orderBy(sortField, sortDirection),
          startAfter(options.cursor),
          firestoreLimit(options.limit + 1)
        );
      }

      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs;

      // Check if there are more results
      const hasMore = docs.length > options.limit;
      const resultDocs = hasMore ? docs.slice(0, options.limit) : docs;

      // Get last document snapshot for cursor
      const lastDoc = resultDocs[resultDocs.length - 1];
      const lastDocSnapshot: DocumentSnapshot | null = lastDoc ?? null;

      // Get list of users current user is following (for batch check)
      let followingSet = new Set<string>();
      if (currentUserId) {
        followingSet = await this.getFollowingIds(currentUserId);
      }

      const users: EnhancedUserProfile[] = [];

      for (const docSnap of resultDocs) {
        const data = docSnap.data() as FirestoreUserData;
        // Skip hidden accounts (bots, test accounts, etc.)
        if (data.isHidden) continue;
        const isFollowing =
          currentUserId !== docSnap.id && followingSet.has(docSnap.id);
        // Skip achievements fetch in list views to avoid N+1 queries
        const user = await this.mapFirestoreToEnhancedProfile(
          docSnap.id,
          data,
          isFollowing,
          true // skipAchievements
        );
        if (user) {
          users.push(user);
        }
      }

      return {
        users,
        lastDocSnapshot,
        hasMore,
      };
    } catch (error) {
      console.error("[UserRepository] Error fetching paginated users:", error);
      toast.error("Failed to load creators.");
      throw error;
    }
  }

  /**
   * Get featured creators
   */
  async getFeaturedCreators(limit = 10): Promise<EnhancedUserProfile[]> {
    try {
      const firestore = await getFirestoreInstance();
      const usersRef = collection(firestore, this.USERS_COLLECTION);

      // Query for featured users, ordered by follower count
      const q = query(
        usersRef,
        where("isFeatured", "==", true),
        orderBy("followerCount", "desc"),
        firestoreLimit(limit)
      );

      const querySnapshot = await getDocs(q);

      const users: EnhancedUserProfile[] = [];

      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data() as FirestoreUserData;
        if (data.isHidden) continue;
        // Skip achievements fetch in list views
        const user = await this.mapFirestoreToEnhancedProfile(
          docSnap.id,
          data,
          false, // isFollowing - will be updated by component
          true // skipAchievements
        );
        if (user) {
          users.push(user);
        }
      }

      return users;
    } catch (error) {
      console.error("[UserRepository] Error fetching featured creators:", error);
      return [];
    }
  }

  /**
   * Subscribe to enhanced user profiles (for creator browsing)
   */
  subscribeToUsers(
    callback: (users: EnhancedUserProfile[]) => void,
    options?: CreatorQueryOptions,
    currentUserId?: string
  ): () => void {
    // Store unsubscribe function for cleanup
    let unsubscribe: (() => void) | null = null;

    // Use async IIFE to get firestore instance
    void (async () => {
      try {
        const firestore = await getFirestoreInstance();
        const usersRef = collection(firestore, this.USERS_COLLECTION);
        const limitValue = options?.limit ?? 100;
        const q = query(usersRef, firestoreLimit(limitValue));

        unsubscribe = onSnapshot(
          q,
          (querySnapshot) => {
            // Process async operations without blocking
            void (async () => {
              try {
                // Get list of users current user is following
                let followingSet = new Set<string>();
                if (currentUserId) {
                  followingSet = await this.getFollowingIds(currentUserId);
                }

                const users: EnhancedUserProfile[] = [];

                for (const docSnap of querySnapshot.docs) {
                  const data = docSnap.data() as FirestoreUserData;
                  if (data.isHidden) continue;
                  const isFollowing =
                    currentUserId !== docSnap.id &&
                    followingSet.has(docSnap.id);
                  // Skip achievements fetch in list views to avoid N+1 queries
                  const user = await this.mapFirestoreToEnhancedProfile(
                    docSnap.id,
                    data,
                    isFollowing,
                    true // skipAchievements
                  );
                  if (user) {
                    users.push(user);
                  }
                }

                // Apply client-side filtering and sorting
                let filteredUsers = this.applyFilters(users, options);
                filteredUsers = this.applySorting(filteredUsers, options);

                callback(filteredUsers);
              } catch (error) {
                console.error(
                  "[UserRepository] Error processing creators snapshot:",
                  error
                );
                // Return empty array on error to maintain UI stability
                callback([]);
              }
            })();
          },
          (error) => {
            console.error(
              "[UserRepository] Real-time subscription error:",
              error
            );
            toast.error("Failed to connect to creators feed.");
          }
        );
      } catch (error) {
        console.error(
          "[UserRepository] Failed to initialize creators subscription:",
          error
        );
        toast.error("Failed to connect to creators feed.");
      }
    })();

    // Return cleanup function that calls unsubscribe when available
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }

  // ============================================================================
  // FOLLOW FUNCTIONALITY
  // ============================================================================

  /**
   * Follow a user
   * Uses a Firestore transaction to atomically:
   * 1. Create follow document in current user's "following" subcollection
   * 2. Create follow document in target user's "followers" subcollection
   * 3. Increment current user's followingCount
   * 4. Increment target user's followerCount
   */
  async followUser(currentUserId: string, targetUserId: string): Promise<void> {
    if (currentUserId === targetUserId) {
      throw new Error("Users cannot follow themselves");
    }

    try {
      const firestore = await getFirestoreInstance();
      await trackWrite(
        () =>
          runTransaction(firestore, async (transaction) => {
            const followingRef = doc(
              firestore,
              `${this.USERS_COLLECTION}/${currentUserId}/following/${targetUserId}`
            );
            const followersRef = doc(
              firestore,
              `${this.USERS_COLLECTION}/${targetUserId}/followers/${currentUserId}`
            );
            const currentUserRef = doc(
              firestore,
              this.USERS_COLLECTION,
              currentUserId
            );
            const targetUserRef = doc(
              firestore,
              this.USERS_COLLECTION,
              targetUserId
            );

            const followingDoc = await transaction.get(followingRef);
            if (followingDoc.exists()) {
              return;
            }

            const currentUserDoc = await transaction.get(currentUserRef);
            const targetUserDoc = await transaction.get(targetUserRef);

            if (!currentUserDoc.exists() || !targetUserDoc.exists()) {
              throw new Error("User not found");
            }

            const currentUserData = currentUserDoc.data() as FirestoreUserData;
            const targetUserData = targetUserDoc.data() as FirestoreUserData;

            const followData: FollowDocument = {
              createdAt: serverTimestamp() as Timestamp,
            };

            transaction.set(followingRef, followData);
            transaction.set(followersRef, followData);

            transaction.update(currentUserRef, {
              followingCount: (currentUserData.followingCount ?? 0) + 1,
              lastActivityDate: serverTimestamp(),
            });
            transaction.update(targetUserRef, {
              followerCount: (targetUserData.followerCount ?? 0) + 1,
            });
          }),
        "community"
      );
    } catch (error) {
      console.error(`[UserRepository] Error following user:`, error);
      toast.error("Failed to follow user. Please try again.");
      throw new Error("Failed to follow user");
    }
  }

  /**
   * Unfollow a user
   * Uses a Firestore transaction to atomically:
   * 1. Delete follow document from current user's "following" subcollection
   * 2. Delete follow document from target user's "followers" subcollection
   * 3. Decrement current user's followingCount
   * 4. Decrement target user's followerCount
   */
  async unfollowUser(
    currentUserId: string,
    targetUserId: string
  ): Promise<void> {
    if (currentUserId === targetUserId) {
      throw new Error("Users cannot unfollow themselves");
    }

    try {
      const firestore = await getFirestoreInstance();
      await trackWrite(
        () =>
          runTransaction(firestore, async (transaction) => {
            const followingRef = doc(
              firestore,
              `${this.USERS_COLLECTION}/${currentUserId}/following/${targetUserId}`
            );
            const followersRef = doc(
              firestore,
              `${this.USERS_COLLECTION}/${targetUserId}/followers/${currentUserId}`
            );
            const currentUserRef = doc(
              firestore,
              this.USERS_COLLECTION,
              currentUserId
            );
            const targetUserRef = doc(
              firestore,
              this.USERS_COLLECTION,
              targetUserId
            );

            const followingDoc = await transaction.get(followingRef);
            if (!followingDoc.exists()) {
              return;
            }

            const currentUserDoc = await transaction.get(currentUserRef);
            const targetUserDoc = await transaction.get(targetUserRef);

            if (!currentUserDoc.exists() || !targetUserDoc.exists()) {
              throw new Error("User not found");
            }

            const currentUserData = currentUserDoc.data() as FirestoreUserData;
            const targetUserData = targetUserDoc.data() as FirestoreUserData;

            transaction.delete(followingRef);
            transaction.delete(followersRef);

            transaction.update(currentUserRef, {
              followingCount: Math.max(
                0,
                (currentUserData.followingCount ?? 0) - 1
              ),
              lastActivityDate: serverTimestamp(),
            });
            transaction.update(targetUserRef, {
              followerCount: Math.max(0, (targetUserData.followerCount ?? 0) - 1),
            });
          }),
        "community"
      );
    } catch (error) {
      console.error(`[UserRepository] Error unfollowing user:`, error);
      toast.error("Failed to unfollow user. Please try again.");
      throw new Error("Failed to unfollow user");
    }
  }

  /**
   * Check if a user is following another user
   */
  async isFollowing(
    currentUserId: string,
    targetUserId: string
  ): Promise<boolean> {
    if (currentUserId === targetUserId) {
      return false; // Can't follow yourself
    }

    try {
      const firestore = await getFirestoreInstance();
      const followingRef = doc(
        firestore,
        `${this.USERS_COLLECTION}/${currentUserId}/following/${targetUserId}`
      );
      const followingDoc = await getDoc(followingRef);
      return followingDoc.exists();
    } catch (error) {
      console.error(`[UserRepository] Error checking follow status:`, error);
      return false;
    }
  }

  /**
   * Get list of users that a user is following
   * Uses batch query to avoid N+1 pattern
   */
  async getFollowing(userId: string, limit = 50): Promise<UserProfile[]> {
    try {
      const firestore = await getFirestoreInstance();
      const followingRef = collection(
        firestore,
        `${this.USERS_COLLECTION}/${userId}/following`
      );
      const q = query(followingRef, firestoreLimit(limit));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return [];
      }

      // Get all user IDs first
      const userIds = querySnapshot.docs.map((docSnap) => docSnap.id);

      // Batch fetch users (Firestore 'in' query supports up to 30 items)
      return this.batchFetchUserProfiles(firestore, userIds);
    } catch (error) {
      console.error(`[UserRepository] Error getting following list:`, error);
      return [];
    }
  }

  /**
   * Get list of users following a user
   * Uses batch query to avoid N+1 pattern
   */
  async getFollowers(userId: string, limit = 50): Promise<UserProfile[]> {
    try {
      const firestore = await getFirestoreInstance();
      const followersRef = collection(
        firestore,
        `${this.USERS_COLLECTION}/${userId}/followers`
      );
      const q = query(followersRef, firestoreLimit(limit));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return [];
      }

      // Get all user IDs first
      const userIds = querySnapshot.docs.map((docSnap) => docSnap.id);

      // Batch fetch users (Firestore 'in' query supports up to 30 items)
      return this.batchFetchUserProfiles(firestore, userIds);
    } catch (error) {
      console.error(`[UserRepository] Error getting followers list:`, error);
      return [];
    }
  }

  /**
   * Batch fetch user profiles by IDs using 'in' query
   * Chunks into batches of 30 (Firestore limit for 'in' queries)
   */
  private async batchFetchUserProfiles(
    firestore: Awaited<ReturnType<typeof getFirestoreInstance>>,
    userIds: string[]
  ): Promise<UserProfile[]> {
    const users: UserProfile[] = [];
    const BATCH_SIZE = 30; // Firestore 'in' query limit

    // Process in chunks of 30
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const chunk = userIds.slice(i, i + BATCH_SIZE);
      const usersRef = collection(firestore, this.USERS_COLLECTION);
      const batchQuery = query(usersRef, where(documentId(), "in", chunk));
      const batchSnapshot = await getDocs(batchQuery);

      for (const docSnap of batchSnapshot.docs) {
        const data = docSnap.data() as FirestoreUserData;
        // Skip achievements for batch fetches to keep it fast
        const user = await this.mapFirestoreToEnhancedProfile(
          docSnap.id,
          data,
          false, // isFollowing - not relevant for these lists
          true // skipAchievements
        );
        if (user) {
          users.push(user);
        }
      }
    }

    return users;
  }

  /**
   * Subscribe to follow status changes for a specific user relationship
   */
  subscribeToFollowStatus(
    currentUserId: string,
    targetUserId: string,
    callback: (isFollowing: boolean) => void
  ): () => void {
    if (currentUserId === targetUserId) {
      // Can't follow yourself, always return false
      callback(false);
      return () => {};
    }

    // Store unsubscribe function for cleanup
    let unsubscribe: (() => void) | null = null;

    // Use async IIFE to get firestore instance
    void (async () => {
      try {
        const firestore = await getFirestoreInstance();
        const followingRef = doc(
          firestore,
          `${this.USERS_COLLECTION}/${currentUserId}/following/${targetUserId}`
        );

        unsubscribe = onSnapshot(
          followingRef,
          (docSnap) => {
            callback(docSnap.exists());
          },
          (error) => {
            console.error(
              `[UserRepository] Follow status subscription error:`,
              error
            );
            callback(false);
          }
        );
      } catch (error) {
        console.error(
          "[UserRepository] Failed to initialize follow status subscription:",
          error
        );
        callback(false);
      }
    })();

    // Return cleanup function that calls unsubscribe when available
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Get set of user IDs that a user is following (for batch checks)
   * Limited to 500 to prevent excessive reads
   */
  private async getFollowingIds(userId: string): Promise<Set<string>> {
    try {
      const firestore = await getFirestoreInstance();
      const followingRef = collection(
        firestore,
        `${this.USERS_COLLECTION}/${userId}/following`
      );
      // Limit to 500 to prevent excessive reads for users following many people
      const q = query(followingRef, firestoreLimit(500));
      const querySnapshot = await getDocs(q);
      return new Set(querySnapshot.docs.map((docSnap) => docSnap.id));
    } catch (error) {
      console.error(`[UserRepository] Error getting following IDs:`, error);
      return new Set();
    }
  }

  /**
   * Map Firestore document data to EnhancedUserProfile
   * @param skipAchievements - If true, skips fetching achievements (for list views to avoid N+1)
   */
  private async mapFirestoreToEnhancedProfile(
    userId: string,
    data: FirestoreUserData,
    isFollowing = false,
    skipAchievements = false
  ): Promise<EnhancedUserProfile | null> {
    try {
      // Base profile data
      const displayName = data.displayName ?? data.name ?? "Anonymous User";
      const username =
        data.username ?? data.email?.split("@")[0] ?? userId.substring(0, 8);
      const avatar = data.photoURL ?? data.avatar ?? undefined;

      // Get counts from denormalized fields
      const sequenceCount = data.sequenceCount ?? 0;
      const collectionCount = data.collectionCount ?? 0;
      const followerCount = data.followerCount ?? 0;
      const followingCount = data.followingCount ?? 0;

      // Get join date from createdAt timestamp
      const joinedDate = data.createdAt?.toDate() ?? new Date();

      // Get last activity date (falls back to join date for users who haven't been active since field was added)
      const lastActiveAt = data.lastActivityDate?.toDate() ?? joinedDate;

      // Gamification data (with fallbacks for users without gamification data)
      const totalXP = data.totalXP ?? 0;
      const currentLevel = data.currentLevel ?? 1;
      const achievementCount = data.achievementCount ?? 0;
      const currentStreak = data.currentStreak ?? 0;
      const longestStreak = data.longestStreak ?? 0;
      const isFeatured = data.isFeatured ?? false;
      const bio = data.bio ?? undefined;
      const instagramUsername = data.instagramUsername ?? undefined;
      const pronouns = data.pronouns ?? undefined;

      // Profile accent color
      const profileColor = data.profileColor ?? undefined;

      // Admin-related fields
      const role = data.role ?? "user";
      const isDisabled = data.isDisabled ?? false;
      const isHidden = data.isHidden ?? false;
      const adminLabel = data.adminLabel ?? undefined;
      const adminNotes = data.adminNotes ?? undefined;

      // Only fetch achievements for single profile views (avoid N+1 in list views)
      const topAchievements = skipAchievements
        ? []
        : await this.fetchUserTopAchievements(userId);

      return {
        id: userId,
        username,
        displayName,
        avatar,
        // NOTE: Email deliberately omitted - user documents are publicly readable
        sequenceCount,
        collectionCount,
        followerCount,
        followingCount,
        joinedDate,
        lastActiveAt,
        isFollowing,
        instagramUsername,
        pronouns,
        profileColor,
        totalXP,
        currentLevel,
        achievementCount,
        currentStreak,
        longestStreak,
        topAchievements,
        isFeatured,
        bio,
        role,
        isDisabled,
        isHidden,
        adminLabel,
        adminNotes,
      };
    } catch (error) {
      console.error(`[UserRepository] Error mapping user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Fetch user's top achievements from Firestore subcollection
   * Returns the most recent unlocked achievements (up to 5)
   */
  private async fetchUserTopAchievements(
    userId: string
  ): Promise<Achievement[]> {
    try {
      const firestore = await getFirestoreInstance();
      // Get user's unlocked achievements from subcollection
      const achievementsPath = getUserAchievementsPath(userId);
      const achievementsRef = collection(firestore, achievementsPath);

      // Query for completed achievements, ordered by unlock date
      const q = query(
        achievementsRef,
        where("isCompleted", "==", true),
        orderBy("unlockedAt", "desc"),
        firestoreLimit(5)
      );

      const querySnapshot = await getDocs(q);
      const achievements: Achievement[] = [];

      // Map user achievements to full achievement details
      for (const docSnap of querySnapshot.docs) {
        const userAch = docSnap.data() as UserAchievement;

        // Find the full achievement details from the master list
        const fullAchievement = ALL_ACHIEVEMENTS.find(
          (ach) => ach.id === userAch.achievementId
        );

        if (fullAchievement) {
          achievements.push(fullAchievement);
        }
      }

      return achievements;
    } catch (error) {
      console.error(
        `[UserRepository] Error fetching achievements for user ${userId}:`,
        error
      );
      // Return empty array on error so profile still loads
      return [];
    }
  }

  /**
   * Apply filters to user list
   */
  private applyFilters(
    users: EnhancedUserProfile[],
    options?: CreatorQueryOptions
  ): EnhancedUserProfile[] {
    if (!options?.filter || options.filter === "all") {
      return users;
    }

    switch (options.filter) {
      case "featured":
        return users.filter((u) => u.isFeatured);
      case "most-sequences":
        return users.filter((u) => u.sequenceCount > 0);
      case "highest-level":
        return users.filter((u) => u.currentLevel > 1);
      case "most-followers":
        return users.filter((u) => u.followerCount > 0);
      case "newest":
        return users; // Will be sorted by join date
      default:
        return users;
    }
  }

  /**
   * Apply sorting to user list
   */
  private applySorting(
    users: EnhancedUserProfile[],
    options?: CreatorQueryOptions
  ): EnhancedUserProfile[] {
    if (!options?.sortBy) {
      return users;
    }

    const sorted = [...users];

    switch (options.sortBy) {
      case "lastActive":
        return sorted.sort(
          (a, b) =>
            (b.lastActiveAt?.getTime() ?? 0) -
            (a.lastActiveAt?.getTime() ?? 0)
        );
      case "joinedDate":
        return sorted.sort(
          (a, b) => b.joinedDate.getTime() - a.joinedDate.getTime()
        );
      default:
        return sorted;
    }
  }
}
