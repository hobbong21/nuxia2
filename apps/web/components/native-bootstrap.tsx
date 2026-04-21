'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { initDeepLinks, initHardwareBackButton, initKeyboardAdjustments } from '@/lib/native';
import { useToast } from '@/components/ui/toast';

/**
 * Capacitor 네이티브 플랫폼 전용 초기화. 웹에서는 각 init 내부에서 no-op.
 */
export function NativeBootstrap() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  React.useEffect(() => {
    void initDeepLinks();
    void initKeyboardAdjustments();
    void initHardwareBackButton({
      isRootRoute: () => ['/', '/products', '/dashboard', '/mypage'].includes(pathname),
      onRouterBack: () => router.back(),
      onToast: (msg) => toast.show(msg, 'info'),
      onAppExit: async () => {
        try {
          const { App } = await import('@capacitor/app');
          await App.exitApp();
        } catch {
          // no-op
        }
      },
    });
  }, [pathname, router, toast]);

  return null;
}
