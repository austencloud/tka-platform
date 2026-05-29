import { AnimationPathCache } from '$lib/shared/animation-engine/services/animation-path-cache';

let instance: AnimationPathCache | null = null;
export function getAnimationPathCache(): AnimationPathCache {
  return instance ??= new AnimationPathCache();
}
