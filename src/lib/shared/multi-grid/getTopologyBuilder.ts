import type { ITopologyBuilder } from './services/contracts/ITopologyBuilder';
import { TopologyBuilder } from './services/implementations/TopologyBuilder';

let instance: ITopologyBuilder | null = null;
export function getTopologyBuilder(): ITopologyBuilder {
  return instance ??= new TopologyBuilder();
}
