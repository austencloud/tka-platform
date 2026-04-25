import { browser } from '$app/environment';
import type { ISequenceDomainManager } from './services/contracts/ISequenceDomainManager';
import { SequenceDomainManager } from './services/implementations/SequenceDomainManager';

let instance: ISequenceDomainManager | null = null;

export function getSequenceDomainManager(): ISequenceDomainManager {
	if (!browser) throw new Error('getSequenceDomainManager() is browser-only');
	return instance ??= new SequenceDomainManager();
}
