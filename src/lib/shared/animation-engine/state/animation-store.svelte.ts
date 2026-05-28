import type { AnimationVisibilityState } from "../services/implementations/AnimationVisibilitySynchronizer";
import type { PreRenderProgress } from "../services/implementations/SequenceFramePreRenderer";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { TrailSettings } from "../domain/types/TrailTypes";
import { loadTrailSettings } from "../utils/animation-panel-persistence";
import {
  DEFAULT_PROP_DIMENSIONS,
  type PropDimensions,
} from "../services/contracts/IPropTextureLoader";
import type { EffectType, TipEffectMap } from "../domain/types/TipEffectTypes";

export interface AnimationStore {
  readonly isInitialized: boolean;
  readonly rendererLoading: boolean;
  readonly rendererError: string | null;
  readonly servicesReady: boolean;
  readonly visibilityState: AnimationVisibilityState;
  readonly isPreRendering: boolean;
  readonly preRenderProgress: PreRenderProgress | null;
  readonly preRenderedFramesReady: boolean;
  readonly displayedLetter: Letter | null;
  readonly displayedTurnsTuple: string;
  readonly displayedStepNumber: number | null;
  readonly displayedMusicalPosition: string | null;
  readonly fadingOutLetter: Letter | null;
  readonly fadingOutTurnsTuple: string | null;
  readonly fadingOutStepNumber: number | null;
  readonly isNewLetter: boolean;
  readonly trailSettings: TrailSettings;
  readonly bluePropDimensions: PropDimensions;
  readonly redPropDimensions: PropDimensions;
  readonly currentBluePropType: string;
  readonly currentRedPropType: string;
  readonly currentPropType: string;
  readonly suppress2DOverlays: boolean;
  readonly blueMotionVisible: boolean;
  readonly redMotionVisible: boolean;

  setInitialized(v: boolean): void;
  setRendererLoading(v: boolean): void;
  setRendererError(v: string | null): void;
  setServicesReady(v: boolean): void;
  setVisibilityState(v: AnimationVisibilityState): void;
  setPreRendering(v: boolean): void;
  setPreRenderProgress(v: PreRenderProgress | null): void;
  setPreRenderedFramesReady(v: boolean): void;
  setGlyphState(v: {
    displayedLetter: Letter | null;
    displayedTurnsTuple: string;
    displayedStepNumber: number | null;
    displayedMusicalPosition: string | null;
    fadingOutLetter: Letter | null;
    fadingOutTurnsTuple: string | null;
    fadingOutStepNumber: number | null;
    isNewLetter: boolean;
  }): void;
  setTrailSettings(v: TrailSettings): void;
  setBluePropDimensions(v: PropDimensions): void;
  setRedPropDimensions(v: PropDimensions): void;
  setBluePropType(v: string): void;
  setRedPropType(v: string): void;
  setLegacyPropType(v: string): void;
  setSuppress2DOverlays(v: boolean): void;
  setMotionVisibility(blue: boolean, red: boolean): void;
}

