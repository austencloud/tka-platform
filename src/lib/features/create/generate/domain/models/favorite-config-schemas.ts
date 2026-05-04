import { z } from "zod";
import { firestoreDate } from "$lib/shared/firestore";

export const FavoriteConfigSchema = z
  .object({
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
