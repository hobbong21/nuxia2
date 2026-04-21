---
name: nextjs-capacitor-build
description: Next.js 14 App Router + Tailwind + shadcn/ui + Capacitor 기반 커머스 하이브리드앱 프론트 스캐폴딩 시 반드시 사용. (1) frontend-engineer가 `apps/web/`과 `apps/mobile/` 스캐폴딩 시, (2) Tailwind config에 디자인 토큰 주입 시, (3) Capacitor webview 래핑 및 네이티브 기능 추상화 시, (4) 포트원 결제위젯·본인인증 SDK 프론트 연동 시 사용.
---

# Next.js × Capacitor Build — 하이브리드 커머스 프론트 스캐폴딩

반응형 웹 + iOS/Android 하이브리드앱을 단일 Next.js 코드베이스에서 빌드한다.

## 모노레포 디렉토리 구조

```
nuxia2/
├── apps/
│   ├── web/                  # Next.js 14 App Router
│   │   ├── app/
│   │   │   ├── (shop)/       # 커머스 라우트 그룹
│   │   │   │   ├── page.tsx           # 홈
│   │   │   │   ├── products/[id]/page.tsx
│   │   │   │   ├── cart/page.tsx
│   │   │   │   └── checkout/page.tsx
│   │   │   ├── (referral)/
│   │   │   │   ├── dashboard/page.tsx
│   │   │   │   └── invite/page.tsx
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── signup/page.tsx
│   │   │   ├── api/             # 프론트 BFF (필요 시만)
│   │   │   ├── layout.tsx       # 루트 레이아웃 (safe-area, 탭바)
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui 설치물
│   │   │   └── commerce/        # 도메인 컴포넌트
│   │   ├── lib/
│   │   │   ├── api-client.ts    # fetch 래퍼 + zod 검증
│   │   │   ├── native/          # Capacitor 추상화 (share, storage, camera)
│   │   │   └── portone.ts       # 포트원 결제/본인인증
│   │   ├── tailwind.config.ts
│   │   ├── next.config.mjs      # output: 'export' 옵션(하이브리드용)
│   │   └── package.json
│   └── mobile/                  # Capacitor 래퍼
│       ├── capacitor.config.ts
│       ├── ios/
│       ├── android/
│       └── package.json
├── packages/
│   └── shared-types/            # FE/BE 공유 타입 (zod 스키마)
└── package.json                 # pnpm workspace
```

## Tailwind 토큰 주입

`_workspace/02_designer_spec.md`의 토큰 JSON을 `tailwind.config.ts`에 매핑:

```ts
import type { Config } from 'tailwindcss'
import tokens from './design-tokens.json'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: tokens.colors,
      fontFamily: tokens.fontFamily,
      fontSize: tokens.fontSize,
      spacing: tokens.spacing,
      borderRadius: tokens.borderRadius,
      boxShadow: tokens.shadow,
    },
  },
} satisfies Config
```

**왜 토큰을 JSON으로 분리하나:** designer가 토큰 변경 시 `design-tokens.json`만 PR 하면 되어 역할 분리가 선명해진다.

## Server / Client 컴포넌트 규칙

| 화면 | 타입 | 이유 |
|------|------|------|
| 상품 목록 / 상세 (최초 렌더) | Server | SEO, 초기 로딩 속도 |
| 카트 (상태 변경 많음) | Client | useState/zustand |
| 체크아웃(결제 SDK) | Client | 포트원 SDK는 브라우저 전용 |
| 레퍼럴 대시보드(실시간 수치) | Server + Client 혼합 | 초기값 Server, 갱신은 Client |
| 인증 폼 | Client | 입력·검증 인터랙션 |

**데이터 페칭 원칙:**
- Server Component에서는 `fetch(apiUrl, { cache: 'no-store' })` 또는 tagged revalidate
- Client Component에서는 `@tanstack/react-query` + zod 스키마로 런타임 검증

## 포트원 결제/본인인증 연동

### 결제위젯 (V2 기준)

```ts
// lib/portone.ts
import PortOne from '@portone/browser-sdk/v2'

export async function requestPayment(params: {
  storeId: string
  orderName: string
  totalAmount: number
  customerId: string
  channelKey: string  // 결제 채널(토스/카드/계좌이체 등)
}) {
  return PortOne.requestPayment({
    storeId: params.storeId,
    channelKey: params.channelKey,
    paymentId: `order_${crypto.randomUUID()}`,
    orderName: params.orderName,
    totalAmount: params.totalAmount,
    currency: 'KRW',
    customer: { customerId: params.customerId },
  })
}
```

