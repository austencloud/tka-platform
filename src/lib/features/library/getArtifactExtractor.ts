import type { IArtifactExtractor } from './services/contracts/IArtifactExtractor';
import { ArtifactExtractor } from './services/implementations/ArtifactExtractor';
import { handPathRepository } from '$lib/shared/foundation/services/implementations/HandPathRepository';
import { soloPropRepository } from '$lib/shared/foundation/services/implementations/SoloPropRepository';

let instance: IArtifactExtractor | null = null;
export function getArtifactExtractor(): IArtifactExtractor {
  return instance ??= new ArtifactExtractor(handPathRepository, soloPropRepository);
}
