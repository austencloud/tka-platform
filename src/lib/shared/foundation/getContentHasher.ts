import type { IContentHasher } from './services/contracts/IContentHasher';
import { ContentHasher } from './services/implementations/ContentHasher';

let instance: IContentHasher | null = null;

export function getContentHasher(): IContentHasher {
	return instance ??= new ContentHasher();
}
