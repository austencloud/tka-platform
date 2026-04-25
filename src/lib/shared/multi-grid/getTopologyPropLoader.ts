import type { ITopologyPropLoader } from './services/contracts/ITopologyPropLoader';
import { TopologyPropLoader } from './services/implementations/TopologyPropLoader';

let instance: ITopologyPropLoader | null = null;
export function getTopologyPropLoader(): ITopologyPropLoader {
  return instance ??= new TopologyPropLoader();
}
