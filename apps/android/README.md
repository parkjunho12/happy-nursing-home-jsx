# 행복한요양원 보호자앨범 (Android WebView 앱)

기존 웹 보호자 앨범을 감싸 보여주는 단순 WebView 래퍼 앱입니다.
(네이티브 로그인·푸시·스토어 등록은 이번 버전 제외)

## 프로젝트 구조
```
apps/android/
├─ settings.gradle
├─ build.gradle                  # 프로젝트 레벨(플러그인 버전)
├─ gradle.properties
├─ gradle/wrapper/gradle-wrapper.properties
└─ app/
   ├─ build.gradle               # ★ 보호자 앨범 URL 설정 위치
   ├─ proguard-rules.pro
   └─ src/main/
      ├─ AndroidManifest.xml      # 권한(INTERNET, ACCESS_NETWORK_STATE), HTTPS 강제
      ├─ java/com/happycare/guardianalbum/MainActivity.kt
      └─ res/
         ├─ layout/activity_main.xml   # 앱바 + WebView + ProgressBar + 오류화면
         ├─ values/strings.xml         # 앱 이름·오류 문구
         ├─ values/colors.xml
         ├─ values/themes.xml
         ├─ drawable/ic_launcher.xml    # 임시 런처 아이콘(벡터)
         └─ xml/backup_rules.xml
```

## ★ 보호자 앨범 URL 바꾸는 위치 (빌드 타입별)
`app/build.gradle` 의 `buildTypes` 안에서 **debug(로컬 테스트)** 와 **release(운영)** 를 각각 설정합니다.

```gradle
buildTypes {
    debug {   // 로컬 테스트
        buildConfigField "String", "ALBUM_URL",    "\"http://10.0.2.2:3000/family/albums\""
        buildConfigField "String", "ALLOWED_HOST", "\"10.0.2.2\""
        manifestPlaceholders = [cleartextTraffic: "true"]
    }
    release {  // 운영 (HTTPS 전용)
        buildConfigField "String", "ALBUM_URL",    "\"https://운영-도메인/family/albums\""
        buildConfigField "String", "ALLOWED_HOST", "\"운영-도메인\""
        manifestPlaceholders = [cleartextTraffic: "false"]
    }
}
```

- `ALBUM_URL`/`ALLOWED_HOST` : 처음 여는 주소 / WebView 안에서 유지할 도메인.
- IDN(한글) 도메인은 `ALLOWED_HOST`에 **punycode(xn--...)** 형태로 넣어야 내부 링크가 정확히 매칭됩니다.

## 로컬(localhost:3000)에서 테스트하기
에뮬레이터의 `localhost`는 PC가 아니라 에뮬레이터 자신을 가리키므로, **PC의 localhost는 `10.0.2.2`** 로 접근합니다. (디버그 빌드는 이미 이 값으로 설정돼 있고, 평문(http)도 디버그에서만 허용됩니다. 릴리스는 HTTPS 전용 유지.)

1. **백엔드** 실행: `localhost:8000`
2. **웹(apps/web)** 실행: `npm run dev` → `localhost:3000`
   - 에뮬레이터 WebView에서 띄운 웹이 백엔드를 찾도록 API 주소를 PC IP로:
     ```
     # apps/web/.env.local
     NEXT_PUBLIC_API_BASE_URL=http://10.0.2.2:8000
     ```
   - (PC 브라우저에서만 볼 때는 `http://localhost:8000` 로 두면 됩니다.)
3. 백엔드 **CORS 허용 오리진**에 `http://10.0.2.2:3000`, `http://localhost:3000` 추가.
4. Android Studio에서 **debug 빌드**로 실행 → 앱이 `http://10.0.2.2:3000/family/albums` 를 엽니다.
5. **실기기**로 테스트하면 `10.0.2.2` 대신 PC의 LAN IP(예: `192.168.0.10`)로 `ALBUM_URL`/`ALLOWED_HOST`/`NEXT_PUBLIC_API_BASE_URL` 을 바꾸세요.

