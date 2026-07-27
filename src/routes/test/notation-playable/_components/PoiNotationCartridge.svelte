<!--
  PoiNotation artifact: a code cartridge holding verbatim syntax from Tiffany
  Fong's repository README (github.com/tiffanyfong/PoiNotation, read
  2026-07-27). Nothing on this surface is invented — the two lines are the
  README's own example, and the caption is the repository's own sentence.
  When active, a cursor steps through the example lines.
-->
<script lang="ts">
	import { MediaQuery } from "svelte/reactivity";

	let { active = false }: { active?: boolean } = $props();

	// Verbatim from the repository README.
	const LINES = [
		"{extended: true, rotations: 1, armSpin: cw, handleSpin: cw} ~",
		"{extended: true, rotations: 2, armSpin: ccw, handleSpin: antispin} * 2",
	];

	const reduceMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
	let litLine = $state(0);

	$effect(() => {
		if (!active || reduceMotion.current) return;
		const timer = setInterval(() => {
			litLine = (litLine + 1) % LINES.length;
		}, 1800);
		return () => clearInterval(timer);
	});
</script>

<div class="cartridge" role="img" aria-label="An example of PoiNotation syntax from the repository">
	<div class="cartridge-top" aria-hidden="true">
		<span class="dot"></span>
		<span class="dot"></span>
		<span class="dot"></span>
		<span class="path">PoiNotation</span>
	</div>
	<pre class="code"><code
			>{#each LINES as line, i (i)}<span
				class="line"
				class:lit={active && i === litLine}
				>{line}</span
			>{/each}</code
		></pre>
	<p class="caption">"Moves can be sequenced to create choreographies."</p>
</div>

<style>
	.cartridge {
		width: min(92%, 54rem);
		margin: auto;
		height: fit-content;
		align-self: center;
		border-radius: 14px;
		overflow: hidden;
		border: 1px solid oklch(0.6 0.12 150 / 0.35);
		background: oklch(0.14 0.015 160 / 0.92);
		box-shadow: 0 14px 34px oklch(0 0 0 / 0.45);
	}

	.cartridge-top {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.55rem 0.85rem;
		background: oklch(0.2 0.02 160 / 0.9);
		border-bottom: 1px solid oklch(0.5 0.08 150 / 0.25);
	}

	.dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: oklch(0.5 0.05 160);
	}

	.path {
		margin-left: 0.4rem;
		font-family: ui-monospace, "Cascadia Code", monospace;
		font-size: clamp(0.65rem, 1.8cqi, 0.8rem);
		color: oklch(0.7 0.06 150);
	}

	.code {
		margin: 0;
		padding: clamp(0.8rem, 3cqi, 1.4rem);
		overflow-x: auto;
		font-family: ui-monospace, "Cascadia Code", monospace;
		font-size: clamp(0.62rem, 1.9cqi, 1.15rem);
		line-height: 1.9;
	}

	.line {
		display: block;
		color: oklch(0.78 0.1 150);
		border-radius: 6px;
		padding-inline: 0.4rem;
		transition: background 300ms ease, color 300ms ease;
	}

	.line.lit {
		background: oklch(0.75 0.15 150 / 0.14);
		color: oklch(0.9 0.13 150);
	}

	.caption {
		margin: 0;
		padding: 0 clamp(0.8rem, 3cqi, 1.4rem) clamp(0.7rem, 2.5cqi, 1.1rem);
		font-size: clamp(0.65rem, 1.8cqi, 0.85rem);
		font-style: italic;
		color: oklch(0.62 0.03 160);
	}

	@media (prefers-reduced-motion: reduce) {
		.line {
			transition: none;
		}
	}
</style>
