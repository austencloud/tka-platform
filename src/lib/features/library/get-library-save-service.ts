
import { LibrarySaveService } from './services/library-save-service';
import { getSharer } from '$lib/shared/share/get-sharer';
import { getVideoUploader } from '$lib/shared/share/get-video-uploader';
import { getLibraryRepository } from '$lib/shared/library/getLibraryRepository';
import { getArtifactExtractor } from './get-artifact-extractor';

let instance: LibrarySaveService | null = null;
export function getLibrarySaveService(): LibrarySaveService {
  return instance ??= new LibrarySaveService(
    getSharer(),
    getVideoUploader(),
    getLibraryRepository(),
    getArtifactExtractor()
  );
}
