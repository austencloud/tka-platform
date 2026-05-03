import { browser } from '$app/environment';
import { CodexPictographUpdater } from './services/implementations/CodexPictographUpdater';

let instance: CodexPictographUpdater | null = null;

export function getCodexPictographUpdater(): CodexPictographUpdater {
	if (!browser) throw new Error('getCodexPictographUpdater() is browser-only');
	return instance ??= new CodexPictographUpdater();
}
