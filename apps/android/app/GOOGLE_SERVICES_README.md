# Firebase(FCM) 설정 안내

이 앱의 푸시 알림(FCM)을 켜려면 **`app/google-services.json`** 파일이 필요합니다.

1. Firebase Console → 프로젝트 생성 → Android 앱 추가
   - 패키지 이름: `com.happycare.guardianalbum`
2. 생성된 **google-services.json** 을 이 폴더(`app/`)에 넣기
3. 백엔드: Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 비공개 키(JSON) 발급 →
   서버에 두고 환경변수로 경로 지정:
   - `FCM_CREDENTIALS_FILE=/path/to/service-account.json`
4. 다시 빌드하면 FCM이 동작합니다.

> google-services.json 이 없으면 google-services 플러그인 때문에 빌드가 실패합니다.
> 푸시를 잠시 끄려면 build.gradle 들의 `com.google.gms.google-services` 플러그인 줄과
> `firebase-*` 의존성을 주석 처리하세요.
