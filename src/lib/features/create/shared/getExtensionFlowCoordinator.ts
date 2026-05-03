import { browser } from '$app/environment';

import { ExtensionFlowCoordinator } from './services/implementations/ExtensionFlowCoordinator';
import { getSequenceExtender } from './getSequenceExtender';

let instance: ExtensionFlowCoordinator | null = null;

export function getExtensionFlowCoordinator(): ExtensionFlowCoordinator {
	if (!browser) throw new Error('getExtensionFlowCoordinator() is browser-only');
	return instance ??= new ExtensionFlowCoordinator(getSequenceExtender());
}
