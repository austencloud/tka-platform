import { browser } from '$app/environment';
import type { IClaudeCodeCopier } from './services/contracts/IClaudeCodeCopier';
import { ClaudeCodeCopier } from './services/implementations/ClaudeCodeCopier';
import { getSequenceDetailLoader } from './getSequenceDetailLoader';

let instance: IClaudeCodeCopier | null = null;

export function getClaudeCodeCopier(): IClaudeCodeCopier {
	if (!browser) throw new Error('getClaudeCodeCopier() is browser-only');
	return instance ??= new ClaudeCodeCopier(getSequenceDetailLoader());
}
