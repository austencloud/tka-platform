import { ArrangePlaybackEngine } from './services/arrange-playback-engine';

let instance: ArrangePlaybackEngine | null = null;
export function getArrangePlaybackEngine(): ArrangePlaybackEngine {
  return instance ??= new ArrangePlaybackEngine();
}