export function createAnimationStore(): AnimationStore {
  const state = $state({
    isInitialized: false,
    rendererLoading: false,
    rendererError: null as string | null,
    servicesReady: false,
    visibilityState: {
      grid: true,
      stepNumbers: true,
      props: true,
      trails: true,
      tkaGlyph: true,
      darkMode: false,
      wordHeader: true,
      activeEffect: "trails" as EffectType,
      tipEffectMap: {} as TipEffectMap,
    } as AnimationVisibilityState,
    isPreRendering: false,
    preRenderProgress: null as PreRenderProgress | null,
    preRenderedFramesReady: false,
    displayedLetter: null as Letter | null,
    displayedTurnsTuple: "(s, 0, 0)",
    displayedStepNumber: null as number | null,
    displayedMusicalPosition: null as string | null,
    fadingOutLetter: null as Letter | null,
    fadingOutTurnsTuple: null as string | null,
    fadingOutStepNumber: null as number | null,
    isNewLetter: false,
    trailSettings: loadTrailSettings(),
    bluePropDimensions: DEFAULT_PROP_DIMENSIONS,
    redPropDimensions: DEFAULT_PROP_DIMENSIONS,
    currentBluePropType: "staff",
    currentRedPropType: "staff",
    currentPropType: "staff",
    suppress2DOverlays: false,
    blueMotionVisible: true,
    redMotionVisible: true,
  });

  return {
    get isInitialized() { return state.isInitialized; },
    get rendererLoading() { return state.rendererLoading; },
    get rendererError() { return state.rendererError; },
    get servicesReady() { return state.servicesReady; },
    get visibilityState() { return state.visibilityState; },
    get isPreRendering() { return state.isPreRendering; },
    get preRenderProgress() { return state.preRenderProgress; },
    get preRenderedFramesReady() { return state.preRenderedFramesReady; },
    get displayedLetter() { return state.displayedLetter; },
    get displayedTurnsTuple() { return state.displayedTurnsTuple; },
    get displayedStepNumber() { return state.displayedStepNumber; },
    get displayedMusicalPosition() { return state.displayedMusicalPosition; },
    get fadingOutLetter() { return state.fadingOutLetter; },
    get fadingOutTurnsTuple() { return state.fadingOutTurnsTuple; },
    get fadingOutStepNumber() { return state.fadingOutStepNumber; },
    get isNewLetter() { return state.isNewLetter; },
    get trailSettings() { return state.trailSettings; },
    get bluePropDimensions() { return state.bluePropDimensions; },
    get redPropDimensions() { return state.redPropDimensions; },
    get currentBluePropType() { return state.currentBluePropType; },
    get currentRedPropType() { return state.currentRedPropType; },
    get currentPropType() { return state.currentPropType; },
    get suppress2DOverlays() { return state.suppress2DOverlays; },
    get blueMotionVisible() { return state.blueMotionVisible; },
    get redMotionVisible() { return state.redMotionVisible; },

    setInitialized(v) { if (state.isInitialized !== v) state.isInitialized = v; },
    setRendererLoading(v) { if (state.rendererLoading !== v) state.rendererLoading = v; },
    setRendererError(v) { if (state.rendererError !== v) state.rendererError = v; },
    setServicesReady(v) { if (state.servicesReady !== v) state.servicesReady = v; },
    setVisibilityState(v) { state.visibilityState = v; },
    setPreRendering(v) { if (state.isPreRendering !== v) state.isPreRendering = v; },
    setPreRenderProgress(v) { if (state.preRenderProgress !== v) state.preRenderProgress = v; },
    setPreRenderedFramesReady(v) { if (state.preRenderedFramesReady !== v) state.preRenderedFramesReady = v; },
    setGlyphState(v) {
      if (state.displayedLetter !== v.displayedLetter) state.displayedLetter = v.displayedLetter;
      if (state.displayedTurnsTuple !== v.displayedTurnsTuple) state.displayedTurnsTuple = v.displayedTurnsTuple;
      if (state.displayedStepNumber !== v.displayedStepNumber) state.displayedStepNumber = v.displayedStepNumber;
      if (state.displayedMusicalPosition !== v.displayedMusicalPosition) state.displayedMusicalPosition = v.displayedMusicalPosition;
      if (state.fadingOutLetter !== v.fadingOutLetter) state.fadingOutLetter = v.fadingOutLetter;
      if (state.fadingOutTurnsTuple !== v.fadingOutTurnsTuple) state.fadingOutTurnsTuple = v.fadingOutTurnsTuple;
      if (state.fadingOutStepNumber !== v.fadingOutStepNumber) state.fadingOutStepNumber = v.fadingOutStepNumber;
      if (state.isNewLetter !== v.isNewLetter) state.isNewLetter = v.isNewLetter;
    },
    setTrailSettings(v) { state.trailSettings = v; },
    setBluePropDimensions(v) {
      if (state.bluePropDimensions.width !== v.width || state.bluePropDimensions.height !== v.height) {
        state.bluePropDimensions = v;
      }
    },
    setRedPropDimensions(v) {
      if (state.redPropDimensions.width !== v.width || state.redPropDimensions.height !== v.height) {
        state.redPropDimensions = v;
      }
    },
    setBluePropType(v) { if (state.currentBluePropType !== v) state.currentBluePropType = v; },
    setRedPropType(v) { if (state.currentRedPropType !== v) state.currentRedPropType = v; },
    setLegacyPropType(v) { if (state.currentPropType !== v) state.currentPropType = v; },
    setSuppress2DOverlays(v) { if (state.suppress2DOverlays !== v) state.suppress2DOverlays = v; },
    setMotionVisibility(blue, red) {
      if (state.blueMotionVisible !== blue) state.blueMotionVisible = blue;
      if (state.redMotionVisible !== red) state.redMotionVisible = red;
    },
  };
}
