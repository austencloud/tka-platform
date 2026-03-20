<script lang="ts">
	/**
	 * Fuse Sequence Browser
	 *
	 * Browses solo prop paths or hand paths (compositional elements),
	 * NOT full sequences. The user picks individual prop paths to fuse.
	 */

	import { onMount } from "svelte";
	import { soloPropRepository } from "$lib/shared/foundation/services/implementations/SoloPropRepository";
	import { handPathRepository } from "$lib/shared/foundation/services/implementations/HandPathRepository";

	type BrowseMode = "soloProps" | "handPaths";

	let {
		side,
		onSelect,
	}: {
		side: "left" | "right";
		onSelect: (data: any) => void;
	} = $props();

	// Use any[] to avoid TypeScript union narrowing issues with SoloPropData | HandPathData
	let items = $state<any[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searchQuery = $state("");
	let browseMode = $state<BrowseMode>("soloProps");

	const filtered = $derived.by(() => {
		if (!searchQuery.trim()) return items;
		const q = searchQuery.trim().toLowerCase();
		return items.filter((item: any) => {
			const name = item.name || "";
			const hash = item.contentHash || "";
			return name.toLowerCase().includes(q) || hash.toLowerCase().includes(q);
		});
	});

	async function loadItems() {
		loading = true;
		error = null;
		try {
			if (browseMode === "soloProps") {
				items = await soloPropRepository.list();
			} else {
				items = await handPathRepository.list();
			}
		} catch (err) {
			console.error(`Failed to load ${browseMode} for fuse browser:`, err);
			error = `Failed to load ${browseMode === "soloProps" ? "prop paths" : "hand paths"}`;
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadItems();
	});

	function handleModeChange(mode: BrowseMode) {
		browseMode = mode;
		loadItems();
	}

	const LOCATION_LABELS: Record<string, string> = {
		n: "North", s: "South", e: "East", w: "West",
		ne: "NE", se: "SE", sw: "SW", nw: "NW", c: "Center",
	};

	function locationLabel(loc: string): string {
		return LOCATION_LABELS[loc] ?? loc;
	}

	function getItemLabel(item: any): string {
		if (item.name) return item.name;
		const start = item.startLocation ? locationLabel(item.startLocation) : null;
		const end = item.endLocation ? locationLabel(item.endLocation) : null;
		if (start && end && start !== end) return `${start} → ${end}`;
		if (start) return `From ${start}`;
		return item.contentHash?.slice(0, 8) ?? "Path";
	}

	function getItemMeta(item: any): string {
		const len = item.length ?? item.steps?.length ?? item.locations?.length ?? 0;
		return `${len} beats`;
	}
</script>

<div class="fuse-browser">
	<div class="mode-toggle" role="radiogroup" aria-label="Browse mode">
		<button
			class="mode-chip"
			class:active={browseMode === "soloProps"}
			role="radio"
			aria-checked={browseMode === "soloProps"}
			onclick={() => handleModeChange("soloProps")}
		>Prop Paths</button>
		<button
			class="mode-chip"
			class:active={browseMode === "handPaths"}
			role="radio"
			aria-checked={browseMode === "handPaths"}
			onclick={() => handleModeChange("handPaths")}
		>Hand Paths</button>
	</div>

	<div class="search-bar">
		<i class="fas fa-search search-icon" aria-hidden="true"></i>
		<input
			type="text"
			class="search-input"
			placeholder="Search {browseMode === 'soloProps' ? 'prop paths' : 'hand paths'}..."
			bind:value={searchQuery}
			aria-label="Search {browseMode === 'soloProps' ? 'prop paths' : 'hand paths'}"
		/>
	</div>

	<div class="item-grid themed-scrollbar">
		{#if loading}
			<div class="state-msg">
				<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
				<span>Loading...</span>
			</div>
		{:else if error}
			<div class="state-msg error">
				<span>{error}</span>
			</div>
		{:else if filtered.length === 0}
			<div class="state-msg">
				{#if searchQuery}
					<span>No matches</span>
				{:else}
					<span>No {browseMode === "soloProps" ? "prop paths" : "hand paths"} saved yet.</span>
					<span class="hint">Save sequences to auto-extract compositional elements, or save individual prop paths from the Assemble tab.</span>
				{/if}
			</div>
		{:else}
			{#each filtered as item, i (item.contentHash || i)}
				<button
					class="item-card"
					onclick={() => onSelect(item)}
					aria-label="Select {getItemLabel(item)}"
				>
					<div class="card-info">
						<i class="fas {browseMode === 'soloProps' ? 'fa-hand-paper' : 'fa-route'} card-icon" aria-hidden="true"></i>
						<span class="card-name">{getItemLabel(item)}</span>
						<span class="card-meta">{getItemMeta(item)}</span>
						{#if item.impliedGridMode}
							<span class="card-grid-mode">{item.impliedGridMode}</span>
						{/if}
					</div>
				</button>
			{/each}
		{/if}
	</div>
</div>

<style>
	.fuse-browser {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.mode-toggle {
		display: flex;
		padding: var(--spacing-xs, 4px);
		gap: 2px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		flex-shrink: 0;
	}

	.mode-chip {
		flex: 1;
		padding: 6px 8px;
		border: none;
		border-radius: var(--radius-sm, 6px);
		background: transparent;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		font-size: var(--font-size-compact, 12px);
		font-weight: 500;
		cursor: pointer;
		min-height: 36px;
		transition: background 150ms ease, color 150ms ease;
	}

	.mode-chip.active {
		background: var(--theme-accent, #6366f1);
		color: #ffffff;
	}

	.search-bar {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs, 4px);
		padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		flex-shrink: 0;
	}

	.search-icon {
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
		font-size: var(--font-size-compact, 12px);
	}

	.search-input {
		flex: 1;
		background: none;
		border: none;
		color: var(--theme-text, #ffffff);
		font-size: var(--font-size-sm, 14px);
		outline: none;
		min-height: 36px;
	}

	.search-input::placeholder {
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
	}

	.item-grid {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-xs, 4px);
		padding: var(--spacing-xs, 4px);
		align-content: start;
	}

	.item-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-sm, 8px);
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		border-radius: var(--radius-sm, 8px);
		cursor: pointer;
		color: var(--theme-text, #ffffff);
		text-align: center;
		transition: border-color 0.15s ease;
		min-height: 64px;
	}

	.item-card:hover {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
		background: rgba(255, 255, 255, 0.06);
	}

	.card-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.card-icon {
		font-size: 1.2rem;
		color: var(--theme-accent, #6366f1);
		margin-bottom: 2px;
	}

	.card-name {
		font-size: var(--font-size-compact, 12px);
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}

	.card-meta {
		font-size: 11px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
	}

	.card-grid-mode {
		font-size: 10px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.state-msg {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: var(--spacing-lg, 24px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		font-size: var(--font-size-sm, 14px);
		text-align: center;
	}

	.state-msg.error {
		color: var(--semantic-error, #fca5a5);
	}

	.hint {
		font-size: var(--font-size-compact, 12px);
		max-width: 200px;
		line-height: 1.4;
	}

	@media (prefers-reduced-motion: reduce) {
		.item-card,
		.mode-chip {
			transition: none;
		}
	}
</style>
