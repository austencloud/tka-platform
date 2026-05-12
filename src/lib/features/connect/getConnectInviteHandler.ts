import { InviteHandler } from './services/InviteHandler';

let instance: InviteHandler | null = null;
export function getConnectInviteHandler(): InviteHandler {
  return instance ??= new InviteHandler();
}
