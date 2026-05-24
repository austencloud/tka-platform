<script lang="ts">
  import { Vector3 } from "three";
  import { getViewer3DContext } from "../../context/viewer-3d-context";

  const viewer = getViewer3DContext();
  let copiedCamera = $state(false);

  function copyCameraState(): void {
    const controls = viewer.cameraChoreography.controls;
    if (!controls) return;

    const pos = new Vector3();
    const tgt = new Vector3();
    controls.getPosition(pos);
    controls.getTarget(tgt);

    const data = {
      position: { x: r(pos.x), y: r(pos.y), z: r(pos.z) },
      target: { x: r(tgt.x), y: r(tgt.y), z: r(tgt.z) },
      azimuth: r(controls.azimuthAngle),
      polar: r(controls.polarAngle),
      distance: r(controls.distance),
    };

    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    copiedCamera = true;
    setTimeout(() => { copiedCamera = false; }, 1500);
  }

  function r(n: number): number {
    return Math.round(n * 1000) / 1000;
  }
</script>

<div class="dev-tools">
  <button class="dev-action" onclick={copyCameraState}>
    <i class="fas" class:fa-clipboard={!copiedCamera} class:fa-check={copiedCamera}></i>
    <span>{copiedCamera ? "Copied!" : "Copy Camera State"}</span>
  </button>
</div>

<style>
  .dev-tools {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .dev-action {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.75);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 160ms;
  }
  .dev-action:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.18);
    color: white;
  }
  .dev-action i {
    width: 18px;
    text-align: center;
    font-size: 14px;
    opacity: 0.7;
  }
</style>
