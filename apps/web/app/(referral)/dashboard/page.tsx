import Link from 'next/link';
import { Header } from '@/components/commerce/Header';
import { TabBar } from '@/components/commerce/TabBar';
import { EarningsCard } from '@/components/referral/EarningsCard';
import { InviteCodeShare } from '@/components/referral/InviteCodeShare';
import { Button } from '@/components/ui/button';
import { formatDate, formatKrw } from '@/lib/format';
import { MOCK_DASHBOARD } from '@/lib/mock';

/**
 * 레퍼럴 대시보드 — Server + Client 혼합.
 * 초기 렌더는 Server (fetch), 증감 인터랙션은 Client.
 * TODO: api-client로 /referral/dashboard 호출
 */
export default async function DashboardPage() {
  const data = MOCK_DASHBOARD;
  return (
    <>
      <Header title="레퍼럴" showBack />
      <main className="pb-[calc(56px+env(safe-area-inset-bottom)+16px)] px-base pt-base space-y-base">
        <EarningsCard variant="expected" data={data} />

        <section aria-labelledby="status-heading" className="rounded-card border border-border bg-background p-base space-y-sm">
          <h2 id="status-heading" className="text-h4">상태 요약</h2>
          <StatusRow
            icon="🟢"
            label="지급 예정"
            value={formatKrw(data.summary.payableKrw)}
            colorClass="text-referral-earn"
          />
          <StatusRow
            icon="🟡"
            label={`유보 중 (${data.summary.withheldCount}건)`}
            value={formatKrw(data.summary.withheldKrw)}
            colorClass="text-referral-withheld"
          />
          <StatusRow
            icon="🔴"
            label={`역정산 (${data.summary.revertedCount}건)`}
            value={`-${formatKrw(data.summary.revertedKrw)}`}
            colorClass="text-referral-revert"
          />
        </section>

        <InviteCodeShare referralCode={data.tree.referralCode} />

        <section aria-labelledby="recent-heading" className="rounded-card border border-border bg-background p-base">
          <h2 id="recent-heading" className="text-h4 mb-sm">최근 내역</h2>
          {data.recent.length === 0 ? (
            <p className="text-body-sm text-muted-foreground py-base text-center">
              아직 수익 이력이 없습니다
            </p>
          ) : (
            <ul className="space-y-sm text-body-sm">
              {data.recent.map((r) => (
                <li key={r.id} className="flex justify-between">
                  <span>
                    {formatDate(r.createdAt)} · {r.generation}대 · {r.type === 'REVERT' ? '역정산' : '적립'}
                  </span>
                  <span
                    className={
                      r.type === 'REVERT' ? 'text-referral-revert tabular-nums' : 'tabular-nums'
                    }
                  >
                    {r.type === 'REVERT' ? '-' : '+'}
                    {formatKrw(r.amountKrw.replace('-', ''))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Button asChild variant="secondary" size="lg" block>
          <Link href="/tree">내 트리 보기</Link>
        </Button>
      </main>
      <TabBar />
    </>
  );
}

function StatusRow({
  icon,
  label,
  value,
  colorClass,
}: {
  icon: string;
  label: string;
  value: string;
  colorClass: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-sm">
        <span aria-hidden>{icon}</span>
        <span className="text-body-sm">{label}</span>
      </span>
      <span className={`tabular-nums font-semibold ${colorClass}`}>{value}</span>
    </div>
  );
}
