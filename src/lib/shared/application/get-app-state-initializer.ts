import { createAppStateInitializer } from '../foundation/services/data/app-state-initializer.svelte';

type AppStateInitializer = ReturnType<typeof createAppStateInitializer>;

const hmrData = import.meta.hot?.data as { appStateInitializer?: AppStateInitializer } | undefined;
const instance: AppStateInitializer = hmrData?.appStateInitializer ?? createAppStateInitializer();

if (import.meta.hot) {
	import.meta.hot.dispose((data) => {
		data.appStateInitializer = instance;
	});
}

export function getAppStateInitializer(): AppStateInitializer {
	return instance;
}
