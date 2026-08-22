import { getLibrarySaveService } from "./get-library-save-service";
import { VisualSequenceSaveCoordinator } from "./services/implementations/VisualSequenceSaveCoordinator";

let instance: VisualSequenceSaveCoordinator | null = null;

export function getVisualSequenceSaveCoordinator(): VisualSequenceSaveCoordinator {
  return (instance ??= new VisualSequenceSaveCoordinator(
    getLibrarySaveService()
  ));
}
