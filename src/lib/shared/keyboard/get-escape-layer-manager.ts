import type { IEscapeLayerManager } from "./services/contracts/IEscapeLayerManager";
import { EscapeLayerManager } from "./services/implementations/EscapeLayerManager";

let instance: IEscapeLayerManager | null = null;

export function getEscapeLayerManager(): IEscapeLayerManager {
  return (instance ??= new EscapeLayerManager());
}
