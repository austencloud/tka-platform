
import { CardBackDomRenderer } from './services/implementations/CardBackDomRenderer';

let instance: CardBackDomRenderer | null = null;
export function getCardBackDomRenderer(): CardBackDomRenderer {
  return instance ??= new CardBackDomRenderer();
}
