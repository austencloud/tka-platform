import { TopologyPositionEnumerator } from './services/implementations/TopologyPositionEnumerator';

let instance: TopologyPositionEnumerator | null = null;
export function getTopologyPositionEnumerator(): TopologyPositionEnumerator {
  return instance ??= new TopologyPositionEnumerator();
}
