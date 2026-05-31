import { ViewportMode } from "../domain/enums/viewport-mode";
import { BREAKPOINTS } from "../../device/domain/constants/device-constants";
import type {
  ViewportState,
  SafeAreaInsets,
  ViewportDimensions,
} from "../domain/models/viewport-state";

export class NavigationViewportManager {
  private viewportState: ViewportState = {
    width: 0,
    height: 0,
    isMobile: false,
    actualVH: 0,
    safeHeight: 0,
    dimensions: {
      viewportWidth: 0,
      viewportHeight: 0,
      screenWidth: 0,
      screenHeight: 0,
      browserUIOffset: 0,
      safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  };

  private subscriptions = new Set<(state: ViewportState) => void>();

  constructor() {
    this.updateViewportState();
    this.setupEventListeners();
  }

  getViewportState(): ViewportState {
    return this.viewportState;
  }

  determineViewportMode(width: number, _height: number): ViewportMode {
    // Based on ModuleSelector logic - mobile if width < certain threshold
    return width < BREAKPOINTS.MOBILE ? ViewportMode.Mobile : ViewportMode.Desktop;
  }

  isMobileViewport(): boolean {
    return this.viewportState.isMobile;
  }

  isDesktopViewport(): boolean {
    return !this.viewportState.isMobile;
  }

  onViewportChange(callback: (state: ViewportState) => void): () => void {
    this.subscriptions.add(callback);
    return () => {
      this.subscriptions.delete(callback);
    };
  }

  calculateSafeAreaInsets(): SafeAreaInsets {
    // Based on ModuleSelector's viewport calculations
    const vh = window.innerHeight;
    const screenHeight = window.screen.height;
    const browserUIOffset = screenHeight - vh;

    // Calculate safe areas for mobile devices
    const top = window.visualViewport?.offsetTop || 0;
    const bottom = Math.max(0, browserUIOffset - top);

    return {
      top,
      bottom,
      left: window.visualViewport?.offsetLeft || 0,
      right: 0,
    };
  }

  getViewportDimensions(): { width: number; height: number } {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  private updateViewportState(): void {
    const basicDimensions = this.getViewportDimensions();
    const safeAreaInsets = this.calculateSafeAreaInsets();
    const isMobile =
      this.determineViewportMode(
        basicDimensions.width,
        basicDimensions.height
      ) === ViewportMode.Mobile;

    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const screenHeight = window.screen.height;
    const screenWidth = window.screen.width;
    const browserUIOffset = screenHeight - vh;

    // Calculate safe modal height (from ModuleSelector logic)
    const safeHeight = Math.min(vh * 0.75, vh - 60);

    const dimensions: ViewportDimensions = {
      viewportWidth: vw,
      viewportHeight: vh,
      screenWidth,
      screenHeight,
      browserUIOffset,
      safeAreaInsets,
    };

    this.viewportState = {
      width: vw,
      height: vh,
      isMobile,
      actualVH: vh,
      safeHeight,
      dimensions,
    };

    // Update CSS custom properties for dynamic sizing (from ModuleSelector)
    document.documentElement.style.setProperty("--actual-vh", `${vh}px`);
    document.documentElement.style.setProperty("--actual-vw", `${vw}px`);
    document.documentElement.style.setProperty(
      "--modal-max-height",
      `${safeHeight}px`
    );

    this.notifySubscribers();
  }

  private setupEventListeners(): void {
    const handleResize = () => this.updateViewportState();
    const handleOrientationChange = () => this.updateViewportState();

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleOrientationChange);

    // Cleanup on unmount would be handled by the DI container lifecycle
  }

  private notifySubscribers(): void {
    this.subscriptions.forEach((callback) => callback(this.viewportState));
  }
}
