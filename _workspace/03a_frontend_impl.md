# 03a. Frontend 구현 노트 — Nuxia 커머스 하이브리드 앱

> 작성자: `frontend-engineer`
> 참조: `01_analyst_requirements.md`, `01a_policy_confirmations.md`, `02_designer_spec.md`
> 기술 스택: Next.js 14 (App Router) · React 18 · Tailwind 3.4 · shadcn/ui 스타일 · zustand · react-query 5 · zod 3 · Capacitor 6 · 포트원 V2

---

## 1. 디렉토리 구조

```
nuxia2/
├── apps/
│   ├── web/                          # Next.js 14 App Router
│   │   ├── app/
│   │   │   ├── (shop)/               # 커머스 라우트 그룹
│   │   │   │   ├── page.tsx                      # 홈
│   │   │   │   ├── products/page.tsx             # 목록
│   │   │   │   ├── products/[id]/page.tsx        # 상세 (Server)
│   │   │   │   ├── products/[id]/add-to-cart.tsx # 상세 인터랙션(Client)
│   │   │   │   ├── cart/page.tsx                 # 카트 (Client)
│   │   │   │   ├── checkout/page.tsx             # 체크아웃 (Client)
│   │   │   │   └── checkout/success/page.tsx     # 결제 콜백 (Client)
│   │   │   ├── (referral)/
│   │   │   │   ├── dashboard/page.tsx            # 대시보드 (Server)
│   │   │   │   ├── tree/page.tsx                 # 트리 뷰 (Client, 선택 상태)
│   │   │   │   └── invite/page.tsx               # 초대 코드·QR (Server)
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx                # 로그인 폼 (Client)
│   │   │   │   └── signup/page.tsx               # 가입 + 본인인증 + 추천코드 (Client)
│   │   │   ├── (mypage)/
│   │   │   │   ├── page.tsx                      # 마이페이지
│   │   │   │   ├── orders/page.tsx               # 주문 내역
│   │   │   │   └── payouts/page.tsx              # 정산 내역 (원천징수 3.3%)
│   │   │   ├── layout.tsx                        # 루트 레이아웃 + Providers
│   │   │   ├── globals.css                       # Tailwind + CSS 변수 + safe-area
│   │   │   ├── not-found.tsx
│   │   │   └── error.tsx
│   │   ├── components/
│   │   │   ├── ui/                               # shadcn 스타일: Button, Input, Card, Toast
│   │   │   ├── commerce/                         # ProductCard, CartItem, PriceTag, TabBar, Header
│   │   │   ├── referral/                         # ReferralTreeNode, EarningsCard, GenerationBadge, InviteCodeShare, TopSheet
│   │   │   ├── providers.tsx                     # QueryClient + Toaster
│   │   │   └── native-bootstrap.tsx              # Capacitor 초기화 Client 컴포넌트
│   │   ├── lib/
│   │   │   ├── api-client.ts                     # fetch + zod 검증 + ApiClientError
│   │   │   ├── portone.ts                        # 포트원 SDK 단일 진입점
│   │   │   ├── format.ts                         # KRW 포맷, BigIntString 유틸
│   │   │   ├── query-client.ts
│   │   │   ├── utils.ts                          # cn (tailwind-merge + clsx)
│   │   │   ├── mock.ts                           # 임시 목 데이터 (백엔드 연결 전)
│   │   │   └── native/                           # Capacitor 추상화 (웹 폴백 분기)
│   │   │       ├── index.ts
│   │   │       ├── share.ts
│   │   │       ├── storage.ts
│   │   │       ├── deep-link.ts
│   │   │       ├── back-button.ts
│   │   │       └── keyboard.ts
│   │   ├── stores/
│   │   │   └── cart.ts                           # zustand + persist localStorage
│   │   ├── design-tokens.json                    # 102개 디자인 토큰 (designer_spec §2)
│   │   ├── tailwind.config.ts                    # theme.extend로 tokens 펼침
│   │   ├── next.config.mjs                       # HYBRID_BUILD=1 시 static export
│   │   ├── postcss.config.mjs
│   │   ├── tsconfig.json
│   │   ├── next-env.d.ts
│   │   └── package.json
│   ├── mobile/                                   # Capacitor 래퍼
│   │   ├── capacitor.config.ts
│   │   ├── tsconfig.json
│   │   ├── README.md                             # 네이티브 프로젝트 초기화 가이드
│   │   └── package.json
│   └── api/                                      # backend-engineer 소관 (미터치)
└── packages/
    └── shared-types/                             # FE/BE 공용 zod 스키마
        ├── src/
        │   ├── index.ts                          # re-export 허브
        │   ├── common.ts                         # BigIntString, Pagination, ApiError
        │   ├── user.ts                           # UserRole/Status enum, Signup/Login/Auth
        │   ├── product.ts                        # Product, ProductStatus, ListQuery
        │   ├── order.ts                          # Order, OrderItem, ShippingAddress
        │   ├── referral.ts                       # ReferralLedger, TreeNode, DashboardResponse, Payout
        │   └── payment.ts                        # PaymentConfirm, IdentityVerify
        ├── tsconfig.json
        └── package.json
```

