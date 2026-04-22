import { Header } from '@/components/commerce/Header';
import { formatKrw, formatDate } from '@/lib/format';

const MOCK_PAYOUTS = [
  {
    id: 'p-1',
    periodStart: '2026-03-01T00:00:00Z',
    periodEnd: '2026-03-31T00:00:00Z',
    amountGrossKrw: '250000',
    amountTaxKrw: '8250',
    amountNetKrw: '241750',
    status: 'PAID',
    paidAt: '2026-04-10T00:00:00Z',
  },
  {
    id: 'p-2',
    periodStart: '2026-04-01T00:00:00Z',
    periodEnd: '2026-04-30T00:00:00Z',
    amountGrossKrw: '180000',
    amountTaxKrw: '5940',
    amountNetKrw: '174060',
    status: 'PENDING',
    paidAt: null as string | null,
  },
];

export default async function PayoutsPage() {
  return (
    <>
      <Header title="정산 내역" showBack />
      <main className="pb-base px-base pt-base space-y-base">
        <section className="rounded-card border border-border bg-muted p-base text-body-sm text-muted-foreground space-y-xs">
          <p>
            <strong className="text-foreground">정산 주기:</strong> 매월 1일~말일분을 익월 10일에 지급합니다.
          </p>
          <p>
            <strong className="text-foreground">원천징수:</strong> 사업소득 3.3% (소득세 3% + 지방소득세 0.3%)
          </p>
          <p>
            <strong className="text-foreground">최소 지급액:</strong> 10,000원 미만은 차월 이월
          </p>
        </section>

        {MOCK_PAYOUTS.map((p) => (
          <article
            key={p.id}
            className="rounded-card border border-border bg-background p-base space-y-sm"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-h4">
                {formatDate(p.periodStart)} ~ {formatDate(p.periodEnd)}
              </h3>
              <span
                className={
                  p.status === 'PAID'
                    ? 'text-body-sm text-referral-earn'
                    : 'text-body-sm text-referral-withheld'
                }
              >
                {p.status === 'PAID' ? '✅ 지급 완료' : '🕒 지급 예정'}
              </span>
            </div>
            <dl className="grid grid-cols-3 gap-sm text-body-sm">
              <div>
                <dt className="text-muted-foreground">총 수익</dt>
                <dd className="tabular-nums">{formatKrw(p.amountGrossKrw)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">원천징수 3.3%</dt>
                <dd className="tabular-nums text-referral-revert">
                  -{formatKrw(p.amountTaxKrw)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">실지급</dt>
                <dd className="tabular-nums font-semibold">
                  {formatKrw(p.amountNetKrw)}
                </dd>
              </div>
            </dl>
            {p.paidAt && (
              <p className="text-caption text-muted-foreground">
                지급일 {formatDate(p.paidAt)}
              </p>
            )}
          </article>
        ))}
      </main>
    </>
  );
}
