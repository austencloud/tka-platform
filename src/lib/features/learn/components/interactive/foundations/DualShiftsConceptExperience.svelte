<script lang="ts">
  import type { ExperienceViewMode } from "../../../domain/types";
  import TimingDirectionExperience from "./TimingDirectionExperience.svelte";
  import { ALPHA_BETA_MODES } from "./pictograph-foundation-content";

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
  conceptId="dual-shifts-alpha-beta"
  title="Alpha and Beta timing/direction"
  modes={ALPHA_BETA_MODES}
  {onComplete}
  {onBack}
  {viewMode}
/>
