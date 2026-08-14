import { z } from "zod";
import {
  ClipTransformSchema,
  LayoutRegionSchema,
  OutputFormatSchema,
  PublishTargetOverridesSchema,
} from "$lib/shared/media-composition/domain/media-layout-schema";
import {
  MediaSourceKindSchema,
  type MediaSourceKind,
} from "$lib/shared/media-composition/domain/media-source-schema";
import {
  PLAYBACK_MAX_BPM,
  PLAYBACK_MIN_BPM,
} from "$lib/shared/animation-engine/domain/constants/timing";

const NonEmptyIdSchema = z.string().trim().min(1);
const TimestampSchema = z.number().finite().int().nonnegative();
const SecondsSchema = z.number().finite().nonnegative();

export const PresetTimePointSchema = z.union([
  z
    .object({
      unit: z.literal("seconds"),
      value: SecondsSchema,
    })
    .strict(),
  z
    .object({
      unit: z.literal("duration-fraction"),
      value: z.number().finite().min(0).max(1),
    })
    .strict(),
]);

export type PresetTimePoint = z.infer<typeof PresetTimePointSchema>;

export const PresetSourceRoleSchema = z
  .object({
    key: NonEmptyIdSchema,
    label: z.string().trim().min(1),
    acceptedKinds: z.array(MediaSourceKindSchema).min(1),
    required: z.boolean(),
    resolution: z.enum([
      "selected-artifact",
      "selected-video",
      "linked-sequence-animation",
      "linked-choreo-card",
      "original-video-audio",
      "manual",
    ]),
  })
  .strict()
  .superRefine((role, context) => {
    if (new Set(role.acceptedKinds).size !== role.acceptedKinds.length) {
      context.addIssue({
        code: "custom",
        path: ["acceptedKinds"],
        message: "Accepted source kinds must be unique",
      });
    }

    const requiredKindByResolution: Partial<
      Record<typeof role.resolution, MediaSourceKind>
    > = {
      "selected-video": "video",
      "linked-sequence-animation": "sequence-animation",
      "linked-choreo-card": "choreo-card",
      "original-video-audio": "audio",
    };
    const requiredKind = requiredKindByResolution[role.resolution];
    if (requiredKind && !role.acceptedKinds.includes(requiredKind)) {
      context.addIssue({
        code: "custom",
        path: ["acceptedKinds"],
        message: `${role.resolution} roles must accept ${requiredKind}`,
      });
    }
  });

export type PresetSourceRole = z.infer<typeof PresetSourceRoleSchema>;

function validatePresetInterval(
  interval: { start: PresetTimePoint; end: PresetTimePoint },
  context: z.RefinementCtx
): void {
  if (interval.start.unit !== interval.end.unit) {
    context.addIssue({
      code: "custom",
      path: ["end"],
      message: "Preset interval endpoints must use the same unit",
    });
    return;
  }

  if (interval.end.value <= interval.start.value) {
    context.addIssue({
      code: "custom",
      path: ["end"],
      message: "Preset interval end must be after its start",
    });
  }
}

const PresetClipTimingFields = {
  start: PresetTimePointSchema,
  end: PresetTimePointSchema,
  sourceIn: PresetTimePointSchema,
  sourceOut: PresetTimePointSchema,
  playbackRate: z.number().finite().positive(),
  loop: z.boolean(),
};

export const PresetVisualClipSchema = z
  .object({
    id: NonEmptyIdSchema,
    kind: z.literal("visual"),
    sourceRole: NonEmptyIdSchema,
    regionId: NonEmptyIdSchema,
    ...PresetClipTimingFields,
    opacity: z.number().finite().min(0).max(1),
    transform: ClipTransformSchema,
    useResolvedTimeMap: z.boolean(),
    syncGroupId: NonEmptyIdSchema.optional(),
  })
  .strict()
  .superRefine((clip, context) => {
    validatePresetInterval(clip, context);
    validatePresetInterval(
      { start: clip.sourceIn, end: clip.sourceOut },
      context
    );
  });

export const PresetAudioClipSchema = z
  .object({
    id: NonEmptyIdSchema,
    kind: z.literal("audio"),
    sourceRole: NonEmptyIdSchema,
    ...PresetClipTimingFields,
  })
  .strict()
  .superRefine((clip, context) => {
    validatePresetInterval(clip, context);
    validatePresetInterval(
      { start: clip.sourceIn, end: clip.sourceOut },
      context
    );
  });

export const PresetClipSchema = z.union([
  PresetVisualClipSchema,
  PresetAudioClipSchema,
]);

export type PresetClip = z.infer<typeof PresetClipSchema>;

export const PresetTransitionSchema = z
  .object({
    id: NonEmptyIdSchema,
    kind: z.literal("crossfade"),
    outgoingClipId: NonEmptyIdSchema,
    incomingClipId: NonEmptyIdSchema,
    start: PresetTimePointSchema,
    end: PresetTimePointSchema,
    curve: z.enum(["linear", "ease-in-out"]),
  })
  .strict()
  .superRefine((transition, context) => {
    if (transition.outgoingClipId === transition.incomingClipId) {
      context.addIssue({
        code: "custom",
        path: ["incomingClipId"],
        message: "A preset transition needs two different clips",
      });
    }
    validatePresetInterval(transition, context);
  });

