import { browser } from '$app/environment';
import { LabelFormatter } from './services/implementations/LabelFormatter';

let instance: LabelFormatter | null = null;

export function getLabelFormatter(): LabelFormatter {
	if (!browser) throw new Error('getLabelFormatter() is browser-only');
	return instance ??= new LabelFormatter();
}
