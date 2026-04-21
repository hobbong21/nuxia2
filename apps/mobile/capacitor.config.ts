import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Nuxia2 하이브리드 앱 Capacitor 설정.
 * - webDir: apps/web static export 결과 (out/)
 * - deepLinks: nuxia2://referral/{code} + Universal Link https://nuxia2.app/r/{code}
 */
const config: CapacitorConfig = {
  appId: 'kr.nuxia2.app',
  appName: 'Nuxia',
  webDir: '../web/out',
  server: {
    androidScheme: 'https',
    allowNavigation: ['api.nuxia2.kr', 'nuxia2.app'],
    // 개발 중 live reload 사용 시 아래 url을 활성화 (주석 해제 후 IP 수정)
    // url: 'http://192.168.0.10:3000',
    // cleartext: true,
  },
  ios: {
    contentInset: 'always',
    scheme: 'Nuxia',
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#FFFFFF',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'native' as const,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#FFFFFF',
    },
  },
};

export default config;
