'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin',            label: '대시보드', icon: '📊' },
  { href: '/admin/abuse-logs', label: '어뷰징',   icon: '🛡️' },
  { href: '/admin/audit-logs', label: '감사 로그', icon: '📝' },
  { href: '/admin/users',      label: '사용자',   icon: '👥' },
  { href: '/admin/payouts',    label: '정산',     icon: '💰' },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-200"
      aria-label="관리자 내비게이션"
    >
      <div className="flex h-14 items-center gap-2 border-b border-zinc-800 px-base">
        <span aria-hidden className="text-h4">🟦</span>
        <span className="font-semibold">NUXIA Admin</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-sm">
        <ul className="space-y-xs">
          {NAV.map((item) => {
            const active =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname?.startsWith(item.href) ?? false;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex h-10 items-center gap-sm rounded-md px-md text-body-sm transition-colors',
                    active
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <span aria-hidden>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-zinc-800 p-sm text-caption text-zinc-500">
        v0.3 · skeleton
      </div>
    </aside>
  );
}
