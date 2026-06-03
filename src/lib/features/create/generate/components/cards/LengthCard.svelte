<!--
LengthCard.svelte - Card for selecting sequence length
Shows current length with +/- stepper controls for quick adjustment.
In spell mode, shows bridge count as subtitle and allows upward adjustment.
-->
<script lang="ts">
  import { GenerationMode } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import StepperCard from "./StepperCard/StepperCard.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { resolveAccessTier, getMaxBeats } from "$lib/shared/auth/domain/access-tier";
  import { isPremiumOrAbove } from "$lib/shared/auth/domain/models/user-role";

  let {
    currentLength,
    currentMode,
    loopEnabled = false,
    locked = false,
    minOverride,
    onLengthChange,
    onStepCapExceeded,
    subtitle = "",
    color = "radial-gradient(ellipse at top left, var(--card-blue, #3b82f6) 0%, var(--card-blue, #3b82f6) 40%, var(--card-blue-end, #1d4ed8) 100%)",
    shadowColor = "220deg 80% 55%",
    gridColumnSpan = 2,
    headerFontSize = "9px",
  } = $props<{
    currentLength: number;
    currentMode: GenerationMode;
    loopEnabled?: boolean;
    locked?: boolean;
    minOverride?: number;
    onLengthChange: (length: number) => void;
    onStepCapExceeded?: () => void;
    subtitle?: string;
    color?: string;
    shadowColor?: string;
    gridColumnSpan?: number;
    headerFontSize?: string;
  }>();

  const accessTier = $derived(
    resolveAccessTier(authState.isAuthenticated, isPremiumOrAbove(authState.role))
  );
  const MAX_LENGTH = $derived(getMaxBeats(accessTier));

  const MIN_LENGTH = $derived(minOverride ?? (loopEnabled ? 4 : 4));
  const STEP = $derived(loopEnabled ? 2 : 1);

  // Clamp the displayed length to the tier cap. If the stored config has a
  // value above the tier limit (e.g., default 16 for a guest with cap 8),
  // push the clamped value back to the parent.
  $effect(() => {
    if (currentLength > MAX_LENGTH) {
      onLengthChange(MAX_LENGTH);
    }
  });

  function handleIncrement() {
    if (locked) return;
    if (currentLength >= MAX_LENGTH) {
      onStepCapExceeded?.();
      return;
    }
    const newLength = Math.min(currentLength + STEP, MAX_LENGTH);
    onLengthChange(newLength);
  }

  function handleDecrement() {
    if (locked) return;
    const newLength = Math.max(currentLength - STEP, MIN_LENGTH);
    onLengthChange(newLength);
  }

  function formatValue(value: number): string {
    return value.toString();
  }
</script>

<StepperCard
  title={t("generator_length")}
  currentValue={currentLength}
  minValue={MIN_LENGTH}
  maxValue={MAX_LENGTH}
  onIncrement={handleIncrement}
  onDecrement={handleDecrement}
  onIncrementBlocked={onStepCapExceeded}
  {formatValue}
  {subtitle}
  {color}
  {shadowColor}
  {gridColumnSpan}
  {headerFontSize}
/>
