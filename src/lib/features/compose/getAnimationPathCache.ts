import { AnimationPathCache } from '$lib/shared/animation-engine/services/implementations/AnimationPathCache';

let instance: AnimationPathCache | null = null;
export function getAnimationPathCache(): AnimationPathCache {
  return instance ??= new AnimationPathCache();
}
