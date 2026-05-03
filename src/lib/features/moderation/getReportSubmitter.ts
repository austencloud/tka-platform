import { browser } from '$app/environment';
import { ReportSubmitter } from './services/implementations/ReportSubmitter';

let instance: ReportSubmitter | null = null;

export function getReportSubmitter(): ReportSubmitter {
	if (!browser) throw new Error('getReportSubmitter() is browser-only');
	return instance ??= new ReportSubmitter();
}
