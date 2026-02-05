// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces

/// <reference types="@sveltejs/kit" />
/// <reference types="vite-plugin-pwa/client" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.svelte-kit/ambient.d.ts" />

declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface Platform {}
  }

  /** App version injected from package.json at build time */
  const __APP_VERSION__: string;

  /** Google Identity Services types */
  interface GoogleOneTapConfig {
    client_id: string;
    callback?: (response: { credential: string }) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: "signin" | "signup" | "use";
    itp_support?: boolean;
    use_fedcm_for_prompt?: boolean;
    prompt_parent_id?: string;
  }

  interface GooglePromptNotification {
    isDisplayed: () => boolean;
    isNotDisplayed: () => boolean;
    isSkippedMoment: () => boolean;
    isDismissedMoment: () => boolean;
    getMomentType: () => string;
    getDismissedReason: () => string;
    getNotDisplayedReason: () => string;
    getSkippedReason: () => string;
  }

  interface GoogleButtonConfig {
    type: "standard" | "icon";
    theme?: "outline" | "filled_blue" | "filled_black";
    size?: "large" | "medium" | "small";
    text?: "signin_with" | "signup_with" | "continue_with" | "signin";
    shape?: "rectangular" | "pill" | "circle" | "square";
    logo_alignment?: "left" | "center";
    width?: number;
    locale?: string;
  }

  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleOneTapConfig) => void;
          prompt: (
            callback?: (notification: GooglePromptNotification) => void
          ) => void;
          renderButton: (
            element: HTMLElement,
            config: GoogleButtonConfig
          ) => void;
          cancel: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

export {};
