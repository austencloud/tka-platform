import type { IIntentResolver } from './services/contracts/IIntentResolver';
import { LLMIntentResolver } from './services/implementations/LLMIntentResolver';

let instance: IIntentResolver | null = null;
export function getIntentResolver(): IIntentResolver {
  return instance ??= new LLMIntentResolver();
}
