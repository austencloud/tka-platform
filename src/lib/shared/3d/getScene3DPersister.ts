import { Scene3DPersister } from './services/implementations/Scene3DPersister';

let instance: Scene3DPersister | null = null;
export function getScene3DPersister(): Scene3DPersister {
  return instance ??= new Scene3DPersister();
}