export const PresetDurationPolicySchema = z.union([
  z
    .object({
      mode: z.literal("fixed"),
      seconds: z.number().finite().positive(),
    })
    .strict(),
  z
    .object({
      mode: z.literal("follow-source-role"),
      sourceRole: NonEmptyIdSchema,
    })
    .strict(),
  z
    .object({
      mode: z.literal("sequence-tempo"),
      bpm: z.number().finite().min(PLAYBACK_MIN_BPM).max(PLAYBACK_MAX_BPM),
    })
    .strict(),
]);

export const PresetAudioMixTrackSchema = z
  .object({
    clipId: NonEmptyIdSchema,
    gain: z.number().finite().min(0).max(4),
    muted: z.boolean(),
    fadeInSeconds: SecondsSchema,
    fadeOutSeconds: SecondsSchema,
  })
  .strict();

export const MediaCompositionPresetSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: NonEmptyIdSchema,
    ownerId: NonEmptyIdSchema,
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    output: OutputFormatSchema,
    duration: PresetDurationPolicySchema,
    sourceRoles: z.array(PresetSourceRoleSchema).min(1),
    regions: z.array(LayoutRegionSchema),
    clips: z.array(PresetClipSchema).min(1),
    transitions: z.array(PresetTransitionSchema),
    audioMix: z
      .object({
        masterGain: z.number().finite().min(0).max(4),
        tracks: z.array(PresetAudioMixTrackSchema),
      })
      .strict(),
    targetDefaults: PublishTargetOverridesSchema,
  })
  .strict()
  .superRefine((preset, context) => {
    const roles = new Map(preset.sourceRoles.map((role) => [role.key, role]));
    const regions = new Set(preset.regions.map((region) => region.id));
    const clips = new Map(preset.clips.map((clip) => [clip.id, clip]));

    const uniqueCollections = [
      ["sourceRoles", preset.sourceRoles.map((role) => ({ id: role.key }))],
      ["regions", preset.regions],
      ["clips", preset.clips],
      ["transitions", preset.transitions],
    ] as const;

    for (const [path, items] of uniqueCollections) {
      const seen = new Set<string>();
      items.forEach((item, index) => {
        if (seen.has(item.id)) {
          context.addIssue({
            code: "custom",
            path: [path, index, path === "sourceRoles" ? "key" : "id"],
            message: `Duplicate ${path} id`,
          });
        }
        seen.add(item.id);
      });
    }

    preset.clips.forEach((clip, index) => {
      const role = roles.get(clip.sourceRole);
      if (!role) {
        context.addIssue({
          code: "custom",
          path: ["clips", index, "sourceRole"],
          message: "Preset clip source role does not exist",
        });
      } else if (
        clip.kind === "audio" &&
        !role.acceptedKinds.includes("audio")
      ) {
        context.addIssue({
          code: "custom",
          path: ["clips", index, "sourceRole"],
          message: "Audio clips need a role that accepts audio",
        });
      } else if (
        clip.kind === "visual" &&
        role.acceptedKinds.every((kind) => kind === "audio")
      ) {
        context.addIssue({
          code: "custom",
          path: ["clips", index, "sourceRole"],
          message: "Visual clips need a role that accepts visual media",
        });
      }

      if (clip.kind === "visual" && !regions.has(clip.regionId)) {
        context.addIssue({
          code: "custom",
          path: ["clips", index, "regionId"],
          message: "Preset visual clip region does not exist",
        });
      }
    });

    preset.transitions.forEach((transition, index) => {
      const outgoing = clips.get(transition.outgoingClipId);
      const incoming = clips.get(transition.incomingClipId);
      if (outgoing?.kind !== "visual") {
        context.addIssue({
          code: "custom",
          path: ["transitions", index, "outgoingClipId"],
          message: "Preset transition outgoing clip must be visual",
        });
      }
      if (incoming?.kind !== "visual") {
        context.addIssue({
          code: "custom",
          path: ["transitions", index, "incomingClipId"],
          message: "Preset transition incoming clip must be visual",
        });
      }
      if (
        outgoing?.kind === "visual" &&
        incoming?.kind === "visual" &&
        outgoing.regionId !== incoming.regionId
      ) {
        context.addIssue({
          code: "custom",
          path: ["transitions", index],
          message: "Crossfading preset clips must share a region",
        });
      }
    });

    preset.audioMix.tracks.forEach((track, index) => {
      const clip = clips.get(track.clipId);
      if (clip?.kind !== "audio") {
        context.addIssue({
          code: "custom",
          path: ["audioMix", "tracks", index, "clipId"],
          message: "Preset audio mix tracks must reference an audio clip",
        });
      }
    });

    if (
      preset.duration.mode === "follow-source-role" &&
      !roles.has(preset.duration.sourceRole)
    ) {
      context.addIssue({
        code: "custom",
        path: ["duration", "sourceRole"],
        message: "Preset duration source role does not exist",
      });
    }
  });

export type MediaCompositionPreset = z.infer<
  typeof MediaCompositionPresetSchema
>;
