import { z } from "zod";

const NonEmptyIdSchema = z.string().trim().min(1);
const NormalizedCoordinateSchema = z.number().finite().min(0).max(1);

export const StorageTimestampSchema = z.union([
  z.number().finite().int().nonnegative(),
  z
    .object({
      seconds: z.number().finite().int().nonnegative(),
      nanoseconds: z.number().finite().int().min(0).max(999_999_999),
    })
    .strict(),
]);

export type StorageTimestamp = z.infer<typeof StorageTimestampSchema>;

export const RenderedArtifactRevisionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: NonEmptyIdSchema,
    ownerId: NonEmptyIdSchema,
    compositionProjectId: NonEmptyIdSchema.nullable(),
    compositionRevisionId: NonEmptyIdSchema,
    sourceSequenceId: NonEmptyIdSchema.nullable(),
    kind: z.enum(["image", "video"]),
    mimeType: z.enum(["image/jpeg", "video/mp4"]),
    width: z.number().finite().int().positive(),
    height: z.number().finite().int().positive(),
    durationSeconds: z.number().finite().positive().nullable(),
    hasAudio: z.boolean(),
    byteLength: z.number().finite().int().nonnegative(),
    sha256: z.string().trim().min(32).max(128),
    storageObjectId: NonEmptyIdSchema,
    createdAt: StorageTimestampSchema,
  })
  .strict()
  .superRefine((artifact, context) => {
    if (artifact.kind === "image" && artifact.mimeType !== "image/jpeg") {
      context.addIssue({
        code: "custom",
        path: ["mimeType"],
        message: "Image artifacts must be JPEG",
      });
    }
    if (artifact.kind === "video" && artifact.mimeType !== "video/mp4") {
      context.addIssue({
        code: "custom",
        path: ["mimeType"],
        message: "Video artifacts must be MP4",
      });
    }
    if (artifact.kind === "image" && artifact.durationSeconds !== null) {
      context.addIssue({
        code: "custom",
        path: ["durationSeconds"],
        message: "Still images cannot carry a duration",
      });
    }
  });

export type RenderedArtifactRevision = z.infer<
  typeof RenderedArtifactRevisionSchema
>;

export const PostMediaItemDraftSchema = z
  .object({
    id: NonEmptyIdSchema,
    artifactRevisionId: NonEmptyIdSchema,
    order: z.number().finite().int().nonnegative(),
    altText: z.string().trim().max(1_000).nullable(),
    cropPreviewRevision: NonEmptyIdSchema,
  })
  .strict();

export type PostMediaItemDraft = z.infer<typeof PostMediaItemDraftSchema>;

export const InstagramPublishOptionsSchema = z
  .object({
    shareToFeed: z.boolean().nullable(),
    cover: z
      .union([
        z
          .object({
            kind: z.literal("designed"),
            artifactRevisionId: NonEmptyIdSchema,
          })
          .strict(),
        z
          .object({
            kind: z.literal("frame"),
            offsetMs: z.number().finite().int().nonnegative(),
          })
          .strict(),
      ])
      .nullable(),
    originalAudioName: z.string().trim().min(1).max(100).nullable(),
    attachedAudio: z
      .object({
        audioId: NonEmptyIdSchema,
        title: z.string().trim().min(1).max(200),
        artist: z.string().trim().min(1).max(200).nullable(),
        durationMs: z.number().finite().int().positive(),
        audioVolume: z.number().finite().int().min(1).max(100),
        videoVolume: z.number().finite().int().min(1).max(100),
      })
      .strict()
      .nullable(),
    trial: z
      .object({
        graduationStrategy: z.enum(["MANUAL", "SS_PERFORMANCE"]),
      })
      .strict()
      .nullable(),
    collaborators: z.array(z.string().trim().min(1).max(30)).max(3),
    userTags: z
      .array(
        z
          .object({
            username: z.string().trim().min(1).max(30),
            x: NormalizedCoordinateSchema.nullable(),
            y: NormalizedCoordinateSchema.nullable(),
          })
          .strict()
      )
      .max(20),
    locationId: NonEmptyIdSchema.nullable(),
    productTags: z.array(
      z
        .object({
          productId: NonEmptyIdSchema,
          x: NormalizedCoordinateSchema.nullable(),
          y: NormalizedCoordinateSchema.nullable(),
        })
        .strict()
    ),
    aiGenerated: z.boolean().nullable(),
    paidPartnership: z.boolean(),
    sponsorIds: z.array(NonEmptyIdSchema).max(2),
  })
  .strict();

export type InstagramPublishOptions = z.infer<
  typeof InstagramPublishOptionsSchema
>;

export const DeliveryIntentSchema = z.union([
  z.object({ mode: z.literal("handoff") }).strict(),
  z.object({ mode: z.literal("publish-now") }).strict(),
  z
    .object({
      mode: z.literal("scheduled"),
      scheduledForUtc: z.string().datetime({ offset: true }),
      displayTimeZone: z.string().trim().min(1).max(100),
    })
    .strict(),
]);

export type DeliveryIntent = z.infer<typeof DeliveryIntentSchema>;

export const PostDeliveryDraftSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: NonEmptyIdSchema,
    ownerId: NonEmptyIdSchema,
    sourceSequenceId: NonEmptyIdSchema.nullable(),
    recipeId: NonEmptyIdSchema.nullable(),
    format: z.enum(["image", "reel", "carousel", "story"]),
    items: z.array(PostMediaItemDraftSchema).min(1).max(10),
    caption: z.string().max(2_200),
    instagram: InstagramPublishOptionsSchema,
    delivery: DeliveryIntentSchema,
    selectedAccountId: NonEmptyIdSchema.nullable(),
    capabilitySnapshotId: NonEmptyIdSchema.nullable(),
    createdAt: StorageTimestampSchema,
    updatedAt: StorageTimestampSchema,
  })
  .strict()
  .superRefine((draft, context) => {
    if (draft.format === "carousel" && draft.items.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Carousels need at least two items",
      });
    }
    if (draft.format !== "carousel" && draft.items.length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Only carousels can contain multiple items",
      });
    }
    const orders = draft.items.map((item) => item.order);
    const expected = draft.items.map((_, index) => index);
    if (orders.some((order, index) => order !== expected[index])) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Media item order must be contiguous and zero-based",
      });
    }
    if (draft.format !== "reel") {
      for (const [field, value] of [
        ["shareToFeed", draft.instagram.shareToFeed],
        ["cover", draft.instagram.cover],
        ["originalAudioName", draft.instagram.originalAudioName],
        ["attachedAudio", draft.instagram.attachedAudio],
        ["trial", draft.instagram.trial],
      ] as const) {
        if (value !== null) {
          context.addIssue({
            code: "custom",
            path: ["instagram", field],
            message: `${field} applies only to Reels`,
          });
        }
      }
    }
  });

export type PostDeliveryDraft = z.infer<typeof PostDeliveryDraftSchema>;
