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
		position: relative;
		height: 100dvh;
		overflow: hidden;
		background: oklch(0.115 0.008 270);
		color: oklch(0.9 0.02 270);
	}

	/* Grain: the whole room reads as printed matter, not a gradient app. */
	.playable-viewport::after {
		content: "";
		position: absolute;
		inset: 0;
		z-index: 100;
		pointer-events: none;
		opacity: 0.05;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
	}

	:global(body:has(.playable-viewport)) {
		overflow: hidden;
	}
</style>
