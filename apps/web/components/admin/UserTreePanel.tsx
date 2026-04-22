'use client';

import * as React from 'react';
import type { TreeNode } from '@nuxia2/shared-types';
import { ReferralTreeNode } from '@/components/referral/ReferralTreeNode';

export interface UserTreePanelProps {
  tree: TreeNode;
  /** 관리자 전용 플래그된 userId 집합 — 해당 노드 옆에 빨간 점 오버레이 */
  flaggedUserIds?: string[];
}

/**
 * 기존 ReferralTreeNode 를 그대로 재사용하면서 관리자 오버레이(빨간 점)를 곁들인 래퍼.
 * 실제 오버레이는 헤더 범례 + 각 플래그 ID 표시로 간단히 표현 (skeleton).
 * 추후 ReferralTreeNode 에 `renderBadge` slot 을 추가하면 인라인 표시로 승격 가능.
 */
export function UserTreePanel({ tree, flaggedUserIds = [] }: UserTreePanelProps) {
  const flagged = collectFlagged(tree, new Set(flaggedUserIds));
  return (
    <section className="rounded-md border border-zinc-800 bg-zinc-950 p-base text-zinc-100">
      <header className="mb-sm flex items-center justify-between">
        <h3 className="text-h4">추천 트리 (3뎁스)</h3>
        <span className="inline-flex items-center gap-1 text-caption text-zinc-400">
          <span aria-hidden className="inline-block h-2 w-2 rounded-pill bg-red-500" />
          관리자 플래그
        </span>
      </header>
      {flagged.length > 0 && (
        <p className="mb-sm rounded-md border border-red-900 bg-red-950/40 p-sm text-body-sm text-red-200">
          플래그된 노드 {flagged.length}건: {flagged.map((n) => n.nickname).join(', ')}
        </p>
      )}
      <div className="rounded-md bg-zinc-900 p-sm text-zinc-900">
        {/* ReferralTreeNode 는 라이트 토큰 기반이므로 흰 배경 위에서 렌더링 */}
        <div className="rounded-sm bg-background p-sm">
          <ReferralTreeNode node={tree} />
        </div>
      </div>
    </section>
  );
}

function collectFlagged(node: TreeNode, flagged: Set<string>): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (n: TreeNode) => {
    if (flagged.has(n.userId)) out.push(n);
    n.children.forEach(walk);
  };
  walk(node);
  return out;
}