## 빌드 / 실행
1. Android Studio에서 `apps/android` 폴더를 열기 → Gradle Sync (래퍼/SDK 자동 처리).
2. 위 `ALBUM_URL` / `ALLOWED_HOST` 수정.
3. 기기/에뮬레이터 선택 후 Run ▶.
   - 디버그 빌드: WebView 디버깅 ON (`BuildConfig.DEBUG`)
   - 릴리스 빌드: WebView 디버깅 OFF

## 동작 요약
- 실행 시 보호자 앨범 URL 자동 로드(로그인 페이지부터).
- JavaScript / DOM Storage / 이미지 자동 로드 허용.
- 혼합 콘텐츠 차단(`MIXED_CONTENT_NEVER_ALLOW`), HTTP는 HTTPS로 전환, 평문(cleartext) 차단.
- 로딩 중 상단 ProgressBar 표시.
- 뒤로가기: WebView 히스토리가 있으면 뒤로, 없으면 앱 종료.
- 인터넷 없음 / 페이지 로드 실패 시 안내 화면 + [다시 시도].
- 계정정보·자동로그인 토큰은 앱에 저장하지 않음(쿠키는 일반 브라우저 수준 허용).
- 이미지 업로드/다운로드는 이번 버전 제외.

## 나중에 확장할 때
- **아이콘 교체**: `res/drawable/ic_launcher.xml`(임시 벡터) 대신 `res/mipmap-*/ic_launcher.png` 세트를 추가하고
  `AndroidManifest.xml`의 `android:icon`을 `@mipmap/ic_launcher`로 바꾸면 됩니다.
- **푸시 알림(FCM)**: `MainActivity`는 그대로 두고, FCM 의존성 + `FirebaseMessagingService`를 별도 클래스로 추가하면 됩니다.
  현재 구조가 단순해서 확장에 영향이 없습니다.

## 푸시 알림(FCM) 설정 — 앨범 업로드 시 보호자 알림
앨범에 사진이 올라오면(`POST /admin/albums/{id}/media`) 백엔드가 해당 수급자의 보호자들에게 자동 푸시를 보냅니다.

동작 흐름:
1. 보호자가 앱(WebView)에서 로그인 → 웹 페이지가 네이티브 브릿지(`window.HappyCareNative.getFcmToken()`)로 FCM 토큰을 읽어 `POST /api/v1/family/push/register`로 서버에 등록.
2. 직원이 앨범에 사진 업로드 → 백엔드가 그 수급자 보호자들의 토큰으로 FCM 발송.
3. 앱이 알림 수신 → 탭하면 해당 앨범(`/family/albums/{id}`)으로 이동.

### 앱 쪽 준비
1. Firebase 콘솔에서 프로젝트 생성 → Android 앱 추가(패키지명 `com.happycare.guardianalbum`).
2. 받은 **`google-services.json`** 파일을 `apps/android/app/` 폴더에 넣으세요. (이 파일이 없으면 빌드가 실패합니다 — FCM 필수 파일)
3. 그대로 빌드하면 FCM 의존성/플러그인이 적용됩니다.

### 백엔드 쪽 준비 (이미 구현됨, 환경변수만 설정)
- Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성(JSON).
- 그 JSON 경로를 백엔드 환경변수로 지정:
  ```
  FCM_CREDENTIALS_FILE=/path/to/serviceAccount.json
  FCM_PROJECT_ID=your-firebase-project-id
  ```
- 미설정 시 푸시는 자동으로 비활성(no-op)되고 앱/업로드는 정상 동작합니다.

> 참고: 안드로이드 13+ 에서는 앱이 첫 실행 시 알림 권한을 요청합니다. 관리자 화면에서 특정 앨범만 수동 발송하려면 `POST /admin/albums/{id}/notify` 도 사용할 수 있습니다.
