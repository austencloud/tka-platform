<script lang="ts">
	/**
	 * TerrainResearchModule
	 *
	 * Temporary module wrapping the terrain research lab.
	 * This provides a visual comparison of open-source terrain implementations.
	 *
	 * TODO: Remove this module once terrain research is complete.
	 */
</script>

<!-- Import the page content directly -->
<div class="terrain-research-module">
	{#await import("../../../routes/test/terrain-research/+page.svelte") then module}
		<svelte:component this={module.default} />
	{/await}
</div>

<style>
	.terrain-research-module {
		width: 100%;
		height: 100%;
		overflow: auto;
	}
</style>
