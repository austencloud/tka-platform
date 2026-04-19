<script lang="ts">
	import { onMount } from 'svelte';
	import Page05TableOfContents from '../_pages/Page05TableOfContents.svelte';
	import {
		provideEditorContext,
		type EditorContext
	} from '../_lib/EditorContext.svelte';
	import { validateSidecar, type PageSidecar } from '../_lib/sidecar-schema';
	import sidecarPage5 from '../_data/page-05.json';
	import EditorShell from './EditorShell.svelte';

	let activePage = $state(5);
	let editorReady = $state(false);
	let ctx: EditorContext | null = null;

	function loadPage(n: number): boolean {
		if (n === 5) {
			const data = sidecarPage5 as unknown as PageSidecar;
			validateSidecar(data);
			ctx = provideEditorContext(data);
			editorReady = true;
			return true;
		}
		editorReady = false;
		ctx = null;
		return false;
	}

	loadPage(activePage);

	function onJump(n: number) {
		activePage = n;
		loadPage(n);
	}

	onMount(() => {
		const splash = document.getElementById('app-loading');
		if (splash) splash.style.display = 'none';
		(window as unknown as { __tkaLoadProgress?: () => void }).__tkaLoadProgress = () => {};
	});

	function onKeydown(e: KeyboardEvent) {
		if (!ctx) return;
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

<svelte:window onkeydown={onKeydown} />
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
