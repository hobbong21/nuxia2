/**
 * Capacitor 네이티브 기능 추상화 허브.
 * UI 컴포넌트는 오직 이 모듈의 함수만 호출해야 하며,
 * @capacitor/* import는 이 폴더 내부로 한정한다.
 */
export { shareReferralLink, shareText } from './share';
export { nativeStorage } from './storage';
export { initDeepLinks, getPendingReferralCode } from './deep-link';
export { initHardwareBackButton } from './back-button';
export { initKeyboardAdjustments } from './keyboard';

export async function isNativePlatform(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function getPlatform(): Promise<'web' | 'ios' | 'android'> {
  if (typeof window === 'undefined') return 'web';
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.getPlatform() as 'web' | 'ios' | 'android';
  } catch {
    return 'web';
  }
}
