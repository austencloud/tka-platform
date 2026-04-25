import type { ITopologyRenderer } from './services/contracts/ITopologyRenderer';
import { TopologyRenderer } from './services/implementations/TopologyRenderer';

let instance: ITopologyRenderer | null = null;
export function getTopologyRenderer(): ITopologyRenderer {
  return instance ??= new TopologyRenderer();
}
