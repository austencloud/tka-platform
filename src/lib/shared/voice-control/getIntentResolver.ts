import { LLMIntentResolver } from './services/implementations/LLMIntentResolver';

let instance: LLMIntentResolver | null = null;
export function getIntentResolver(): LLMIntentResolver {
  return instance ??= new LLMIntentResolver();
}
