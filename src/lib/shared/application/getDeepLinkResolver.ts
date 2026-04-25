import type { IDeepLinkResolver } from './services/contracts/IDeepLinkResolver';
import { DeepLinkResolver } from './services/implementations/DeepLinkResolver';
import { getSequenceRepository } from '$lib/features/create/shared/getSequenceRepository';
import { getBrowseLoader } from '$lib/features/browse/sequences/display/getBrowseLoader';

let instance: IDeepLinkResolver | null = null;
export function getDeepLinkResolver(): IDeepLinkResolver {
  return instance ??= new DeepLinkResolver(getSequenceRepository(), getBrowseLoader());
}
