<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Page05TableOfContents from '../_pages/Page05TableOfContents.svelte';
	import { provideEditorContext } from '../_lib/EditorContext.svelte';
	import { type PageSidecar } from '../_lib/sidecar-schema';
	import sidecarPage5 from '../_data/page-05.json';
	import EditorShell from './EditorShell.svelte';

	// Context is created exactly once during component init; subsequent page
	// jumps swap the loaded sidecar in-place via ctx.loadSidecar. Calling
	// provideEditorContext again outside init triggers Svelte's
	// lifecycle_outside_component error and breaks navigation.
	const initialPage = 5;
	const initialSidecar = sidecarPage5 as unknown as PageSidecar;
	const ctx = provideEditorContext(initialSidecar);

	let activePage = $state(initialPage);
	const editableSet = new Set<number>([5]);
	const editorReady = $derived(editableSet.has(activePage));

	async function onJump(n: number) {
		if (n === activePage) return;
		activePage = n;
		if (n === 5) {
			await ctx.loadSidecar(sidecarPage5 as unknown as PageSidecar);
		}
		// Other pages: leave ctx pointing at the previously-loaded sidecar
		// so EditableText/SaveIndicator inside the editor shell stay valid.
		// The canvas renders the "not yet editable" placeholder.
	}

	onMount(() => {
		const splash = document.getElementById('app-loading');
		if (splash) splash.style.display = 'none';
		(window as unknown as { __tkaLoadProgress?: () => void }).__tkaLoadProgress = () => {};
	});

	// Flush any pending autosave before the tab/route unloads so the last
	// keystroke isn't lost in the 800ms debounce window.
	function onBeforeUnload() {
		void ctx.autosave.flushNow();
	}

	onDestroy(() => {
		void ctx.autosave.flushNow();
	});

	function onKeydown(e: KeyboardEvent) {
		const isMac =
			typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
		const meta = isMac ? e.metaKey : e.ctrlKey;
		if (!meta) return;
		const active = document.activeElement as HTMLElement | null;
		if (active?.classList.contains('ProseMirror')) return;
		if (e.key === 'z' && !e.shiftKey) {
			e.preventDefault();
			ctx.performUndo();
		} else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
			e.preventDefault();
			ctx.performRedo();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} onbeforeunload={onBeforeUnload} />
<svelte:head>
	<title>Guide Editor — Level 1 Page {activePage}</title>
</svelte:head>

<EditorShell {activePage} {onJump}>
	{#if activePage === 5 && editorReady}
		<Page05TableOfContents />
	{:else}
		<div class="not-yet-migrated">
			<h2>Page {activePage} — not yet editable</h2>
			<p>
				Only Page 5 has been migrated to the editor in Phase 1. Other pages
				render via the existing
				<a href="/guide/level-1#page-{activePage}">read-only route</a>.
			</p>
		</div>
	{/if}
</EditorShell>

<style>
	:global(body) {
		margin: 0;
	}
	.not-yet-migrated {
		color: #cdd1d9;
		max-width: 40ch;
		padding: 2rem;
		font-family: system-ui, sans-serif;
		line-height: 1.5;
	}
	.not-yet-migrated h2 {
		color: #fff;
		margin: 0 0 1rem;
	}
	.not-yet-migrated a {
		color: #6cb6f0;
	}
</style>
