import { DeepLinkResolver } from './services/implementations/DeepLinkResolver';
import { getSequenceRepository } from '$lib/features/create/shared/getSequenceRepository';
import { getBrowseLoader } from '$lib/features/browse/sequences/display/getBrowseLoader';

let instance: DeepLinkResolver | null = null;
export function getDeepLinkResolver(): DeepLinkResolver {
  return instance ??= new DeepLinkResolver(getSequenceRepository(), getBrowseLoader());
}
