import { TopologyBuilder } from './services/implementations/TopologyBuilder';

let instance: TopologyBuilder | null = null;
export function getTopologyBuilder(): TopologyBuilder {
  return instance ??= new TopologyBuilder();
}
