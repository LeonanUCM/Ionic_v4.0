import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.agroseguro.frutosai20',
  appName: 'AgroSeguro Frutos AI 2.0',
  webDir: 'www',
    android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
    zoomEnabled: true
  }
};

export default config;
