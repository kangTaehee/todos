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

1. Firebase compat SDK (CDN, v10.12.2 — modular API가 아닌 compat API 사용)
2. `firebase-config.js` — Firebase 초기화, 전역 `db`(Firestore) 정의
3. `script.js` — 메인 로직 전체 (전역 `db`, `currentUsername`, `todos`, `bg` 사용)
4. `localStorageBackup.js` — 백업/복구 UI (전역 `db` 사용, `handleBackup`/`handleRestore`는 HTML inline onclick으로 호출됨)

### 데이터 모델 (Firestore)

- `users/{username}` — `{ username, bgIndex }` (사용자별 배경 이미지 인덱스)
- `users/{username}/todos/{id}` — `{ text, title, id, done, datetime }`
  - `id`는 `Date.now()` 타임스탬프이며 문서 ID로도 사용 (문자열 변환)
  - `text`는 할일 내용 또는 URL, `title`은 `URL|제목` 형식 입력 시의 링크 제목

### 인증/세션

실제 인증 없음 — 이름만 입력하는 로그인. `localStorage.username`으로 자동 로그인 유지. Firestore 문서 경로가 사용자 이름 기반이므로 이름이 곧 데이터 키다.

### 주요 동작 (script.js)

- 투두 입력란은 `할일` 또는 `URL|링크제목` 형식을 파싱 (`|` 구분)
- 투두 텍스트 클릭 시 `http`/`file`로 시작하면 새 창으로 열림
- 배경 선택기(`bg` 배열)는 선택 인덱스를 Firestore `bgIndex`에 저장
- 날씨는 OpenWeatherMap API 사용 (API 키가 script.js에 하드코딩됨)

## 파일 참고

- `todo.js` — 빈 파일 (레거시, 사용 안 함)
- `del.html` — 렌더링된 DOM을 저장한 스냅샷 (참고용, 앱에서 로드되지 않음)
- `.hintrc` — webhint 설정 (browserslist: IE 제외)

## 언어

UI 텍스트, 커밋 메시지, 주석 모두 한국어를 사용한다.
