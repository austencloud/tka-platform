import { browser } from '$app/environment';
import { ReportQuerier } from './services/implementations/ReportQuerier';

let instance: ReportQuerier | null = null;

export function getReportQuerier(): ReportQuerier {
	if (!browser) throw new Error('getReportQuerier() is browser-only');
	return instance ??= new ReportQuerier();
}
