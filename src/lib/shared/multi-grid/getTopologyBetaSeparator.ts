import { TopologyBetaSeparator } from './services/implementations/TopologyBetaSeparator';

let instance: TopologyBetaSeparator | null = null;
export function getTopologyBetaSeparator(): TopologyBetaSeparator {
  return instance ??= new TopologyBetaSeparator();
}
