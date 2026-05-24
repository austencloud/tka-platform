export interface AnimationLoopOptions {
	onTick: (dt: number) => void;
	active?: boolean;
}

export function useAnimationLoop(options: AnimationLoopOptions): () => void {
	let rafId = 0;
	let prevTime = 0;
	let running = false;

	function tick() {
		if (document.hidden) {
			running = false;
			return;
		}
		const now = performance.now();
		const dt = prevTime === 0 ? 0 : (now - prevTime) / 1000;
		prevTime = now;
		options.onTick(dt);
		rafId = requestAnimationFrame(tick);
	}

	function start() {
		if (running) return;
		running = true;
		prevTime = performance.now();
		rafId = requestAnimationFrame(tick);
	}

	function stop() {
		running = false;
		cancelAnimationFrame(rafId);
		rafId = 0;
	}

	function onVisibility() {
		if (document.hidden) {
			stop();
		} else if (options.active !== false) {
			start();
		}
	}

	document.addEventListener("visibilitychange", onVisibility);

	if (options.active !== false) {
		start();
	}

	return () => {
		stop();
		document.removeEventListener("visibilitychange", onVisibility);
	};
}