---

## 2. 라우팅 맵 (App Router)

| 경로 | 라우트 그룹 | 렌더 타입 | 비고 |
|------|-----------|---------|------|
| `/` | (shop) | Server | 홈 — 히어로, 카테고리, 베스트 그리드, 레퍼럴 요약 |
| `/products` | (shop) | Server | 목록 + sticky 필터 헤더 |
| `/products/[id]` | (shop) | Server + Client island | 상세 (SSR) + 장바구니 버튼(Client) |
| `/cart` | (shop) | Client | zustand 카트 스토어 |
| `/checkout` | (shop) | Client | 포트원 결제 TopSheet |
| `/checkout/success` | (shop) | Client | 백엔드 confirm 호출 |
| `/dashboard` | (referral) | Server | 레퍼럴 대시보드 — 3개 EarningsCard + 상태 + 최근 내역 |
| `/tree` | (referral) | Client | 인터랙티브 트리 (노드 선택 상태) |
| `/invite` | (referral) | Server | 초대 코드 + QR 플레이스홀더 |
| `/login` | (auth) | Client | 이메일+비밀번호 |
| `/signup` | (auth) | Client | 본인인증 + 추천코드 자동 주입 |
| `/mypage` | (mypage) | Server | 계정 요약 |
| `/mypage/orders` | (mypage) | Server | 주문 내역 |
| `/mypage/payouts` | (mypage) | Server | 정산 내역 (원천징수 3.3% 표시) |

라우트 그룹으로 논리 분리. URL에는 그룹 이름이 노출되지 않음 (Next 14 관례).

---

## 3. Server / Client 분리 규칙

- **Server (기본값)**: 초기 데이터 페치, SEO 필요, 인터랙션 없음. 예: 홈, 목록, 상세, 대시보드, 마이페이지.
- **Client (`"use client"`)**: 상태·이벤트·브라우저 API 필요. 예: 카트, 체크아웃, 트리 선택, 폼, 토스트.
- **혼합 패턴**: 상품 상세는 Server 페이지 안에 Client "island"(`add-to-cart.tsx`)만 분리.
- **데이터 페칭**:
  - Server: `fetch()` with `cache: 'no-store'` (현재는 mock — TODO)
  - Client: `@tanstack/react-query` + `lib/api-client.ts`의 zod 검증 유틸

---

## 4. 디자인 토큰 → Tailwind 매핑

### 방식
1. `apps/web/design-tokens.json`에 designer_spec §2의 전체 토큰(102개) 그대로 이식.
2. `tailwind.config.ts`에서 JSON을 import, `theme.extend`에 색·폰트·간격·반경·그림자·행간·z-index·트랜지션을 펼침.
3. `globals.css`에서 shadcn/ui가 기대하는 HSL 기반 CSS 변수도 병행 세팅 (하이브리드 호환).

### 사용 예
```tsx
<button className="bg-accent text-accent-foreground hover:bg-accent-hover rounded-button h-12 shadow-focus" />
<p className="text-earnings-xl font-extrabold tabular-nums" /> {/* 40px */}
<span className="bg-referral-gen3 text-white rounded-pill" />
```

