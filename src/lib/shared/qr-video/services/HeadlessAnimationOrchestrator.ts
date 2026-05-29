import { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/sequence-animation-orchestrator";
import { AnimationStateManager } from "$lib/shared/animation-engine/services/animation-state-manager";
import { PropInterpolator } from "$lib/shared/animation-engine/services/prop-interpolator";
import { createAngleCalculator } from "$lib/shared/animation-engine/services/angle-calculator";
import { EndpointCalculator } from "$lib/shared/animation-engine/services/endpoint-calculator";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

interface HeadlessConfig {
  bluePropType: PropType;
  redPropType: PropType;
  effortPreset?: string;
  pathShape?: string;
}

const HEADLESS_VISIBILITY_MANAGER: AnimationVisibilityStateManager = {
  getVisibility: () => true,
  setVisibility: () => {},
  isDarkMode: () => false,
  getPathShape: () => "arc",
  getEffortPreset: () => "glide",
  setSpeed: () => {},
  getSpeed: () => 1,
} as unknown as AnimationVisibilityStateManager;

export class HeadlessAnimationOrchestrator extends SequenceAnimationOrchestrator {
  private readonly headlessConfig: HeadlessConfig;

  constructor(config: HeadlessConfig) {
    const stateManager = new AnimationStateManager();
    const angleCalculator = createAngleCalculator();
    const endpointCalculator = new EndpointCalculator(angleCalculator);
    const propInterpolator = new PropInterpolator(angleCalculator, endpointCalculator);

    super(stateManager, propInterpolator);
    this.headlessConfig = config;

    const vm = {
      ...HEADLESS_VISIBILITY_MANAGER,
      getEffortPreset: () => config.effortPreset ?? "glide",
      getPathShape: () => config.pathShape ?? "arc",
    } as unknown as AnimationVisibilityStateManager;
    this.setVisibilityManager(vm);
  }

  protected override getDefaultPropConfig(): { bluePropType: PropType; redPropType: PropType } {
    return {
      bluePropType: this.headlessConfig.bluePropType,
      redPropType: this.headlessConfig.redPropType,
    };
  }
}
