import type { ICollectionCollaborationManager } from "./services/contracts/ICollectionCollaborationManager";
import { CollectionCollaborationManager } from "./services/implementations/CollectionCollaborationManager";

let instance: ICollectionCollaborationManager | undefined;

export function getCollectionCollaborationManager(): ICollectionCollaborationManager {
  instance ??= new CollectionCollaborationManager();
  return instance;
}
