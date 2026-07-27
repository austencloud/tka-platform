<!--
CollectionPickerHost.svelte

Always-mounted host for the collections picker, sitting at app level in
MainApplication next to the other global sheets. Card menus call
openCollectionPicker() instead of rendering their own sheet, so the drawer
survives the card that opened it disappearing (which is exactly what happens
when you untick the collection you're currently browsing).
-->
<script lang="ts">
	import { collectionPickerState } from "$lib/features/library/state/collection-picker-state.svelte";
	import CollectionPickerSheet from "./CollectionPickerSheet.svelte";
</script>

{#if collectionPickerState.sequenceId}
	<CollectionPickerSheet
		isOpen={collectionPickerState.isOpen}
		sequenceId={collectionPickerState.sequenceId}
		sequenceLabel={collectionPickerState.sequenceLabel}
		currentCollectionId={collectionPickerState.currentCollectionId}
		onClose={() => collectionPickerState.close()}
	/>
{/if}
