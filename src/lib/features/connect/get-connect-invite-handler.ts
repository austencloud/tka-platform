import { InviteHandler } from './services/invite-handler';

let instance: InviteHandler | null = null;
export function getConnectInviteHandler(): InviteHandler {
  return instance ??= new InviteHandler();
}
