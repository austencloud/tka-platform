<script lang="ts">
	import { useEditorContext } from '../_lib/EditorContext.svelte';
	import type { PlacedAsset } from '../_lib/sidecar-schema';

	const ctx = useEditorContext();

	const selected = $derived<PlacedAsset | null>(
		ctx.selectedAssetId
			? ctx.sidecar.placedAssets.find((a) => a.id === ctx.selectedAssetId) ?? null
			: null
	);

	function setPosition(field: 'x' | 'y', raw: string) {
		if (!selected) return;
		const v = Number(raw);
		if (!Number.isFinite(v)) return;
		const id = selected.id;
		ctx.mutate(
			(draft) => {
				const asset = draft.placedAssets.find((a) => a.id === id);
				if (asset) asset.position = { ...asset.position, [field]: v };
				return draft;
			},
			{ key: `inspector:pos:${id}`, withinMs: 600 }
		);
	}

	function setSize(field: 'width' | 'height', raw: string) {
		if (!selected) return;
		const v = Number(raw);
		if (!Number.isFinite(v) || v < 0) return;
		const id = selected.id;
		ctx.mutate(
			(draft) => {
				const asset = draft.placedAssets.find((a) => a.id === id);
				if (asset) asset.size = { ...asset.size, [field]: v };
				return draft;
			},
			{ key: `inspector:size:${id}`, withinMs: 600 }
		);
	}

	function setColumnsOverride(raw: string) {
		if (!selected) return;
		const id = selected.id;
		const parsed = raw === '' ? undefined : Number(raw);
		if (parsed !== undefined && (!Number.isInteger(parsed) || parsed < 1)) return;
		ctx.mutate((draft) => {
			const asset = draft.placedAssets.find((a) => a.id === id);
			if (asset) {
				asset.overrides = { ...asset.overrides, columnsOverride: parsed };
			}
			return draft;
		});
	}

	function deleteAsset() {
		if (!selected) return;
		const id = selected.id;
		ctx.mutate((draft) => {
			draft.placedAssets = draft.placedAssets.filter((a) => a.id !== id);
			return draft;
		});
		ctx.selectedAssetId = null;
	}
</script>

<section class="inspector">
	<header><h3>Inspector</h3></header>

	{#if !selected}
		<p class="empty">Select a placed asset on the canvas to edit its position, size, and overrides.</p>
	{:else}
		<dl class="meta">
			<dt>Type</dt>
			<dd>{selected.type}</dd>
			<dt>ID</dt>
			<dd class="mono">{selected.id.slice(0, 12)}…</dd>
			{#if selected.libraryId}
				<dt>Library</dt>
				<dd class="mono">{selected.libraryId}</dd>
			{/if}
		</dl>

		<fieldset>
			<legend>Position ({selected.position.unit})</legend>
			<label>
				x
				<input
					type="number"
					step="0.5"
					value={selected.position.x}
					oninput={(e) => setPosition('x', (e.currentTarget as HTMLInputElement).value)}
				/>
			</label>
			<label>
				y
				<input
					type="number"
					step="0.5"
					value={selected.position.y}
					oninput={(e) => setPosition('y', (e.currentTarget as HTMLInputElement).value)}
				/>
			</label>
		</fieldset>

		<fieldset>
			<legend>Size ({selected.size.unit})</legend>
			<label>
				width
				<input
					type="number"
					step="0.5"
					min="0"
					value={selected.size.width}
					oninput={(e) => setSize('width', (e.currentTarget as HTMLInputElement).value)}
				/>
			</label>
			<label>
				height
				<input
					type="number"
					step="0.5"
					min="0"
					value={selected.size.height}
					oninput={(e) => setSize('height', (e.currentTarget as HTMLInputElement).value)}
				/>
			</label>
		</fieldset>

		{#if selected.type === 'sequence'}
			<fieldset>
				<legend>Sequence overrides</legend>
				<label>
					columns
					<input
						type="number"
						min="1"
						placeholder="auto"
						value={selected.overrides.columnsOverride ?? ''}
						oninput={(e) => setColumnsOverride((e.currentTarget as HTMLInputElement).value)}
					/>
				</label>
			</fieldset>
		{/if}

		<button class="danger" type="button" onclick={deleteAsset}>Delete asset</button>
	{/if}
</section>

<style>
	.inspector {
		background: #11151c;
		color: #e6e8ec;
		padding: 1rem;
		font-family: system-ui, sans-serif;
		font-size: 0.85rem;
		border-top: 1px solid #1f2530;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	header h3 {
		margin: 0;
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #cdd1d9;
	}
	.empty {
		color: #6a7280;
		line-height: 1.4;
		margin: 0;
	}
	.meta {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 0.6rem;
		margin: 0;
	}
	.meta dt {
		color: #6a7280;
	}
	.meta dd {
		margin: 0;
	}
	.mono {
		font-family: ui-monospace, monospace;
		font-size: 0.78rem;
	}
	fieldset {
		border: 1px solid #1f2530;
		border-radius: 4px;
		padding: 0.5rem 0.75rem;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
	}
	fieldset legend {
		color: #cdd1d9;
		font-size: 0.78rem;
		padding: 0 0.3rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		color: #6a7280;
		font-size: 0.72rem;
	}
	input {
		background: #0d1117;
		color: #e6e8ec;
		border: 1px solid #2a3344;
		border-radius: 3px;
		padding: 0.3rem 0.4rem;
		font: inherit;
	}
	input:focus {
		outline: 2px solid #4ea7e8;
		outline-offset: 1px;
	}
	.danger {
		background: transparent;
		color: #f08a8e;
		border: 1px solid #5a2a2d;
		border-radius: 4px;
		padding: 0.4rem 0.6rem;
		cursor: pointer;
		font: inherit;
	}
	.danger:hover {
		background: #2a1517;
	}
</style>
