import type { ITopologyBetaSeparator } from './services/contracts/ITopologyBetaSeparator';
import { TopologyBetaSeparator } from './services/implementations/TopologyBetaSeparator';

let instance: ITopologyBetaSeparator | null = null;
export function getTopologyBetaSeparator(): ITopologyBetaSeparator {
  return instance ??= new TopologyBetaSeparator();
}
