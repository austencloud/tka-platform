import type {
  ThirdOrderCompositionDraft,
  ThirdOrderCompositionFrame,
} from "../../domain/third-order-composition";

export interface IThirdOrderCompositionSampler {
  sample(
    composition: ThirdOrderCompositionDraft,
    masterBeat: number
  ): ThirdOrderCompositionFrame;
  clear(): void;
}
