---
name: nuxia-design-extract
description: Nuxia(nuxia.co.kr) 웹사이트의 디자인 언어를 추출하여 커머스 하이브리드앱용 디자인 토큰/컴포넌트/반응형 스펙으로 번안할 때 반드시 사용. (1) ux-designer가 `_workspace/02_designer_spec.md`를 작성할 때, (2) Tailwind config에 토큰을 매핑할 때, (3) 모바일 퍼스트 반응형 브레이크포인트 정의 시, (4) Capacitor safe-area/접근성 체크리스트 작성 시 사용.
---

# Nuxia Design Extract — 스타일 추출 & 커머스 번안

Nuxia의 기업 소개 스타일을 분석해 커머스 UI에 맞게 번안한다. 복제가 아닌 원리 추출.

## 추출 순서

### 1. 디자인 언어 관찰

Nuxia 사이트(https://www.nuxia.co.kr/About/Introduce)에서 다음을 관찰한다:

| 항목 | 관찰 포인트 |
|------|------------|
| 색상 | 주색(primary), 보조(secondary), 배경 계열(white/gray 단계), 강조(accent) |
| 타이포 | 한글 폰트(대개 Pretendard/Noto Sans KR), 제목/본문/캡션 사이즈 비율 |
| 레이아웃 | 최대 컨텐츠 폭, 섹션 간 수직 리듬, 그리드 컬럼 수 |
| 섹션 패턴 | 풀블리드 히어로 / 좌우 분할 소개 / 숫자 강조 / 카드 그리드 / 푸터 구조 |
| 마이크로 인터랙션 | 스크롤 리빌, 호버 전이, 링크 밑줄 스타일 |

관찰 불가(사이트 접근 실패, 구조 변경 등) 시 아래 "폴백 토큰 세트" 사용 + 문서에 명시.

### 2. 디자인 토큰 추출

아래 JSON 구조로 추출한다 (Tailwind config 직접 매핑 가능):

```json
{
  "colors": {
    "primary": { "DEFAULT": "#hex", "foreground": "#hex" },
    "secondary": { "DEFAULT": "#hex", "foreground": "#hex" },
    "accent": { "DEFAULT": "#hex", "foreground": "#hex" },
    "muted": { "DEFAULT": "#hex", "foreground": "#hex" },
    "background": "#hex",
    "foreground": "#hex",
    "border": "#hex"
  },
  "fontFamily": {
    "sans": ["Pretendard Variable", "Pretendard", "system-ui", "sans-serif"]
  },
  "fontSize": {
    "caption": "12px",
    "body": "14px",
    "lead": "16px",
    "h4": "20px",
    "h3": "24px",
    "h2": "32px",
    "h1": "40px",
    "display": "56px"
  },
  "spacing": { "section": "96px", "card": "24px", "inline": "8px" },
  "borderRadius": { "sm": "6px", "md": "10px", "lg": "16px", "pill": "999px" },
  "shadow": {
    "card": "0 2px 8px rgba(0,0,0,0.06)",
    "elevated": "0 8px 24px rgba(0,0,0,0.08)"
  }
}
```

### 3. 커머스 번안 (Nuxia 톤 → 커머스 컨텍스트)

| Nuxia의 의도 | 커머스에서의 번안 |
|-------------|-------------------|
| 기업 신뢰감 (여백 넉넉, 정돈된 타이포) | 상품 신뢰감 (가격은 명확, CTA는 차분하지만 대비 확보) |
| 차분한 주색 | 커머스 CTA는 주색 유지하되, 장바구니/구매 버튼은 `accent` 혹은 명도 한 단계 강조 |
| 대형 히어로 섹션 | 프로모션/베스트 상품 슬라이더로 치환 |
| 숫자 강조(매출/연혁) | 리뷰 수·평점·재고 수로 치환 |
| 좌우 분할 소개 | 상품 상세(이미지 좌 / 정보 우) |

## 반응형 브레이크포인트

모바일 퍼스트. Tailwind 기본값 준수:

| 이름 | 최소 폭 | 비고 |
|------|---------|------|
| (기본) | 360px | iPhone SE 기준 |
| sm | 640px | 소형 태블릿 세로 |
| md | 768px | 태블릿 |
| lg | 1024px | 작은 데스크톱 |
| xl | 1280px | 표준 데스크톱 |
| 2xl | 1536px | 와이드 |

**규칙:**
- 기본 스타일 = 360px 세로 뷰포트
- 레이아웃은 `md:` 이상에서만 다단 컬럼
- 터치 타겟 최소 44×44px (WCAG 2.5.5)
- 가로 스크롤 금지 (iOS webview 확대 방지)

## 핵심 화면 와이어프레임 (ASCII)

### 홈 (모바일)
```
┌─────────────────────┐
│ ☰ NUXIA    🔍 🛒(3) │  ← 고정 헤더
├─────────────────────┤
│                     │
│   [히어로 배너]     │
│                     │
├─────────────────────┤
│ 카테고리 · · · · ·  │  ← 가로 스크롤 칩
├─────────────────────┤
│ 베스트  더보기 >    │
│ [카드][카드][→]     │
├─────────────────────┤
│ 내 레퍼럴 요약      │
│ 3세대: 170,000원    │
│ [초대 링크 공유]    │
└─────────────────────┘
│    홈 검색 찜 내정보│  ← 고정 탭바
```

### 레퍼럴 대시보드
```
┌─────────────────────┐
│ ← 레퍼럴             │
├─────────────────────┤
│ 이번 달 수익         │
│ 250,000원            │
│ ├ 1대(3%)  30,000    │
│ ├ 2대(5%)  50,000    │
│ └ 3대(17%) 170,000   │
├─────────────────────┤
│ 내 트리 [펼치기]     │
│ └ 김○○ (1대)        │
│   └ 이○○ (2대)      │
│     └ 박○○ (3대)    │
├─────────────────────┤
│ 초대 코드: XYZ-123   │
│ [공유하기] [QR 보기] │
└─────────────────────┘
```

## 컴포넌트 카탈로그 (shadcn/ui 확장)

| 컴포넌트 | 상태 variants | 비고 |
|----------|--------------|------|
| `Button` | primary / secondary / ghost / destructive | 터치 타겟 h-12 기본 |
| `ProductCard` | default / sold-out / onsale | 이미지 1:1 비율 |
| `CartItem` | default / selected / error | 좌측 체크박스 44px |
| `ReferralTreeNode` | root / generation-1 / 2 / 3 / self-blocked | 셀프레퍼럴 시 빨간 경계 |
| `EarningsCard` | earned / pending / withheld | withheld는 warning 색 |
| `BottomTabBar` | iOS / Android safe-area 반영 | `pb-[env(safe-area-inset-bottom)]` |

## Capacitor 특이사항

- **Safe Area**: `html { padding-top: env(safe-area-inset-top); }` 또는 top-level layout에서 처리
- **키보드 회피**: `@capacitor/keyboard`로 input 포커스 시 스크롤 조정
- **딥링크**: 초대 링크(`nuxia2://referral/XYZ-123`)를 앱이 있을 때 앱으로, 없을 때 웹으로 라우팅
- **스와이프 뒤로가기**: iOS는 네이티브 제스처, Android는 하드웨어 백 버튼 핸들러
- **오프라인 fallback**: 초기 진입 시 네트워크 없으면 오프라인 플레이스홀더

## 접근성 체크리스트 (WCAG 2.1 AA)

- [ ] 본문 텍스트 대비 4.5:1
- [ ] 대형 텍스트(18px+) 대비 3:1
- [ ] 터치 타겟 44×44 이상
- [ ] 키보드/스크린리더로 주요 플로우 완주 가능
- [ ] 이미지 alt 텍스트
- [ ] 색상만으로 정보 전달 금지 (레퍼럴 상태는 색+아이콘+라벨)

## 폴백 토큰 세트 (Nuxia 접근 실패 시)

```json
{
  "colors": {
    "primary": { "DEFAULT": "#0F172A", "foreground": "#FFFFFF" },
    "accent": { "DEFAULT": "#2563EB", "foreground": "#FFFFFF" },
    "background": "#FFFFFF",
    "foreground": "#0F172A",
    "border": "#E2E8F0"
  }
}
```

사용 시 문서 상단에 "Nuxia 접근 실패로 폴백 토큰 적용" 명시.

## 체크리스트

- [ ] 디자인 토큰 JSON 완성
- [ ] 핵심 6화면 와이어프레임
- [ ] 컴포넌트 카탈로그 5종 이상
- [ ] Capacitor safe-area + 딥링크 규약
- [ ] 접근성 체크리스트 체크
