'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/', label: '홈', icon: '🏠' },
  { href: '/products', label: '카테고리', icon: '🔍' },
  { href: '/dashboard', label: '레퍼럴', icon: '👥' },
  { href: '/mypage', label: 'MY', icon: '👤' },
] as const;

/**
 * 하단 탭바.
 * - 높이 56px + safe-bottom
 * - 아이콘+라벨 각 44px 터치 타겟
 */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="주요 메뉴"
      className={cn(
        'fixed inset-x-0 bottom-0 z-tabbar',
        'border-t border-border bg-background/95 backdrop-blur',
        'pb-safe',
      )}
    >
      <ul className="mx-auto flex max-w-[1200px] items-stretch justify-around h-tabbar">
        {TABS.map((tab) => {
          const active =
            tab.href === '/'
              ? pathname === '/'
              : pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'tap flex h-full flex-col items-center justify-center gap-[2px]',
                  active ? 'text-accent' : 'text-muted-foreground',
                )}
              >
                <span aria-hidden className="text-[20px] leading-none">{tab.icon}</span>
                <span className="text-[11px]">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
