<script lang="ts">
	import { onMount } from 'svelte';
	import { LibraryClient } from '../library-client';
	import { LIBRARY_DRAG_MIME } from '../library-drop';
	import { useEditorContext } from '../EditorContext.svelte';
	import {
		emptyLibrary,
		type GuideLibrary,
		type LibraryEntry,
		type LibraryEntryKind
	} from '../library-schema';

	type FilterMode = 'all' | 'pictograph' | 'sequence';

	const ctx = useEditorContext();
	const client = new LibraryClient();

	let library: GuideLibrary = $state(emptyLibrary());
	let loading = $state(true);
	let error: string | null = $state(null);
	let filter: FilterMode = $state('all');

	async function load() {
		loading = true;
		error = null;
		try {
			library = await client.fetch();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Library failed to load';
		} finally {
			loading = false;
		}
	}

	onMount(load);

	// Per-page placement counts. A future enhancement counts across all pages.
	const placementCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const a of ctx.sidecar.placedAssets) {
			if (typeof a.libraryId !== 'string') continue;
			counts.set(a.libraryId, (counts.get(a.libraryId) ?? 0) + 1);
		}
		return counts;
	});

	const filteredEntries = $derived.by(() => {
		if (filter === 'all') return library.entries;
		return library.entries.filter((e) => e.kind === filter);
	});

	function handleDragStart(e: DragEvent, entry: LibraryEntry) {
		if (!e.dataTransfer) return;
		e.dataTransfer.setData(
			LIBRARY_DRAG_MIME,
			JSON.stringify({ id: entry.id, kind: entry.kind })
		);
		e.dataTransfer.effectAllowed = 'copy';
	}

	function placeholderInitial(label: string): string {
		const ch = label.trim().charAt(0);
		return ch.length > 0 ? ch.toUpperCase() : '?';
	}

	function kindLabel(kind: LibraryEntryKind): string {
		return kind === 'pictograph' ? 'PICTOGRAPH' : 'SEQUENCE';
	}

	function handleAddManual() {
		console.log('[LibraryPanel] Manual entry creation: Phase 3 (Pictograph Picker)');
	}
</script>

