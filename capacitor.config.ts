import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tkaflowarts.composer',
  appName: 'Flow Arts Composer',
  // SvelteKit's adapter-cloudflare emits the built client + app shell here
  // (there is no top-level build/ dir). Capacitor bundles this as the native
  // web assets. The 25 +server API routes can't run in the native shell (no
  // worker); the app's core is client-side Firebase, which works offline-first.
  webDir: '.svelte-kit/cloudflare',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 3000,
      backgroundColor: '#0b1d2a',
      androidScaleType: 'CENTER_CROP'
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0b1d2a'
    },
    // Android 15+ (targetSdk 36) enforces edge-to-edge: the WebView renders
    // behind the status bar + camera cutout, and the pre-15 opt-out is gone on
    // Android 16. The System Bars core plugin (Capacitor 8.3.2+) reads the real
    // insets from WindowInsetsCompat and injects --safe-area-inset-* CSS vars
    // (Android WebView <140 returns wrong values for env(safe-area-inset-*), so
    // the var is the reliable source). The app consumes them via CSS to reserve
    // the cutout strip. Supersedes StatusBar overlays for edge-to-edge.
    SystemBars: {
      style: 'DARK',
      insetsHandling: 'css'
    },
    Keyboard: {
      resize: 'none',
      style: 'dark'
    },
    PushNotifications: {
      presentationOptions: [
        'badge',
        'sound',
        'alert'
      ]
    },
    CapacitorUpdater: {
      autoUpdate: true,
      appId: 'com.tkaflowarts.composer'
    }
  }
};

export default config;
