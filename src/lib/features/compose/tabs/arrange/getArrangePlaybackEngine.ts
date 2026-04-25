import type { IArrangePlaybackEngine } from './services/contracts/IArrangePlaybackEngine';
import { ArrangePlaybackEngine } from './services/implementations/ArrangePlaybackEngine';

let instance: IArrangePlaybackEngine | null = null;
export function getArrangePlaybackEngine(): IArrangePlaybackEngine {
  return instance ??= new ArrangePlaybackEngine();
}
