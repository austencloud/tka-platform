import { createAppState } from './state/app-state-factory.svelte';

type AppState = ReturnType<typeof createAppState>;

const hmrData = import.meta.hot?.data as { appState?: AppState } | undefined;
const instance: AppState = hmrData?.appState ?? createAppState();

if (import.meta.hot) {
	import.meta.hot.dispose((data) => {
		data.appState = instance;
	});
}

export function getAppState(): AppState {
	return instance;
}
