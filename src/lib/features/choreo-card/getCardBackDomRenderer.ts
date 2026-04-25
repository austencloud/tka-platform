import type { ICardBackDomRenderer } from './services/contracts/ICardBackDomRenderer';
import { CardBackDomRenderer } from './services/implementations/CardBackDomRenderer';

let instance: ICardBackDomRenderer | null = null;
export function getCardBackDomRenderer(): ICardBackDomRenderer {
  return instance ??= new CardBackDomRenderer();
}
