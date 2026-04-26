import { SequenceAnimationOrchestrator } from "$lib/features/compose/services/implementations/SequenceAnimationOrchestrator";
import { AnimationStateManager } from "$lib/features/compose/services/implementations/AnimationStateManager";
import { StepCalculator } from "$lib/features/compose/services/implementations/StepCalculator";
import { PropInterpolator } from "$lib/features/compose/services/implementations/PropInterpolator";
import { AngleCalculator } from "$lib/features/compose/services/implementations/AngleCalculator";
import { EndpointCalculator } from "$lib/features/compose/services/implementations/EndpointCalculator";
import { MotionCalculator } from "$lib/features/compose/services/implementations/MotionCalculator";
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
  getEffortPreset: () => "smooth",
  setSpeed: () => {},
  getSpeed: () => 1,
} as unknown as AnimationVisibilityStateManager;

export class HeadlessAnimationOrchestrator extends SequenceAnimationOrchestrator {
  private readonly headlessConfig: HeadlessConfig;

  constructor(config: HeadlessConfig) {
    const stateManager = new AnimationStateManager();
    const stepCalculator = new StepCalculator();
    const angleCalculator = new AngleCalculator();
    const motionCalculator = new MotionCalculator();
    const endpointCalculator = new EndpointCalculator(angleCalculator, motionCalculator);
    const propInterpolator = new PropInterpolator(angleCalculator, endpointCalculator);

    super(stateManager, stepCalculator, propInterpolator);
    this.headlessConfig = config;

    const vm = {
      ...HEADLESS_VISIBILITY_MANAGER,
      getEffortPreset: () => config.effortPreset ?? "smooth",
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