### 토큰 카운트 (JSON)
- colors 40, fontFamily 2, fontSize 12, spacing 16, borderRadius 9, boxShadow 6, lineHeight 5, zIndex 8, transitionDuration 4, transitionTimingFunction 4 (designer spec의 `transition`을 duration+timing으로 분리) = **총 106 엔트리**

### 왜 JSON으로 분리했나
Designer가 토큰 변경 시 `design-tokens.json` 한 파일만 PR → frontend는 자동 반영. 역할 분리가 선명.

---

## 5. 포트원 결제·본인인증 연동 경로

### 구조
- **유일한 SDK 진입점**: `apps/web/lib/portone.ts`
  - `requestPayment()` — 결제위젯 호출
  - `requestIdentityVerification()` — 본인인증
- **UI 레이어**는 위 함수만 호출. SDK 직접 import 금지.

### 결제 흐름 (프론트 관점)
1. `/checkout` 페이지에서 사용자 "결제하기" 탭
2. TODO: `POST /orders` 호출로 서버 주문 생성 → `paymentId` 수신
3. `lib/portone.ts::requestPayment()` 호출 (금액은 BigIntString → number 변환)
4. 결제 성공 시 `/checkout/success?paymentId=...&orderId=...` 리다이렉트
5. success 페이지에서 `api.post('/payments/confirm', ...)` 호출 → **백엔드가 포트원 API로 재조회 후 금액 검증**
6. 결과(`PAID`)에 따라 카트 clear + 주문 내역 이동

### 본인인증 흐름
1. `/signup`에서 "포트원 본인인증" 버튼 탭
2. `requestIdentityVerification()` → 팝업/웹뷰
3. 성공 시 `identityVerificationId`를 상태 저장
4. 가입 요청(`POST /auth/signup`)에 포함 → 백엔드가 `ci` 획득

### 환경 변수
```
NEXT_PUBLIC_API_BASE_URL=https://api.nuxia2.kr
NEXT_PUBLIC_PORTONE_STORE_ID=store-xxxx
NEXT_PUBLIC_PORTONE_CHANNEL_KEY=channel-xxxx       # 결제용
NEXT_PUBLIC_PORTONE_IV_CHANNEL_KEY=channel-iv-xxxx # 본인인증용
```

---

## 6. Capacitor 래핑 규약

### 6-1. Safe Area
- `globals.css`에 `--safe-top/--safe-bottom/--safe-left/--safe-right` CSS 변수 노출
- 유틸리티: `.pt-safe / .pb-safe / .pl-safe / .pr-safe`
- 탭바: `pb-safe` + 56px 고정 / 헤더: `pt-safe`

### 6-2. 딥링크
- `lib/native/deep-link.ts`에 `parseReferralCode()` 순수 함수
- `initDeepLinks()`: Capacitor App plugin의 `appUrlOpen` 리스너 등록
- 파싱된 코드는 `nativeStorage.set('pendingReferralCode', code)` 저장
- `/signup` 진입 시 `getPendingReferralCode()` pop → input 자동 주입
- 지원 URL:
  - `nuxia2://referral/{code}` (custom scheme)
  - `https://nuxia2.app/r/{code}` (Universal Link / App Link)

### 6-3. 하드웨어 백 버튼 (Android)
- `lib/native/back-button.ts`의 `initHardwareBackButton()`
- 우선순위 스택:
  1. `pushBackHandler()`로 등록된 핸들러 (TopSheet/Modal이 활용)
  2. 비루트 라우트 → `router.back()`
  3. 루트 탭 → 2초 이내 재입력 시 `App.exitApp()`, 아니면 토스트

### 6-4. 키보드
- `lib/native/keyboard.ts`의 `keyboardWillShow` 리스너에서
  활성 엘리먼트 `scrollIntoView({ block: 'center' })`

### 6-5. 오프라인 / 스크롤 복원
- 현재는 기본 제공. 향후 SWR 캐시 / sessionStorage 기반 확장 TODO.

### 6-6. 빌드 분기
- Web SSR: `next build` (기본)
- Hybrid: `HYBRID_BUILD=1 next build` → `output: 'export'`, `images.unoptimized: true`, `trailingSlash: true`
- Capacitor `webDir: '../web/out'`로 정적 번들 소싱

---

