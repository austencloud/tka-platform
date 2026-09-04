<div class="corner-frame">
  <div class="corner-guide">
    <strong>Pick a crossing</strong>
    <div class="axis-guide" aria-hidden="true">
      <span><i class="row-dot"></i>Rows ↓</span>
      <span><i class="column-dot"></i>Columns →</span>
    </div>
    <span class="compact-axis" aria-hidden="true">
      <span class="row-arrow">↓</span>
      <span class="column-arrow">→</span>
    </span>
  </div>
</div>

<style>
  .corner-frame {
    position: absolute;
    inset: 0;
    container-type: size;
  }

  .corner-guide {
    display: grid;
    width: 100%;
    height: 100%;
    place-content: center;
    gap: clamp(0.35rem, 5cqi, 0.8rem);
    padding: clamp(0.35rem, 7cqi, 1rem);
    color: var(--theme-text, #fff);
    text-align: center;
  }

  .corner-guide > strong {
    font-size: clamp(0.875rem, 10cqi, 1.15rem);
    font-weight: 750;
    line-height: 1.1;
  }

  .axis-guide {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.3rem 0.65rem;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.65));
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 600;
    white-space: nowrap;
  }

  .axis-guide span {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .axis-guide i {
    display: block;
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
  }

  .row-dot {
    background: var(--prop-blue-text, #818cf8);
  }

  .column-dot {
    background: var(--prop-red-text, #f87171);
  }

  .compact-axis {
    display: none;
  }

  @container (max-width: 7.5rem) {
    .axis-guide {
      display: none;
    }
  }

  @container (max-height: 7.5rem) {
    .axis-guide {
      display: none;
    }
  }

  @container (max-width: 5rem) {
    .corner-guide {
      padding: 0;
    }

    .corner-guide > strong {
      display: none;
    }

    .compact-axis {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      font-size: clamp(0.75rem, 24cqi, 1rem);
      font-weight: 800;
    }

    .row-arrow {
      color: var(--prop-blue-text, #818cf8);
    }

    .column-arrow {
      color: var(--prop-red-text, #f87171);
    }
  }

  @container (max-height: 5rem) {
    .corner-guide {
      padding: 0;
    }

    .corner-guide > strong {
      display: none;
    }

    .compact-axis {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      font-size: clamp(0.75rem, 24cqi, 1rem);
      font-weight: 800;
    }
  }
</style>
