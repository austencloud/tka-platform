
import { MuseumPersister } from './services/implementations/MuseumPersister';

let instance: MuseumPersister | null = null;
export function getMuseumPersister(): MuseumPersister {
  return instance ??= new MuseumPersister();
}
