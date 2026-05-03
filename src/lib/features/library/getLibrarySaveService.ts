
import { LibrarySaveService } from './services/implementations/LibrarySaveService';
import { getSharer } from '$lib/shared/share/getSharer';
import { getVideoUploader } from '$lib/shared/share/getVideoUploader';
import { getTagManager } from './getTagManager';
import { getLibraryRepository } from './getLibraryRepository';
import { getArtifactExtractor } from './getArtifactExtractor';

let instance: LibrarySaveService | null = null;
export function getLibrarySaveService(): LibrarySaveService {
  return instance ??= new LibrarySaveService(
    getSharer(),
    getVideoUploader(),
    getTagManager(),
    getLibraryRepository(),
    getArtifactExtractor()
  );
}
