/**
 * 임시 목(mock) 데이터.
 * TODO: backend-engineer의 실제 API 완성 후 api-client 호출로 대체.
 */
import type { ProductCardData } from '@/components/commerce/ProductCard';
import type { DashboardResponse } from '@nuxia2/shared-types';
import type { ProductSort } from '@/components/commerce/ProductFilterBar';

/**
 * v0.3.x 확장: `categoryName` + `createdAt` + `popularity` 필드.
 * - shared-types `Product.categoryName` (string | null | undefined) 와 동일한 자유 문자열.
 * - 필터/정렬은 `filterMockProducts()` 에서 처리.
 */
export interface MockProduct extends ProductCardData {
  categoryName: string;
  createdAt: string;
  popularity: number;
}

export const MOCK_PRODUCTS: MockProduct[] = [
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
    categoryName: '의류',
    createdAt: '2026-04-18T00:00:00Z',
    popularity: 980,
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
    categoryName: '의류',
    createdAt: '2026-04-02T00:00:00Z',
    popularity: 640,
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
    categoryName: '의류',
    createdAt: '2026-03-12T00:00:00Z',
    popularity: 410,
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
    categoryName: '의류',
    createdAt: '2026-04-10T00:00:00Z',
    popularity: 720,
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    slug: 'sample-5',
    name: '캔버스 토트백 블랙',
    brandName: 'NUXIA',
    imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600',
    listPriceKrw: '72000',
    salePriceKrw: '57600',
    discountPct: 20,
    referralPreviewBps: 300,
    soldOut: false,
    categoryName: '가방',
    createdAt: '2026-04-15T00:00:00Z',
    popularity: 540,
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    slug: 'sample-6',
    name: '레더 크로스백',
    brandName: 'NUXIA',
    imageUrl: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600',
    listPriceKrw: '240000',
    salePriceKrw: '192000',
    discountPct: 20,
    referralPreviewBps: 300,
    soldOut: false,
    categoryName: '가방',
    createdAt: '2026-03-28T00:00:00Z',
    popularity: 890,
  },
  {
    id: '77777777-7777-7777-7777-777777777777',
    slug: 'sample-7',
    name: '러너 스니커즈 오프화이트',
    brandName: 'NUXIA',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
    listPriceKrw: '139000',
    salePriceKrw: '118150',
    discountPct: 15,
    referralPreviewBps: 300,
    soldOut: false,
    isNew: true,
    categoryName: '신발',
    createdAt: '2026-04-20T00:00:00Z',
    popularity: 1120,
  },
  {
    id: '88888888-8888-8888-8888-888888888888',
    slug: 'sample-8',
    name: '스트랩 샌들 브라운',
    brandName: 'NUXIA',
    imageUrl: 'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=600',
    listPriceKrw: '78000',
    salePriceKrw: '62400',
    discountPct: 20,
    referralPreviewBps: 300,
    soldOut: false,
    categoryName: '신발',
    createdAt: '2026-04-08T00:00:00Z',
    popularity: 310,
  },
  {
    id: '99999999-9999-9999-9999-999999999999',
    slug: 'sample-9',
    name: '미니멀 실버 목걸이',
    brandName: 'NUXIA',
    imageUrl: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=600',
    listPriceKrw: '55000',
    salePriceKrw: '49500',
    discountPct: 10,
    referralPreviewBps: 300,
    soldOut: false,
    categoryName: '액세서리',
    createdAt: '2026-03-22T00:00:00Z',
    popularity: 420,
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    slug: 'sample-10',
    name: '클래식 브라운 벨트',
    brandName: 'NUXIA',
    imageUrl: 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=600',
    listPriceKrw: '39000',
    salePriceKrw: '31200',
    discountPct: 20,
    referralPreviewBps: 300,
    soldOut: false,
    categoryName: '액세서리',
    createdAt: '2026-04-05T00:00:00Z',
    popularity: 270,
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    slug: 'sample-11',
    name: '세라믹 머그컵 2종 세트',
    brandName: 'NUXIA Home',
    imageUrl: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600',
    listPriceKrw: '29000',
    salePriceKrw: '23200',
    discountPct: 20,
    referralPreviewBps: 300,
    soldOut: false,
    categoryName: '라이프',
    createdAt: '2026-04-12T00:00:00Z',
    popularity: 660,
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    slug: 'sample-12',
    name: '린넨 침구 세트 (Q)',
    brandName: 'NUXIA Home',
    imageUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600',
    listPriceKrw: '189000',
    salePriceKrw: '151200',
    discountPct: 20,
    referralPreviewBps: 300,
    soldOut: false,
    categoryName: '라이프',
    createdAt: '2026-03-30T00:00:00Z',
    popularity: 500,
  },
];

/**
 * URL 쿼리 기반 mock 필터링/정렬.
 * 실제 API 도입 시 제거하고 `api.get('/products', { params })` 로 대체.
 */
export function filterMockProducts(params: {
  categoryName?: string | null;
  keyword?: string;
  sort?: ProductSort;
}): MockProduct[] {
  const { categoryName, keyword, sort = 'popular' } = params;
  let out = MOCK_PRODUCTS.slice();

  if (categoryName) {
    out = out.filter((p) => p.categoryName === categoryName);
  }
  if (keyword && keyword.trim()) {
    const q = keyword.trim().toLowerCase();
    out = out.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brandName ?? '').toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q),
    );
  }

  switch (sort) {
    case 'newest':
      out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case 'popular':
      out.sort((a, b) => b.popularity - a.popularity);
      break;
    case 'priceAsc':
      out.sort(
        (a, b) => Number(BigInt(a.salePriceKrw) - BigInt(b.salePriceKrw)),
      );
      break;
    case 'priceDesc':
      out.sort(
        (a, b) => Number(BigInt(b.salePriceKrw) - BigInt(a.salePriceKrw)),
      );
      break;
  }
  return out;
}

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
