export interface InputCapabilities {
	canUsePointerLock(): boolean;
	handlePointerEvent(e: PointerEvent): void;
	current: { currentPointerType: string };
	init(): void;
	destroy(): void;
}

export function createInputCapabilities(): InputCapabilities {
	let currentPointerType = "mouse";

	return {
		canUsePointerLock() {
			return currentPointerType !== "touch" && !!document.documentElement.requestPointerLock;
		},
		handlePointerEvent(e: PointerEvent) {
			currentPointerType = e.pointerType;
		},
		get current() {
			return { currentPointerType };
		},
		init() {},
		destroy() {},
	};
}