## 7. 주요 컴포넌트 구현 노트 (12개)

| # | 컴포넌트 | 파일 | 핵심 구현 포인트 |
|---|---------|------|----------------|
| 1 | `Button` | `components/ui/button.tsx` | cva 기반 variants (primary/secondary/accent/ghost/destructive/link) × sizes (sm/md/lg/xl/icon). `asChild` 로 Link/a 감싸기. loading 시 스피너 + 텍스트 유지. `icon` size는 44×44 터치 타겟 |
| 2 | `Input` | `components/ui/input.tsx` | h-11(44px), focus 시 ring + 배경 전환, disabled 40% opacity |
| 3 | `Card` / `CardHeader` / `CardTitle` / `CardContent` / `CardFooter` | `components/ui/card.tsx` | shadow-card + rounded-card, 디자이너 스펙 준수 |
| 4 | `Toast` / `Toaster` / `useToast` | `components/ui/toast.tsx` | 하단 고정, tabbar 높이만큼 offset, aria-live 자동 분기 (error=assertive) |
| 5 | `ProductCard` | `components/commerce/ProductCard.tsx` | 이미지 1:1 aspect-square, 타이틀 2줄 line-clamp-2, 우하단 "N% 적립" 뱃지, SOLD OUT overlay, NEW 뱃지 |
| 6 | `PriceTag` | `components/commerce/PriceTag.tsx` | 3요소 위계: 할인율 뱃지(빨강) + 원가 취소선(회색) + 판매가(굵은 검정 price-lg). soldOut variant 별도 |
| 7 | `CartItem` | `components/commerce/CartItem.tsx` | min-h 88px, 체크박스 44px, 수량 stepper 각 44px, 삭제 × 아이콘 |
| 8 | `TabBar` | `components/commerce/TabBar.tsx` | fixed bottom + `pb-safe`, 4탭 (홈/카테고리/레퍼럴/MY), `usePathname`으로 active 판정, h-tabbar (56px) |
| 9 | `Header` | `components/commerce/Header.tsx` | sticky top-0, 스크롤 > 100px 시 `bg-background/90 backdrop-blur`, showBack/뒤로가기 지원, `pt-safe` |
| 10 | `ReferralTreeNode` | `components/referral/ReferralTreeNode.tsx` | 재귀 렌더. gen별 ring color (primary/gen1/gen2/gen3). **셀프레퍼럴 차단은 색(referral-blocked) + 🚫 아이콘 + "차단됨" 라벨 3중 인코딩**. 하위 `ul` 들여쓰기 + border-l |
| 11 | `EarningsCard` | `components/referral/EarningsCard.tsx` | variant 4종 (expected/payable/withheld/revert), expected일 때만 `GenerationBars` (gen3가 가장 두꺼운 bar). **confetti/레벨업 애니메이션 금지 — 투명성 우선**. ℹ 3대 17% "상위 추천인에게 지급" 보조 문구 |
| 12 | `GenerationBadge` | `components/referral/GenerationBadge.tsx` | pill h-6, gen별 색, `withHint && generation === 3` 시 "상위 추천인에게 지급되는 비율입니다" 보조 라벨 동반 |
| 13 (보조) | `InviteCodeShare` | `components/referral/InviteCodeShare.tsx` | 코드 박스(mono font) + 복사 + 공유 버튼, aria-label로 자모 분리 읽기 제공, `lib/native/share.ts`의 플랫폼 분기 호출 |
| 14 (보조) | `TopSheet` | `components/referral/TopSheet.tsx` | `transition.lerp` 500ms, drag handle, `pushBackHandler`로 하드웨어 백 버튼과 연동, body overflow 잠금 |

---

## 8. shared-types 스키마 목록

