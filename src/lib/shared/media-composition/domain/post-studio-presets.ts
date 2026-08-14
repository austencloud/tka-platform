import {
  MediaCompositionPresetSchema,
  type MediaCompositionPreset,
  type PresetClip,
  type PresetSourceRole,
} from "$lib/shared/media-composition/domain/media-composition-preset-schema";
import type { LayoutRegion } from "$lib/shared/media-composition/domain/media-layout-schema";

const OUTPUT = {
  width: 1080,
  height: 1920,
  frameRate: 30,
  backgroundColor: "#08080c",
} as const;

const FULL_DURATION = {
  start: { unit: "duration-fraction", value: 0 },
  end: { unit: "duration-fraction", value: 1 },
  sourceIn: { unit: "duration-fraction", value: 0 },
  sourceOut: { unit: "duration-fraction", value: 1 },
  playbackRate: 1,
  loop: false,
} as const;

const DEFAULT_TRANSFORM = {
  scale: 1,
  rotationDegrees: 0,
  translateX: 0,
  translateY: 0,
} as const;

export const POST_STUDIO_ROLE = {
  performance: "performance-video",
  animation: "sequence-animation",
  card: "choreo-card",
} as const;

export type PostStudioRoleKey =
  (typeof POST_STUDIO_ROLE)[keyof typeof POST_STUDIO_ROLE];

function role(
  key: PostStudioRoleKey,
  label: string,
  resolution: PresetSourceRole["resolution"],
  acceptedKinds: PresetSourceRole["acceptedKinds"]
): PresetSourceRole {
  return { key, label, acceptedKinds, required: true, resolution };
}

function region(
  id: string,
  label: string,
  geometry: Pick<LayoutRegion, "x" | "y" | "width" | "height">,
  fit: LayoutRegion["fit"]
): LayoutRegion {
  return {
    id,
    label,
    ...geometry,
    zIndex: 0,
    fit,
    clipContent: true,
    respectSafeArea: false,
  };
}

function visualClip(
  id: string,
  sourceRole: PostStudioRoleKey,
  regionId: string
): PresetClip {
  return {
    id,
    kind: "visual",
    sourceRole,
    regionId,
    ...FULL_DURATION,
    opacity: 1,
    transform: DEFAULT_TRANSFORM,
    // Every sequence-derived visual reads the same resolved timeline. The
    // performance clip uses it for media sync, the animation for fractional
    // motion, and the card for its highlighted pictograph.
    useResolvedTimeMap: true,
  };
}

function fractionVisualClip(
  id: string,
  sourceRole: PostStudioRoleKey,
  regionId: string,
  start: number,
  end: number
): PresetClip {
  return {
    ...visualClip(id, sourceRole, regionId),
    start: { unit: "duration-fraction", value: start },
    end: { unit: "duration-fraction", value: end },
    sourceIn: { unit: "duration-fraction", value: start },
    sourceOut: { unit: "duration-fraction", value: end },
  };
}

function preset(
  input: Omit<
    MediaCompositionPreset,
    | "schemaVersion"
    | "ownerId"
    | "createdAt"
    | "updatedAt"
    | "output"
    | "transitions"
    | "audioMix"
    | "targetDefaults"
  > & {
    transitions?: MediaCompositionPreset["transitions"];
  }
): MediaCompositionPreset {
  return MediaCompositionPresetSchema.parse({
    schemaVersion: 1,
    ownerId: "tka-system",
    createdAt: 0,
    updatedAt: 0,
    output: OUTPUT,
    transitions: [],
    audioMix: { masterGain: 1, tracks: [] },
    targetDefaults: {
      instagram: { delivery: "handoff", coverFrameSeconds: 0 },
    },
    ...input,
  });
}

const CARD_ROLE = role(
  POST_STUDIO_ROLE.card,
  "Choreo card",
  "linked-choreo-card",
  ["choreo-card"]
);
const ANIMATION_ROLE = role(
  POST_STUDIO_ROLE.animation,
  "Sequence animation",
  "linked-sequence-animation",
  ["sequence-animation"]
);
const PERFORMANCE_ROLE = role(
  POST_STUDIO_ROLE.performance,
  "Performance video",
  "selected-video",
  ["video"]
);

/**
 * The four structural starting points shown in Post Studio. They bind by role,
 * never by one sequence's concrete URLs, so the same preset can be reused.
 */
export const POST_STUDIO_PRESETS: readonly MediaCompositionPreset[] = [
  preset({
    id: "sequence-breakdown",
    name: "Sequence breakdown",
    description: "Animation above the full choreo card.",
    duration: { mode: "fixed", seconds: 8 },
    sourceRoles: [ANIMATION_ROLE, CARD_ROLE],
    regions: [
      region(
        "motion",
        "Animation",
        { x: 0, y: 0, width: 1, height: 0.56 },
        "cover"
      ),
      region(
        "card",
        "Choreo card",
        { x: 0, y: 0.56, width: 1, height: 0.44 },
        "contain"
      ),
    ],
    clips: [
      visualClip("animation", POST_STUDIO_ROLE.animation, "motion"),
      visualClip("card", POST_STUDIO_ROLE.card, "card"),
    ],
  }),
  preset({
    id: "performance-breakdown",
    name: "Performance breakdown",
    description: "Performance above the choreo card.",
    duration: {
      mode: "follow-source-role",
      sourceRole: POST_STUDIO_ROLE.performance,
    },
    sourceRoles: [PERFORMANCE_ROLE, ANIMATION_ROLE, CARD_ROLE],
    regions: [
      region(
        "performance",
        "Performance",
        { x: 0, y: 0, width: 1, height: 0.6 },
        "cover"
      ),
      region(
        "card",
        "Choreo card",
        { x: 0, y: 0.6, width: 1, height: 0.4 },
        "contain"
      ),
    ],
    clips: [
      fractionVisualClip(
        "performance",
        POST_STUDIO_ROLE.performance,
        "performance",
        0,
        0.56
      ),
      fractionVisualClip(
        "performance-animation",
        POST_STUDIO_ROLE.animation,
        "performance",
        0.44,
        1
      ),
      visualClip("card", POST_STUDIO_ROLE.card, "card"),
    ],
    transitions: [
      {
        id: "performance-to-animation",
        kind: "crossfade",
        outgoingClipId: "performance",
        incomingClipId: "performance-animation",
        start: { unit: "duration-fraction", value: 0.44 },
        end: { unit: "duration-fraction", value: 0.56 },
        curve: "ease-in-out",
      },
    ],
  }),
  preset({
    id: "motion-focus",
    name: "Motion focus",
    description: "The sequence animation fills the vertical frame.",
    duration: { mode: "fixed", seconds: 8 },
    sourceRoles: [ANIMATION_ROLE],
    regions: [
      region(
        "motion",
        "Animation",
        { x: 0, y: 0, width: 1, height: 1 },
        "contain"
      ),
    ],
    clips: [visualClip("animation", POST_STUDIO_ROLE.animation, "motion")],
  }),
  preset({
    id: "card-focus",
    name: "Card focus",
    description: "The full choreo card, framed for a Reel.",
    duration: { mode: "fixed", seconds: 5 },
    sourceRoles: [CARD_ROLE],
    regions: [
      region(
        "card",
        "Choreo card",
        { x: 0, y: 0, width: 1, height: 1 },
        "contain"
      ),
    ],
    clips: [visualClip("card", POST_STUDIO_ROLE.card, "card")],
  }),
];
