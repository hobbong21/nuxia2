'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface HeaderProps {
  title?: string;
  showBack?: boolean;
  /** 스크롤 100px 초과 시 backdrop-blur 상태 */
  scrollAware?: boolean;
  right?: React.ReactNode;
}

/**
 * designer_spec §6 #10 Header
 * - 기본 h-56 mobile
 * - scrollAware=true 이면 100px 초과 시 배경 blur
 */
export function Header({ title, showBack, scrollAware = true, right }: HeaderProps) {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    if (!scrollAware) return;
    const onScroll = () => setScrolled(window.scrollY > 100);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [scrollAware]);

  return (
    <header
      className={cn(
        'sticky top-0 z-header h-header pt-safe',
        'transition-[background-color,backdrop-filter] duration-base',
        scrollAware && scrolled
          ? 'bg-background/90 backdrop-blur border-b border-border'
          : 'bg-background',
      )}
    >
      <div className="mx-auto flex h-full max-w-[1200px] items-center gap-md px-base">
        {showBack ? (
          <button
            type="button"
            aria-label="뒤로가기"
            onClick={() => history.back()}
            className="tap -ml-2 inline-flex items-center justify-center"
          >
            <span aria-hidden className="text-h4">‹</span>
          </button>
        ) : (
          <Link
            href="/"
            aria-label="홈"
            className="text-h4 font-extrabold tracking-tight text-primary"
          >
            NUXIA
          </Link>
        )}
        {title && (
          <h1 className={cn('text-lead font-semibold', showBack ? '' : 'sr-only')}>
            {title}
          </h1>
        )}
        <div className="ml-auto flex items-center gap-xs">
          {right}
        </div>
      </div>
    </header>
  );
}
