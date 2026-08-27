# 행복한요양원 직원앱 (Android WebView 앱)

기존 직원 전용 웹 페이지를 감싸 보여주는 단순 WebView 래퍼 앱입니다.
권한(요양보호사/사회복지사/관리자) 분기는 **앱이 아니라 기존 웹 로그인·백엔드**에서 처리합니다.
(네이티브 로그인·푸시·출퇴근·카메라는 이번 버전 제외)

## 프로젝트 구조
```
apps/android-staff/
├─ settings.gradle
├─ build.gradle                  # 프로젝트 레벨(플러그인 버전)
├─ gradle.properties
├─ gradle/wrapper/gradle-wrapper.properties
└─ app/
   ├─ build.gradle               # ★ 직원 전용 URL 설정 위치
   ├─ proguard-rules.pro
   └─ src/main/
      ├─ AndroidManifest.xml      # 권한(INTERNET, ACCESS_NETWORK_STATE), HTTPS 강제, allowBackup=false
      ├─ java/com/happycare/staffapp/MainActivity.kt
      └─ res/
         ├─ layout/activity_main.xml
         ├─ values/strings.xml · colors.xml · themes.xml
         ├─ drawable/ic_launcher.xml   # 임시 런처 아이콘(벡터)
         └─ xml/backup_rules.xml
```

## ★ 직원 전용 URL 바꾸는 위치
`app/build.gradle` 의 `defaultConfig` 안 두 줄을 수정하세요.

```gradle
buildConfigField "String", "STAFF_URL",    "\"https://여기에-직원전용-URL-입력\""
buildConfigField "String", "ALLOWED_HOST", "\"여기에-직원전용-도메인\""
```

- `STAFF_URL`   : 앱 실행 시 처음 여는 직원 로그인/홈 페이지. 예) `https://admin.example.com/login`
- `ALLOWED_HOST`: WebView 안에서 유지할 내부 도메인. 예) `admin.example.com`

값을 바꾼 뒤 다시 빌드하면 됩니다. (URL/토큰은 코드가 아닌 BuildConfig로 주입)

## 보안 / 개인정보
- **FLAG_SECURE**: 스크린샷·화면 녹화 방지(민감정보 보호).
- 계정정보·자동로그인 토큰을 앱에 저장하지 않음. JWT/token 하드코딩 없음.
- 혼합 콘텐츠 차단(`MIXED_CONTENT_NEVER_ALLOW`), HTTP→HTTPS 전환, 평문 차단(`usesCleartextTraffic=false`).
- 로그에 URL query·token·개인정보를 출력하지 않음. `allowBackup=false`.
- release 빌드에서 WebView 디버깅 OFF(`BuildConfig.DEBUG`).

## 동작 요약
- 실행 시 직원 로그인 페이지 자동 로드. JS/DOM Storage/이미지 허용.
- 로딩 ProgressBar, 뒤로가기(WebView 히스토리→없으면 종료).
- 내부 도메인은 WebView, 외부 링크는 기본 브라우저.
- 인터넷 없음 / 로드 실패 시 안내 + [다시 시도].

## 나중에 확장
- 푸시(FCM), 출근 체크, 사진 업로드 등은 현재 구조를 유지한 채 별도 모듈/서비스로 추가하면 됩니다.
- 아이콘: `res/drawable/ic_launcher.xml`(임시) → `res/mipmap-*/ic_launcher.png` 세트로 교체 후 매니페스트 `android:icon`만 변경.
