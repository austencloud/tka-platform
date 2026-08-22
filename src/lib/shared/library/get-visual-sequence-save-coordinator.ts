import type { IVisualSequenceSaveCoordinator } from "$lib/shared/library/services/contracts/IVisualSequenceSaveCoordinator";

type VisualSequenceSaveCoordinatorFactory = () => Promise<IVisualSequenceSaveCoordinator>;

let factory: VisualSequenceSaveCoordinatorFactory | null = null;
let instance: Promise<IVisualSequenceSaveCoordinator> | null = null;

export function registerVisualSequenceSaveCoordinatorFactory(
  nextFactory: VisualSequenceSaveCoordinatorFactory
): void {
  factory = nextFactory;
  instance = null;
}

export function getVisualSequenceSaveCoordinator(): Promise<IVisualSequenceSaveCoordinator> {
  if (!factory) {
    throw new Error("Visual sequence saving has not been registered");
  }

  return (instance ??= factory());
}
