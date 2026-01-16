<script lang="ts">
  /**
   * Beat-Pair Analysis Display
   *
   * Shows detected beat-pair relationships and their groupings.
   * Simplified view for single-pattern sequences, detailed view for modular.
   * Shows axis-alternating pattern info when detected.
   */
  import type { BeatPairRelationship } from "../../domain/models/beatpair-models";
  import type { BeatPairGroups } from "../../domain/models/label-models";
  import type { AxisAlternatingPattern } from "../../services/contracts/ILOOPDetector";
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";

  interface Props {
    beatPairs: BeatPairRelationship[];
    beatPairGroups?: BeatPairGroups;
    collapsed?: boolean;
    isAxisAlternating?: boolean;
    axisAlternatingPattern?: AxisAlternatingPattern | null;
  }

  let {
    beatPairs,
    beatPairGroups,
    collapsed = false,
    isAxisAlternating = false,
    axisAlternatingPattern = null,
  }: Props = $props();

  // Initialize as expanded (true), then apply collapsed prop via effect
  let isExpanded = $state(true);

  // Apply initial collapsed state on mount
  $effect(() => {
    if (collapsed && isExpanded) {
      isExpanded = false;
    }
  });

  // Color coding for different transformation types
  const transformationColors: Record<string, string> = {
    FLIPPED: "#14b8a6",
    HORIZONTAL_FLIP: "#14b8a6",
    ROTATED_180: "#36c3ff",
    ROTATED_90: "#36c3ff",
    ROTATED_90_CCW: "#36c3ff",
    ROTATED_90_CW: "#36c3ff",
    SWAPPED: "#26e600",
    INVERTED: "#eb7d00",
    MIRRORED: "#a855f7",
    REPEATED: "#6b7280",
    UNKNOWN: "var(--semantic-error)",
    SAME: "#6b7280",
    ROTATED: "#36c3ff",
  };

  // Color coding for letter relationships
  const letterRelationshipColors: Record<string, string> = {
    inverted: "#eb7d00",
    compound: "var(--semantic-success)",
    alpha_beta_counterpart: "#a855f7",
  };

  function getColorForPattern(pattern: string): string {
    for (const [key, color] of Object.entries(transformationColors)) {
      if (pattern.toUpperCase().includes(key)) {
        return color;
      }
    }
    return "#6b7280";
  }

  /**
   * Get the primary letter relationship type for color coding
   */
  function getLetterRelationshipColor(
    rel: BeatPairRelationship["letterRelationship"]
  ): string {
    const defaultColor = "#6b7280";
    if (!rel) return defaultColor;
    if (rel.relationships.isCompound)
      return letterRelationshipColors.compound ?? defaultColor;
    if (rel.relationships.isAlphaBetaCounterpart)
      return letterRelationshipColors.alpha_beta_counterpart ?? defaultColor;
    if (rel.relationships.isInverted)
      return letterRelationshipColors.inverted ?? defaultColor;
    return defaultColor;
  }

  /**
   * Format letter relationship as a concise display string
   */
  function formatLetterRelationship(
    rel: BeatPairRelationship["letterRelationship"]
  ): string | null {
    if (!rel) return null;
    const types: string[] = [];
    if (rel.relationships.isCompound) types.push("Compound");
    if (rel.relationships.isAlphaBetaCounterpart) types.push("α↔β");
    if (rel.relationships.isInverted) types.push("Inverted");
    if (types.length === 0) return null;
    return `${rel.letter1}↔${rel.letter2}`;
  }

  const groupCount = $derived(Object.keys(beatPairGroups || {}).length);
  const isModular = $derived(groupCount > 1);

  // For single-pattern sequences, get the unified pattern
  const unifiedPattern = $derived.by(() => {
    if (isModular || groupCount === 0) return null;
    const patterns = Object.keys(beatPairGroups || {});
    return patterns[0] || null;
  });

  // Find pairs that have alternative interpretations worth showing
  const pairsWithAlternatives = $derived.by(() => {
    return beatPairs.filter((pair) => {
      const primary = pair.detectedTransformations[0] || "UNKNOWN";
      const alternatives = (pair.allValidTransformations || []).filter(
        (t) => t !== primary
      );
      return alternatives.length > 0;
    });
  });

  // Check if any beat pairs have letter relationships worth showing
  const hasLetterRelationships = $derived(
    beatPairs.some(
      (p) =>
        p.letterRelationship &&
        (p.letterRelationship.relationships.isCompound ||
          p.letterRelationship.relationships.isAlphaBetaCounterpart ||
          p.letterRelationship.relationships.isInverted)
    )
  );
</script>

