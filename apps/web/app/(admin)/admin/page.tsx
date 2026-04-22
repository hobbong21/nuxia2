import { adminApi } from '@/lib/admin-client';
import { AdminKpiCard } from '@/components/admin/AdminKpiCard';
import { formatKrw } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * 관리자 홈 — KPI 요약 카드.
 * Server Component: adminApi 는 현재 mock (USE_MOCK=true) 이므로 fetch 발생 X.
 */
export default async function AdminHomePage() {
  const kpi = await adminApi.getKpi();
  return (
    <div className="space-y-lg">
      <header className="space-y-xs">
        <h1 className="text-h2">대시보드</h1>
        <p className="text-body-sm text-zinc-400">
          v0.3 스프린트 M1 관리자 가시성 — BE 연동 전 mock 데이터를 렌더링합니다.
        </p>
      </header>
      <section className="grid gap-base sm:grid-cols-2 lg:grid-cols-4">
        <AdminKpiCard
          label="이번 달 어뷰징 차단"
          value={String(kpi.blockedThisMonth)}
          sub="SELF/CIRCULAR/DUP/STAFF/COOLDOWN 합계"
          tone="danger"
        />
        <AdminKpiCard
          label="미지급 정산 (net)"
          value={formatKrw(kpi.pendingPayouts)}
          sub="PENDING + WITHHELD"
          tone="warning"
        />
        <AdminKpiCard
          label="미성년 유보"
          value={String(kpi.minorHoldCount)}
          sub="MINOR_HOLD 상태"
          tone="warning"
        />
        <AdminKpiCard
          label="활성 사용자"
          value={String(kpi.activeUsers)}
          sub="role=CUSTOMER, status=ACTIVE"
          tone="success"
        />
      </section>
    </div>
  );
}
