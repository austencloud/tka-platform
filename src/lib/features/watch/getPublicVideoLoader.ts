import type { IPublicVideoLoader } from './services/contracts/IPublicVideoLoader';
import { PublicVideoLoader } from './services/implementations/PublicVideoLoader';
import { getCollaborativeVideoManager } from '$lib/shared/video-collaboration/getCollaborativeVideoManager';

let instance: IPublicVideoLoader | null = null;
export function getPublicVideoLoader(): IPublicVideoLoader {
  return instance ??= new PublicVideoLoader(getCollaborativeVideoManager());
}
