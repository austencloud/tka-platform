import { TopologyPropLoader } from './services/implementations/TopologyPropLoader';

let instance: TopologyPropLoader | null = null;
export function getTopologyPropLoader(): TopologyPropLoader {
  return instance ??= new TopologyPropLoader();
}
