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
