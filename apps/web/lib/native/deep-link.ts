import { nativeStorage } from './storage';

const PENDING_KEY = 'pendingReferralCode';
const SCHEME_PREFIX = 'nuxia2://';
const UNIVERSAL_PREFIX = 'https://nuxia2.app/r/';

/** URL 에서 referral code 추출. `nuxia2://referral/NX-ABC123` 또는 `https://nuxia2.app/r/NX-ABC123` */
export function parseReferralCode(url: string): string | null {
  if (url.startsWith(`${SCHEME_PREFIX}referral/`)) {
    return url.slice(`${SCHEME_PREFIX}referral/`.length).split(/[/?#]/)[0] || null;
  }
  if (url.startsWith(UNIVERSAL_PREFIX)) {
    return url.slice(UNIVERSAL_PREFIX.length).split(/[/?#]/)[0] || null;
  }
  return null;
}

/** 앱 진입 시 1회 호출. URL open 리스너 등록 + 초기 URL 확인 */
export async function initDeepLinks(onCode?: (code: string) => void): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { App } = await import('@capacitor/app');
    App.addListener('appUrlOpen', async (event: { url: string }) => {
      const code = parseReferralCode(event.url);
      if (code) {
        await nativeStorage.set(PENDING_KEY, code);
        onCode?.(code);
      }
    });
  } catch {
    // @capacitor/app 미설치 상황 무시
  }
}

/** 가입 화면 진입 시 호출 — 저장된 pending 코드 pop */
export async function getPendingReferralCode(): Promise<string | null> {
  const code = await nativeStorage.get(PENDING_KEY);
  if (code) {
    await nativeStorage.remove(PENDING_KEY);
  }
  return code;
}
