import { browser } from '$app/environment';
import { ClaudeCodeCopier } from '$lib/shared/browse/services/claude-code-copier';
import { getSequenceDetailLoader } from '$lib/shared/browse/get-sequence-detail-loader';

let instance: ClaudeCodeCopier | null = null;

export function getClaudeCodeCopier(): ClaudeCodeCopier {
	if (!browser) throw new Error('getClaudeCodeCopier() is browser-only');
	return instance ??= new ClaudeCodeCopier(getSequenceDetailLoader());
}
