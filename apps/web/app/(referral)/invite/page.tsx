import { Header } from '@/components/commerce/Header';
import { TabBar } from '@/components/commerce/TabBar';
import { InviteCodeShare } from '@/components/referral/InviteCodeShare';
import { MOCK_DASHBOARD } from '@/lib/mock';

export default async function InvitePage() {
  const code = MOCK_DASHBOARD.tree.referralCode;
  const url = `https://nuxia2.app/r/${code}`;
  // TODO: QR 라이브러리 (e.g. qrcode.react) 추가 시 실제 SVG 렌더
  return (
    <>
      <Header title="친구 초대" showBack />
      <main className="pb-[calc(56px+env(safe-area-inset-bottom)+16px)] px-base pt-base space-y-base">
        <InviteCodeShare referralCode={code} />

        <section className="rounded-card border border-border bg-background p-base">
          <h2 className="text-h4 mb-sm">QR 코드</h2>
          <div
            aria-label={`QR 코드: ${url}`}
            className="mx-auto grid aspect-square w-48 grid-cols-12 grid-rows-12 gap-[2px] bg-foreground p-sm"
          >
            {/* 플레이스홀더 패턴. 실제 QR은 qrcode.react로 대체 */}
            {Array.from({ length: 144 }).map((_, i) => (
              <span
                key={i}
                className={i % 3 === 0 ? 'bg-background' : 'bg-foreground'}
              />
            ))}
          </div>
          <p className="mt-sm text-center text-caption text-muted-foreground break-all">
            {url}
          </p>
        </section>

        <section className="rounded-card border border-border bg-background p-base space-y-sm text-body-sm text-muted-foreground">
          <h2 className="text-h4 text-foreground">친구 초대 혜택</h2>
          <ul className="list-disc pl-md space-y-xs leading-relaxed">
            <li>친구가 내 코드로 가입 후 구매 시 1대 3% 수익</li>
            <li>친구의 친구가 구매 시 2대 5% 수익</li>
            <li>3대까지 총 25% 수익 구조</li>
            <li>구매확정 7일 후 정산, 월 10일 지급 (원천징수 3.3% 적용)</li>
          </ul>
        </section>
      </main>
      <TabBar />
    </>
  );
}
