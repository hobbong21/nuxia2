import { shareLabel } from '../format';

export async function shareReferralLink(opts: {
  code: string;
  url: string;
}): Promise<{ shared: boolean; fallback: 'web-share' | 'clipboard' | 'native' }> {
  const { code, url } = opts;
  const title = 'Nuxia 초대';
  const text = shareLabel(code);

  if (typeof window === 'undefined') {
    return { shared: false, fallback: 'clipboard' };
  }

  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, url });
      return { shared: true, fallback: 'native' };
    }
  } catch {
    // Capacitor 미설치 or 플러그인 미탑재 → 웹 분기로 계속
  }

  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await (navigator as Navigator & { share: (data: ShareData) => Promise<void> })
        .share({ title, text, url });
      return { shared: true, fallback: 'web-share' };
    } catch {
      // 사용자 취소 → clipboard 폴백
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return { shared: true, fallback: 'clipboard' };
  } catch {
    return { shared: false, fallback: 'clipboard' };
  }
}

export async function shareText(text: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ text });
      return;
    }
  } catch {
    // no-op
  }
  await navigator.clipboard.writeText(text);
}
