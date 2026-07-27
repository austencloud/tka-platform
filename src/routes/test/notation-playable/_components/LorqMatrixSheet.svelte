<!--
  Lorq Nichols artifact: the 144-cell matrix as a luminous sheet. The grid is
  drawn as cells (the same 12×12 the sourced sheet enumerates); when active,
  pointer movement sends a restrained highlight through nearby cells. No cell
  is labelled — the enumeration is Lorq's, and the labels live at his site.
-->
<script lang="ts">
	let { active = false }: { active?: boolean } = $props();

	let mx = $state(-1);
	let my = $state(-1);

	function track(event: PointerEvent) {
		if (!active) return;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		mx = ((event.clientX - rect.left) / rect.width) * 12;
		my = ((event.clientY - rect.top) / rect.height) * 12;
	}

	function leave() {
		mx = -1;
		my = -1;
	}

	function glow(i: number): number {
		if (mx < 0) return 0;
		const cx = (i % 12) + 0.5;
		const cy = Math.floor(i / 12) + 0.5;
		const d = Math.hypot(cx - mx, cy - my);
		return Math.max(0, 1 - d / 2.6);
	}
</script>

<div
	class="lorq-sheet"
	role="img"
	aria-label="A twelve by twelve grid of one hundred forty-four cells"
	onpointermove={track}
	onpointerleave={leave}
>
	<div class="sheet">
		<div class="matrix">
			{#each Array.from({ length: 144 }) as _, i (i)}
				<span
					class="cell"
					class:diag={i % 12 === Math.floor(i / 12)}
					style={`--g: ${glow(i).toFixed(3)}`}
				></span>
			{/each}
		</div>
	</div>
</div>

<style>
	.lorq-sheet {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		padding: clamp(0.8rem, 4cqi, 2rem);
	}

	/* The physical sheet: fills whatever stage it hangs in (portrait on the
	   4K rail card, square-ish elsewhere), with the enumeration centered on
	   the paper — no dead void around a floating grid. */
	.sheet {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		padding: clamp(0.5rem, 2cqi, 1.2rem);
		border-radius: 14px;
		background: oklch(0.16 0.02 80 / 0.6);
		border: 1px solid oklch(0.75 0.12 80 / 0.3);
		box-shadow: 0 0 40px oklch(0.75 0.14 80 / 0.12);
	}

	.matrix {
		width: min(100%, 94cqh);
		aspect-ratio: 1;
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: 2px;
	}

	.cell {
		aspect-ratio: 1;
		border-radius: 2px;
		background: color-mix(
			in oklch,
			oklch(0.85 0.14 80) calc(16% + var(--g, 0) * 64%),
			oklch(0.2 0.02 80 / 0.5)
		);
	}

	.cell.diag {
		background: color-mix(
			in oklch,
			oklch(0.85 0.16 80) calc(58% + var(--g, 0) * 42%),
			oklch(0.3 0.05 80)
		);
	}
</style>
