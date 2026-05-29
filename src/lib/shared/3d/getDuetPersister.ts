import { DuetPersister } from './services/duet-persister';
import { getBrowseLoader } from '$lib/shared/browse/getBrowseLoader';

let instance: DuetPersister | null = null;
export function getDuetPersister(): DuetPersister {
  return instance ??= new DuetPersister(getBrowseLoader());
}
