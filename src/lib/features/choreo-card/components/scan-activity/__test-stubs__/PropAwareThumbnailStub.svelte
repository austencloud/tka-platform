<script lang="ts">
  interface Props {
    leftPropType: string;
    rightPropType: string;
    catDogModeEnabled: boolean;
  }

  let { leftPropType, rightPropType, catDogModeEnabled }: Props = $props();
</script>

<div
  data-testid="prop-aware-preview"
  data-left-prop={leftPropType}
  data-right-prop={rightPropType}
  data-cat-dog={String(catDogModeEnabled)}
></div>
