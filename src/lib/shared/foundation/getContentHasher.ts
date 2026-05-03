import { ContentHasher } from './services/implementations/ContentHasher';

let instance: ContentHasher | null = null;

export function getContentHasher(): ContentHasher {
	return instance ??= new ContentHasher();
}
