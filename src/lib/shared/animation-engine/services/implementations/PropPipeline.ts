import type { PropTypeManager } from "./PropTypeManager";
import type { AnimationEngineProps, AnimationEngineState } from "./AnimationEngine.svelte";
import type { IAnimationRenderer } from "$lib/shared/animation-engine/services/contracts/IAnimationRenderer";
import type { ISVGGenerator } from "$lib/shared/animation-engine/services/contracts/ISVGGenerator";
import type { TrailCapturer } from "./TrailCapturer";
import type { IPropTextureLoader } from "$lib/shared/animation-engine/services/contracts/IPropTextureLoader";
import type { RenderFrameParams } from "$lib/shared/animation-engine/services/contracts/IAnimationRenderLoop";
import { PropTextureLoader } from "./PropTextureLoader.svelte";

export class PropPipeline {
  private propTextureService: IPropTextureLoader | null = null;

  constructor(private readonly propTypeManager: PropTypeManager) {}

  initializeTextureLoader(
    renderer: IAnimationRenderer,
    svgGenerator: ISVGGenerator,
    trailCapturer: TrailCapturer | null
  ): IPropTextureLoader {
    this.propTextureService = new PropTextureLoader();
    this.propTextureService.initialize(renderer, svgGenerator, trailCapturer);
    this.propTypeManager.updateRefs({ propTextureService: this.propTextureService });
    return this.propTextureService;
  }

  handlePropTypeChanges(
    props: AnimationEngineProps,
    state: AnimationEngineState,
    getFrameParamsFn: () => RenderFrameParams,
    darkMode: boolean
  ): void {
    const hasOverrides = props.bluePropType != null || props.redPropType != null;

    if (hasOverrides) {
      this.propTypeManager.handleOverrides(props, state, getFrameParamsFn, darkMode);
    } else {
      this.propTypeManager.handleSettingsChange(state, getFrameParamsFn, darkMode);
    }

    this.propTypeManager.handleAdditionalLayers(props, state, getFrameParamsFn);
  }

  async loadTextures(state: AnimationEngineState, darkMode: boolean): Promise<void> {
    await this.propTypeManager.loadPropTextures(state, darkMode);
  }

  dispose(): void {
    this.propTextureService?.dispose?.();
  }
}
