import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.dandwan.chatroomai',
  appName: 'ChatroomAI',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
