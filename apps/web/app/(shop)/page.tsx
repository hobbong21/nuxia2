import Link from 'next/link';
import { Header } from '@/components/commerce/Header';
import { TabBar } from '@/components/commerce/TabBar';
import { ProductCard } from '@/components/commerce/ProductCard';
import { Button } from '@/components/ui/button';
import { formatKrw } from '@/lib/format';
import { MOCK_PRODUCTS, MOCK_DASHBOARD } from '@/lib/mock';

/**
 * 홈 — Server Component.
 * TODO: fetch products (/products) & dashboard summary (/referral/dashboard) via api-client.
 */
export default async function HomePage() {
  const products = MOCK_PRODUCTS;
  const summary = MOCK_DASHBOARD;
  return (
    <>
      <Header
        right={
          <Link href="/cart" aria-label="장바구니" className="tap inline-flex">
            <span aria-hidden className="text-h4">🛒</span>
          </Link>
        }
      />
      <main className="pb-[calc(56px+env(safe-area-inset-bottom)+16px)]">
        {/* Hero */}
        <section className="px-base pt-base">
          <div className="relative aspect-[16/9] overflow-hidden rounded-card bg-secondary">
            <div className="absolute inset-0 flex flex-col items-start justify-end gap-sm p-base bg-gradient-to-t from-primary/60 to-transparent text-primary-foreground">
              <h2 className="text-h2">새로운 시작, 함께</h2>
              <p className="text-body-sm opacity-90">특별 기획전 · 최대 30%</p>
            </div>
          </div>
          <div className="mt-sm flex justify-center gap-xs" aria-hidden>
            <span className="h-1.5 w-4 rounded-pill bg-primary" />
            <span className="h-1.5 w-1.5 rounded-pill bg-border-strong" />
            <span className="h-1.5 w-1.5 rounded-pill bg-border-strong" />
          </div>
        </section>

        {/* Categories */}
        <section className="mt-section px-base" aria-labelledby="cat-heading">
          <h2 id="cat-heading" className="sr-only">카테고리</h2>
          <ul className="flex gap-sm overflow-x-auto pb-xs -mx-base px-base">
            {['전체', '의류', '가방', '신발', '액세서리', '라이프'].map((cat) => (
              <li key={cat}>
                <button className="tap rounded-pill border border-border px-md bg-background text-body-sm">
                  {cat}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Best grid */}
        <section className="mt-section px-base" aria-labelledby="best-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="best-heading" className="text-h3">베스트</h2>
            <Link href="/products" className="text-body-sm text-accent">
              더보기 &gt;
            </Link>
          </div>
          <div className="mt-base grid grid-cols-2 gap-base md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        {/* Referral summary */}
        <section className="mt-section px-base" aria-labelledby="ref-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="ref-heading" className="text-h3">내 레퍼럴 요약</h2>
            <Link href="/dashboard" className="text-body-sm text-accent">
              대시보드 &gt;
            </Link>
          </div>
          <div className="mt-base rounded-card border border-border bg-background p-lg shadow-card space-y-sm">
            <p className="text-caption text-muted-foreground">이번 달 예상 수익</p>
            <p className="text-earnings-xl font-extrabold tabular-nums text-foreground">
              {formatKrw(summary.expectedThisMonthKrw)}
            </p>
            <dl className="grid grid-cols-3 gap-sm text-body-sm">
              <div>
                <dt className="text-muted-foreground">1대 (3%)</dt>
                <dd className="tabular-nums">{formatKrw(summary.byGeneration.gen1.amountKrw)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">2대 (5%)</dt>
                <dd className="tabular-nums">{formatKrw(summary.byGeneration.gen2.amountKrw)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">3대 (17%)</dt>
                <dd className="tabular-nums">{formatKrw(summary.byGeneration.gen3.amountKrw)}</dd>
              </div>
            </dl>
            <Button asChild variant="accent" size="lg" block>
              <Link href="/invite">초대 링크 공유하기</Link>
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-section-lg border-t border-border px-base py-lg text-caption text-muted-foreground space-y-xs">
          <p>(주)Nuxia · 통신판매업 신고번호 0000-0000</p>
          <p>고객센터 1670-2575 · 평일 10:00–18:00</p>
          <div className="flex gap-md">
            <Link href="/legal/terms" className="underline">이용약관</Link>
            <Link href="/legal/privacy" className="underline">개인정보처리방침</Link>
          </div>
        </footer>
      </main>
      <TabBar />
    </>
  );
}
