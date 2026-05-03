import { FCMTokenManager } from './services/implementations/FCMTokenManager';

let instance: FCMTokenManager | null = null;
export function getFCMTokenManager(): FCMTokenManager {
  return instance ??= new FCMTokenManager();
}
