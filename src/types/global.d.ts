// Global type declarations for the application

declare global {
  // Environment variables
  interface ImportMetaEnv {
    readonly VITE_APP_TITLE: string;
    readonly VITE_API_URL: string;
    readonly VITE_ENVIRONMENT: "development" | "staging" | "production";
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly SSR: boolean;

    // Environment context
    readonly PUBLIC_ENVIRONMENT: "development" | "production";

    // Module visibility flags
    readonly PUBLIC_ENABLE_CREATE_MODULE: string;
    readonly PUBLIC_ENABLE_BROWSE_MODULE: string;
    readonly PUBLIC_ENABLE_FEEDBACK_MODULE: string;
    readonly PUBLIC_ENABLE_LEARN_MODULE: string;
    readonly PUBLIC_ENABLE_LIBRARY_MODULE: string;
    readonly PUBLIC_ENABLE_COMPOSE_MODULE: string;
    readonly PUBLIC_ENABLE_TRAIN_MODULE: string;
    readonly PUBLIC_ENABLE_ML_TRAINING_MODULE: string;
    readonly PUBLIC_ENABLE_ADMIN_MODULE: string;

    // Development tools
    readonly PUBLIC_ENABLE_DEBUG_TOOLS: string;
    readonly PUBLIC_ENABLE_ROLE_OVERRIDE: string;
    readonly PUBLIC_ENABLE_ANALYTICS: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  // Window extensions
  interface Window {
    // Add any global window properties here
    __SVELTE_KIT_DEV__?: boolean;
    // CSV data loaded by layout
    csvData?: {
      diamondData: string;
      boxData: string;
    };
    // Web Speech API
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }

  // Google Maps API type declarations (loaded dynamically)
  namespace google {
    namespace maps {
      class Map {
        constructor(element: HTMLElement, options?: MapOptions);
        panTo(latLng: LatLngLiteral): void;
        setZoom(zoom: number): void;
      }

      interface MapOptions {
        center?: LatLngLiteral;
        zoom?: number;
        minZoom?: number;
        maxZoom?: number;
        mapId?: string;
        disableDefaultUI?: boolean;
        zoomControl?: boolean;
        mapTypeControl?: boolean;
        streetViewControl?: boolean;
        fullscreenControl?: boolean;
      }

      interface LatLngLiteral {
        lat: number;
        lng: number;
      }

      interface MapsLibrary {
        Map: typeof Map;
      }

      interface MarkerLibrary {
        AdvancedMarkerElement: typeof marker.AdvancedMarkerElement;
        PinElement: typeof marker.PinElement;
      }

      function importLibrary(name: "maps"): Promise<MapsLibrary>;
      function importLibrary(name: "marker"): Promise<MarkerLibrary>;

      namespace marker {
        class AdvancedMarkerElement extends EventTarget {
          constructor(options: AdvancedMarkerElementOptions);
          map: Map | null;
          addListener(eventName: string, handler: () => void): void;
        }

        interface AdvancedMarkerElementOptions {
          map?: Map;
          position?: LatLngLiteral;
          content?: Node | PinElement | null;
          title?: string;
        }

        class PinElement {
          constructor(options?: PinElementOptions);
          element: HTMLElement;
        }

        interface PinElementOptions {
          background?: string;
          borderColor?: string;
          glyphColor?: string;
        }
      }
    }
  }

  // Prioritized Task Scheduling API (Chromium 94+)
  // https://developer.mozilla.org/en-US/docs/Web/API/Prioritized_Task_Scheduling_API
  interface Scheduler {
    postTask<T>(
      callback: () => T | Promise<T>,
      options?: {
        priority?: "user-blocking" | "user-visible" | "background";
        signal?: AbortSignal;
        delay?: number;
      }
    ): Promise<T>;
    yield(options?: {
      priority?: "user-blocking" | "user-visible" | "background" | "inherit";
      signal?: AbortSignal;
    }): Promise<void>;
  }

   
  var scheduler: Scheduler | undefined;

  // Custom events
  interface CustomEventMap {
    "theme-change": CustomEvent<{ theme: "light" | "dark" }>;
    "settings-update": CustomEvent<{ settings: Record<string, unknown> }>;
  }

  // Extend the global EventTarget interface
  interface EventTarget {
    addEventListener<K extends keyof CustomEventMap>(
      type: K,
      listener: (this: EventTarget, ev: CustomEventMap[K]) => void,
      options?: boolean | AddEventListenerOptions
    ): void;
    removeEventListener<K extends keyof CustomEventMap>(
      type: K,
      listener: (this: EventTarget, ev: CustomEventMap[K]) => void,
      options?: boolean | EventListenerOptions
    ): void;
  }

  // DOM types
  interface AddEventListenerOptions {
    capture?: boolean;
    once?: boolean;
    passive?: boolean;
    signal?: AbortSignal;
  }

  interface EventListenerOptions {
    capture?: boolean;
  }
}

// Module declarations for assets
declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}

declare module "*.jpeg" {
  const content: string;
  export default content;
}

declare module "*.gif" {
  const content: string;
  export default content;
}

declare module "*.webp" {
  const content: string;
  export default content;
}

declare module "*.ico" {
  const content: string;
  export default content;
}

// CSS modules
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module "*.module.scss" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// JSON modules
declare module "*.json" {
  const value: unknown;
  export default value;
}

// Svelte component types
declare module "*.svelte" {
  import type { ComponentType } from "svelte";
  const component: ComponentType;
  export default component;
}

// Threlte type augmentation - useThrelte returns stores with .current property
declare module "@threlte/core" {
  import type { Camera, Scene, WebGLRenderer } from "three";

  export interface ThrelteContext {
    camera: {
      current: Camera;
    };
    scene: {
      current: Scene;
    };
    renderer: {
      current: WebGLRenderer;
    };
  }

  export function useThrelte(): ThrelteContext;
}

export {};
