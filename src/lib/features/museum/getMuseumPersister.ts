import { MuseumPersister } from '$lib/features/museum/scenes/procedural/services/implementations/MuseumPersister';

let instance: MuseumPersister | null = null;

export function getMuseumPersister(): MuseumPersister {
  return instance ??= new MuseumPersister();
}
