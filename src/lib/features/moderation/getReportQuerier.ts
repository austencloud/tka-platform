import * as reportQuerier from './services/report-querier';

export function getReportQuerier(): typeof reportQuerier {
	return reportQuerier;
}
