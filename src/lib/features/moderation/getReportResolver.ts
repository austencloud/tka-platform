import { browser } from '$app/environment';
import type { IReportResolver } from './services/contracts/IReportResolver';
import { ReportResolver } from './services/implementations/ReportResolver';
import { getReportQuerier } from './getReportQuerier';

let instance: IReportResolver | null = null;

export function getReportResolver(): IReportResolver {
	if (!browser) throw new Error('getReportResolver() is browser-only');
	return instance ??= new ReportResolver(getReportQuerier());
}
