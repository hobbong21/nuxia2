import Link from 'next/link';
import { Header } from '@/components/commerce/Header';
import { TabBar } from '@/components/commerce/TabBar';
import { formatKrw } from '@/lib/format';
import { MOCK_DASHBOARD } from '@/lib/mock';

export default async function MyPage() {
  const summary = MOCK_DASHBOARD;
  return (
    <>
      <Header title="MY" showBack={false} />
      <main className="pb-[calc(56px+env(safe-area-inset-bottom)+16px)]">
        <section className="px-base pt-base">
          <h2 className="text-h3">홍길동</h2>
          <p className="text-body-sm text-referral-earn">본인인증 완료 ✅</p>
          <p className="text-body-sm text-muted-foreground">
            추천 코드 <code className="font-mono">{summary.tree.referralCode}</code>
          </p>
        </section>

        <section className="mt-lg mx-base rounded-card border border-border bg-background p-base flex items-center justify-between">
          <div>
            <p className="text-caption text-muted-foreground">이번 달 레퍼럴 수익</p>
            <p className="text-h3 tabular-nums">{formatKrw(summary.expectedThisMonthKrw)}</p>
          </div>
          <Link href="/dashboard" className="tap text-body-sm text-accent">
            대시보드 &gt;
          </Link>
        </section>

        <section className="mt-lg mx-base rounded-card border border-border bg-background p-base">
          <h2 className="text-h4 mb-sm">주문/배송</h2>
          <div className="flex justify-around text-center">
            <Stat label="입금대기" value="0" />
            <Stat label="배송중" value="1" />
            <Stat label="완료" value="3" />
          </div>
        </section>

        <nav className="mt-lg mx-base rounded-card border border-border bg-background divide-y divide-border">
          {[
            { href: '/mypage/orders', label: '주문내역' },
            { href: '/mypage/favorites', label: '찜한 상품 (12)' },
            { href: '/mypage/reviews', label: '리뷰 작성 가능 (2)' },
            { href: '/mypage/addresses', label: '배송지 관리' },
            { href: '/mypage/coupons', label: '쿠폰 / 포인트' },
            { href: '/mypage/payouts', label: '정산 계좌 등록', warn: true },
            { href: '/help', label: '고객센터' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between p-base tap text-body"
            >
              <span className="flex items-center gap-sm">
                {item.warn && <span className="text-status-warning" aria-hidden>⚠</span>}
                {item.label}
              </span>
              <span aria-hidden className="text-muted-foreground">›</span>
            </Link>
          ))}
        </nav>
      </main>
      <TabBar />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-h3 tabular-nums">{value}</p>
      <p className="text-caption text-muted-foreground">{label}</p>
    </div>
  );
}
