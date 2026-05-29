import { createPerformanceMetricsState } from './state/performance-metrics-state.svelte';

type PerformanceMetricsState = ReturnType<typeof createPerformanceMetricsState>;

const hmrData = import.meta.hot?.data as { performanceMetricsState?: PerformanceMetricsState } | undefined;
const instance: PerformanceMetricsState = hmrData?.performanceMetricsState ?? createPerformanceMetricsState();

if (import.meta.hot) {
	import.meta.hot.dispose((data) => {
		data.performanceMetricsState = instance;
	});
}

export function getPerformanceMetricsState(): PerformanceMetricsState {
	return instance;
}
