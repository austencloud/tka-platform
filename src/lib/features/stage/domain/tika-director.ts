import { z } from "zod";
import {
  TikaDirectorFormationSchema,
  TikaDirectorPresentationSchema,
} from "./tika-director-vocabulary";

export const TIKA_DIRECTOR_MAX_HISTORY = 40;

export * from "./tika-director-vocabulary";

export const TikaDirectorActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("assign-distinct-props") }).strict(),
  z
    .object({
      type: z.literal("assign-distinct-characters"),
      /** Restrict the draw to avatars carrying this presentation label. */
      presentation: TikaDirectorPresentationSchema.optional(),
    })
    .strict(),
  z.object({ type: z.literal("assign-distinct-sequences") }).strict(),
  z
    .object({
      type: z.literal("formation-transition"),
      startFormation: TikaDirectorFormationSchema.optional(),
      endFormation: TikaDirectorFormationSchema,
      durationBeats: z.number().int().min(1).max(64),
    })
    .strict(),
]);

export const TikaDirectorResponseSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("apply"),
      summary: z.string().min(1).max(320),
      actions: z.array(TikaDirectorActionSchema).min(1).max(4),
    })
    .strict(),
  z
    .object({
      kind: z.literal("clarify"),
      question: z.string().min(1).max(320),
    })
    .strict(),
  z
    .object({
      kind: z.literal("unsupported"),
      message: z.string().min(1).max(320),
    })
    .strict(),
]);

const TikaDirectorConversationMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(2_000),
  })
  .strict();

export const TikaDirectorRequestSchema = z
  .object({
    prompt: z.string().trim().min(1).max(2_000),
    conversation: z
      .array(TikaDirectorConversationMessageSchema)
      .max(TIKA_DIRECTOR_MAX_HISTORY),
    scene: z
      .object({
        id: z.string().min(1).max(160),
        name: z.string().min(1).max(160),
        bpm: z.number().min(15).max(180),
        currentBeat: z.number().min(0),
        performers: z
          .array(
            z
              .object({
                id: z.string().min(1).max(160),
                label: z.string().min(1).max(80),
                characterId: z.string().min(1).max(160),
                prop: z.string().min(1).max(160),
              })
              .strict()
          )
          .min(1)
          .max(8),
        formations: z
          .array(
            z
              .object({
                atBeat: z.number().min(0),
                presetId: z.string().min(1).max(80).optional(),
              })
              .strict()
          )
          .max(100),
        /**
         * How many sequences the caller's library can lend the cast. The
         * planner refuses distinct sequences when this cannot cover the cast;
         * older clients omit it and the client-side pick reports the shortfall.
         */
        librarySequenceCount: z.number().int().min(0).optional(),
        /**
         * How many deployed avatars carry each presentation label, so the
         * planner can refuse a filtered cast the catalog cannot cover.
         */
        characterPresentationCounts: z
          .object({
            masculine: z.number().int().min(0),
            feminine: z.number().int().min(0),
            androgynous: z.number().int().min(0),
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict();

export type TikaDirectorAction = z.infer<typeof TikaDirectorActionSchema>;
export type TikaDirectorResponse = z.infer<typeof TikaDirectorResponseSchema>;
export type TikaDirectorRequest = z.infer<typeof TikaDirectorRequestSchema>;
export type TikaDirectorConversationMessage =
  TikaDirectorRequest["conversation"][number];
