import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
import { AnimationStateManager } from "$lib/shared/animation-engine/services/animation-state-manager";
import { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/sequence-animation-orchestrator";
import {
  mapThirdOrderChildStep,
  resolveThirdOrderGridPose,
  wrapThirdOrderBeat,
} from "../../domain/third-order-math";
import type {
  ThirdOrderCompositionDraft,
  ThirdOrderCompositionFrame,
} from "../../domain/third-order-composition";
import type { IThirdOrderCompositionSampler } from "../contracts/IThirdOrderCompositionSampler";

interface SequenceSampler {
  orchestrator: SequenceAnimationOrchestrator;
  totalSteps: number;
}

const DEFAULT_PROP: PropState = {
  centerPathAngle: 0,
  staffRotationAngle: 0,
};

export class ThirdOrderCompositionSampler implements IThirdOrderCompositionSampler {
  private samplers = new WeakMap<SequenceData, SequenceSampler>();

  sample(
    composition: ThirdOrderCompositionDraft,
    masterBeat: number
  ): ThirdOrderCompositionFrame {
    const carrierSampler = this.samplerFor(composition.carrier);
    const totalBeats = carrierSampler?.totalSteps ?? 0;
    const resolvedBeat = wrapThirdOrderBeat(masterBeat, totalBeats);
    const carrierProps = carrierSampler
      ? this.sampleTrack(carrierSampler, resolvedBeat)
      : { left: { ...DEFAULT_PROP }, right: { ...DEFAULT_PROP } };

    const lookAheadBeat = wrapThirdOrderBeat(resolvedBeat + 0.01, totalBeats);
    const nextCarrierProps = carrierSampler
      ? this.sampleTrack(carrierSampler, lookAheadBeat)
      : carrierProps;

    const children = composition.children.map((child) => {
      const childSampler = this.samplerFor(child.sequence);
      const childTotalSteps = childSampler?.totalSteps ?? 0;
      const childStep = mapThirdOrderChildStep(
        resolvedBeat,
        childTotalSteps,
        totalBeats,
        child.timingMode,
        child.rate
      );
      const props = childSampler
        ? this.sampleTrack(childSampler, childStep)
        : { left: { ...DEFAULT_PROP }, right: { ...DEFAULT_PROP } };
      const carrier = carrierProps[child.lane];
      const nextCarrier = nextCarrierProps[child.lane];

      return {
        ...child,
        props,
        step: childStep,
        totalSteps: childTotalSteps,
        pose: resolveThirdOrderGridPose(
          carrier,
          nextCarrier,
          child.orientationMode
        ),
      };
    });

    // Sampling the look-ahead pose advances the carrier sampler internally.
    // Return it to the visible beat so effects that read it later see the frame
    // the user is looking at, not the derivative probe.
    if (carrierSampler) this.sampleTrack(carrierSampler, resolvedBeat);

    return {
      masterBeat: resolvedBeat,
      totalBeats,
      carrierProps,
      children,
    };
  }

  clear(): void {
    this.samplers = new WeakMap<SequenceData, SequenceSampler>();
  }

  private samplerFor(sequence: SequenceData): SequenceSampler | null {
    const cached = this.samplers.get(sequence);
    if (cached) return cached;

    const orchestrator = new SequenceAnimationOrchestrator(
      new AnimationStateManager()
    );
    if (!orchestrator.initializeWithDomainData(sequence)) return null;

    const sampler = {
      orchestrator,
      totalSteps: orchestrator.getMetadata().totalSteps,
    };
    this.samplers.set(sequence, sampler);
    return sampler;
  }

  private sampleTrack(
    sampler: SequenceSampler,
    step: number
  ): { left: PropState; right: PropState } {
    sampler.orchestrator.calculateState(step);
    return sampler.orchestrator.getCurrentPropStates();
  }
}
