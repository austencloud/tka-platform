import type { IAttributionPromptTrigger } from './services/contracts/IAttributionPromptTrigger';
import { AttributionPromptTrigger } from './services/implementations/AttributionPromptTrigger';

let instance: IAttributionPromptTrigger | null = null;
export function getAttributionPromptTrigger(): IAttributionPromptTrigger {
  return instance ??= new AttributionPromptTrigger();
}
