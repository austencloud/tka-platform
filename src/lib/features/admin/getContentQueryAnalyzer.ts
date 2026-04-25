import { browser } from '$app/environment';
import type { IContentQueryAnalyzer } from './services/implementations/ContentQueryAnalyzer';
import { ContentQueryAnalyzer } from './services/implementations/ContentQueryAnalyzer';

let instance: IContentQueryAnalyzer | null = null;

export function getContentQueryAnalyzer(): IContentQueryAnalyzer {
	if (!browser) throw new Error('getContentQueryAnalyzer() is browser-only');
	return instance ??= new ContentQueryAnalyzer();
}
