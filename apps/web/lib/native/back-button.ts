/**
 * Android 하드웨어 백 버튼 핸들러.
 * - 스택: TopSheet > Modal > 상세 router.back() > 루트 탭 두 번 누르면 종료
 * - 콜백 체인은 zustand 또는 이벤트 bus로 전파하는 것이 확장성 있으나,
 *   여기서는 간단히 handler list 큐로 구현.
 */

type BackHandler = () => boolean | Promise<boolean>; // true = handled

const handlers: BackHandler[] = [];
let lastBackPressAt = 0;
let initialized = false;

export function pushBackHandler(handler: BackHandler): () => void {
  handlers.push(handler);
  return () => {
    const idx = handlers.indexOf(handler);
    if (idx >= 0) handlers.splice(idx, 1);
  };
}

export async function initHardwareBackButton(opts: {
  isRootRoute: () => boolean;
  onRouterBack: () => void;
  onToast: (msg: string) => void;
  onAppExit: () => void;
}): Promise<void> {
  if (initialized) return;
  if (typeof window === 'undefined') return;
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { App } = await import('@capacitor/app');

    App.addListener('backButton', async () => {
      // 1. registered handler 우선 (TopSheet/Modal)
      for (let i = handlers.length - 1; i >= 0; i--) {
        const h = handlers[i];
        const handled = await h();
        if (handled) return;
      }
      // 2. 상세/서브 라우트 → back
      if (!opts.isRootRoute()) {
        opts.onRouterBack();
        return;
      }
      // 3. 루트 탭: 2초 내 연속 → 종료
      const now = Date.now();
      if (now - lastBackPressAt < 2000) {
        opts.onAppExit();
      } else {
        lastBackPressAt = now;
        opts.onToast('한 번 더 누르면 종료됩니다');
      }
    });
    initialized = true;
  } catch {
    // no-op
  }
}
