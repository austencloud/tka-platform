import { ArrangePlaybackEngine } from './services/implementations/ArrangePlaybackEngine';

let instance: ArrangePlaybackEngine | null = null;
export function getArrangePlaybackEngine(): ArrangePlaybackEngine {
  return instance ??= new ArrangePlaybackEngine();
}
