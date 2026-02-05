<!--
PositionExplanation - Explanation box for a position type
-->
<script lang="ts">
  import type { PositionInfo } from "../../../../domain/constants/positions-experience-data";

  let {
    info,
  }: {
    info: PositionInfo;
  } = $props();
</script>

<div class="explanation">
  <h3>Understanding {info.name}</h3>
  <ul>
    <li>
      {@html info.description.replace(
        /(straight line|identical position|perpendicular)/gi,
        "<strong>$1</strong>"
      )}
    </li>
    <li>Think: <strong>{info.angle} apart</strong></li>
    <li>Examples: {info.examples}</li>
  </ul>
</div>

<style>
  .explanation {
    padding: 1.25rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }

  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: white;
    margin: 0;
  }

  ul {
    margin: 0.75rem 0 0 0;
    padding-left: 1.25rem;
  }

  li {
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.75);
    line-height: 1.6;
    margin-bottom: 0.5rem;
  }

  li:last-child {
    margin-bottom: 0;
  }
</style>
