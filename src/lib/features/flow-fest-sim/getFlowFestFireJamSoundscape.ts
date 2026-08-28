import { FlowFestFireJamSoundscape } from "./services/implementations/FlowFestFireJamSoundscape";

let instance: FlowFestFireJamSoundscape | null = null;

export function getFlowFestFireJamSoundscape(): FlowFestFireJamSoundscape {
  instance ??= new FlowFestFireJamSoundscape();
  return instance;
}
