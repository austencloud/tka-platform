import { browser } from '$app/environment';
import type { IExportOrchestrator } from './services/contracts/IExportOrchestrator';
import { ExportOrchestrator } from './services/implementations/ExportOrchestrator';
import { getSharer } from '$lib/shared/share/getSharer';

let instance: IExportOrchestrator | null = null;

export function getExportOrchestrator(): IExportOrchestrator {
	if (!browser) throw new Error('getExportOrchestrator() is browser-only');
	return instance ??= new ExportOrchestrator(getSharer());
}
