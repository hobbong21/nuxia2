import { Sidebar } from '@/components/admin/Sidebar';

/**
 * 관리자 레이아웃 — §M1-5 규약에 따라 기본 다크 테마.
 * `.dark` 클래스를 root div 에 부여해 shadcn 다크 토큰이 자동 활성화되도록 한다.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-[1280px] p-lg">{children}</div>
      </main>
    </div>
  );
}
