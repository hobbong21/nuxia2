'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatKrw, formatDate } from '@/lib/format';
import type { TreeNode } from '@nuxia2/shared-types';
import { GenerationBadge } from './GenerationBadge';

const GEN_RING: Record<0 | 1 | 2 | 3, string> = {
  0: 'ring-primary',
  1: 'ring-referral-gen1',
  2: 'ring-referral-gen2',
  3: 'ring-referral-gen3',
};

/**
 * designer_spec §5-7 & §6 #5
 * - gen/3대 뱃지 (색)
 * - 셀프레퍼럴 차단은 색+🚫 아이콘+"차단됨" 라벨 3중 인코딩
 */
export interface ReferralTreeNodeProps {
  node: TreeNode;
  highlighted?: boolean;
  onSelect?: (node: TreeNode) => void;
}

export function ReferralTreeNode({
  node,
  highlighted,
  onSelect,
}: ReferralTreeNodeProps) {
  const blocked = node.blockedReason === 'SELF_REFERRAL';
  const otherBlocked = node.blockedReason && !blocked;

  return (
    <div className="flex flex-col gap-xs">
      <button
        type="button"
        onClick={() => onSelect?.(node)}
        className={cn(
          'tap flex items-center gap-sm rounded-card border p-sm text-left',
          'focus-visible:outline-none',
          blocked
            ? 'border-referral-blocked bg-referral-blocked/10'
            : otherBlocked
              ? 'border-status-warning bg-status-warning/10'
              : 'border-border bg-background',
          highlighted && 'ring-2 ring-accent',
        )}
        aria-label={blockedLabel(node)}
      >
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-pill ring-2 text-body-sm bg-muted',
            GEN_RING[node.generation],
          )}
          aria-hidden
        >
          {node.generation === 0 ? '나' : '👤'}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-xs">
            <span className="truncate text-body font-medium">{node.nickname}</span>
            {node.generation !== 0 && (
              <GenerationBadge generation={node.generation} />
            )}
          </span>
          <span className="block text-caption text-muted-foreground">
            가입 {formatDate(node.joinedAt)} · 기여 {formatKrw(node.contributionThisMonthKrw)}
          </span>
          {blocked && (
            <span className="mt-xs flex items-center gap-xs text-caption font-semibold text-referral-blocked">
              <span aria-hidden>🚫</span>
              <span>차단됨 — 동일 인증정보</span>
            </span>
          )}
          {otherBlocked && (
            <span className="mt-xs flex items-center gap-xs text-caption font-semibold text-status-warning">
              <span aria-hidden>⚠</span>
              <span>{blockedReasonLabel(node.blockedReason!)}</span>
            </span>
          )}
        </span>
      </button>
      {node.children.length > 0 && (
        <ul className="ml-4 border-l border-border pl-md space-y-xs">
          {node.children.map((child) => (
            <li key={child.userId}>
              <ReferralTreeNode node={child} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function blockedLabel(node: TreeNode): string {
  if (node.blockedReason === 'SELF_REFERRAL') return `${node.nickname} — 셀프레퍼럴 차단`;
  if (node.blockedReason === 'STAFF') return `${node.nickname} — 임직원 참여 불가`;
  if (node.blockedReason === 'SUSPENDED') return `${node.nickname} — 계정 정지`;
  if (node.blockedReason === 'WITHDRAWN') return `${node.nickname} — 탈퇴 회원`;
  return `${node.nickname} (${node.generation}대)`;
}

function blockedReasonLabel(reason: NonNullable<TreeNode['blockedReason']>) {
  switch (reason) {
    case 'STAFF':
      return '임직원 참여 불가';
    case 'SUSPENDED':
      return '계정 심사 중';
    case 'WITHDRAWN':
      return '탈퇴 회원';
    default:
      return '차단됨';
  }
}
