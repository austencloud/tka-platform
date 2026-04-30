<!--
  VillageTimelineStrip - Compact sparkline showing village health over the last 500 ticks.
  Green line = total knowledge, red dots = extinctions, gold dots = inventions,
  white dots = reincarnations. No axes, no labels. Pure gestalt.
-->
<script lang="ts">
	interface TimelineEvent {
		tick: number;
		type: "extinction" | "invention" | "reincarnation";
	}

	interface Props {
		knowledgeHistory: number[];
		events: TimelineEvent[];
		width?: number;
		height?: number;
	}

	const { knowledgeHistory, events, width = 220, height = 40 }: Props = $props();

	const maxKnowledge = $derived(
		knowledgeHistory.length > 0 ? Math.max(1, ...knowledgeHistory) : 1,
	);

	const knowledgePath = $derived.by(() => {
		if (knowledgeHistory.length < 2) return "";
		const stepX = width / (knowledgeHistory.length - 1);
		return knowledgeHistory
			.map((v, i) => {
				const x = i * stepX;
				const y = height - (v / maxKnowledge) * (height - 4);
				return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
			})
			.join(" ");
	});

	const eventDots = $derived.by(() => {
		if (knowledgeHistory.length === 0) return [];
		const stepX = width / Math.max(1, knowledgeHistory.length - 1);
		return events
			.filter((e) => e.tick < knowledgeHistory.length)
			.map((e) => ({
				x: e.tick * stepX,
				y: 2,
				color:
					e.type === "extinction"
						? "#ef4444"
						: e.type === "invention"
							? "#fbbf24"
							: "#ffffff",
			}));
	});
</script>

<svg {width} {height} class="timeline-strip">
	<!-- Knowledge line -->
	{#if knowledgePath}
		<path
			d={knowledgePath}
			fill="none"
			stroke="#4ade80"
			stroke-width="1.5"
			opacity="0.7"
		/>
	{/if}

	<!-- Event dots -->
	{#each eventDots as dot}
		<circle
			cx={dot.x}
			cy={height - dot.y}
			r="2"
			fill={dot.color}
			opacity="0.9"
		/>
	{/each}
</svg>

<style>
	.timeline-strip {
		display: block;
		background: rgba(255, 255, 255, 0.02);
		border-radius: 3px;
	}
</style>
