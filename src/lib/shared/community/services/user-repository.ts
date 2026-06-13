/**
 * User Repository - Fetches user data from Firebase Firestore
 *
 * Includes gamification data, social features, and follow/unfollow functionality
 * with atomic Firestore transactions.
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
import { firestoreGet, firestoreList } from "$lib/shared/firestore";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import { getUserAchievementsPath } from "$lib/shared/gamification/data/firestore-collections";
import { ALL_ACHIEVEMENTS } from "$lib/shared/gamification/domain/constants/achievement-definitions";
import type {
  Achievement,
} from "$lib/shared/gamification/domain/models/achievement-models";
import type { PaginatedUsersResult, PaginatedQueryOptions } from "./types";
import type {
  EnhancedUserProfile,
  UserProfile,
  CreatorQueryOptions,
  CreatorSortCriteria,
} from "../domain/models/enhanced-user-profile";
import type { UserRole } from "$lib/shared/auth/domain/models/user-role";
import {
  UserFirestoreDataSchema,
  UserAchievementFirestoreSchema,
  FollowDocSchema,
} from "../domain/models/user-firestore-schemas";
import type { UserFirestoreDataParsed } from "../domain/models/user-firestore-schemas";

// ============================================================================
// INTERNAL TYPES
// ============================================================================

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
  profileColor?: string;
  role?: UserRole;
  isDisabled?: boolean;
  isHidden?: boolean;
  adminLabel?: string;
  adminNotes?: string;
}

interface FollowDocument {
  createdAt: Timestamp;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const USERS_COLLECTION = "users";

const SORT_FIELD_MAP: Record<CreatorSortCriteria, string> = {
  lastActive: "lastActivityDate",
  joinedDate: "createdAt",
  favoriteProp: "favoriteProp",
};

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

async function getFollowingIds(userId: string): Promise<Set<string>> {
  try {
    const docs = await firestoreList(
      `${USERS_COLLECTION}/${userId}/following`,
      FollowDocSchema,
      { limit: 500 },
    );
    return new Set(docs.map((d) => d.id));
  } catch (error) {
    console.error(`[UserRepository] Error getting following IDs:`, error);
    return new Set();
  }
}

async function fetchUserTopAchievements(userId: string): Promise<Achievement[]> {
  try {
    const achievementsPath = getUserAchievementsPath(userId);

    const userAchievements = await firestoreList(
      achievementsPath,
      UserAchievementFirestoreSchema,
      {
        where: [{ field: "isCompleted", op: "==", value: true }],
        orderBy: [{ field: "unlockedAt", direction: "desc" }],
        limit: 5,
      },
    );

    const achievements: Achievement[] = [];

    for (const userAch of userAchievements) {
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
    return [];
  }
}

async function mapFirestoreToEnhancedProfile(
  userId: string,
  data: FirestoreUserData | UserFirestoreDataParsed,
  isFollowing = false,
  skipAchievements = false
): Promise<EnhancedUserProfile | null> {
  try {
    const displayName = data.displayName ?? data.name ?? "Anonymous User";
    const username =
      data.username ?? data.email?.split("@")[0] ?? userId.substring(0, 8);
    const avatar = data.photoURL ?? data.avatar ?? undefined;

    const sequenceCount = data.sequenceCount ?? 0;
    const collectionCount = data.collectionCount ?? 0;
    const followerCount = data.followerCount ?? 0;
    const followingCount = data.followingCount ?? 0;

    const rawCreatedAt = data.createdAt;
    const joinedDate =
      rawCreatedAt instanceof Date
        ? rawCreatedAt
        : rawCreatedAt && typeof rawCreatedAt === "object" && "toDate" in rawCreatedAt
          ? (rawCreatedAt as Timestamp).toDate()
          : new Date();
    const rawLastActivity = data.lastActivityDate;
    const lastActiveAt =
      rawLastActivity instanceof Date
        ? rawLastActivity
        : rawLastActivity && typeof rawLastActivity === "object" && "toDate" in rawLastActivity
          ? (rawLastActivity as Timestamp).toDate()
          : joinedDate;

    const totalXP = data.totalXP ?? 0;
    const currentLevel = data.currentLevel ?? 1;
    const achievementCount = data.achievementCount ?? 0;
    const currentStreak = data.currentStreak ?? 0;
    const longestStreak = data.longestStreak ?? 0;
    const isFeatured = data.isFeatured ?? false;
    const bio = data.bio ?? undefined;
    const instagramUsername = data.instagramUsername ?? undefined;
    const pronouns = data.pronouns ?? undefined;
    const profileColor = data.profileColor ?? undefined;

    const role = data.role ?? "user";
    const isDisabled = data.isDisabled ?? false;
    const isHidden = data.isHidden ?? false;
    const adminLabel = data.adminLabel ?? undefined;
    const adminNotes = data.adminNotes ?? undefined;

    const topAchievements = skipAchievements
      ? []
      : await fetchUserTopAchievements(userId);

    return {
      id: userId,
      username,
      displayName,
      avatar,
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

async function batchFetchUserProfiles(
  firestore: Awaited<ReturnType<typeof getFirestoreInstance>>,
  userIds: string[]
): Promise<UserProfile[]> {
  const users: UserProfile[] = [];
  const BATCH_SIZE = 30;

  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const chunk = userIds.slice(i, i + BATCH_SIZE);
    const usersRef = collection(firestore, USERS_COLLECTION);
    const batchQuery = query(usersRef, where(documentId(), "in", chunk));
    const batchSnapshot = await getDocs(batchQuery);

    for (const docSnap of batchSnapshot.docs) {
      const data = docSnap.data() as FirestoreUserData;
      const user = await mapFirestoreToEnhancedProfile(
        docSnap.id,
        data,
        false,
        true
      );
      if (user) {
        users.push(user);
      }
    }
  }

  return users;
}

function applyFilters(
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
      return users;
    default:
      return users;
  }
}

function applySorting(
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
          (b.lastActiveAt?.getTime() ?? 0) - (a.lastActiveAt?.getTime() ?? 0)
      );
    case "joinedDate":
      return sorted.sort(
        (a, b) => b.joinedDate.getTime() - a.joinedDate.getTime()
      );
    default:
      return sorted;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function getUserProfile(
  userId: string,
  currentUserId?: string
): Promise<EnhancedUserProfile | null> {
  try {
    const userData = await firestoreGet(
      USERS_COLLECTION,
      userId,
      UserFirestoreDataSchema,
    );

    if (!userData) {
      return null;
    }

    let isFollowing = false;
    if (currentUserId && currentUserId !== userId) {
      isFollowing = await checkIsFollowing(currentUserId, userId);
    }

    return mapFirestoreToEnhancedProfile(
      userId,
      userData,
      isFollowing
    );
  } catch (error) {
    console.error(`[UserRepository] Error fetching user ${userId}:`, error);
    return null;
  }
}

export async function getUsers(
  options?: CreatorQueryOptions,
  currentUserId?: string
): Promise<EnhancedUserProfile[]> {
  try {
    const firestore = await getFirestoreInstance();
    const usersRef = collection(firestore, USERS_COLLECTION);
    const limitValue = options?.limit ?? 100;
    const q = query(usersRef, firestoreLimit(limitValue));

    const querySnapshot = await getDocs(q);

    let followingSet = new Set<string>();
    if (currentUserId) {
      followingSet = await getFollowingIds(currentUserId);
    }

    const users: EnhancedUserProfile[] = [];

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data() as FirestoreUserData;
      const isFollowing =
        currentUserId !== docSnap.id && followingSet.has(docSnap.id);
      const user = await mapFirestoreToEnhancedProfile(
        docSnap.id,
        data,
        isFollowing,
        true
      );
      if (user) {
        users.push(user);
      }
    }

    let filteredUsers = applyFilters(users, options);
    filteredUsers = applySorting(filteredUsers, options);

    return filteredUsers;
  } catch (error) {
    console.error("[UserRepository] Error fetching users:", error);
    toast.error("Failed to load creators.");
    throw error;
  }
}

export async function getUsersPaginated(
  options: PaginatedQueryOptions,
  currentUserId?: string
): Promise<PaginatedUsersResult> {
  try {
    const firestore = await getFirestoreInstance();
    const usersRef = collection(firestore, USERS_COLLECTION);

    const sortField = SORT_FIELD_MAP[options.sortBy] || "lastActivityDate";
    const sortDirection = options.sortDirection === "asc" ? "asc" : "desc";

    let q = query(
      usersRef,
      orderBy(sortField, sortDirection),
      firestoreLimit(options.limit + 1)
    );

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

    const hasMore = docs.length > options.limit;
    const resultDocs = hasMore ? docs.slice(0, options.limit) : docs;

    const lastDoc = resultDocs[resultDocs.length - 1];
    const lastDocSnapshot: DocumentSnapshot | null = lastDoc ?? null;

    let followingSet = new Set<string>();
    if (currentUserId) {
      followingSet = await getFollowingIds(currentUserId);
    }

    const users: EnhancedUserProfile[] = [];

    for (const docSnap of resultDocs) {
      const data = docSnap.data() as FirestoreUserData;
      if (data.isHidden) continue;
      const isFollowing =
        currentUserId !== docSnap.id && followingSet.has(docSnap.id);
      const user = await mapFirestoreToEnhancedProfile(
        docSnap.id,
        data,
        isFollowing,
        true
      );
      if (user) {
        users.push(user);
      }
    }

    return { users, lastDocSnapshot, hasMore };
  } catch (error) {
    console.error("[UserRepository] Error fetching paginated users:", error);
    toast.error("Failed to load creators.");
    throw error;
  }
}

export async function getFeaturedCreators(
  limitCount = 10
): Promise<EnhancedUserProfile[]> {
  try {
    const results = await firestoreList(
      USERS_COLLECTION,
      UserFirestoreDataSchema,
      {
        where: [{ field: "isFeatured", op: "==", value: true }],
        orderBy: [{ field: "followerCount", direction: "desc" }],
        limit: limitCount,
      },
    );

    const users: EnhancedUserProfile[] = [];

    for (const data of results) {
      if (data.isHidden) continue;
      const user = await mapFirestoreToEnhancedProfile(
        data.id,
        data,
        false,
        true
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

export function subscribeToUsers(
  callback: (users: EnhancedUserProfile[]) => void,
  options?: CreatorQueryOptions,
  currentUserId?: string
): () => void {
  let unsubscribe: (() => void) | null = null;

  void (async () => {
    try {
      const firestore = await getFirestoreInstance();
      const usersRef = collection(firestore, USERS_COLLECTION);
      const limitValue = options?.limit ?? 100;
      const q = query(usersRef, firestoreLimit(limitValue));

      unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          void (async () => {
            try {
              let followingSet = new Set<string>();
              if (currentUserId) {
                followingSet = await getFollowingIds(currentUserId);
              }

              const users: EnhancedUserProfile[] = [];

              for (const docSnap of querySnapshot.docs) {
                const data = docSnap.data() as FirestoreUserData;
                if (data.isHidden) continue;
                const isFollowing =
                  currentUserId !== docSnap.id && followingSet.has(docSnap.id);
                const user = await mapFirestoreToEnhancedProfile(
                  docSnap.id,
                  data,
                  isFollowing,
                  true
                );
                if (user) {
                  users.push(user);
                }
              }

              let filteredUsers = applyFilters(users, options);
              filteredUsers = applySorting(filteredUsers, options);

              callback(filteredUsers);
            } catch (error) {
              console.error(
                "[UserRepository] Error processing creators snapshot:",
                error
              );
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

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}

export async function followUser(
  currentUserId: string,
  targetUserId: string
): Promise<void> {
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
            `${USERS_COLLECTION}/${currentUserId}/following/${targetUserId}`
          );
          const followersRef = doc(
            firestore,
            `${USERS_COLLECTION}/${targetUserId}/followers/${currentUserId}`
          );
          const currentUserRef = doc(
            firestore,
            USERS_COLLECTION,
            currentUserId
          );
          const targetUserRef = doc(
            firestore,
            USERS_COLLECTION,
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

export async function unfollowUser(
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
            `${USERS_COLLECTION}/${currentUserId}/following/${targetUserId}`
          );
          const followersRef = doc(
            firestore,
            `${USERS_COLLECTION}/${targetUserId}/followers/${currentUserId}`
          );
          const currentUserRef = doc(
            firestore,
            USERS_COLLECTION,
            currentUserId
          );
          const targetUserRef = doc(
            firestore,
            USERS_COLLECTION,
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
            followerCount: Math.max(
              0,
              (targetUserData.followerCount ?? 0) - 1
            ),
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

export async function checkIsFollowing(
  currentUserId: string,
  targetUserId: string
): Promise<boolean> {
  if (currentUserId === targetUserId) {
    return false;
  }

  try {
    const firestore = await getFirestoreInstance();
    const followingRef = doc(
      firestore,
      `${USERS_COLLECTION}/${currentUserId}/following/${targetUserId}`
    );
    const followingDoc = await getDoc(followingRef);
    return followingDoc.exists();
  } catch (error) {
    console.error(`[UserRepository] Error checking follow status:`, error);
    return false;
  }
}

export async function getFollowing(
  userId: string,
  limit = 50
): Promise<UserProfile[]> {
  try {
    const firestore = await getFirestoreInstance();
    const followingRef = collection(
      firestore,
      `${USERS_COLLECTION}/${userId}/following`
    );
    const q = query(followingRef, firestoreLimit(limit));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return [];
    }

    const userIds = querySnapshot.docs.map((docSnap) => docSnap.id);
    return batchFetchUserProfiles(firestore, userIds);
  } catch (error) {
    console.error(`[UserRepository] Error getting following list:`, error);
    toast.error("Failed to load following list.");
    return [];
  }
}

export async function getFollowers(
  userId: string,
  limit = 50
): Promise<UserProfile[]> {
  try {
    const firestore = await getFirestoreInstance();
    const followersRef = collection(
      firestore,
      `${USERS_COLLECTION}/${userId}/followers`
    );
    const q = query(followersRef, firestoreLimit(limit));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return [];
    }

    const userIds = querySnapshot.docs.map((docSnap) => docSnap.id);
    return batchFetchUserProfiles(firestore, userIds);
  } catch (error) {
    console.error(`[UserRepository] Error getting followers list:`, error);
    toast.error("Failed to load followers.");
    return [];
  }
}

export function subscribeToFollowStatus(
  currentUserId: string,
  targetUserId: string,
  callback: (isFollowing: boolean) => void
): () => void {
  if (currentUserId === targetUserId) {
    callback(false);
    return () => {};
  }

  let unsubscribe: (() => void) | null = null;

  void (async () => {
    try {
      const firestore = await getFirestoreInstance();
      const followingRef = doc(
        firestore,
        `${USERS_COLLECTION}/${currentUserId}/following/${targetUserId}`
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

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}
