import { TopologyRenderer } from './services/implementations/TopologyRenderer';

let instance: TopologyRenderer | null = null;
export function getTopologyRenderer(): TopologyRenderer {
  return instance ??= new TopologyRenderer();
}
