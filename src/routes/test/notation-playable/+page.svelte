<!--
  /test/notation-playable — the playable-archive prototype for /notation.
  A one-screen, horizontal Artifact Rail over the real NOTATION_CATALOG.
  Production /notation is untouched during this visual exploration.

  Spec: docs/superpowers/specs/2026-07-27-notation-playable-archive-design.md
-->
<script lang="ts">
	import PlayableArchive from "./_components/PlayableArchive.svelte";
</script>

<svelte:head>
	<title>Playable archive prototype</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="playable-viewport">
	<PlayableArchive />
</div>

<style>
	.playable-viewport {
		height: 100dvh;
		overflow: hidden;
		background:
			radial-gradient(120% 90% at 50% 0%, oklch(0.2 0.04 280 / 0.6), transparent 60%),
			oklch(0.11 0.015 270);
		color: oklch(0.9 0.02 270);
	}

	:global(body:has(.playable-viewport)) {
		overflow: hidden;
	}
</style>
