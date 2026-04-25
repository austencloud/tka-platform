import type { ITopologyPositionEnumerator } from './services/contracts/ITopologyPositionEnumerator';
import { TopologyPositionEnumerator } from './services/implementations/TopologyPositionEnumerator';

let instance: ITopologyPositionEnumerator | null = null;
export function getTopologyPositionEnumerator(): ITopologyPositionEnumerator {
  return instance ??= new TopologyPositionEnumerator();
}
