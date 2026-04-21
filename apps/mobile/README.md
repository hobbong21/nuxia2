# @nuxia2/mobile — Capacitor 래퍼

`apps/web`의 Next.js static export 번들을 iOS / Android 네이티브 앱으로 감싸는 Capacitor 프로젝트입니다.

> **중요**: 이 패키지에는 `ios/`와 `android/` 네이티브 프로젝트가 포함되어 있지 않습니다.
> Xcode / Android Studio가 설치된 환경에서 아래 절차로 초기화해야 합니다.

---

## 빌드 절차 (3단계)

### 1) 웹 번들 빌드 (static export)

```bash
# 루트에서
pnpm install
pnpm --filter @nuxia2/web run build:hybrid
# 결과: apps/web/out/
```

### 2) 네이티브 프로젝트 초기화 (최초 1회)

#### iOS (macOS + Xcode 필요)

```bash
cd apps/mobile
pnpm run cap:add:ios
```

`apps/mobile/ios/` 디렉토리가 생성되고 `App.xcworkspace`가 포함됩니다.

#### Android (Android Studio + JDK 17 권장)

```bash
cd apps/mobile
pnpm run cap:add:android
```

`apps/mobile/android/` 디렉토리가 생성됩니다.

### 3) 동기화 및 실행

```bash
# 웹 변경사항 반영
pnpm run sync

# iOS 실기기/시뮬레이터 실행
pnpm run cap:open:ios   # Xcode에서 실행
# 또는
pnpm run cap:run:ios

# Android
pnpm run cap:open:android
# 또는
pnpm run cap:run:android
```

---

## 딥링크 설정

- **Custom scheme:** `nuxia2://referral/{code}`
- **Universal Link:** `https://nuxia2.app/r/{code}`

### iOS

`Info.plist`에 추가:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>nuxia2</string>
    </array>
  </dict>
</array>
```

Universal Link는 `apps/mobile/ios/App/App/App.entitlements`에
`com.apple.developer.associated-domains` = `applinks:nuxia2.app`를 추가한 뒤
서버에 `/.well-known/apple-app-site-association` 파일을 배포해야 합니다.

### Android

`AndroidManifest.xml`의 `MainActivity` 인텐트 필터에 추가:

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="nuxia2" />
  <data android:scheme="https" android:host="nuxia2.app" android:pathPrefix="/r/" />
</intent-filter>
```

Universal Link는 `/.well-known/assetlinks.json`도 서버에 배포해야 합니다.

---

## 필수 권한

현재 활성화된 플러그인:

| 플러그인 | 역할 |
|---------|------|
| `@capacitor/app` | 앱 라이프사이클, 딥링크(`appUrlOpen`), 하드웨어 백 버튼 |
| `@capacitor/share` | 네이티브 공유 시트 (레퍼럴 초대) |
| `@capacitor/preferences` | 플랫폼 key-value 저장소 |
| `@capacitor/keyboard` | 키보드 표출 이벤트 (포커스 스크롤 보정) |
| `@capacitor/status-bar` | 상태바 스타일 제어 |

---

## 알려진 제약

- **Windows**에서는 iOS 빌드 불가 → Android만 가능
- **macOS**에서는 둘 다 가능
- 딥링크 Universal Link 동작은 배포 도메인 + AASA/assetlinks.json 필수
- 포트원 결제는 웹뷰 내부에서 동작하지만 간편결제(네이버페이/카카오페이)는 외부 앱 전환 흐름이 있어 커스텀 URL Scheme whitelist 필요
