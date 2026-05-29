import * as reportSubmitter from './services/report-submitter';

export function getReportSubmitter(): typeof reportSubmitter {
	return reportSubmitter;
}
