<!--
  A compact, simultaneous model of the two independent Timing and Direction
  axes. The balls are intentionally abstract: the production hand-path player
  remains the owner of actual TKA motion on the following comparison board.
-->
<div
  class="concept-model"
  role="group"
  aria-label="Animated timing and direction examples"
>
  <section class="concept-panel timing-panel" aria-labelledby="timing-heading">
    <h3 id="timing-heading">Timing</h3>

    <div class="examples timing-examples">
      <div class="example-row timing-row together" data-phase="0">
        <strong>Together</strong>
        <div class="bounce-stage" role="img" aria-label="Together timing">
          <div class="bounce-lane blue">
            <span class="ball" aria-hidden="true"></span>
            <span class="ball-shadow" aria-hidden="true"></span>
          </div>
          <div class="bounce-lane red">
            <span class="ball" aria-hidden="true"></span>
            <span class="ball-shadow" aria-hidden="true"></span>
          </div>
        </div>
      </div>

      <div class="example-row timing-row split" data-phase="half">
        <strong>Split</strong>
        <div class="bounce-stage" role="img" aria-label="Split timing">
          <div class="bounce-lane blue">
            <span class="ball" aria-hidden="true"></span>
            <span class="ball-shadow" aria-hidden="true"></span>
          </div>
          <div class="bounce-lane red">
            <span class="ball" aria-hidden="true"></span>
            <span class="ball-shadow" aria-hidden="true"></span>
          </div>
        </div>
      </div>

      <div class="example-row timing-row quarter" data-phase="quarter">
        <strong>Quarter</strong>
        <div class="bounce-stage" role="img" aria-label="Quarter timing">
          <div class="bounce-lane blue">
            <span class="ball" aria-hidden="true"></span>
            <span class="ball-shadow" aria-hidden="true"></span>
          </div>
          <div class="bounce-lane red">
            <span class="ball" aria-hidden="true"></span>
            <span class="ball-shadow" aria-hidden="true"></span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section
    class="concept-panel direction-panel"
    aria-labelledby="direction-heading"
  >
    <h3 id="direction-heading">Direction</h3>

    <div class="examples direction-examples">
      <div class="example-row direction-row same" data-direction="same">
        <strong>Same</strong>
        <div class="travel-stage" role="img" aria-label="Same direction">
          <div class="travel-lane blue">
            <span class="direction-arrow" aria-hidden="true">›</span>
            <span class="traveler" aria-hidden="true"></span>
          </div>
          <div class="travel-lane red">
            <span class="direction-arrow" aria-hidden="true">›</span>
            <span class="traveler" aria-hidden="true"></span>
          </div>
        </div>
      </div>

      <div class="example-row direction-row opposite" data-direction="opposite">
        <strong>Opposite</strong>
        <div class="travel-stage" role="img" aria-label="Opposite direction">
          <div class="travel-lane blue">
            <span class="direction-arrow" aria-hidden="true">›</span>
            <span class="traveler" aria-hidden="true"></span>
          </div>
          <div class="travel-lane red">
            <span class="direction-arrow" aria-hidden="true">‹</span>
            <span class="traveler" aria-hidden="true"></span>
          </div>
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  .concept-model {
    --concept-cycle: calc(
      var(--duration-dramatic) + var(--duration-dramatic) +
        var(--duration-dramatic) + var(--duration-dramatic) +
        var(--duration-dramatic) + var(--duration-dramatic) +
        var(--duration-dramatic) + var(--duration-dramatic)
    );
    --phase-quarter: calc(
      0ms - var(--duration-dramatic) - var(--duration-dramatic)
    );
    --phase-half: calc(
      0ms - var(--duration-dramatic) - var(--duration-dramatic) -
        var(--duration-dramatic) - var(--duration-dramatic)
    );
    --bounce-rise: 2.5rem;
    --quarter-rest: 1.25rem;
    --ball-size: 1rem;
    --track-width: 8.5rem;
    --track-travel: 7.25rem;

    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: min(100%, 64rem);
    min-height: min(100%, 24rem);
    margin-inline: auto;
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-lg, 0.75rem);
    background: var(--theme-card-bg);
  }

  .concept-panel {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-width: 0;
    padding: clamp(1rem, 2.25cqw, 2rem);
  }

  .direction-panel {
    border-inline-start: 1px solid var(--theme-stroke);
  }

  h3 {
    margin: 0;
    color: var(--theme-text);
    font-size: clamp(1.35rem, 2.1cqw, 2rem);
    line-height: 1.1;
    text-align: center;
  }

  .examples {
    display: grid;
    min-height: 0;
    margin-top: clamp(0.75rem, 2cqh, 1.25rem);
  }

  .timing-examples {
    grid-template-rows: repeat(3, minmax(0, 1fr));
  }

  .direction-examples {
    grid-template-rows: repeat(2, minmax(0, 1fr));
  }

  .example-row {
    display: grid;
    grid-template-columns: minmax(5.5rem, 0.7fr) minmax(8.5rem, 1fr);
    align-items: center;
    gap: clamp(0.5rem, 1.2cqw, 1rem);
    min-width: 0;
    padding-block: 0.55rem;
  }

  .example-row + .example-row {
    border-top: 1px solid var(--theme-stroke);
  }

  .example-row > strong {
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.2;
    text-align: center;
  }

  .bounce-stage {
    display: flex;
    align-items: stretch;
    justify-content: center;
    gap: clamp(1rem, 2cqw, 2rem);
    height: calc(var(--bounce-rise) + var(--ball-size) + 0.35rem);
  }

  .bounce-lane {
    position: relative;
    width: var(--ball-size);
    height: 100%;
    min-width: var(--ball-size);
  }

  .bounce-lane::after {
    content: "";
    position: absolute;
    right: -0.35rem;
    bottom: 0;
    left: -0.35rem;
    height: 1px;
    background: var(--theme-stroke-strong);
  }

  .ball,
  .traveler {
    display: block;
    width: var(--ball-size);
    aspect-ratio: 1;
    border-radius: 50%;
  }

  .ball {
    position: absolute;
    z-index: 1;
    top: 0;
    left: 0;
    transform: translateY(var(--bounce-rise)) scale(1.12, 0.88);
    animation: timing-bounce var(--concept-cycle) var(--ease-in-out) infinite
      both;
    animation-delay: var(--phase-delay, 0ms);
  }

  .ball-shadow {
    position: absolute;
    right: 0.05rem;
    bottom: 0.08rem;
    left: 0.05rem;
    height: 0.28rem;
    border-radius: 50%;
    background: var(--theme-text);
    opacity: 0.36;
    animation: timing-shadow var(--concept-cycle) var(--ease-in-out) infinite
      both;
    animation-delay: var(--phase-delay, 0ms);
  }

  .blue .ball,
  .blue .traveler {
    background: var(--prop-blue, #3d44b8);
  }

  .red .ball,
  .red .traveler {
    background: var(--prop-red, #ed1c24);
  }

  .split .red {
    --phase-delay: var(--phase-half);
  }

  .quarter .red {
    --phase-delay: var(--phase-quarter);
  }

  .travel-stage {
    display: grid;
    align-content: center;
    justify-content: center;
    gap: 0.85rem;
    min-width: 0;
  }

  .travel-lane {
    position: relative;
    width: var(--track-width);
    height: var(--ball-size);
    border-radius: 999px;
    background: color-mix(in srgb, var(--theme-stroke) 70%, transparent);
  }

  .direction-arrow {
    position: absolute;
    top: 50%;
    right: 0.28rem;
    translate: 0 -52%;
    color: var(--theme-text-dim);
    font-size: 1rem;
    font-weight: 800;
    line-height: 1;
  }

  .opposite .red .direction-arrow {
    right: auto;
    left: 0.28rem;
  }

  .traveler {
    position: absolute;
    top: 0;
    left: 0;
    animation: direction-travel-forward var(--concept-cycle) linear infinite
      both;
  }

  .opposite .red .traveler {
    animation-name: direction-travel-reverse;
  }

  @keyframes timing-bounce {
    0%,
    100% {
      transform: translateY(var(--bounce-rise)) scale(1.12, 0.88);
    }
    50% {
      transform: translateY(0) scale(0.94, 1.06);
    }
  }

  @keyframes timing-shadow {
    0%,
    100% {
      opacity: 0.36;
      transform: scaleX(1);
    }
    50% {
      opacity: 0.12;
      transform: scaleX(0.42);
    }
  }

  @keyframes direction-travel-forward {
    0% {
      opacity: 1;
      transform: translateX(0);
    }
    45% {
      opacity: 1;
      transform: translateX(var(--track-travel));
    }
    48% {
      opacity: 0;
      transform: translateX(var(--track-travel));
    }
    50% {
      opacity: 0;
      transform: translateX(0);
    }
    52% {
      opacity: 1;
      transform: translateX(0);
    }
    97% {
      opacity: 1;
      transform: translateX(var(--track-travel));
    }
    100% {
      opacity: 0;
      transform: translateX(var(--track-travel));
    }
  }

  @keyframes direction-travel-reverse {
    0% {
      opacity: 1;
      transform: translateX(var(--track-travel));
    }
    45% {
      opacity: 1;
      transform: translateX(0);
    }
    48% {
      opacity: 0;
      transform: translateX(0);
    }
    50% {
      opacity: 0;
      transform: translateX(var(--track-travel));
    }
    52% {
      opacity: 1;
      transform: translateX(var(--track-travel));
    }
    97% {
      opacity: 1;
      transform: translateX(0);
    }
    100% {
      opacity: 0;
      transform: translateX(0);
    }
  }

  @media (max-width: 640px) {
    .concept-model {
      --bounce-rise: 2rem;
      --quarter-rest: 1rem;
      --ball-size: 0.85rem;
      --track-width: 6.4rem;
      --track-travel: 5.55rem;
      min-height: min(100%, 22rem);
    }

    .concept-panel {
      padding: 0.8rem 0.6rem;
    }

    h3 {
      font-size: 1.25rem;
    }

    .examples {
      margin-top: 0.5rem;
    }

    .example-row {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
      gap: 0.35rem;
      padding-block: 0.4rem;
    }

    .bounce-stage {
      gap: 1.35rem;
    }

    .travel-stage {
      gap: 0.55rem;
    }
  }

  @media (max-height: 540px) and (min-width: 641px) {
    .concept-model {
      --bounce-rise: 0.8rem;
      --quarter-rest: 0.4rem;
      --ball-size: 0.7rem;
      --track-width: 6rem;
      --track-travel: 5.3rem;
      height: 8.25rem;
      min-height: 8.25rem;
    }

    .concept-panel {
      padding: 0.4rem 0.8rem;
    }

    .examples {
      margin-top: 0.15rem;
    }

    .example-row {
      padding-block: 0;
    }

    .bounce-stage {
      gap: 1rem;
    }

    .travel-stage {
      gap: 0.3rem;
    }
  }

  @media (min-width: 1680px) {
    .concept-model {
      width: min(100%, 80rem);
    }
  }

  @media (min-width: 2600px) {
    .concept-model {
      width: min(100%, 96rem);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ball,
    .ball-shadow,
    .traveler {
      animation: none;
    }

    .split .red .ball {
      transform: translateY(0) scale(0.94, 1.06);
    }

    .quarter .red .ball {
      transform: translateY(var(--quarter-rest));
    }

    .split .red .ball-shadow {
      opacity: 0.12;
      transform: scaleX(0.42);
    }

    .quarter .red .ball-shadow {
      opacity: 0.24;
      transform: scaleX(0.7);
    }

    .same .traveler {
      transform: translateX(1.35rem);
    }

    .opposite .blue .traveler {
      transform: translateX(1.35rem);
    }

    .opposite .red .traveler {
      transform: translateX(calc(var(--track-travel) - 1.35rem));
    }
  }
</style>
