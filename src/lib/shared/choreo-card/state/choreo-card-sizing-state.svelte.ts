/** A measured box, in CSS pixels. */
interface Size {
  width: number;
  height: number;
}

interface ContainModel {
  cols: number;
  gridHeightUnits: number;
  headerUnits: number;
  footerUnits: number;
  headerMinPx: number;
}

export interface ChoreoCardSizingDeps {
  readonly containerElement: HTMLDivElement | undefined;
  readonly previewStackElement: HTMLDivElement | undefined;
  readonly previewAspectRatio: number;
  readonly forceContain: boolean;
  readonly needsScroll: boolean;
  readonly fitWidth: boolean;
  readonly containModel: ContainModel;
}

/**
 * Owns the DOM measurement lifecycle for a ChoreoCard instance.
 *
 * Keeping both ResizeObservers and the aspect-fit calculation together makes
 * container measurements a one-way input to layout instead of scattering DOM
 * reads through the cell renderer and transition controller.
 */
export function createChoreoCardSizingState(
  getDeps: () => ChoreoCardSizingDeps
) {
  let containedWidth = $state<number | null>(null);
  let containedHeight = $state<number | null>(null);
  let containerWidth = $state(0);
  let containerHeight = $state(0);
  let cellWidth = $state(0);
  let cellWidthSuppressed = false;
  let flipSuppressed = $state(false);
  let containerWasZero = false;
  let flipTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * `measured` carries the size a ResizeObserver already computed for us.
   *
   * Reading clientWidth/clientHeight here is a synchronous layout read, and it
   * lands first in the callback, so it absorbs the whole forced-reflow cost of
   * whatever styles changed to trigger the resize. A Chrome trace of the Post
   * Studio blamed this function for 210ms of forced reflow across six seconds.
   * The observer entry already has the number, measured at observation time for
   * free, so the hot path hands it in and never touches the DOM.
   */
  function captureContainerDimensions(measured?: Size): void {
    const container = getDeps().containerElement;
    if (!container) return;
    const width = measured?.width ?? container.clientWidth;
    const height = measured?.height ?? container.clientHeight;
    if (width > 0 && Math.abs(width - containerWidth) > 0.5) {
      containerWidth = width;
    }
    if (height > 0 && Math.abs(height - containerHeight) > 0.5) {
      containerHeight = height;
    }
  }

  /**
   * `content` is the observer entry's contentRect, which is the content box —
   * exactly what the getComputedStyle arithmetic below reconstructs by hand.
   * Taking it directly skips a style recalc and two more layout reads on the
   * resize path. The manual path stays for the effect-driven calls, which have
   * no entry to draw on.
   */
  function updateContainedDimensions(content?: Size): void {
    const deps = getDeps();
    const container = deps.containerElement;
    const aspectRatio = deps.previewAspectRatio;
    if (!container || !aspectRatio || !Number.isFinite(aspectRatio)) return;

    let availableWidth: number;
    let availableHeight: number;
    if (content) {
      availableWidth = content.width;
      availableHeight = content.height;
    } else {
      const style = getComputedStyle(container);
      availableWidth =
        container.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      availableHeight =
        container.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom);
    }

    if (availableWidth === 0 || availableHeight === 0) {
      containerWasZero = true;
      containedWidth = null;
      containedHeight = null;
      return;
    }

    const revealedFromZero = containerWasZero;
    containerWasZero = false;

    if (deps.needsScroll) {
      containedWidth = null;
      containedHeight = null;
      return;
    }

    let nextWidth: number | null;
    let nextHeight: number | null;
    const containerRatio = availableWidth / availableHeight;

    if (deps.forceContain && deps.fitWidth) {
      const heightFromWidth = availableWidth / aspectRatio;
      if (
        Number.isFinite(heightFromWidth) &&
        heightFromWidth > availableHeight
      ) {
        nextHeight = availableHeight;
        const widthFromHeight = availableHeight * aspectRatio;
        nextWidth = Number.isFinite(widthFromHeight) ? widthFromHeight : null;
      } else {
        nextWidth = availableWidth;
        nextHeight = Number.isFinite(heightFromWidth) ? heightFromWidth : null;
      }
    } else if (aspectRatio > containerRatio) {
      nextWidth = availableWidth;
      const heightFromWidth = availableWidth / aspectRatio;
      nextHeight = Number.isFinite(heightFromWidth) ? heightFromWidth : null;
    } else {
      nextHeight = availableHeight;
      const widthFromHeight = availableHeight * aspectRatio;
      nextWidth = Number.isFinite(widthFromHeight) ? widthFromHeight : null;
    }

    // The header has a pixel floor on screen. Re-solve the box when the
    // proportional model would allocate less than that floor so grid rows do
    // not lose height and clip at the bottom.
    const model = deps.containModel;
    if (nextWidth != null && model.headerMinPx > 0) {
      const modeledHeaderPx = (nextWidth / model.cols) * model.headerUnits;
      if (modeledHeaderPx < model.headerMinPx) {
        const perWidthUnits =
          (model.gridHeightUnits + model.footerUnits) / model.cols;
        const width = Math.max(
          0,
          Math.min(
            availableWidth,
            (availableHeight - model.headerMinPx) / perWidthUnits
          )
        );
        nextWidth = width;
        nextHeight = model.headerMinPx + width * perWidthUnits;
      }
    }

    const widthChanged =
      nextWidth !== containedWidth &&
      (nextWidth === null ||
        containedWidth === null ||
        Math.abs(nextWidth - containedWidth) > 0.5);
    const heightChanged =
      nextHeight !== containedHeight &&
      (nextHeight === null ||
        containedHeight === null ||
        Math.abs(nextHeight - containedHeight) > 0.5);

    if (widthChanged) containedWidth = nextWidth;
    if (heightChanged) containedHeight = nextHeight;

    if (revealedFromZero) {
      flipSuppressed = true;
      requestAnimationFrame(() => {
        updateCellWidth();
        requestAnimationFrame(() => {
          flipSuppressed = false;
        });
      });
    }
  }

  function updateCellWidth(measuredWidth?: number): void {
    if (cellWidthSuppressed) return;
    const deps = getDeps();
    const widthUnits = deps.containModel.cols;
    const stack = deps.previewStackElement;
    if (!stack || widthUnits <= 0) return;
    const stackWidth = measuredWidth ?? stack.clientWidth;
    if (stackWidth < 1) return;
    const nextCellWidth = Number.isFinite(stackWidth / widthUnits)
      ? stackWidth / widthUnits
      : 0;
    if (Math.abs(nextCellWidth - cellWidth) > 0.5) {
      cellWidth = nextCellWidth;
    }
  }

  function setCellWidthSuppressed(suppressed: boolean): void {
    cellWidthSuppressed = suppressed;
  }

  function setFlipSuppressed(suppressed: boolean): void {
    if (flipTimer !== null) {
      clearTimeout(flipTimer);
      flipTimer = null;
    }
    flipSuppressed = suppressed;
  }

  function suppressFlipFor(durationMs: number): void {
    setFlipSuppressed(true);
    flipTimer = setTimeout(() => {
      flipTimer = null;
      flipSuppressed = false;
    }, durationMs);
  }

  $effect(() => {
    const container = getDeps().containerElement;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[entries.length - 1]?.contentRect;
      const size = rect ? { width: rect.width, height: rect.height } : undefined;
      captureContainerDimensions(size);
      updateContainedDimensions(size);
    });
    observer.observe(container);
    captureContainerDimensions();
    updateContainedDimensions();
    return () => observer.disconnect();
  });

  $effect(() => {
    const deps = getDeps();
    void deps.previewAspectRatio;
    void deps.forceContain;
    void deps.needsScroll;
    void deps.fitWidth;
    updateContainedDimensions();
  });

  $effect(() => {
    const stack = getDeps().previewStackElement;
    if (!stack) return;

    const observer = new ResizeObserver((entries) => {
      updateCellWidth(entries[entries.length - 1]?.contentRect.width);
    });
    observer.observe(stack);
    updateCellWidth();
    return () => observer.disconnect();
  });

  $effect(() => {
    return () => {
      if (flipTimer !== null) clearTimeout(flipTimer);
    };
  });

  return {
    get containedWidth() {
      return containedWidth;
    },
    get containedHeight() {
      return containedHeight;
    },
    get containerWidth() {
      return containerWidth;
    },
    get containerHeight() {
      return containerHeight;
    },
    get cellWidth() {
      return cellWidth;
    },
    get flipSuppressed() {
      return flipSuppressed;
    },
    captureContainerDimensions,
    updateContainedDimensions,
    updateCellWidth,
    setCellWidthSuppressed,
    setFlipSuppressed,
    suppressFlipFor,
  } as const;
}
