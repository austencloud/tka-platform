import { browser } from '$app/environment';
import { ReportResolver } from './services/report-resolver';
import * as reportQuerier from './services/report-querier';

let instance: ReportResolver | null = null;

export function getReportResolver(): ReportResolver {
	if (!browser) throw new Error('getReportResolver() is browser-only');
	return instance ??= new ReportResolver(reportQuerier);
}
