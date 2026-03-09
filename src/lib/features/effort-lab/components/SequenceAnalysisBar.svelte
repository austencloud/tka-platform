<script lang="ts">
	import type { SequenceLabanProfile, SpaceQuality } from "../domain/laban-actions";

	interface Props {
		profile: SequenceLabanProfile | null;
	}

	const { profile }: Props = $props();

	const SPACE_COLORS: Record<SpaceQuality, string> = {
		indirect: "rgba(139, 92, 246, 0.8)",
		direct: "rgba(34, 211, 238, 0.8)",
		neutral: "rgba(148, 163, 184, 0.8)",
	};

	const FLOW_COLORS: Record<string, string> = {
		free: "#34d399",
		mixed: "#fbbf24",
		bound: "#f43f5e",
	};

	const spaceEntries = $derived.by(() => {
		if (!profile) return [];
		const { direct, indirect, neutral } = profile.spaceProfile;
		const entries: { type: SpaceQuality; count: number }[] = [];
		if (indirect > 0) entries.push({ type: "indirect", count: indirect });
		if (direct > 0) entries.push({ type: "direct", count: direct });
		if (neutral > 0) entries.push({ type: "neutral", count: neutral });
		return entries;
	});

	const flowLabel = $derived.by(() => {
		if (!profile) return "";
		const { quality, reversalCount } = profile.flowProfile;
		const capitalized = quality.charAt(0).toUpperCase() + quality.slice(1);
		const noun = reversalCount === 1 ? "reversal" : "reversals";
		return `${capitalized} (${reversalCount} ${noun})`;
	});

	const flowColor = $derived(profile ? FLOW_COLORS[profile.flowProfile.quality] : undefined);
</script>

{#if !profile}
	<div class="analysis-bar">
		<span class="analysis-empty">No sequence loaded</span>
	</div>
{:else}
	<div class="analysis-bar">
		<div class="analysis-section">
			<span class="analysis-label">Space</span>
			<span class="analysis-value">
				{#each spaceEntries as entry, i}
					{#if i > 0}
						<span class="dot-separator"> · </span>
					{/if}
					<span style="color: {SPACE_COLORS[entry.type]}"
						>{entry.count} {entry.type}</span
					>
				{/each}
			</span>
		</div>

		<div class="analysis-divider"></div>

		<div class="analysis-section">
			<span class="analysis-label">Flow</span>
			<span class="analysis-value" style="color: {flowColor}">{flowLabel}</span>
		</div>
	</div>
{/if}

<style>
	.analysis-bar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 16px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: var(--border-radius-lg, 12px);
		font-size: var(--font-size-compact, 12px);
	}

	.analysis-section {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.analysis-label {
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 10px;
	}

	.analysis-value {
		color: var(--theme-text, #ffffff);
	}

	.analysis-divider {
		width: 1px;
		height: 16px;
		background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
	}

	.analysis-empty {
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		font-style: italic;
	}

	.dot-separator {
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
	}
</style>
