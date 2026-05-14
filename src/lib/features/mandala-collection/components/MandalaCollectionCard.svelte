<script lang="ts">
	import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
	import type { CollectedMandala } from "../domain/mandala-collection-types";

	let {
		mandala,
		onDelete,
	}: {
		mandala: CollectedMandala;
		onDelete: (id: string) => void;
	} = $props();

	const dateLabel = $derived(
		new Date(mandala.createdAt).toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
		})
	);
</script>

<div class="collection-card">
	<div class="card-mandala">
		<SequenceMandala
			sequence={{ steps: mandala.steps }}
			mode="card-back"
			style="stroke"
			show={mandala.variant}
			size={160}
			bluePropType={mandala.bluePropType}
			redPropType={mandala.redPropType}
		/>
	</div>
	<div class="card-info">
		<span class="card-name">{mandala.name}</span>
		<span class="card-date">{dateLabel}</span>
	</div>
	<button
		class="card-delete"
		onclick={() => onDelete(mandala.id)}
		type="button"
		aria-label="Delete {mandala.name}"
	>
		<i class="fas fa-trash-alt" aria-hidden="true"></i>
	</button>
</div>

<style>
	.collection-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 12px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		border-radius: 12px;
		transition: border-color 200ms ease;
	}

	.collection-card:hover {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
	}

	.card-mandala {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.card-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}

	.card-name {
		font-size: 13px;
		font-weight: 500;
		color: var(--theme-text, #fff);
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 140px;
	}

	.card-date {
		font-size: 11px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
	}

	.card-delete {
		position: absolute;
		top: 6px;
		right: 6px;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 6px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
		cursor: pointer;
		opacity: 0;
		transition: opacity 150ms ease, color 150ms ease, background 150ms ease;
		font-size: 12px;
	}

	.collection-card:hover .card-delete {
		opacity: 1;
	}

	.card-delete:hover {
		color: var(--semantic-error, #ef4444);
		background: color-mix(in srgb, var(--semantic-error, #ef4444) 12%, transparent);
	}
</style>
