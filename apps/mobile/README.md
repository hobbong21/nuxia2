# @nuxia2/mobile — Capacitor 래퍼

`apps/web`의 Next.js static export 번들을 iOS / Android 네이티브 앱으로 감싸는 Capacitor 프로젝트입니다.

> **중요**: 이 패키지에는 `ios/`와 `android/` 네이티브 프로젝트가 포함되어 있지 않습니다.
> Xcode / Android Studio가 설치된 환경에서 아래 절차로 초기화해야 합니다.

---

## 사전 요구사항

| 플랫폼 | iOS 빌드 | Android 빌드 | 비고 |
|--------|---------|-------------|------|
| **macOS** | ✅ Xcode 15+, iOS 16 SDK+ | ✅ Android Studio Hedgehog+ | 둘 다 가능 |
| **Windows** | ❌ | ✅ Android Studio Hedgehog+ | iOS는 CI(macOS runner) 또는 Mac 클라우드 필수 |
| **Linux** | ❌ | ✅ Android Studio Hedgehog+ | iOS 불가 |

공통:
- Node.js >= 20, pnpm >= 9
- JDK 17 (Android 빌드)
- CocoaPods 1.15+ (iOS — `brew install cocoapods`)
- Ruby 3.x (iOS fastlane 사용 시)

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

`apps/mobile/ios/` 디렉토리가 생성되고 `App.xcworkspace`가 포함됩니다. 최초 실행 시 CocoaPods이 자동으로 `pod install`을 실행합니다.

#### Android (Android Studio + JDK 17)

```bash
cd apps/mobile
pnpm run cap:add:android
```

`apps/mobile/android/` 디렉토리가 생성됩니다. Android Studio에서 Gradle sync가 자동으로 수행됩니다.

### 3) 동기화 및 실행

```bash
# 웹 변경사항 반영 (apps/web/out → native public/)
pnpm --filter @nuxia2/mobile run sync

# iOS 실기기/시뮬레이터 실행
pnpm --filter @nuxia2/mobile run cap:open:ios    # Xcode에서 실행
# 또는
pnpm --filter @nuxia2/mobile run cap:run:ios

# Android
pnpm --filter @nuxia2/mobile run cap:open:android
# 또는
pnpm --filter @nuxia2/mobile run cap:run:android
```

---

## 딥링크 설정

앱은 두 가지 딥링크 엔트리포인트를 지원합니다.

- **Custom scheme:** `nuxia2://referral/{code}`
- **Universal Link / App Link:** `https://nuxia2.app/r/{code}`

### iOS

#### 1. Custom URL Scheme

`ios/App/App/Info.plist`에 추가:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>app.nuxia2.deeplink</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>nuxia2</string>
    </array>
  </dict>
</array>
```

#### 2. Universal Link (선택, 배포 시)

`ios/App/App/App.entitlements`에 다음을 추가:

```xml
<key>com.apple.developer.associated-domains</key>
<array>
  <string>applinks:nuxia2.app</string>
</array>
```

서버에 `/.well-known/apple-app-site-association` 파일을 배포:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.app.nuxia2",
        "paths": ["/r/*"]
      }
    ]
  }
}
```

### Android

#### 1. Custom Scheme + App Link

`android/app/src/main/AndroidManifest.xml`의 `MainActivity` 내부:

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <!-- Custom scheme -->
  <data android:scheme="nuxia2" />
  <!-- App Link -->
  <data
    android:scheme="https"
    android:host="nuxia2.app"
    android:pathPrefix="/r/" />
</intent-filter>
```

#### 2. Android App Link 검증 파일

서버에 `/.well-known/assetlinks.json` 배포:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "app.nuxia2",
      "sha256_cert_fingerprints": ["<SHA256 키 지문>"]
    }
  }
}
```

---

## 포트원 SDK 동작 확인 절차

Capacitor 웹뷰 내부에서 PortOne V2 SDK가 정상 동작하는지 체크리스트:

1. 결제 시도 → 간편결제(네이버페이/카카오페이)는 **외부 앱 전환** 플로우가 정상인지
2. 외부 앱 전환 후 복귀 시 `capacitor://app` 또는 `appUrlOpen` 이벤트로 결과 수신
3. iOS의 경우 `Info.plist`의 `LSApplicationQueriesSchemes`에 간편결제 URL scheme whitelist 필요
4. Android의 경우 `AndroidManifest.xml`의 `<queries>`에 패키지 명시 필요
5. 본인인증(`identityVerification`)은 팝업 웹뷰로 처리되므로 `allowNavigation` 설정 확인 (`capacitor.config.ts`)

자세한 권장 설정은 PortOne V2 공식 문서 참조.

---

## 필수 권한 / 플러그인

현재 활성화된 플러그인:

| 플러그인 | 역할 |
|---------|------|
| `@capacitor/app` | 앱 라이프사이클, 딥링크(`appUrlOpen`), 하드웨어 백 버튼 |
| `@capacitor/share` | 네이티브 공유 시트 (레퍼럴 초대) |
| `@capacitor/preferences` | 플랫폼 key-value 저장소 |
| `@capacitor/keyboard` | 키보드 표출 이벤트 (포커스 스크롤 보정) |
| `@capacitor/status-bar` | 상태바 스타일 제어 |

---

## 알려진 제약 / 주의사항

- **Windows**에서는 iOS 빌드 불가 → Android만 가능. iOS는 macOS 또는 CI runner 필요.
- **macOS**에서는 둘 다 가능 (Xcode + Android Studio 모두 설치 권장).
- **JDK 17** 강제 — Android Gradle Plugin 8.x가 JDK 17 이상을 요구합니다.
- Universal Link / App Link는 배포 도메인(`nuxia2.app`) + AASA/assetlinks.json이 HTTPS로 서빙되어야 동작합니다.
- 포트원 결제는 웹뷰 내부에서 동작하지만 간편결제는 외부 앱 전환 흐름이 있어 URL Scheme whitelist 필요.
- 배포 서명 키(release keystore / App Store 인증서)는 이 레포에 포함되지 않습니다. CI secret으로 관리하세요.
