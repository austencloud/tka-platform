import { browser } from '$app/environment';
import type { IRecordingPersister } from './services/implementations/RecordingPersister';
import { RecordingPersister } from './services/implementations/RecordingPersister';

let instance: IRecordingPersister | null = null;

export function getRecordingPersister(): IRecordingPersister {
	if (!browser) throw new Error('getRecordingPersister() is browser-only');
	return instance ??= new RecordingPersister();
}