| 파일 | 주요 export |
|------|-----------|
| `common.ts` | `BigIntStringSchema`, `BigIntString`, `IsoDateTimeSchema`, `IsoDateTime`, `PaginationQuerySchema`, `ApiErrorSchema`, `makePaginatedSchema` |
| `user.ts` | `UserRoleSchema` (CUSTOMER/STAFF/STAFF_FAMILY/ADMIN), `UserStatusSchema` (ACTIVE/SUSPENDED/BANNED/WITHDRAWN/UNDER_REVIEW/MINOR_HOLD), `UserSchema`, `SignupRequestSchema`, `LoginRequestSchema`, `AuthResponseSchema` |
| `product.ts` | `ProductStatusSchema`, `ProductImageSchema`, `ProductSchema`, `ProductListQuerySchema` |
| `order.ts` | `OrderStatusSchema`, `OrderItemSchema`, `ShippingAddressSchema`, `OrderSchema`, `CreateOrderRequestSchema`, `CreateOrderResponseSchema` |
| `referral.ts` | `GenerationSchema`, `LedgerTypeSchema`, `LedgerStatusSchema`, `ReferralLedgerSchema`, `TreeNodeSchema` (recursive), `DashboardResponseSchema`, `PayoutStatusSchema`, `PayoutSchema` |
| `payment.ts` | `PaymentConfirmRequestSchema`, `PaymentConfirmResponseSchema`, `IdentityVerifyRequestSchema`, `IdentityVerifyResponseSchema` |

### BigInt JSON 규약
- DB의 BigInt 금액 컬럼은 JSON 직렬화 시 **문자열**로 내려온다고 가정 (`z.string().regex(/^-?\d+$/)`)
- 프론트는 표시 시 `formatKrw()` 사용, 합계 연산 시 BigInt 변환
- Number 캐스팅은 **표시 전용**으로 제한 (포트원 SDK 호출 시 한정)

---

## 9. TODO — 백엔드 API 완성 후 연결 작업

다음 지점들은 현재 `lib/mock.ts` 기반으로 동작. backend-engineer가 API 계약 발행하면 순차 연결.

| 화면 / 기능 | 필요한 API | 연결 지점 |
|-----------|----------|----------|
| 홈 베스트 / 목록 / 상세 | `GET /products`, `GET /products/:id` | `app/(shop)/page.tsx`, `products/page.tsx`, `products/[id]/page.tsx` (mock → api) |
| 카트 → 체크아웃 | `POST /orders` (서버 주문 생성) | `app/(shop)/checkout/page.tsx::onPay()` 의 `paymentId` 로컬 생성 부분 |
| 결제 confirm | `POST /payments/confirm` | `app/(shop)/checkout/success/page.tsx` (스키마는 이미 정의됨) |
| 본인인증 confirm | `POST /identity/confirm` | `app/(auth)/signup/page.tsx::onSubmit()` 직후 |
| 회원가입 / 로그인 | `POST /auth/signup`, `POST /auth/login` | `/signup`, `/login` |
| 레퍼럴 대시보드 | `GET /referral/dashboard` | `app/(referral)/dashboard/page.tsx` |
| 레퍼럴 트리 | `GET /referral/tree?depth=3` | `app/(referral)/tree/page.tsx` |
| 주문 내역 | `GET /orders?userId=me` | `app/(mypage)/orders/page.tsx` |
| 정산 내역 | `GET /payouts?userId=me` | `app/(mypage)/payouts/page.tsx` |

### 백엔드에 질의가 필요한 API 계약 항목

1. **에러 코드 규격 일관성** — 현재 `ApiErrorSchema = { code, message, details? }`로 가정. 백엔드가 `{ statusCode, message, error }` 형태로 내려보내면 `api-client.ts`의 파서 조정 필요.
2. **BigInt 직렬화 방식 확정** — Prisma BigInt → JSON 문자열 vs Number. `shared-types`는 **문자열 기준**. NestJS에 custom BigInt serializer 필요 (toString).
3. **TreeNode 응답 형태** — 재귀 구조 vs 평탄화 + parentId 조인. 현재 스키마는 재귀. 트리 깊이 3 고정이므로 둘 다 가능하나 최종 확정 필요.
4. **가격 정규화** — 상품 `listPriceKrw`, `salePriceKrw`, `discountPct` 중 `discountPct`는 캐시 컬럼인지 derived인지 확정.
5. **Order → Payment 연결 시점** — `POST /orders`에서 `paymentId`를 즉시 반환 vs 별도 엔드포인트? 현재 `CreateOrderResponseSchema`에 `paymentId` 포함으로 가정.
6. **Referral Dashboard 월 경계** — 서버 기준 KST 월 경계 판정(1일 00:00 KST) 확인.
7. **Payout 원천징수 계산 규칙** — `amountNet = amountGross - floor(amountGross * 0.033)` 인지, 원천 330bps 방식인지 확인 (정책 T1 기준).
8. **본인인증 API 응답** — ci 자체는 프론트에 노출하지 않음이 원칙. `verified: boolean + age` 만 반환하는 것으로 가정. 백엔드가 다른 필드 포함 시 스키마 업데이트.

