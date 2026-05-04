import { DeepLinkResolver } from './services/implementations/DeepLinkResolver';
import { getSequenceRepository } from '$lib/shared/create/getSequenceRepository';
import { getBrowseLoader } from '$lib/shared/browse/getBrowseLoader';

let instance: DeepLinkResolver | null = null;
export function getDeepLinkResolver(): DeepLinkResolver {
  return instance ??= new DeepLinkResolver(getSequenceRepository(), getBrowseLoader());
}
