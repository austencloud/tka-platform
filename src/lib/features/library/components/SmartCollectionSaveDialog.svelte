<!--
SmartCollectionSaveDialog.svelte

Names and saves the CURRENT engine's active filters as a Smart Collection.
Given a live BrowseEngine, it snapshots {source, filters, sort} via
buildFilterSpecFromEngine on save. Reused by every browse host that offers a
"Save as Smart Collection" action (gallery = community pool, All library =
my-library pool).
-->
<script lang="ts">
	import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
	import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
	import type { BrowseEngine } from "$lib/shared/browse/engine/types";
	import { buildFilterSpecFromEngine } from "$lib/shared/browse/services/smart-filter-spec";
	import { collectionsState } from "$lib/features/library/state/collections-state.svelte";
	import { toast } from "$lib/shared/toast/state/toast-state.svelte";

	let {
		engine,
		show = $bindable(false),
	}: {
		engine: BrowseEngine;
		show?: boolean;
	} = $props();

	let name = $state("");
	let saving = $state(false);

	$effect(() => {
		// Reset the field each time the dialog opens.
		if (show) {
			name = "";
			saving = false;
		}
	});

	async function save() {
		const trimmed = name.trim();
		if (!trimmed || saving) return;
		saving = true;
		const spec = buildFilterSpecFromEngine(engine);
		const created = await collectionsState.createSmart(trimmed, spec);
		saving = false;
		if (created) {
			toast.success(`Smart collection "${created.name}" saved.`);
			show = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			void save();
		} else if (e.key === "Escape") {
			e.preventDefault();
			show = false;
		}
	}
</script>

<Drawer bind:isOpen={show} placement="bottom">
	<DrawerHeader title="Save as Smart Collection" onClose={() => (show = false)} />
	<div class="save-smart">
		<p class="hint">
			This saves your current filters as a rule. The collection stays up to
			date on its own — new matching sequences show up automatically.
		</p>
		<div class="row">
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="text"
				class="name-field"
				placeholder="Name this smart collection"
				aria-label="Smart collection name"
				bind:value={name}
				onkeydown={handleKeydown}
				maxlength="60"
				autofocus
			/>
			<button
				type="button"
				class="save-btn"
				onclick={save}
				disabled={!name.trim() || saving}
			>
				<i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
				<span>Save</span>
			</button>
		</div>
	</div>
</Drawer>

<style>
	.save-smart {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 16px;
		max-width: 520px;
		margin: 0 auto;
	}

	.hint {
		margin: 0;
		font-size: var(--font-size-sm, 14px);
		line-height: 1.5;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
	}

	.row {
		display: flex;
		gap: 8px;
	}

	.name-field {
		flex: 1;
		min-width: 0;
		height: 44px;
		padding: 0 14px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid color-mix(in srgb, var(--theme-accent) 45%, transparent);
		border-radius: 12px;
		color: var(--theme-text, white);
		font-size: var(--font-size-sm, 14px);
		font-family: inherit;
	}

	.name-field:focus {
		outline: none;
		border-color: color-mix(in srgb, var(--theme-accent) 70%, transparent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent) 14%, transparent);
	}

	.save-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 44px;
		padding: 0 18px;
		flex-shrink: 0;
		border: 1px solid color-mix(in srgb, var(--theme-accent) 45%, transparent);
		border-radius: 12px;
		background: color-mix(in srgb, var(--theme-accent) 22%, transparent);
		color: var(--theme-text, white);
		font-size: var(--font-size-sm, 14px);
		font-weight: 600;
		cursor: pointer;
	}

	.save-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
