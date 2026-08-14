import { z } from "zod";

export const InstagramFeatureKeySchema = z.enum([
  "image",
  "reel",
  "carousel",
  "story",
  "trial-reel",
  "alt-text",
  "cover",
  "feed-distribution",
  "user-tags",
  "location",
  "collaborators",
  "product-tags",
  "partnership-labels",
  "ai-disclosure",
  "api-audio",
  "comments",
  "insights",
  "schedule",
]);

export type InstagramFeatureKey = z.infer<typeof InstagramFeatureKeySchema>;

export const InstagramCapabilityRecoveryActionSchema = z.enum([
  "none",
  "connect-instagram",
  "connect-facebook",
  "reconnect",
  "upgrade-account",
  "app-review-pending",
  "finish-in-instagram",
]);

export type InstagramCapabilityRecoveryAction = z.infer<
  typeof InstagramCapabilityRecoveryActionSchema
>;

export const InstagramCapabilityResultSchema = z
  .object({
    available: z.boolean(),
    reasonCode: z.string().trim().min(1).nullable(),
    recoveryAction: InstagramCapabilityRecoveryActionSchema,
  })
  .strict()
  .superRefine((result, context) => {
    if (result.available && result.reasonCode !== null) {
      context.addIssue({
        code: "custom",
        path: ["reasonCode"],
        message: "Available capabilities cannot carry a failure reason",
      });
    }
    if (result.available && result.recoveryAction !== "none") {
      context.addIssue({
        code: "custom",
        path: ["recoveryAction"],
        message: "Available capabilities cannot require recovery",
      });
    }
    if (!result.available && result.reasonCode === null) {
      context.addIssue({
        code: "custom",
        path: ["reasonCode"],
        message: "Unavailable capabilities need a stable reason",
      });
    }
  });

export type InstagramCapabilityResult = z.infer<
  typeof InstagramCapabilityResultSchema
>;

export const InstagramCapabilitySnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().trim().min(1),
    accountId: z.string().trim().min(1),
    username: z.string().trim().min(1),
    accountType: z.enum(["BUSINESS", "CREATOR", "UNKNOWN"]),
    route: z.enum(["instagram-login", "facebook-login"]),
    graphVersion: z.string().regex(/^v\d+\.\d+$/),
    appAccess: z.enum(["standard", "advanced", "unknown"]),
    permissions: z.record(
      z.string().trim().min(1),
      z.enum(["granted", "declined", "expired", "unknown"])
    ),
    features: z.record(
      InstagramFeatureKeySchema,
      InstagramCapabilityResultSchema
    ),
    verifiedAtMs: z.number().finite().int().nonnegative(),
    expiresAtMs: z.number().finite().int().nonnegative(),
  })
  .strict();

export type InstagramCapabilitySnapshot = z.infer<
  typeof InstagramCapabilitySnapshotSchema
>;
