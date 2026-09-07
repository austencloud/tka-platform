import type { IFacSequenceMotionClipSampler } from "./contracts/IFacSequenceMotionClipSampler";
import { FacSequenceMotionClipSampler } from "./implementations/FacSequenceMotionClipSampler";
import type {
  LocalPropFrame,
  MotionClip,
  PropStream,
} from "../domain/motion-composition-types";

let instance: IFacSequenceMotionClipSampler | null = null;

export function getFacSequenceMotionClipSampler(): IFacSequenceMotionClipSampler {
  return (instance ??= new FacSequenceMotionClipSampler());
}

export function sampleFacSequenceMotionClip(
  clip: MotionClip,
  stream: PropStream,
  localBeat: number
): LocalPropFrame | undefined {
  return getFacSequenceMotionClipSampler().sample(clip, stream, localBeat);
}
