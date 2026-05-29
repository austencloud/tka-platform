import { PoiOptionFilterDecorator } from './services/poi-option-filter-decorator';

let instance: PoiOptionFilterDecorator | null = null;
export function getPoiOptionFilterDecorator(): PoiOptionFilterDecorator {
  return instance ??= new PoiOptionFilterDecorator();
}
