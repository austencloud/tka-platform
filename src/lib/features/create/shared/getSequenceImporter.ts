import { browser } from '$app/environment';
import { SequenceImporter } from './services/implementations/SequenceImporter';
import { getEnumMapper } from '$lib/shared/foundation/getEnumMapper';

let instance: SequenceImporter | null = null;

export function getSequenceImporter(): SequenceImporter {
	if (!browser) throw new Error('getSequenceImporter() is browser-only');
	return instance ??= new SequenceImporter(getEnumMapper());
}
