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
  tunnel: "sequence-tunnel",
  scene3d: "sequence-scene-3d",
  mandala: "sequence-mandala",
} as const;

export type PostStudioRoleKey =
  (typeof POST_STUDIO_ROLE)[keyof typeof POST_STUDIO_ROLE];

/** How a layer element is built and how the compositor reads a frame from it. */
export type PostStudioRenderMode =
  | "external-media"
  | "sequence-animation"
  | "choreo-card"
  | "tunnel"
  | "scene-3d"
  | "mandala";

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
// These labels name a slot in the preview and an option in its source chooser,
// so they are the short spoken names — "Animation", not "Sequence animation".
const ANIMATION_ROLE = role(
  POST_STUDIO_ROLE.animation,
  "Animation",
  "linked-sequence-animation",
  ["sequence-animation"]
);
const PERFORMANCE_ROLE = role(
  POST_STUDIO_ROLE.performance,
  "Performance",
  "selected-video",
  ["video"]
);
const TUNNEL_ROLE = role(
  POST_STUDIO_ROLE.tunnel,
  "Tunnel",
  "linked-sequence-derived",
  ["tunnel"]
);
const SCENE_3D_ROLE = role(
  POST_STUDIO_ROLE.scene3d,
  "3D view",
  "linked-sequence-derived",
  ["scene-3d"]
);
const MANDALA_ROLE = role(
  POST_STUDIO_ROLE.mandala,
  "Mandala",
  "linked-sequence-derived",
  ["mandala"]
);

export interface PostStudioSource {
  readonly key: PostStudioRoleKey;
  readonly label: string;
  readonly role: PresetSourceRole;
  readonly renderMode: PostStudioRenderMode;
  /** Whether the source fills its slot or is letterboxed inside it. */
  readonly defaultFit: LayoutRegion["fit"];
  /**
   * A still image has no timeline of its own. The compositor renders one frame
   * and holds it, and the timeline lane draws it as a hold rather than a strip.
   */
  readonly isStill: boolean;
  /**
   * WebGL scenes are expensive enough that two live contexts in one preview is
   * a hardware-tier gamble, so 3D is limited to one slot at a time.
   */
  readonly exclusive: boolean;
  readonly clip: (id: string, regionId: string) => PresetClip;
}

function source(
  key: PostStudioRoleKey,
  presetRole: PresetSourceRole,
  renderMode: PostStudioRenderMode,
  defaultFit: LayoutRegion["fit"],
  options: { isStill?: boolean; exclusive?: boolean } = {}
): PostStudioSource {
  return {
    key,
    label: presetRole.label,
    role: presetRole,
    renderMode,
    defaultFit,
    isStill: options.isStill ?? false,
    exclusive: options.exclusive ?? false,
    clip: (id, regionId) => visualClip(id, key, regionId),
  };
}

/**
 * Every media type a slot can hold. This is the list the empty-slot chooser
 * renders and the only place a new source type has to be declared — the slot
 * verbs in `post-studio-slots.ts` read roles, fit and clip shape from here
 * rather than each carrying their own switch.
 */
export const POST_STUDIO_SOURCES: Readonly<
  Record<PostStudioRoleKey, PostStudioSource>
> = {
  [POST_STUDIO_ROLE.animation]: source(
    POST_STUDIO_ROLE.animation,
    ANIMATION_ROLE,
    "sequence-animation",
    "cover"
  ),
  [POST_STUDIO_ROLE.performance]: source(
    POST_STUDIO_ROLE.performance,
    PERFORMANCE_ROLE,
    "external-media",
    "cover"
  ),
  [POST_STUDIO_ROLE.card]: source(
    POST_STUDIO_ROLE.card,
    CARD_ROLE,
    "choreo-card",
    "contain"
  ),
  [POST_STUDIO_ROLE.tunnel]: source(
    POST_STUDIO_ROLE.tunnel,
    TUNNEL_ROLE,
    "tunnel",
    "cover"
  ),
  [POST_STUDIO_ROLE.scene3d]: source(
    POST_STUDIO_ROLE.scene3d,
    SCENE_3D_ROLE,
    "scene-3d",
    "cover",
    { exclusive: true }
  ),
  [POST_STUDIO_ROLE.mandala]: source(
    POST_STUDIO_ROLE.mandala,
    MANDALA_ROLE,
    "mandala",
    "contain",
    // The mandala is a whole-sequence fingerprint, not a frame at a time:
    // `SequenceMandala` declares a `currentStep` prop and never reads it.
    { isStill: true }
  ),
};

export const POST_STUDIO_SOURCE_ORDER: readonly PostStudioRoleKey[] = [
  POST_STUDIO_ROLE.animation,
  POST_STUDIO_ROLE.performance,
  POST_STUDIO_ROLE.card,
  POST_STUDIO_ROLE.tunnel,
  POST_STUDIO_ROLE.scene3d,
  POST_STUDIO_ROLE.mandala,
];

/**
 * Structural arrangements, kept as fixtures rather than as a product feature.
 * Post Studio no longer offers these as a template menu — a post is a top slot
 * and a bottom slot, both picked in the preview, which reaches every pairing
 * including the ones nobody enumerated here. `DEFAULT_POST_LAYOUT` is the one
 * the studio boots into; the rest exist for tests and for reference.
 *
 * They bind by role, never by one sequence's concrete URLs.
 */
export const POST_STUDIO_PRESETS: readonly MediaCompositionPreset[] = [
  preset({
    id: "sequence-breakdown",
    name: "Sequence breakdown",
    description: "Animation above the full choreo card.",
    duration: { mode: "sequence-tempo", bpm: 60 },
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
    duration: { mode: "sequence-tempo", bpm: 60 },
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

/** Animation over the choreo card — where every post starts before editing. */
export const DEFAULT_POST_LAYOUT: MediaCompositionPreset =
  POST_STUDIO_PRESETS.find((entry) => entry.id === "sequence-breakdown") ??
  POST_STUDIO_PRESETS[0]!;