{#if beatPairs.length > 0}
  <div class="beat-pair-analysis">
    <button
      class="header"
      class:expanded={isExpanded}
      onclick={() => (isExpanded = !isExpanded)}
    >
      <div class="header-left">
        <FontAwesomeIcon
          icon={isExpanded ? "chevron-down" : "chevron-right"}
          size="0.8em"
        />
        <span class="title">Beat-Pair Analysis</span>
        {#if isAxisAlternating && axisAlternatingPattern}
          <span class="axis-alternating-badge"
            >{axisAlternatingPattern.metaPatternType}</span
          >
        {:else if isModular}
          <span class="modular-badge">Modular ({groupCount} patterns)</span>
        {/if}
      </div>
      <span class="pair-count">{beatPairs.length} pairs</span>
    </button>

    {#if isExpanded}
      {#if isModular}
        <!-- MODULAR: Show full breakdown with groups -->
        <div class="groups-section">
          <h4 class="section-title">Transformation Groups</h4>
          <div class="groups-grid">
            {#each Object.entries(beatPairGroups || {}) as [pattern, beats]}
              <div
                class="group-card"
                style="--group-color: {getColorForPattern(pattern)}"
              >
                <div class="group-pattern">{pattern}</div>
                <div class="group-beats">
                  Beats: {beats.join(", ")}
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Full detailed pairs for modular -->
        <div class="pairs-section">
          <h4 class="section-title">Detailed Pairs</h4>
          <div class="pairs-list">
            {#each beatPairs as pair}
              {@const primaryTransform =
                pair.detectedTransformations[0] || "UNKNOWN"}
              {@const alternatives = (
                pair.allValidTransformations || []
              ).filter((t) => t !== primaryTransform)}
              <div class="pair-row">
                <div class="pair-beats">
                  <span class="beat-num">{pair.keyBeat}</span>
                  <span class="arrow">↔</span>
                  <span class="beat-num">{pair.correspondingBeat}</span>
                </div>
                <div class="pair-info">
                  <div class="pair-transforms">
                    <span
                      class="transform-tag primary"
                      style="--tag-color: {getColorForPattern(
                        primaryTransform
                      )}"
                    >
                      {primaryTransform}
                    </span>
                    {#if alternatives.length > 0}
                      <span class="also-label">also:</span>
                      {#each alternatives as alt}
                        <span
                          class="transform-tag alternative"
                          style="--tag-color: {getColorForPattern(alt)}"
                        >
                          {alt}
                        </span>
                      {/each}
                    {/if}
                  </div>
                  {#if pair.letterRelationship}
                    {@const letterDisplay = formatLetterRelationship(
                      pair.letterRelationship
                    )}
                    {#if letterDisplay}
                      <span
                        class="letter-tag"
                        style="--letter-color: {getLetterRelationshipColor(
                          pair.letterRelationship
                        )}"
                        title={pair.letterRelationship.summary}
                      >
                        {letterDisplay}
                      </span>
                    {/if}
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {:else if unifiedPattern}
        <!-- SINGLE PATTERN: Simplified view -->
        <div class="unified-section">
          <div class="unified-summary">
            <span class="unified-label">All {beatPairs.length} pairs:</span>
            <span
              class="transform-tag primary"
              style="--tag-color: {getColorForPattern(unifiedPattern)}"
            >
              {unifiedPattern}
            </span>
          </div>

          <!-- Show letter relationships for each pair -->
          {#if hasLetterRelationships}
            <div class="letter-relationships">
              <span class="letter-label">Letter relationships:</span>
              <div class="letter-pairs-list">
                {#each beatPairs as pair}
                  {#if pair.letterRelationship}
                    {@const letterDisplay = formatLetterRelationship(
                      pair.letterRelationship
                    )}
                    {#if letterDisplay}
                      <span
                        class="letter-tag"
                        style="--letter-color: {getLetterRelationshipColor(
                          pair.letterRelationship
                        )}"
                        title={pair.letterRelationship.summary}
                      >
                        {letterDisplay}
                      </span>
                    {/if}
                  {/if}
                {/each}
              </div>
            </div>
          {/if}

          <!-- Only show pairs with alternatives -->
          {#if pairsWithAlternatives.length > 0}
            <div class="alternatives-note">
              <span class="note-label"
                >{pairsWithAlternatives.length} pair{pairsWithAlternatives.length >
                1
                  ? "s"
                  : ""} also match:</span
              >
              <div class="alternatives-list">
                {#each pairsWithAlternatives as pair}
                  {@const primary =
                    pair.detectedTransformations[0] || "UNKNOWN"}
                  {@const alternatives = (
                    pair.allValidTransformations || []
                  ).filter((t) => t !== primary)}
                  <div class="alt-pair-row">
                    <span class="alt-pair-nums"
                      >{pair.keyBeat}↔{pair.correspondingBeat}:</span
                    >
                    {#each alternatives as alt}
                      <span
                        class="transform-tag alternative"
                        style="--tag-color: {getColorForPattern(alt)}"
                      >
                        {alt}
                      </span>
                    {/each}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .beat-pair-analysis {
    background: var(--surface-dark, rgba(0, 0, 0, 0.3));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    overflow: hidden;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: transparent;
    border: none;
    color: var(--foreground);
    cursor: pointer;
    transition: background var(--transition-micro);
  }

  .header:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .title {
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .modular-badge {
    padding: 2px 8px;
    background: rgba(168, 85, 247, 0.2);
    border: 1px solid rgba(168, 85, 247, 0.4);
    border-radius: 12px;
    font-size: var(--font-size-xs);
    color: #a855f7;
    font-weight: 500;
  }

  .axis-alternating-badge {
    padding: 2px 8px;
    background: linear-gradient(
      135deg,
      rgba(20, 184, 166, 0.2) 0%,
      rgba(168, 85, 247, 0.2) 100%
    );
    border: 1px solid rgba(20, 184, 166, 0.4);
    border-radius: 12px;
    font-size: var(--font-size-xs);
    color: #5eead4;
    font-weight: 500;
    text-transform: capitalize;
  }

  .pair-count {
    font-size: var(--font-size-xs);
    color: var(--muted-foreground);
  }

  /* Groups Section (modular only) */
  .groups-section,
  .pairs-section {
    padding: var(--spacing-sm) var(--spacing-md);
    border-top: 1px solid var(--theme-stroke);
  }

  .section-title {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .groups-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }

  .group-card {
    flex: 1;
    min-width: 120px;
    padding: var(--spacing-sm);
    background: color-mix(in srgb, var(--group-color) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--group-color) 40%, transparent);
    border-radius: 8px;
  }

  .group-pattern {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--group-color);
    margin-bottom: 4px;
  }

  .group-beats {
    font-size: var(--font-size-xs);
    color: var(--muted-foreground);
  }

  /* Unified Section (single pattern) */
  .unified-section {
    padding: var(--spacing-sm) var(--spacing-md);
    border-top: 1px solid var(--theme-stroke);
  }

  .unified-summary {
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }

  .unified-label {
    font-size: var(--font-size-sm);
    color: var(--muted-foreground);
  }

  .alternatives-note {
    margin-top: var(--spacing-sm);
    padding-top: var(--spacing-sm);
    border-top: 1px dashed var(--theme-stroke);
  }

  .note-label {
    font-size: var(--font-size-xs);
    color: var(--muted-foreground);
    display: block;
    margin-bottom: var(--spacing-xs);
  }

  .alternatives-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .alt-pair-row {
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }

  .alt-pair-nums {
    font-size: var(--font-size-xs);
    color: var(--muted-foreground);
    min-width: 40px;
  }

  /* Pairs List (modular only) */
  .pairs-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .pair-row {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-md);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: rgba(255, 255, 255, 0.02);
    border-radius: 6px;
  }

  .pair-beats {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    min-width: 70px;
  }

  .beat-num {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(99, 102, 241, 0.2);
    border-radius: 4px;
    font-size: var(--font-size-xs);
    font-weight: 600;
  }

  .arrow {
    color: var(--muted-foreground);
    font-size: var(--font-size-xs);
  }

  .pair-transforms {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    flex: 1;
  }

  .transform-tag {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    white-space: nowrap;
  }

  .transform-tag.primary {
    background: color-mix(in srgb, var(--tag-color) 25%, transparent);
    border: 1px solid color-mix(in srgb, var(--tag-color) 50%, transparent);
    color: var(--tag-color);
  }

  .transform-tag.alternative {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    color: var(--muted-foreground);
    font-style: italic;
  }

  .also-label {
    font-size: var(--font-size-compact);
    color: var(--muted-foreground);
    font-style: italic;
    opacity: 0.7;
    margin-left: 4px;
  }

  /* Letter relationship display */
  .letter-relationships {
    margin-top: var(--spacing-sm);
    padding-top: var(--spacing-sm);
    border-top: 1px dashed var(--theme-stroke);
  }

  .letter-label {
    font-size: var(--font-size-xs);
    color: var(--muted-foreground);
    display: block;
    margin-bottom: var(--spacing-xs);
  }

  .letter-pairs-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }

  .letter-tag {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: var(--font-size-compact);
    font-weight: 600;
    white-space: nowrap;
    background: color-mix(in srgb, var(--letter-color) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--letter-color) 50%, transparent);
    color: var(--letter-color);
    cursor: help;
  }

  .pair-info {
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    flex: 1;
    min-width: 0;
  }
</style>
