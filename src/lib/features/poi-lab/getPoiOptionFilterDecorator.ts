import { PoiOptionFilterDecorator } from './services/implementations/PoiOptionFilterDecorator';

let instance: PoiOptionFilterDecorator | null = null;
export function getPoiOptionFilterDecorator(): PoiOptionFilterDecorator {
  return instance ??= new PoiOptionFilterDecorator();
}
