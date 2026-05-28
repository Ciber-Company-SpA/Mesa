import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mesa.meseros',
  appName: 'Meseros-App',
  webDir: 'public',
  server: {
    url: 'https://mesa-production-f46d.up.railway.app/waiter/control',
    cleartext: false,
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0c0a09'
  }
};

export default config;
