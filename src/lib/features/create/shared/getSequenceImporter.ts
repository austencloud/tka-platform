import { browser } from '$app/environment';
import type { ISequenceImporter } from './services/contracts/ISequenceImporter';
import { SequenceImporter } from './services/implementations/SequenceImporter';
import { getEnumMapper } from '$lib/shared/foundation/getEnumMapper';

let instance: ISequenceImporter | null = null;

export function getSequenceImporter(): ISequenceImporter {
	if (!browser) throw new Error('getSequenceImporter() is browser-only');
	return instance ??= new SequenceImporter(getEnumMapper());
}
