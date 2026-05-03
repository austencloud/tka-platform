import { ArtifactExtractor } from './services/implementations/ArtifactExtractor';
import { handPathRepository } from '$lib/shared/foundation/services/implementations/HandPathRepository';
import { soloPropRepository } from '$lib/shared/foundation/services/implementations/SoloPropRepository';

let instance: ArtifactExtractor | null = null;
export function getArtifactExtractor(): ArtifactExtractor {
  return instance ??= new ArtifactExtractor(handPathRepository, soloPropRepository);
}
