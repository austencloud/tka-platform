<script lang="ts">
  interface Props {
    bluePropType: string;
    redPropType: string;
    catDogModeEnabled: boolean;
  }

  let { bluePropType, redPropType, catDogModeEnabled }: Props = $props();
</script>

<div
  data-testid="prop-aware-preview"
  data-blue-prop={bluePropType}
  data-red-prop={redPropType}
  data-cat-dog={String(catDogModeEnabled)}
></div>
