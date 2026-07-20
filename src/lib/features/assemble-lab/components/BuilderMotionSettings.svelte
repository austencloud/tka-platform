<script lang="ts">
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  let {
    turnCount,
    rotationDirection,
    onchangeTurnCount,
    onchangeRotationDirection,
    stacked = false,
  }: {
    turnCount: number;
    rotationDirection: RotationDirection;
    onchangeTurnCount: (turnCount: number) => void;
    onchangeRotationDirection: (direction: RotationDirection) => void;
    stacked?: boolean;
  } = $props();

  const FLOAT_VALUE = "float";
  const TURN_OPTIONS = [
    { value: FLOAT_VALUE, label: "fl" },
    { value: "0", label: "0" },
    { value: "0.5", label: "0.5" },
    { value: "1", label: "1" },
    { value: "1.5", label: "1.5" },
    { value: "2", label: "2" },
    { value: "2.5", label: "2.5" },
    { value: "3", label: "3" },
  ];
  const ROTATION_OPTIONS = [
    { value: RotationDirection.CLOCKWISE, label: "CW" },
    { value: RotationDirection.COUNTER_CLOCKWISE, label: "CCW" },
  ];

  const turnValue = $derived(
    turnCount === -0.5 ? FLOAT_VALUE : String(turnCount)
  );
  const rotationOptions = $derived(
    ROTATION_OPTIONS.map((option) => ({
      ...option,
      disabled: turnCount === -0.5,
    }))
  );

  function selectTurn(value: string): void {
    onchangeTurnCount(value === FLOAT_VALUE ? -0.5 : Number(value));
  }
</script>

<div class="motion-settings" class:stacked>
  <div class="setting rotation-setting">
    <span class="setting-label">Direction</span>
    <SegmentedControl
      options={rotationOptions}
      value={rotationDirection}
      onchange={onchangeRotationDirection}
      size="sm"
      color="accent"
    />
  </div>
  <div class="setting turn-setting">
    <span class="setting-label">Turns</span>
    <SegmentedControl
      options={TURN_OPTIONS}
      value={turnValue}
      onchange={selectTurn}
      size="sm"
      color="accent"
    />
  </div>
</div>

<style>
  .motion-settings {
    display: flex;
    align-items: end;
    gap: var(--settings-spacing-sm, 8px);
    width: 100%;
    min-width: 0;
  }

  .motion-settings.stacked {
    align-items: stretch;
    flex-direction: column;
  }

  .setting {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .rotation-setting {
    flex: 0 0 126px;
  }

  .turn-setting {
    flex: 1 1 410px;
  }

  .setting-label {
    padding-left: 4px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.55));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .stacked .rotation-setting,
  .stacked .turn-setting {
    flex-basis: auto;
  }
</style>
