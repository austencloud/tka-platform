<script lang="ts">
	import { ERA_CONFIGS } from "$lib/features/retro/shared/domain/era-types";
	const era = ERA_CONFIGS.dos;
</script>

<svelte:head>
	<title>{era.title}</title>
</svelte:head>

<div class="era-placeholder">
	<h1>{era.title}</h1>
	<p>{era.subtitle}</p>
	<p class="phase">Coming soon</p>
	<a href="/1995">Visit TKA-OS v1.0 (Win95)</a>
</div>

<style>
	.era-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: #000;
		color: #33ff33;
		font-family: "Courier New", monospace;
		text-align: center;
		gap: 12px;
	}
	h1 {
		font-size: 24px;
	}
	p {
		margin: 0;
	}
	.phase {
		color: #888;
		font-style: italic;
	}
	a {
		color: #33ffff;
	}
</style>
