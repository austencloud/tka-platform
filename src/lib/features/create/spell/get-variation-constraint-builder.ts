import { browser } from '$app/environment';
import { VariationConstraintBuilder } from './services/variation-constraint-builder';
import * as letterTypeClassifier from './services/letter-type-classifier';

let instance: VariationConstraintBuilder | null = null;

export function getVariationConstraintBuilder(): VariationConstraintBuilder {
	if (!browser) throw new Error('getVariationConstraintBuilder() is browser-only');
	return instance ??= new VariationConstraintBuilder(letterTypeClassifier);
}
