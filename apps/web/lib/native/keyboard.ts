/**
 * 키보드 표출 시 포커스 엘리먼트 스크롤 보정.
 * - iOS contentInset 문제 및 Android resize mode 차이 대응.
 */

export async function initKeyboardAdjustments(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { Keyboard } = await import('@capacitor/keyboard');

    Keyboard.addListener('keyboardWillShow', () => {
      const active = document.activeElement as HTMLElement | null;
      if (active && typeof active.scrollIntoView === 'function') {
        requestAnimationFrame(() => {
          active.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });
      }
    });

    Keyboard.addListener('keyboardDidHide', () => {
      // dismiss 시 포커스 유지되지 않도록 스크롤 복원 생략 — 사용자 탭으로 제어
    });
  } catch {
    // no-op
  }
}
