import { z } from "zod";
import { firestoreDate } from "$lib/shared/firestore";

export const FavoriteConfigSchema = z
  .object({
    sourceSetupId: z.string().optional(),
    config: z.record(z.string(), z.unknown()),
    startEndOptions: z.record(z.string(), z.unknown()).nullable().optional(),
    setAt: firestoreDate,
  })
  .passthrough();

export type FavoriteConfig = z.infer<typeof FavoriteConfigSchema>;

export const CommunityFavoriteSchema = z
  .object({
    userId: z.string(),
    displayName: z.string(),
    avatar: z.string().optional(),
    config: z.record(z.string(), z.unknown()),
    startEndOptions: z.record(z.string(), z.unknown()).nullable().optional(),
    setAt: firestoreDate,
  })
  .passthrough();

export type CommunityFavorite = z.infer<typeof CommunityFavoriteSchema>;

/**
 * Minimal schema for reading a user doc that may contain a favoriteConfig field.
 * Used by firestoreGet/firestoreList to parse the raw Firestore user doc.
 */
export const UserWithFavoriteSchema = z
  .object({
    id: z.string(),
    favoriteConfig: z
      .object({
        sourceSetupId: z.string().optional(),
        config: z.record(z.string(), z.unknown()),
        startEndOptions: z.record(z.string(), z.unknown()).nullable().optional(),
        setAt: firestoreDate.optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    displayName: z.string().optional(),
    photoURL: z.string().optional(),
  })
  .passthrough();

export type UserWithFavorite = z.infer<typeof UserWithFavoriteSchema>;

export const SavedGeneratorSetupSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    config: z.record(z.string(), z.unknown()),
    startEndOptions: z.record(z.string(), z.unknown()).nullable().optional(),
    createdAt: firestoreDate.optional(),
    updatedAt: firestoreDate.optional(),
  })
  .passthrough();

export type SavedGeneratorSetupDoc = z.infer<
  typeof SavedGeneratorSetupSchema
>;
