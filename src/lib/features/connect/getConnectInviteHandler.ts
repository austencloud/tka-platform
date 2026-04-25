import type { IInviteHandler } from './services/contracts/IInviteHandler';
import { InviteHandler } from './services/implementations/InviteHandler';

let instance: IInviteHandler | null = null;
export function getConnectInviteHandler(): IInviteHandler {
  return instance ??= new InviteHandler();
}
