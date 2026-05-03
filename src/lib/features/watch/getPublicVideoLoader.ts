import { PublicVideoLoader } from './services/implementations/PublicVideoLoader';
import { getCollaborativeVideoManager } from '$lib/shared/video-collaboration/getCollaborativeVideoManager';

let instance: PublicVideoLoader | null = null;
export function getPublicVideoLoader(): PublicVideoLoader {
  return instance ??= new PublicVideoLoader(getCollaborativeVideoManager());
}
