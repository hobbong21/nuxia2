'use client';

import * as React from 'react';
import { Header } from '@/components/commerce/Header';
import { TabBar } from '@/components/commerce/TabBar';
import { ReferralTreeNode } from '@/components/referral/ReferralTreeNode';
import { MOCK_DASHBOARD } from '@/lib/mock';
import type { TreeNode } from '@nuxia2/shared-types';
import { formatDate, formatKrw } from '@/lib/format';

export default function TreePage() {
  const data = MOCK_DASHBOARD;
  const [selected, setSelected] = React.useState<TreeNode | null>(null);

  return (
    <>
      <Header title="내 추천 트리" showBack />
      <main className="pb-[calc(56px+env(safe-area-inset-bottom)+16px)] px-base pt-base space-y-base">
        <div className="flex gap-sm">
          <select className="tap rounded-pill border border-border bg-background px-md text-body-sm">
            <option>3대까지</option>
            <option>2대까지</option>
            <option>1대까지</option>
          </select>
          <select className="tap rounded-pill border border-border bg-background px-md text-body-sm">
            <option>전체 상태</option>
            <option>정상</option>
            <option>차단</option>
          </select>
        </div>

        <section className="rounded-card border border-border bg-background p-base">
          <ReferralTreeNode node={data.tree} onSelect={setSelected} />
        </section>

        {selected && (
          <section className="rounded-card border border-accent bg-accent/5 p-base space-y-xs">
            <h2 className="text-h4">선택: {selected.nickname}</h2>
            <p className="text-body-sm">가입일 {formatDate(selected.joinedAt)}</p>
            <p className="text-body-sm">
              이번 달 기여 {formatKrw(selected.contributionThisMonthKrw)}
            </p>
            <p className="text-body-sm">
              내가 받을 수익 {formatKrw(selected.myEarningThisMonthKrw)}
            </p>
            <p className="text-body-sm">
              상태 {selected.blockedReason ? `🚫 ${selected.blockedReason}` : '✅ 정상'}
            </p>
          </section>
        )}

        <aside
          aria-label="셀프레퍼럴 차단 예시"
          className="rounded-card border-2 border-referral-blocked bg-referral-blocked/5 p-base space-y-xs"
        >
          <h2 className="text-h4 text-referral-blocked flex items-center gap-xs">
            <span aria-hidden>⚠</span> 셀프레퍼럴 차단 예시
          </h2>
          <div className="flex items-center gap-sm rounded-card border border-referral-blocked bg-background p-sm">
            <span aria-hidden>🚫</span>
            <span className="text-body-sm font-semibold text-referral-blocked">
              차단됨 — 동일 인증정보
            </span>
          </div>
          <p className="text-caption text-muted-foreground">
            본인의 본인인증(ci)과 추천인의 ci가 일치하면 가입 및 원장 생성이 모두 차단됩니다.
          </p>
        </aside>
      </main>
      <TabBar />
    </>
  );
}
