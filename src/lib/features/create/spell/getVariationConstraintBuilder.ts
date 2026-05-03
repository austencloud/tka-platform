import { browser } from '$app/environment';
import { VariationConstraintBuilder } from './services/implementations/VariationConstraintBuilder';
import { getLetterTypeClassifier } from './getLetterTypeClassifier';

let instance: VariationConstraintBuilder | null = null;

export function getVariationConstraintBuilder(): VariationConstraintBuilder {
	if (!browser) throw new Error('getVariationConstraintBuilder() is browser-only');
	return instance ??= new VariationConstraintBuilder(getLetterTypeClassifier());
}
