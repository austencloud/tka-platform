import { browser } from '$app/environment';
import type { ITrainingDataPersister } from './services/contracts/ITrainingDataPersister';
import { TrainingDataPersister } from './services/implementations/TrainingDataPersister';

let instance: ITrainingDataPersister | null = null;

export function getTrainingDataPersister(): ITrainingDataPersister {
	if (!browser) throw new Error('getTrainingDataPersister() is browser-only');
	return instance ??= new TrainingDataPersister();
}
