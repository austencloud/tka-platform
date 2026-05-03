import { AttributionPromptTrigger } from './services/implementations/AttributionPromptTrigger';

let instance: AttributionPromptTrigger | null = null;
export function getAttributionPromptTrigger(): AttributionPromptTrigger {
  return instance ??= new AttributionPromptTrigger();
}
