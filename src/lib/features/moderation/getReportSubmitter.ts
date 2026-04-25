import { browser } from '$app/environment';
import type { IReportSubmitter } from './services/contracts/IReportSubmitter';
import { ReportSubmitter } from './services/implementations/ReportSubmitter';

let instance: IReportSubmitter | null = null;

export function getReportSubmitter(): IReportSubmitter {
	if (!browser) throw new Error('getReportSubmitter() is browser-only');
	return instance ??= new ReportSubmitter();
}
