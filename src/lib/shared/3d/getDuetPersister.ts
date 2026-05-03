import { DuetPersister } from './services/implementations/DuetPersister';
import { getBrowseLoader } from '$lib/features/browse/sequences/display/getBrowseLoader';

let instance: DuetPersister | null = null;
export function getDuetPersister(): DuetPersister {
  return instance ??= new DuetPersister(getBrowseLoader());
}
