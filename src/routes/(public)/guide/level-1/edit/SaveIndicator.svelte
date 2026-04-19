<script lang="ts">
	import { useEditorContext } from '../_lib/EditorContext.svelte';

	const ctx = useEditorContext();

	let tick = $state(0);
	$effect(() => {
		const id = setInterval(() => {
			tick++;
		}, 1000);
		return () => clearInterval(id);
	});

	const label = $derived.by(() => {
		// Touch tick so the derived re-runs every second.
		void tick;
		switch (ctx.autosave.status) {
			case 'idle':
				return ctx.autosave.lastSavedAt
					? `Saved ${secondsAgo(ctx.autosave.lastSavedAt)}s ago`
					: 'Not yet saved';
			case 'saving':
				return 'Saving…';
			case 'saved':
				return `Saved ${secondsAgo(ctx.autosave.lastSavedAt)}s ago`;
			case 'error':
				return 'Save failed — click to retry';
		}
	});

	function secondsAgo(t: number | null): number {
		if (t === null) return 0;
		return Math.max(0, Math.floor((Date.now() - t) / 1000));
	}

	function onClick() {
		if (ctx.autosave.status === 'error') {
			void ctx.autosave.flushNow();
		}
	}
</script>

<button
	class="save-indicator"
	data-status={ctx.autosave.status}
	onclick={onClick}
	title={ctx.autosave.lastError?.message ?? ''}
	type="button"
>
	{label}
</button>

<style>
	.save-indicator {
		background: transparent;
		border: 1px solid currentColor;
		border-radius: 999px;
		padding: 0.25rem 0.7rem;
		font-family: system-ui, sans-serif;
		font-size: 0.78rem;
		cursor: default;
	}
	.save-indicator[data-status='saving'] {
		color: #b48a00;
	}
	.save-indicator[data-status='saved'] {
		color: #1a8e3a;
	}
	.save-indicator[data-status='error'] {
		color: #c1272d;
		cursor: pointer;
	}
	.save-indicator[data-status='idle'] {
		color: #777;
	}
</style>
