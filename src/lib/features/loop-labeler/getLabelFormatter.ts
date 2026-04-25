import { browser } from '$app/environment';
import type { ILabelFormatter } from './services/contracts/ILabelFormatter';
import { LabelFormatter } from './services/implementations/LabelFormatter';

let instance: ILabelFormatter | null = null;

export function getLabelFormatter(): ILabelFormatter {
	if (!browser) throw new Error('getLabelFormatter() is browser-only');
	return instance ??= new LabelFormatter();
}
