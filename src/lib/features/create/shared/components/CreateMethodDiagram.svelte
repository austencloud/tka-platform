<script lang="ts">
  import type { CreateMethodDiagramKind } from "../domain/create-method-presentations";

  let { kind }: { kind: CreateMethodDiagramKind } = $props();
</script>

<div class="diagram" data-kind={kind} aria-hidden="true">
  {#if kind === "construct"}
    <div class="construct-flow">
      <span class="step start"><i class="fas fa-play"></i></span>
      <span class="connector"></span>
      <span class="step"><i class="fas fa-plus"></i></span>
      <span class="connector"></span>
      <span class="step finish"><i class="fas fa-check"></i></span>
    </div>
  {:else if kind === "generate"}
    <div class="rule-card">
      <span class="rule"><i></i><b></b></span>
      <span class="rule"><i></i><b></b></span>
      <span class="rule"><i></i><b></b></span>
    </div>
    <i class="fas fa-wand-magic-sparkles generated-mark"></i>
    <div class="generated-stack"><span></span><span></span><span></span></div>
  {:else if kind === "fuse"}
    <div class="fuse-source top"><span></span><span></span><span></span></div>
    <div class="fuse-source bottom">
      <span></span><span></span><span></span>
    </div>
    <span class="merge-line top"></span>
    <span class="merge-line bottom"></span>
    <div class="fuse-result"><span></span><span></span><span></span></div>
  {:else if kind === "tunnel"}
    <div class="performer performer-one"><i class="fas fa-person"></i></div>
    <div class="performer performer-two"><i class="fas fa-person"></i></div>
    <div class="performer performer-three"><i class="fas fa-person"></i></div>
    <div class="performer performer-four"><i class="fas fa-person"></i></div>
    <span class="tunnel-line line-one"></span>
    <span class="tunnel-line line-two"></span>
  {:else}
    <div class="assemble-grid">
      {#each Array(9) as _, index}
        <span class:active={index === 0 || index === 4 || index === 8}></span>
      {/each}
      <i class="path path-one"></i>
      <i class="path path-two"></i>
    </div>
  {/if}
</div>

<style>
  .diagram {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 84px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--method-color) 32%, transparent);
    border-radius: clamp(12px, 1.2cqi, 18px);
    background:
      radial-gradient(
        circle at 78% 18%,
        color-mix(in srgb, var(--method-color) 18%, transparent),
        transparent 42%
      ),
      color-mix(in srgb, var(--theme-panel-bg) 72%, transparent);
  }

  .construct-flow,
  .fuse-source,
  .fuse-result,
  .generated-stack {
    display: flex;
    align-items: center;
  }

  .construct-flow {
    position: absolute;
    inset: 0;
    justify-content: center;
    padding: 18px;
  }

  .step {
    width: clamp(34px, 4.2cqi, 52px);
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    border: 1px solid color-mix(in srgb, var(--method-color) 52%, transparent);
    border-radius: 12px;
    background: color-mix(
      in srgb,
      var(--method-color) 12%,
      var(--theme-card-bg)
    );
    color: var(--method-color);
    font-size: clamp(0.75rem, 1.1cqi, 1rem);
  }

  .step.start,
  .step.finish {
    background: color-mix(
      in srgb,
      var(--method-color) 22%,
      var(--theme-card-bg)
    );
  }

  .connector {
    width: clamp(18px, 3.5cqi, 52px);
    height: 2px;
    background: color-mix(in srgb, var(--method-color) 60%, transparent);
  }

  .connector::after {
    content: "";
    display: block;
    width: 7px;
    height: 7px;
    margin-left: auto;
    border-top: 2px solid var(--method-color);
    border-right: 2px solid var(--method-color);
    transform: translateY(-3px) rotate(45deg);
  }

  .rule-card {
    position: absolute;
    left: 8%;
    top: 18%;
    width: 34%;
    height: 64%;
    display: grid;
    align-content: center;
    gap: 10px;
    padding: 12px;
    box-sizing: border-box;
    border: 1px solid color-mix(in srgb, var(--method-color) 48%, transparent);
    border-radius: 12px;
    background: color-mix(in srgb, var(--theme-card-bg) 86%, transparent);
  }

  .rule {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .rule i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--method-color);
  }

  .rule b {
    height: 3px;
    flex: 1;
    border-radius: 999px;
    background: color-mix(in srgb, var(--method-color) 42%, transparent);
  }

  .generated-mark {
    position: absolute;
    left: 49%;
    top: 42%;
    color: var(--method-color);
    font-size: clamp(1rem, 1.8cqi, 1.5rem);
  }

  .generated-stack {
    position: absolute;
    right: 8%;
    top: 23%;
    width: 27%;
    height: 54%;
    justify-content: center;
  }

  .generated-stack span,
  .fuse-source span,
  .fuse-result span {
    width: clamp(16px, 2.4cqi, 28px);
    aspect-ratio: 0.78;
    margin-left: -4px;
    border: 1px solid color-mix(in srgb, var(--method-color) 56%, transparent);
    border-radius: 6px;
    background: color-mix(
      in srgb,
      var(--method-color) 17%,
      var(--theme-card-bg)
    );
    transform: rotate(6deg);
  }

  .generated-stack span:first-child {
    transform: rotate(-9deg);
  }

  .fuse-source,
  .fuse-result {
    position: absolute;
  }

  .fuse-source {
    left: 7%;
  }

  .fuse-source.top {
    top: 18%;
  }

  .fuse-source.bottom {
    bottom: 18%;
  }

  .fuse-source span,
  .fuse-result span {
    width: clamp(13px, 2cqi, 23px);
    transform: none;
  }

  .fuse-source.bottom span {
    border-color: color-mix(in srgb, #fb7185 58%, transparent);
    background: color-mix(in srgb, #fb7185 14%, var(--theme-card-bg));
  }

  .merge-line {
    position: absolute;
    left: 35%;
    width: 27%;
    height: 2px;
    transform-origin: left center;
    background: color-mix(in srgb, var(--method-color) 62%, transparent);
  }

  .merge-line.top {
    top: 35%;
    transform: rotate(18deg);
  }

  .merge-line.bottom {
    bottom: 35%;
    transform: rotate(-18deg);
    background: color-mix(in srgb, #fb7185 62%, transparent);
  }

  .fuse-result {
    right: 7%;
    top: 40%;
  }

  .performer {
    position: absolute;
    width: clamp(30px, 4cqi, 46px);
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--method-color) 54%, transparent);
    border-radius: 50%;
    background: color-mix(
      in srgb,
      var(--method-color) 16%,
      var(--theme-card-bg)
    );
    color: var(--method-color);
  }

  .performer-one {
    left: 12%;
    top: 18%;
  }

  .performer-two {
    left: 34%;
    bottom: 18%;
  }

  .performer-three {
    right: 34%;
    top: 18%;
  }

  .performer-four {
    right: 12%;
    bottom: 18%;
  }

  .tunnel-line {
    position: absolute;
    left: 20%;
    right: 20%;
    height: 1px;
    border-top: 2px dashed
      color-mix(in srgb, var(--method-color) 52%, transparent);
    transform: rotate(12deg);
  }

  .line-one {
    top: 42%;
  }

  .line-two {
    bottom: 42%;
    transform: rotate(-12deg);
  }

  .assemble-grid {
    position: absolute;
    left: 50%;
    top: 50%;
    width: min(60%, 132px);
    aspect-ratio: 1;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    place-items: center;
    transform: translate(-50%, -50%) rotate(45deg);
    border: 1px solid color-mix(in srgb, var(--method-color) 28%, transparent);
    background-image:
      linear-gradient(
        to right,
        transparent 32%,
        color-mix(in srgb, var(--method-color) 22%, transparent) 33%,
        transparent 34%,
        transparent 65%,
        color-mix(in srgb, var(--method-color) 22%, transparent) 66%,
        transparent 67%
      ),
      linear-gradient(
        to bottom,
        transparent 32%,
        color-mix(in srgb, var(--method-color) 22%, transparent) 33%,
        transparent 34%,
        transparent 65%,
        color-mix(in srgb, var(--method-color) 22%, transparent) 66%,
        transparent 67%
      );
  }

  .assemble-grid span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: color-mix(
      in srgb,
      var(--method-color) 42%,
      var(--theme-card-bg)
    );
  }

  .assemble-grid span.active {
    width: 13px;
    height: 13px;
    box-shadow: 0 0 0 4px
      color-mix(in srgb, var(--method-color) 13%, transparent);
    background: var(--method-color);
  }

  @media (prefers-reduced-motion: reduce) {
    .diagram * {
      transition: none !important;
      animation: none !important;
    }
  }
</style>
