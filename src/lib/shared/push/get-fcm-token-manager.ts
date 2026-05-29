import { FCMTokenManager } from './services/fcm-token-manager';

let instance: FCMTokenManager | null = null;
export function getFCMTokenManager(): FCMTokenManager {
  return instance ??= new FCMTokenManager();
}
