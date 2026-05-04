import { browser } from '$app/environment';
import { ClaudeCodeCopier } from '$lib/shared/browse/services/ClaudeCodeCopier';
import { getSequenceDetailLoader } from '$lib/shared/browse/getSequenceDetailLoader';

let instance: ClaudeCodeCopier | null = null;

export function getClaudeCodeCopier(): ClaudeCodeCopier {
	if (!browser) throw new Error('getClaudeCodeCopier() is browser-only');
	return instance ??= new ClaudeCodeCopier(getSequenceDetailLoader());
}
