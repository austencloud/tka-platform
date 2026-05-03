import { browser } from '$app/environment';
import { TrainingDataPersister } from './services/implementations/TrainingDataPersister';

let instance: TrainingDataPersister | null = null;

export function getTrainingDataPersister(): TrainingDataPersister {
	if (!browser) throw new Error('getTrainingDataPersister() is browser-only');
	return instance ??= new TrainingDataPersister();
}
