import type {
  LocalPropFrame,
  MotionClip,
  PropStream,
} from "../../domain/motion-composition-types";

export interface IFacSequenceMotionClipSampler {
  sample(
    clip: MotionClip,
    stream: PropStream,
    localBeat: number
  ): LocalPropFrame | undefined;
  clear(): void;
}
