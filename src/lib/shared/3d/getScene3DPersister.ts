import type { IScene3DPersister } from './services/contracts/IScene3DPersister';
import { Scene3DPersister } from './services/implementations/Scene3DPersister';

let instance: IScene3DPersister | null = null;
export function getScene3DPersister(): IScene3DPersister {
  return instance ??= new Scene3DPersister();
}
