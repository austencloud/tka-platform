import type { IFCMTokenManager } from './services/contracts/IFCMTokenManager';
import { FCMTokenManager } from './services/implementations/FCMTokenManager';

let instance: IFCMTokenManager | null = null;
export function getFCMTokenManager(): IFCMTokenManager {
  return instance ??= new FCMTokenManager();
}
