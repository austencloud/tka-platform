import { browser } from '$app/environment';
import { ExportOrchestrator } from './services/implementations/ExportOrchestrator';
import { getSharer } from '$lib/shared/share/getSharer';

let instance: ExportOrchestrator | null = null;

export function getExportOrchestrator(): ExportOrchestrator {
	if (!browser) throw new Error('getExportOrchestrator() is browser-only');
	return instance ??= new ExportOrchestrator(getSharer());
}
