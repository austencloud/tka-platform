import { getTipPoints } from "$lib/shared/animation-engine/domain/types/prop-tip-points";
import { AnimationStateManager } from "$lib/shared/animation-engine/services/animation-state-manager";
import { calculatePropCenter } from "$lib/shared/animation-engine/services/prop-position-calculator";
import { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/sequence-animation-orchestrator";
import { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { resolveRecordedPropConfig } from "$lib/shared/foundation/services/recorded-prop-intent";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type {
  LocalPropFrame,
  MotionClip,
  PropStream,
} from "../../domain/motion-composition-types";
import type { IFacSequenceMotionClipSampler } from "../contracts/IFacSequenceMotionClipSampler";

const FAC_VIEWBOX_SIZE = 950;
const FAC_VIEWBOX_CENTER = FAC_VIEWBOX_SIZE / 2;

interface CachedSequenceSampler {
  orchestrator: SequenceAnimationOrchestrator;
}

function isPathShape(value: unknown): value is "arc" | "linear" | "concave" {
  return value === "arc" || value === "linear" || value === "concave";
}

export class FacSequenceMotionClipSampler implements IFacSequenceMotionClipSampler {
  private samplers = new WeakMap<SequenceData, CachedSequenceSampler>();

  sample(
    clip: MotionClip,
    stream: PropStream,
    localBeat: number
  ): LocalPropFrame | undefined {
    if (clip.kind !== "fac-sequence") return undefined;
    if (stream.channelId !== "left" && stream.channelId !== "right") {
      throw new Error(
        `FAC sequence channel must be left or right, received ${stream.channelId}`
      );
    }

    const cached = this.samplerFor(clip.sequence);
    const propState =
      cached.orchestrator.samplePropStateAt(localBeat)[stream.channelId];
    const recordedProps = resolveRecordedPropConfig(clip.sequence);
    const propType =
      stream.style.propType ??
      (stream.channelId === "left"
        ? recordedProps?.leftPropType
        : recordedProps?.rightPropType) ??
      PropType.STAFF;
    const center = calculatePropCenter(propState, {
      canvasSize: FAC_VIEWBOX_SIZE,
      propDimensions: { width: 0, height: 0 },
    });
    const halfAngle = -propState.staffRotationAngle / 2;
    const tipPoints = getTipPoints(propType).points;

    return {
      transform: {
        translation: [
          center.x - FAC_VIEWBOX_CENTER,
          FAC_VIEWBOX_CENTER - center.y,
          0,
        ],
        rotation: [0, 0, Math.sin(halfAngle), Math.cos(halfAngle)],
        scale: [1, 1, 1],
      },
      endpoints:
        tipPoints.length > 0
          ? tipPoints.map((point, index) => ({
              id: `tip:${index}`,
              position: [point.dx, -point.dy, 0] as const,
            }))
          : [{ id: "center", position: [0, 0, 0] }],
    };
  }

  clear(): void {
    this.samplers = new WeakMap<SequenceData, CachedSequenceSampler>();
  }

  private samplerFor(sequence: SequenceData): CachedSequenceSampler {
    const cached = this.samplers.get(sequence);
    if (cached) return cached;

    const visibility = new AnimationVisibilityStateManager({ ephemeral: true });
    const pathShape = sequence.metadata.pathShape;
    if (isPathShape(pathShape)) visibility.setPathShape(pathShape);
    visibility.setMotionAwarePaths(sequence.metadata.motionAwarePaths === true);

    const orchestrator = new SequenceAnimationOrchestrator(
      new AnimationStateManager()
    );
    orchestrator.setVisibilityManager(visibility);
    if (!orchestrator.initializeWithDomainData(sequence)) {
      throw new Error(`FAC sequence ${sequence.id} cannot be sampled`);
    }

    const created = { orchestrator };
    this.samplers.set(sequence, created);
    return created;
  }
}
