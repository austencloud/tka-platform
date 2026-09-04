<script lang="ts">
  import type { ExperienceViewMode } from "../../../domain/types";
  import TimingDirectionExperience from "./TimingDirectionExperience.svelte";
  import { GAMMA_MODES } from "./pictograph-foundation-content";

  let {
    onComplete,
    onBack,
    viewMode = "step",
  } = $props<{
    onComplete?: () => void;
    onBack?: () => void;
    viewMode?: ExperienceViewMode;
  }>();

  let experience = $state<TimingDirectionExperience | null>(null);

  export function handleBack(): void {
    experience?.handleBack();
  }
</script>

<TimingDirectionExperience
  bind:this={experience}
  conceptId="gamma-motion"
  title="Quarter timing/direction"
  modes={GAMMA_MODES}
  {onComplete}
  {onBack}
  {viewMode}
/>
