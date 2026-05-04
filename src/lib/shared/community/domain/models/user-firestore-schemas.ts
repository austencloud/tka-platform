import { z } from "zod";
import { firestoreDate } from "$lib/shared/firestore";

/**
 * Zod schema matching the FirestoreUserData interface in user-repository.ts.
 * Uses .passthrough() to allow extra/legacy fields through.
 */
export const UserFirestoreDataSchema = z
  .object({
    id: z.string(),
    displayName: z.string().optional(),
    name: z.string().optional(),
    username: z.string().optional(),
    email: z.string().optional(),
    photoURL: z.string().optional(),
    avatar: z.string().optional(),
    sequenceCount: z.number().optional(),
    collectionCount: z.number().optional(),
    followerCount: z.number().optional(),
    followingCount: z.number().optional(),
    createdAt: firestoreDate.optional(),
    totalXP: z.number().optional(),
    currentLevel: z.number().optional(),
    achievementCount: z.number().optional(),
    currentStreak: z.number().optional(),
    longestStreak: z.number().optional(),
    isFeatured: z.boolean().optional(),
    bio: z.string().optional(),
    instagramUsername: z.string().optional(),
    pronouns: z.string().optional(),
    lastActivityDate: firestoreDate.optional(),
    profileColor: z.string().optional(),
    role: z.enum(["user", "premium", "tester", "admin"]).optional(),
    isDisabled: z.boolean().optional(),
    isHidden: z.boolean().optional(),
    adminLabel: z.string().optional(),
    adminNotes: z.string().optional(),
  })
  .passthrough();

export type UserFirestoreDataParsed = z.infer<typeof UserFirestoreDataSchema>;

/**
 * Minimal schema for user achievement docs in subcollections.
 * Used by firestoreList to parse achievement records.
 */
export const UserAchievementFirestoreSchema = z
  .object({
    id: z.string(),
    achievementId: z.string(),
    isCompleted: z.boolean(),
    unlockedAt: firestoreDate.optional(),
    progress: z.number().optional(),
    notificationShown: z.boolean().optional(),
  })
  .passthrough();

export type UserAchievementFirestoreParsed = z.infer<
  typeof UserAchievementFirestoreSchema
>;

/**
 * Minimal schema for follow subcollection docs (just need the id).
 */
export const FollowDocSchema = z
  .object({
    id: z.string(),
    createdAt: firestoreDate.optional(),
  })
  .passthrough();

export type FollowDocParsed = z.infer<typeof FollowDocSchema>;
