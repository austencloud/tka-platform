<script lang="ts">
	import { onDestroy } from 'svelte';
	import { provideEditorContext } from '../EditorContext.svelte';
	import { type PageSidecar } from '../sidecar-schema';
	import { pages } from '../page-manifest';
	import { getOriginalArtboard } from '../original-artboards';
	import sidecarPage5 from '../../_data/page-05.json';
	import ArtboardPage from '../ArtboardPage.svelte';
	import EditorShell from './EditorShell.svelte';
	import ReadOnlyPageBoundary from './ReadOnlyPageBoundary.svelte';
	import { editorPrefs } from './editor-prefs.svelte';

	interface Props {
		initialPage: number;
		onNavigate: (n: number) => void;
	}
	let { initialPage, onNavigate }: Props = $props();

	const firstSidecar = loadSidecarFor(initialPage) ?? emptyPlaceholder(initialPage);
	const ctx = provideEditorContext(firstSidecar);

	let activePage = $state(initialPage);

	function loadSidecarFor(n: number): PageSidecar | null {
		if (n === 5) return sidecarPage5 as unknown as PageSidecar;
		return null;
	}

	function emptyPlaceholder(n: number): PageSidecar {
		return { pageNumber: n, text: {}, placedAssets: [] };
	}

	async function focusPage(n: number) {
		if (n === activePage) return;
		activePage = n;
		onNavigate(n);
		const sidecar = loadSidecarFor(n) ?? emptyPlaceholder(n);
		await ctx.loadSidecar(sidecar);
	}

	// Book-layout spread pairing: page 1 alone on right (cover), then 2-3,
	// 4-5, ..., 46-47 face each other.
	const spread = $derived<{ left: number | null; right: number | null }>(
		activePage === 1
			? { left: null, right: 1 }
			: activePage % 2 === 0
				? { left: activePage, right: activePage + 1 <= pages.length ? activePage + 1 : null }
				: { left: activePage - 1, right: activePage }
	);

	function componentFor(n: number | null) {
		if (n === null) return null;
		const entry = pages.find((p) => p.pageNumber === n);
		return entry && entry.kind === 'svelte' ? entry.component : null;
	}

	const leftComp = $derived(componentFor(spread.left));
	const rightComp = $derived(componentFor(spread.right));
	const activeComp = $derived(componentFor(activePage));
	const activeArtboard = $derived(getOriginalArtboard(activePage));

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
		const inEditable = active?.classList.contains('ProseMirror');
		// Zoom shortcuts work even inside TipTap — they're view-level, not edit-level.
		if (e.key === '=' || e.key === '+') {
			e.preventDefault();
			editorPrefs.zoomIn();
			return;
		}
		if (e.key === '-' || e.key === '_') {
			e.preventDefault();
			editorPrefs.zoomOut();
			return;
		}
		if (e.key === '0') {
			e.preventDefault();
			editorPrefs.resetZoom();
			return;
		}
		if (inEditable) return;
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

<EditorShell {activePage} onJump={focusPage}>
	{#if editorPrefs.viewMode === 'compare'}
		<div class="compare">
			<div class="pane original-pane">
				<div class="pane-label">Original</div>
				{#if activeArtboard}
					<ArtboardPage
						src={activeArtboard}
						pageNumber={activePage}
						label="Original page {activePage}"
					/>
				{:else}
					<div class="missing">No original artboard for page {activePage}</div>
				{/if}
			</div>
			<div class="pane reconstructed-pane">
				<div class="pane-label">Reconstructed</div>
				{#if activeComp}
					{@const Comp = activeComp}
					<Comp />
				{:else}
					<div class="missing">No Svelte component for page {activePage}</div>
				{/if}
			</div>
		</div>
	{:else if editorPrefs.viewMode === 'spread'}
		<div class="spread">
			<div
				class="slot"
				class:focused={spread.left === activePage}
				class:ghost={spread.left === null}
			>
				{#if leftComp && spread.left !== null}
					{#if spread.left === activePage}
						{@const Comp = leftComp}
						<Comp />
					{:else}
						<button
							type="button"
							class="focus-overlay"
							onclick={() => focusPage(spread.left as number)}
							title="Click to focus page {spread.left}"
							aria-label="Focus page {spread.left}"
						></button>
						<ReadOnlyPageBoundary>
							{@const Comp = leftComp}
							<Comp />
						</ReadOnlyPageBoundary>
					{/if}
				{/if}
			</div>
			<div
				class="slot"
				class:focused={spread.right === activePage}
				class:ghost={spread.right === null}
			>
				{#if rightComp && spread.right !== null}
					{#if spread.right === activePage}
						{@const Comp = rightComp}
						<Comp />
					{:else}
						<button
							type="button"
							class="focus-overlay"
							onclick={() => focusPage(spread.right as number)}
							title="Click to focus page {spread.right}"
							aria-label="Focus page {spread.right}"
						></button>
						<ReadOnlyPageBoundary>
							{@const Comp = rightComp}
							<Comp />
						</ReadOnlyPageBoundary>
					{/if}
				{/if}
			</div>
		</div>
	{:else}
		{#if activeComp}
			{@const Single = activeComp}
			<Single />
		{:else}
			<div class="not-yet-migrated">
				<h2>Page {activePage} — component missing</h2>
				<p>The page manifest has no svelte component for this page number.</p>
			</div>
		{/if}
	{/if}
</EditorShell>

<style>
	.spread {
		display: flex;
		gap: 0.25in;
		align-items: flex-start;
	}
	.slot {
		position: relative;
	}
	.slot.focused {
		outline: 2px solid #4ea7e8;
		outline-offset: 6px;
	}
	.slot.ghost {
		visibility: hidden;
	}
	.focus-overlay {
		position: absolute;
		inset: 0;
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0;
		margin: 0;
		z-index: 5;
	}
	.focus-overlay:hover {
		background: rgba(78, 167, 232, 0.08);
	}
	.focus-overlay:focus-visible {
		outline: 2px solid #4ea7e8;
		outline-offset: 2px;
	}

	.compare {
		/* Flex with explicit pane sizing — grid's 1fr inside a flex parent with
		   no explicit width was resolving asymmetrically, causing only the
		   right pane to pick up the zoom transform. */
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
		/* Natural size = 2× page width + gap. Panes can shrink below this via
		   min-width: 0 when the canvas is narrower. */
		width: max-content;
		max-width: 100%;
	}
	.pane {
		flex: 1 1 0;
		min-width: 0;
		width: 8.5in;
		position: relative;
		background: #ececec;
		border-radius: 4px;
		padding: 0.5rem;
	}
	.pane-label {
		position: absolute;
		top: 0.4rem;
		left: 0.6rem;
		font-family: system-ui, sans-serif;
		font-size: 0.7rem;
		color: #5a6270;
		background: rgba(255, 255, 255, 0.88);
		padding: 0.1rem 0.4rem;
		border-radius: 3px;
		z-index: 5;
	}
	.reconstructed-pane {
		outline: 2px solid #4ea7e8;
		outline-offset: 4px;
	}
	.pane :global(.page),
	.pane :global(.text-page),
	.pane :global(.title-page),
	.pane :global(.artboard-page) {
		width: 100%;
		max-width: 100%;
		margin: 0;
		box-shadow: none;
	}
	.pane :global(.artboard) {
		width: 100%;
		height: auto;
	}

	.missing {
		padding: 4rem 1rem;
		text-align: center;
		color: #888;
		font-family: system-ui, sans-serif;
		font-style: italic;
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
</style>
