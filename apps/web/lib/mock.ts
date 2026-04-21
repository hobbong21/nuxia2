/**
 * 임시 목(mock) 데이터.
 * TODO: backend-engineer의 실제 API 완성 후 api-client 호출로 대체.
 */
import type { ProductCardData } from '@/components/commerce/ProductCard';
import type { DashboardResponse } from '@nuxia2/shared-types';

export const MOCK_PRODUCTS: ProductCardData[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    slug: 'sample-1',
    name: '베이식 화이트 셔츠 오버핏 프리미엄',
    brandName: 'NUXIA',
    imageUrl: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=600',
    listPriceKrw: '120000',
    salePriceKrw: '84000',
    discountPct: 30,
    referralPreviewBps: 300,
    soldOut: false,
    isNew: true,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    slug: 'sample-2',
    name: '네이비 테일러드 자켓',
    brandName: 'NUXIA',
    imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600',
    listPriceKrw: '180000',
    salePriceKrw: '180000',
    discountPct: 0,
    referralPreviewBps: 300,
    soldOut: false,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    slug: 'sample-3',
    name: '슬림 울 슬랙스',
    brandName: 'NUXIA',
    imageUrl: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600',
    listPriceKrw: '95000',
    salePriceKrw: '66500',
    discountPct: 30,
    referralPreviewBps: 300,
    soldOut: true,
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    slug: 'sample-4',
    name: '라이트 코튼 트레이닝 팬츠',
    brandName: 'NUXIA',
    imageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600',
    listPriceKrw: '65000',
    salePriceKrw: '45500',
    discountPct: 30,
    referralPreviewBps: 300,
    soldOut: false,
  },
];

export const MOCK_DASHBOARD: DashboardResponse = {
  expectedThisMonthKrw: '250000',
  byGeneration: {
    gen1: { rateBps: 300, amountKrw: '30000', orderCount: 3 },
    gen2: { rateBps: 500, amountKrw: '50000', orderCount: 2 },
    gen3: { rateBps: 1700, amountKrw: '170000', orderCount: 1 },
  },
  summary: {
    payableKrw: '250000',
    withheldKrw: '42000',
    revertedKrw: '9000',
    withheldCount: 5,
    revertedCount: 1,
  },
  recent: [],
  tree: {
    userId: 'root',
    nickname: '나 (홍길동)',
    referralCode: 'NX-ABC123',
    generation: 0,
    blockedReason: null,
    joinedAt: '2026-01-10T00:00:00Z',
    contributionThisMonthKrw: '0',
    myEarningThisMonthKrw: '0',
    children: [
      {
        userId: 'g1-a',
        nickname: '김○○',
        referralCode: 'NX-KIM001',
        generation: 1,
        blockedReason: null,
        joinedAt: '2026-02-02T00:00:00Z',
        contributionThisMonthKrw: '500000',
        myEarningThisMonthKrw: '15000',
        children: [
          {
            userId: 'g2-a',
            nickname: '이○○',
            referralCode: 'NX-LEE001',
            generation: 2,
            blockedReason: null,
            joinedAt: '2026-02-15T00:00:00Z',
            contributionThisMonthKrw: '300000',
            myEarningThisMonthKrw: '15000',
            children: [
              {
                userId: 'g3-a',
                nickname: '박○○',
                referralCode: 'NX-PARK01',
                generation: 3,
                blockedReason: null,
                joinedAt: '2026-03-01T00:00:00Z',
                contributionThisMonthKrw: '1000000',
                myEarningThisMonthKrw: '170000',
                children: [],
              },
            ],
          },
          {
            userId: 'g2-b',
            nickname: '최○○ (차단)',
            referralCode: 'NX-CHOI01',
            generation: 2,
            blockedReason: 'SELF_REFERRAL',
            joinedAt: '2026-03-05T00:00:00Z',
            contributionThisMonthKrw: '0',
            myEarningThisMonthKrw: '0',
            children: [],
          },
        ],
      },
    ],
  },
};
