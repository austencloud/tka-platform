<script lang="ts">
  /**
   * Props Showroom - A debug gallery displaying all available 3D models,
   * textures, and effects. Walk around in FPS to preview assets before
   * placing them in the museum.
   *
   * Accessible from the museum mode bar as a developer tool.
   */
  import "../museum-theme.css";
  import { Canvas } from "@threlte/core";
  import ShowroomScene from "./ShowroomScene.svelte";
</script>

<div class="showroom-container museum-gold-scope">
  <div class="showroom-header">
    <h2>Props Showroom</h2>
    <p>Walk around to preview all available 3D models. Click to enter FPS mode, WASD to move.</p>
  </div>
  <div class="showroom-canvas">
    <Canvas>
      <ShowroomScene />
    </Canvas>
  </div>
</div>

<style>
  .showroom-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #0a0a0a;
  }

  .showroom-header {
    padding: 12px 20px;
    background: rgba(18, 18, 28, 0.98);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    flex-shrink: 0;
  }

  .showroom-header h2 {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 16px;
    color: var(--museum-gold-90);
    font-weight: 400;
  }

  .showroom-header p {
    margin: 4px 0 0;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.3);
  }

  .showroom-canvas {
    flex: 1;
    overflow: hidden;
  }
</style>
