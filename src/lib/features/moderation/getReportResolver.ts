import { browser } from '$app/environment';
import { ReportResolver } from './services/implementations/ReportResolver';
import { getReportQuerier } from './getReportQuerier';

let instance: ReportResolver | null = null;

export function getReportResolver(): ReportResolver {
	if (!browser) throw new Error('getReportResolver() is browser-only');
	return instance ??= new ReportResolver(getReportQuerier());
}
