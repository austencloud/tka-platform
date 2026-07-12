import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tkaflowarts.composer',
  appName: 'Flow Arts Composer',
  webDir: 'build',
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
