import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'Frutos2_0',
  webDir: 'www',
    android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
    zoomEnabled: true
  }
};

export default config;
