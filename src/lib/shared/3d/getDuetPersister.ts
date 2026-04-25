import type { IDuetPersister } from './services/contracts/IDuetPersister';
import { DuetPersister } from './services/implementations/DuetPersister';
import { getBrowseLoader } from '$lib/features/browse/sequences/display/getBrowseLoader';

let instance: IDuetPersister | null = null;
export function getDuetPersister(): IDuetPersister {
  return instance ??= new DuetPersister(getBrowseLoader());
}
