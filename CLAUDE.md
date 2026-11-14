# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

바닐라 JS로 만든 정적 투두리스트 웹앱 (빌드 도구, 패키지 매니저, 테스트 없음). Firebase Firestore를 데이터 저장소로 사용한다.

## 실행 방법

빌드 과정이 없다. `index.html`을 브라우저에서 직접 열거나 정적 서버로 서빙하면 된다:

```powershell
npx serve .
# 또는
python -m http.server 8000
```

날씨 기능(geolocation)과 클립보드 API는 `file://`에서 제한될 수 있으므로 로컬 서버 사용을 권장.

## 아키텍처

모듈 시스템 없이 전역 스코프를 공유하는 `<script>` 태그 순차 로드 구조. **로드 순서가 중요하다** (`index.html` 하단 참조):

1. Firebase compat SDK (CDN, v10.12.2 — app/auth/firestore, modular API가 아닌 compat API 사용)
2. `firebase-config.js` — Firebase 초기화, 전역 `db`(Firestore)·`auth`(Auth) 정의
3. `script.js` — 메인 로직 전체 (전역 `db`, `auth`, `currentUid`, `todos`, `bg` 사용)
4. `localStorageBackup.js` — 백업/복구 UI (전역 `db`, `currentUid` 사용, `handleBackup`/`handleRestore`는 HTML inline onclick으로 호출됨)

`script.js`는 최상위에서 DOM 요소를 바로 조회하므로, 스크립트가 참조하는 요소는 `<script>` 태그보다 앞에 있어야 한다.

### 데이터 모델 (Firestore)

- `users/{uid}` — `{ bgIndex }` (uid는 Firebase Auth 사용자 ID)
- `users/{uid}/todos/{id}` — `{ text, title, id, done, datetime }`
  - `id`는 `Date.now()` 타임스탬프이며 문서 ID로도 사용 (문자열 변환)
  - `text`는 할일 내용 또는 URL, `title`은 `URL|제목` 형식 입력 시의 링크 제목
- `users/{uid}/bookmarks/{id}` — `{ title, url, key, id }` (`key`는 전역 단축키 한 글자, 없으면 `null`)
- `users/{uid}/trash/{type}-{id}` — `{ type: 'todo'|'bookmark', data, deletedAt }` 삭제된 항목 보관 (30일)
- `users/migrate-{토큰}` — 이름 기반 데이터를 계정으로 옮기기 위한 1회용 문서. `?migrate=<토큰>`으로 접속해 로그인하면 `runPendingMigration`이 복사 후 삭제한다.
- `users/태희`, `users/집`, `users/희희호호` — 이름 기반 시절의 레거시 데이터. 보안 규칙상 아무도 접근할 수 없으며 백업 용도로만 남아 있다.

### 인증/세션

Firebase Authentication의 Google 로그인(`signInWithPopup`)을 사용한다. 로그인 상태는 Firebase가 브라우저에 보관하므로 로그아웃 전까지 유지되며, `auth.onAuthStateChanged`가 화면 전환(`showLoggedIn`/`showLoggedOut`)을 담당한다.

접근 제어는 `firestore.rules`가 담당한다 — 각 사용자는 `users/{자기 uid}` 이하만 읽고 쓸 수 있다. `apiKey`는 공개값이므로 클라이언트 코드에서의 확인은 보안이 아니다. 규칙은 CLI 없이 Firebase 콘솔 > Firestore > 규칙 탭에 붙여넣어 게시한다 (Spark 무료 요금제 사용).

새 도메인에서 서비스하려면 Firebase 콘솔 > Authentication > 설정 > 승인된 도메인에 추가해야 로그인이 된다.

### 주요 동작 (script.js)

- 투두 입력란은 `할일` 또는 `URL|링크제목` 형식을 파싱 (`|` 구분)
- 투두 텍스트 클릭 시 `http`/`file`로 시작하면 새 창으로 열림
- 배경 선택기(`bg` 배열)는 선택 인덱스를 Firestore `bgIndex`에 저장
- 할일·즐겨찾기 삭제는 원본을 지우고 `users/{uid}/trash/{type}-{id}`(`{ type, data, deletedAt }`)로 옮긴다(`moveToTrash`). 7초간 실행 취소 토스트가 뜨고, 이후에도 "최근 삭제" 목록에서 복구할 수 있다(`restoreFromTrash`). 30일이 지난 항목은 로그인 시 자동 영구 삭제
- 날씨는 OpenWeatherMap API 사용 (API 키가 script.js에 하드코딩됨)

## 파일 참고

- `todo.js` — 빈 파일 (레거시, 사용 안 함)
- `firestore.rules` — Firestore 보안 규칙 원본 (콘솔에 게시하는 내용과 동일하게 유지)
- `.hintrc` — webhint 설정 (browserslist: IE 제외)

## 언어

UI 텍스트, 커밋 메시지, 주석 모두 한국어를 사용한다.
