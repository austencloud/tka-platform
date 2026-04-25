import { browser } from '$app/environment';
import type { IExtensionFlowCoordinator } from './services/contracts/IExtensionFlowCoordinator';
import { ExtensionFlowCoordinator } from './services/implementations/ExtensionFlowCoordinator';
import { getSequenceExtender } from './getSequenceExtender';

let instance: IExtensionFlowCoordinator | null = null;

export function getExtensionFlowCoordinator(): IExtensionFlowCoordinator {
	if (!browser) throw new Error('getExtensionFlowCoordinator() is browser-only');
	return instance ??= new ExtensionFlowCoordinator(getSequenceExtender());
}