---

## 10. 추후 작업 (환경 초기화)

### 개발자 환경 세팅
```bash
# 루트에서
pnpm install

# 웹 개발 서버
pnpm --filter @nuxia2/web run dev

# 타입 체크
pnpm --filter @nuxia2/shared-types run build
pnpm --filter @nuxia2/web run typecheck
```

### 하이브리드 앱 빌드 (3단계)
```bash
# 1. 웹 static export
pnpm --filter @nuxia2/web run build:hybrid  # → apps/web/out/

# 2. (최초 1회) 네이티브 프로젝트 생성
#    - macOS에서 iOS:
pnpm --filter @nuxia2/mobile run cap:add:ios
#    - Android:
pnpm --filter @nuxia2/mobile run cap:add:android

# 3. 동기화 + 실행
pnpm --filter @nuxia2/mobile run sync
pnpm --filter @nuxia2/mobile run cap:open:ios       # Xcode
pnpm --filter @nuxia2/mobile run cap:open:android   # Android Studio
```

### 주의
- `apps/mobile/ios/` 및 `apps/mobile/android/`는 **커밋되지 않은 상태** — 각 개발자/CI가 최초 빌드 시 생성.
- Windows 환경에서는 iOS 빌드 불가. Android만 가능.
- Capacitor 딥링크 실제 동작에는 배포 도메인에 AASA 파일/assetlinks.json 업로드 필요 (apps/mobile/README.md 참조).

---

## 11. 검증 체크리스트 (self-check)

- [x] 모바일 퍼스트 — 기본 스타일 360px, `md:`에서만 다단 컬럼
- [x] 터치 타겟 44×44 최소 (`.tap` 유틸 + icon size + tap targets)
- [x] Safe Area — 헤더 `pt-safe`, 탭바/고정 하단 CTA `pb-safe`
- [x] 레퍼럴 상태 3중 인코딩 — 색 + 아이콘 + 라벨 (`ReferralTreeNode`, `EarningsCard`)
- [x] 3대 17% 옆 "상위 추천인에게 지급" 보조 문구 (`EarningsCard::GenerationBars`)
- [x] confetti/레벨업 애니메이션 **없음** (투명성 우선)
- [x] 셀프레퍼럴 차단: 색(blocked 진빨강) + 🚫 + "차단됨 — 동일 인증정보"
- [x] BigInt JSON 직렬화 — 모든 금액 BigIntString, `formatKrw` 로만 표시
- [x] 포트원 SDK 호출은 `lib/portone.ts`에서만
- [x] API fetch는 `lib/api-client.ts`에서만 (zod 검증 포함)
- [x] `@capacitor/*` import는 `lib/native/` 내부에서만
- [x] `prefers-reduced-motion` 대응 (`globals.css`에 미디어 쿼리)
- [x] focus-visible 링 (globals.css)
- [x] 한글 Pretendard 로딩 (웹폰트 + 시스템 폴백 체인)

---

## 부록 — 생성 파일 카운트

- `packages/shared-types/`: 9 파일 (config 2 + src 7)
- `apps/web/`:
  - configs: 6 (package.json, tsconfig.json, next.config.mjs, postcss.config.mjs, tailwind.config.ts, design-tokens.json, next-env.d.ts → 7)
  - app/: 14 페이지 (shop 6 + referral 3 + auth 2 + mypage 3 + layout + globals.css + not-found + error)
  - components/: 14 (ui 4 + commerce 5 + referral 5 + providers + native-bootstrap)
  - lib/: 11 (format, api-client, portone, query-client, utils, mock + native 6)
  - stores/: 1 (cart.ts)
- `apps/mobile/`: 4 (package.json, tsconfig.json, capacitor.config.ts, README.md)

총 ~60개 파일 생성.
