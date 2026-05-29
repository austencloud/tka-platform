import { TrainingDataStore } from './services/training-data-store';

let instance: TrainingDataStore | null = null;
export function getTrainingDataStore(): TrainingDataStore {
  return instance ??= new TrainingDataStore();
}
