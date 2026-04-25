import { browser } from '$app/environment';
import type { IReportQuerier } from './services/contracts/IReportQuerier';
import { ReportQuerier } from './services/implementations/ReportQuerier';

let instance: IReportQuerier | null = null;

export function getReportQuerier(): IReportQuerier {
	if (!browser) throw new Error('getReportQuerier() is browser-only');
	return instance ??= new ReportQuerier();
}
