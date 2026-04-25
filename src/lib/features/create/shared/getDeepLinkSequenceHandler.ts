import { browser } from '$app/environment';
import type { IDeepLinkSequenceHandler } from './services/contracts/IDeepLinkSequenceHandler';
import { DeepLinkSequenceHandler } from './services/implementations/DeepLinkSequenceHandler';
import { getDeepLinker } from '$lib/shared/navigation/getDeepLinker';
import { getLetterDeriver } from '$lib/shared/navigation/getLetterDeriver';
import { getPositionDeriver } from '$lib/shared/navigation/getPositionDeriver';

let instance: IDeepLinkSequenceHandler | null = null;

export function getDeepLinkSequenceHandler(): IDeepLinkSequenceHandler {
	if (!browser) throw new Error('getDeepLinkSequenceHandler() is browser-only');
	return instance ??= new DeepLinkSequenceHandler(getDeepLinker(), getLetterDeriver(), getPositionDeriver());
}
