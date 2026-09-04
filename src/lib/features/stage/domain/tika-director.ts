import { z } from "zod";

export const TIKA_DIRECTOR_FORMATIONS = [
  "line",
  "triangle",
  "diamond",
  "circle",
  "v-shape",
  "grid",
  "grid-2x2",
  "stagger",
  "cluster",
  "diagonal",
  "solo",
  "tunnel-stack",
  "back-to-back",
  "facing-each-other",
  "stage-lr",
  "side-by-side",
] as const;

export const TikaDirectorFormationSchema = z.enum(TIKA_DIRECTOR_FORMATIONS);

export const TikaDirectorActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("assign-distinct-props") }).strict(),
  z.object({ type: z.literal("assign-distinct-characters") }).strict(),
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
    content: z.string().min(1).max(1_000),
  })
  .strict();

export const TikaDirectorRequestSchema = z
  .object({
    prompt: z.string().trim().min(1).max(2_000),
    conversation: z.array(TikaDirectorConversationMessageSchema).max(8),
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
      })
      .strict(),
  })
  .strict();

export type TikaDirectorFormation = z.infer<typeof TikaDirectorFormationSchema>;
export type TikaDirectorAction = z.infer<typeof TikaDirectorActionSchema>;
export type TikaDirectorResponse = z.infer<typeof TikaDirectorResponseSchema>;
export type TikaDirectorRequest = z.infer<typeof TikaDirectorRequestSchema>;
export type TikaDirectorConversationMessage =
  TikaDirectorRequest["conversation"][number];
