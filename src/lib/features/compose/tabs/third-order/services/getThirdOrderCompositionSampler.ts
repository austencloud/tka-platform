import type { IThirdOrderCompositionSampler } from "./contracts/IThirdOrderCompositionSampler";
import { ThirdOrderCompositionSampler } from "./implementations/ThirdOrderCompositionSampler";

let instance: IThirdOrderCompositionSampler | null = null;

export function getThirdOrderCompositionSampler(): IThirdOrderCompositionSampler {
  return (instance ??= new ThirdOrderCompositionSampler());
}
