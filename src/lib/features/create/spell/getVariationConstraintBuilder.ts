import { browser } from '$app/environment';
import type { IVariationConstraintBuilder } from './services/contracts/IVariationConstraintBuilder';
import { VariationConstraintBuilder } from './services/implementations/VariationConstraintBuilder';
import { getLetterTypeClassifier } from './getLetterTypeClassifier';

let instance: IVariationConstraintBuilder | null = null;

export function getVariationConstraintBuilder(): IVariationConstraintBuilder {
	if (!browser) throw new Error('getVariationConstraintBuilder() is browser-only');
	return instance ??= new VariationConstraintBuilder(getLetterTypeClassifier());
}
