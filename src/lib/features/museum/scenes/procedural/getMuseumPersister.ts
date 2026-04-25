import type { IMuseumPersister } from './services/contracts/IMuseumPersister';
import { MuseumPersister } from './services/implementations/MuseumPersister';

let instance: IMuseumPersister | null = null;
export function getMuseumPersister(): IMuseumPersister {
  return instance ??= new MuseumPersister();
}
