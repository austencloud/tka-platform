<script lang="ts">
  import DrillPill from '../DrillPill.svelte';
  import SidebarFilterSection from './SidebarFilterSection.svelte';

  interface Props {
    availablePatterns: string[];
    selectedPattern: string | null;
    accentColor: string;
    onSelectPattern: (pattern: string) => void;
  }

  let { availablePatterns, selectedPattern, accentColor, onSelectPattern }: Props = $props();

  const sectionState = $derived(availablePatterns.length > 0 ? 'active' as const : 'disabled' as const);

  const hasUniform = $derived(availablePatterns.some(p => p.toLowerCase().startsWith('uniform')));

  const directPatterns = $derived(
    availablePatterns.filter(p => !p.toLowerCase().startsWith('uniform'))
  );

  const isUniformSelected = $derived(
    selectedPattern !== null && selectedPattern.toLowerCase().match(/^\d/)
  );

  let uniformExpanded = $state(false);

  const UNIFORM_VALUES = [
    { label: '0t', display: '0T' },
    { label: '0.5t', display: '0.5T' },
    { label: '1t', display: '1T' },
    { label: '1.5t', display: '1.5T' },
    { label: '2t', display: '2T' },
    { label: '2.5t', display: '2.5T' },
    { label: '3t', display: '3T' },
  ];

  function handleUniformClick(): void {
    uniformExpanded = !uniformExpanded;
  }

  function handleUniformValue(label: string): void {
    // Keep expanded so user can see which value is selected
    onSelectPattern(label);
  }

  function formatPatternLabel(pattern: string): string {
    return pattern
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
</script>

<SidebarFilterSection
  label="Turn Pattern"
  state={sectionState}
  {accentColor}
  disabledMessage="Select earlier filters first..."
>
  <div class="pill-row">
    {#if hasUniform}
      <DrillPill
        label="Uniform"
        selected={uniformExpanded || !!isUniformSelected}
        onClick={handleUniformClick}
      />
    {/if}
    {#each directPatterns as pattern}
      <DrillPill
        label={formatPatternLabel(pattern)}
        selected={selectedPattern === pattern}
        onClick={() => onSelectPattern(pattern)}
      />
    {/each}
  </div>

  {#if uniformExpanded}
    <div class="uniform-values">
      {#each UNIFORM_VALUES as v}
        <DrillPill
          label={v.display}
          selected={selectedPattern === v.label}
          onClick={() => handleUniformValue(v.label)}
        />
      {/each}
    </div>
  {/if}
</SidebarFilterSection>

<style>
  .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .uniform-values {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
</style>
