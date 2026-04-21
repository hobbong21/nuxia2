import { Header } from '@/components/commerce/Header';
import { formatKrw, formatDate } from '@/lib/format';

const MOCK_ORDERS = [
  {
    id: 'order-1',
    status: 'DELIVERED',
    totalAmountKrw: '84000',
    itemCount: 1,
    representativeName: '베이식 화이트 셔츠',
    createdAt: '2026-04-18T09:00:00Z',
  },
  {
    id: 'order-2',
    status: 'PREPARING',
    totalAmountKrw: '180000',
    itemCount: 1,
    representativeName: '네이비 테일러드 자켓',
    createdAt: '2026-04-20T14:30:00Z',
  },
];

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: '결제 대기',
  PAID: '결제 완료',
  PREPARING: '배송 준비',
  SHIPPED: '배송 중',
  DELIVERED: '배송 완료',
  CONFIRMED: '구매 확정',
  REFUNDED: '환불',
};

export default async function OrdersPage() {
  return (
    <>
      <Header title="주문내역" showBack />
      <main className="pb-base px-base pt-base space-y-sm">
        {MOCK_ORDERS.map((o) => (
          <article
            key={o.id}
            className="rounded-card border border-border bg-background p-base space-y-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-caption text-muted-foreground">
                {formatDate(o.createdAt)}
              </span>
              <span className="text-body-sm font-semibold text-accent">
                {STATUS_LABEL[o.status] ?? o.status}
              </span>
            </div>
            <h3 className="text-body line-clamp-1">
              {o.representativeName} 외 {o.itemCount - 1}건
            </h3>
            <p className="text-body font-semibold">{formatKrw(o.totalAmountKrw)}</p>
          </article>
        ))}
      </main>
    </>
  );
}
