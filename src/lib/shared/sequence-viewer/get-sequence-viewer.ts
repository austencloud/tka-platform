import { browser } from '$app/environment';
import { SequenceViewer } from './services/sequence-viewer';

let instance: SequenceViewer | null = null;

export function getSequenceViewer(): SequenceViewer {
	if (!browser) throw new Error('getSequenceViewer() is browser-only');
	return instance ??= new SequenceViewer();
}