<aside class="library-panel">
	<header class="header">
		<h3>Library</h3>
		<button
			type="button"
			class="add-manual"
			onclick={handleAddManual}
			title="Add manual entry (Phase 3)"
			aria-label="Add manual entry"
		>
			+
		</button>
	</header>

	<div class="filters" role="tablist" aria-label="Filter library entries">
		<button
			type="button"
			role="tab"
			aria-selected={filter === 'all'}
			class:active={filter === 'all'}
			onclick={() => (filter = 'all')}
		>
			All
		</button>
		<button
			type="button"
			role="tab"
			aria-selected={filter === 'pictograph'}
			class:active={filter === 'pictograph'}
			onclick={() => (filter = 'pictograph')}
		>
			Pictographs
		</button>
		<button
			type="button"
			role="tab"
			aria-selected={filter === 'sequence'}
			class:active={filter === 'sequence'}
			onclick={() => (filter = 'sequence')}
		>
			Sequences
		</button>
	</div>

	<div class="body">
		{#if loading}
			<div class="grid">
				{#each Array.from({ length: 4 }, (_, i) => i) as i (i)}
					<div class="tile skeleton" aria-hidden="true">
						<div class="thumb skeleton-block"></div>
						<div class="label skeleton-block"></div>
					</div>
				{/each}
			</div>
		{:else if error}
			<button type="button" class="error" onclick={load}>
				Library failed to load — click to retry
				<span class="error-detail">{error}</span>
			</button>
		{:else if filteredEntries.length === 0}
			<p class="empty">
				{#if library.entries.length === 0}
					No library entries yet. Use 'Save to Guide' from the main app's
					Save dialog to add pictographs and sequences.
				{:else}
					No entries match this filter.
				{/if}
			</p>
		{:else}
			<div class="grid">
				{#each filteredEntries as entry (entry.id)}
					{@const count = placementCounts.get(entry.id) ?? 0}
					<div
						class="tile"
						role="button"
						tabindex="0"
						aria-label={`Drag ${entry.label} onto the page`}
						draggable="true"
						ondragstart={(e) => handleDragStart(e, entry)}
						title={entry.label}
					>
						<div class="thumb">
							{#if entry.thumbnailPath}
								<img src={entry.thumbnailPath} alt={entry.label} draggable="false" />
							{:else}
								<div class="placeholder">
									<span class="placeholder-kind">{kindLabel(entry.kind)}</span>
									<span class="placeholder-initial">{placeholderInitial(entry.label)}</span>
								</div>
							{/if}
							{#if count > 0}
								<span class="badge" title="{count} placement(s) on this page">
									{count} placed
								</span>
							{/if}
						</div>
						<div class="label">{entry.label}</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</aside>

<style>
	.library-panel {
		background: #11151c;
		color: #e6e8ec;
		height: 100%;
		display: flex;
		flex-direction: column;
		font-family: system-ui, sans-serif;
		font-size: 0.85rem;
		min-height: 0;
	}
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #1f2530;
	}
	.header h3 {
		margin: 0;
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #cdd1d9;
	}
	.add-manual {
		width: 24px;
		height: 24px;
		border: 1px solid #2a3140;
		background: #1a2030;
		color: #cdd1d9;
		border-radius: 4px;
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
	}
	.add-manual:hover {
		background: #232a3a;
	}
	.filters {
		display: flex;
		gap: 0.25rem;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid #1f2530;
	}
	.filters button {
		flex: 1;
		padding: 0.35rem 0.5rem;
		background: transparent;
		border: 1px solid #2a3140;
		color: #8a93a4;
		border-radius: 4px;
		font-size: 0.75rem;
		cursor: pointer;
	}
	.filters button:hover {
		color: #cdd1d9;
	}
	.filters button.active {
		background: #2b3650;
		border-color: #3b4a6e;
		color: #e6e8ec;
	}
	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0.75rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}
	.tile {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		background: #161b25;
		border: 1px solid #1f2530;
		border-radius: 6px;
		padding: 0.4rem;
		cursor: grab;
		user-select: none;
	}
	.tile:hover {
		border-color: #3b4a6e;
	}
	.tile:active {
		cursor: grabbing;
	}
	.thumb {
		position: relative;
		width: 100%;
		aspect-ratio: 1 / 1;
		background: #0d1117;
		border-radius: 4px;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		pointer-events: none;
	}
	.placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		color: #6a7280;
	}
	.placeholder-kind {
		font-size: 0.6rem;
		letter-spacing: 0.08em;
	}
	.placeholder-initial {
		font-size: 1.5rem;
		font-weight: 600;
		color: #cdd1d9;
	}
	.badge {
		position: absolute;
		top: 4px;
		right: 4px;
		padding: 2px 6px;
		font-size: 0.65rem;
		background: rgba(43, 54, 80, 0.95);
		border: 1px solid #3b4a6e;
		color: #e6e8ec;
		border-radius: 999px;
	}
	.label {
		font-size: 0.75rem;
		color: #cdd1d9;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.empty {
		color: #6a7280;
		line-height: 1.4;
		margin: 0;
		padding: 0.5rem;
	}
	.error {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		width: 100%;
		text-align: left;
		background: #2a1818;
		border: 1px solid #4a2828;
		color: #e6a8a8;
		padding: 0.75rem;
		border-radius: 6px;
		cursor: pointer;
		font-family: inherit;
		font-size: inherit;
	}
	.error-detail {
		font-size: 0.7rem;
		color: #b88080;
		font-family: monospace;
	}
	.skeleton .skeleton-block {
		background: linear-gradient(90deg, #1a2030 0%, #232a3a 50%, #1a2030 100%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 4px;
	}
	.skeleton .thumb {
		background: transparent;
	}
	.skeleton .label {
		height: 0.75rem;
		width: 70%;
	}
	@keyframes shimmer {
		from {
			background-position: 200% 0;
		}
		to {
			background-position: -200% 0;
		}
	}
</style>
