
import { StanceSimulator, restPoseFromHeight } from './services/implementations/StanceSimulator';
import { userProportionsState } from '$lib/shared/3d/state/user-proportions-state.svelte';

let instance: StanceSimulator | null = null;
export function getStanceSimulator(): StanceSimulator {
  if (!instance) {
    const heightM = userProportionsState.heightCm / 100;
    instance = new StanceSimulator(restPoseFromHeight(heightM));
  }
  return instance;
}
