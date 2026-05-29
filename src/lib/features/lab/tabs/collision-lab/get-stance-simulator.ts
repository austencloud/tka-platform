
import { StanceSimulator, restPoseFromHeight } from './services/stance-simulator';
import { userProportionsState } from "@austencloud/scene-3d";

let instance: StanceSimulator | null = null;
export function getStanceSimulator(): StanceSimulator {
  if (!instance) {
    const heightM = userProportionsState.heightCm / 100;
    instance = new StanceSimulator(restPoseFromHeight(heightM));
  }
  return instance;
}
