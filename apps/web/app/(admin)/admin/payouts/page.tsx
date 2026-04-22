import { adminApi } from '@/lib/admin-client';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { formatKrw, formatDate } from '@/lib/format';
import type { Payout } from '@nuxia2/shared-types';

export const dynamic = 'force-dynamic';

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: { cursor?: string };
}) {
  const { items, nextCursor } = await adminApi.getPayouts({ cursor: searchParams.cursor });

  const columns: DataTableColumn<Payout>[] = [
    { key: 'period', header: '정산 주기', render: (r) => `${formatDate(r.periodStart)} ~ ${formatDate(r.periodEnd)}` },
    { key: 'user', header: '사용자', render: (r) => <code className="text-caption text-zinc-400">{r.userId.slice(0, 10)}…</code> },
    { key: 'gross', header: '총지급', align: 'right', render: (r) => formatKrw(r.amountGrossKrw) },
    { key: 'tax', header: '원천세 (3.3%)', align: 'right', render: (r) => formatKrw(r.amountTaxKrw) },
    { key: 'net', header: '실지급', align: 'right', render: (r) => <strong>{formatKrw(r.amountNetKrw)}</strong> },
    { key: 'status', header: '상태', render: (r) => <PayoutStatusBadge value={r.status} /> },
    { key: 'bank', header: '계좌', render: (r) => r.bankMaskedAccount ?? <span className="text-zinc-500">—</span> },
    { key: 'paidAt', header: '지급시각', align: 'right', render: (r) => (r.paidAt ? formatDate(r.paidAt) : <span className="text-zinc-500">—</span>) },
  ];

  return (
    <div className="space-y-lg">
      <header>
        <h1 className="text-h2">정산 내역</h1>
        <p className="text-body-sm text-zinc-400">월별 지급/유보/실패 이력.</p>
      </header>
      <DataTable
        caption="정산 내역"
        rows={items}
        rowKey={(r) => r.id}
        columns={columns}
        emptyLabel="정산 이력이 없습니다."
        nextCursor={nextCursor}
        nextHref={(c) => `/admin/payouts?cursor=${c}`}
      />
    </div>
  );
}

function PayoutStatusBadge({ value }: { value: Payout['status'] }) {
  const m: Record<Payout['status'], string> = {
    PAID:               'bg-green-950 text-green-200 border-green-700',
    PENDING:            'bg-blue-950 text-blue-200 border-blue-700',
    WITHHELD:           'bg-yellow-950 text-yellow-200 border-yellow-700',
    FAILED:             'bg-red-950 text-red-200 border-red-700',
    CLAWBACK_REQUESTED: 'bg-orange-950 text-orange-200 border-orange-700',
  };
  return <span className={`inline-flex rounded-pill border px-2 py-0.5 text-caption font-semibold ${m[value]}`}>{value}</span>;
}
