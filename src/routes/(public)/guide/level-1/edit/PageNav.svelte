<script lang="ts">
	import { pages } from '../_lib/page-manifest';

	interface Props {
		activePage: number;
		onJump: (n: number) => void;
	}
	let { activePage, onJump }: Props = $props();
</script>

<nav class="page-nav">
	<header>
		<strong>Level 1</strong><span>{pages.length} pages</span>
	</header>
	<ol>
		{#each pages as p}
			<li>
				<button
					type="button"
					class:active={activePage === p.pageNumber}
					onclick={() => onJump(p.pageNumber)}
				>
					<span class="num">{p.pageNumber}</span>
					<span class="label">{p.label}</span>
				</button>
			</li>
		{/each}
	</ol>
</nav>

<style>
	.page-nav {
		background: #11151c;
		color: #e6e8ec;
		height: 100%;
		overflow-y: auto;
		padding: 1rem;
		font-family: system-ui, sans-serif;
		font-size: 0.85rem;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid #1f2530;
		margin-bottom: 0.5rem;
	}
	header span {
		color: #6a7280;
		font-size: 0.72rem;
	}
	ol {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	button {
		display: grid;
		grid-template-columns: 28px 1fr;
		gap: 0.5rem;
		align-items: center;
		width: 100%;
		background: transparent;
		color: inherit;
		border: none;
		padding: 0.45rem 0.5rem;
		text-align: left;
		cursor: pointer;
		border-radius: 4px;
		font: inherit;
	}
	button:hover {
		background: #1c222d;
	}
	button.active {
		background: #2a3344;
	}
	.num {
		color: #6a7280;
		font-variant-numeric: tabular-nums;
	}
</style>