**중요:** 프론트는 `paymentId`만 결제 성공 콜백에서 받아 백엔드에 전달. 백엔드가 포트원 서버 API로 재조회 → 금액 검증 → 승인.

### 본인인증

```ts
export async function requestIdentityVerification(userId: string) {
  return PortOne.requestIdentityVerification({
    storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
    identityVerificationId: `iv_${crypto.randomUUID()}`,
    channelKey: process.env.NEXT_PUBLIC_PORTONE_IV_CHANNEL_KEY!,
    customer: { id: userId },
  })
}
```

콜백으로 받은 `identityVerificationId`를 백엔드에 전달 → 백엔드가 포트원 API로 조회해 `ci` 획득.

## Capacitor 래핑

### capacitor.config.ts

```ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'kr.nuxia2.app',
  appName: 'Nuxia2',
  webDir: '../web/out',       // Next.js output: 'export' 결과물
  server: {
    androidScheme: 'https',
    allowNavigation: ['api.nuxia2.kr'],
  },
  ios: { contentInset: 'always' },
  plugins: {
    SplashScreen: { launchShowDuration: 800 },
    Keyboard: { resize: 'native' },
  },
}
export default config
```

### Next.js 빌드 (하이브리드용 static export)

```js
// apps/web/next.config.mjs
export default {
  output: 'export',
  images: { unoptimized: true },  // export 시 필수
  trailingSlash: true,
}
```

**Web과 Hybrid 분리 빌드:**
- Web 배포: 기본 SSR/ISR (`next build` + `next start`)
- Hybrid 번들: `NEXT_OUTPUT=export next build` → `apps/mobile/`에서 `cap sync`

환경 변수로 분기 또는 별도 Next config (`next.hybrid.config.mjs`).

### 네이티브 기능 추상화

```ts
// lib/native/share.ts
import { Capacitor } from '@capacitor/core'

export async function shareReferralLink(url: string) {
  if (Capacitor.isNativePlatform()) {
    const { Share } = await import('@capacitor/share')
    await Share.share({ title: 'Nuxia2 초대', url })
  } else if (navigator.share) {
    await navigator.share({ url })
  } else {
    await navigator.clipboard.writeText(url)
  }
}
```

**원칙:** `@capacitor/*` import는 `lib/native/`에서만. 그 외 컴포넌트는 wrapper 함수만 호출.

## 반응형 레이아웃 예시

```tsx
// app/(shop)/products/page.tsx
export default async function ProductsPage() {
  const products = await fetchProducts()
  return (
    <main className="px-4 py-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <h1 className="text-h2 md:text-h1 font-bold mb-6">전체 상품</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
        {products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </main>
  )
}
```

## 필수 패키지

```jsonc
// apps/web/package.json (일부)
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "zod": "^3.23.0",
    "@tanstack/react-query": "^5.0.0",
    "@portone/browser-sdk": "^0.0.10",
    "zustand": "^4.5.0"
  }
}
```

```jsonc
// apps/mobile/package.json
{
  "dependencies": {
    "@capacitor/core": "^6.0.0",
    "@capacitor/ios": "^6.0.0",
    "@capacitor/android": "^6.0.0",
    "@capacitor/share": "^6.0.0",
    "@capacitor/keyboard": "^6.0.0",
    "@capacitor/preferences": "^6.0.0"
  }
}
```

## 체크리스트

- [ ] `apps/web/` Next.js App Router 구조 생성
- [ ] `tailwind.config.ts`에 디자인 토큰 매핑
- [ ] `apps/mobile/` Capacitor 구성, `cap sync` 실행 가능
- [ ] `lib/native/` 래퍼 5종 이상 (share, storage, camera, keyboard, haptics)
- [ ] 포트원 결제/본인인증 함수 분리 (프론트는 호출만, 검증은 백엔드)
- [ ] `packages/shared-types/`에 zod 스키마 정의
- [ ] 반응형 핵심 화면(홈/상품상세/체크아웃/레퍼럴) 360/768/1024 모두 확인
