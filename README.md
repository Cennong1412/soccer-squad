# 월드 사커 스쿼드 (PWA)

11개 주요 축구 리그의 팀별 선수 명단과 시즌 기록을 폰에서 팀/국적/포지션/나이별로 보는 PWA입니다.
빌드 단계 없이 브라우저가 `data/*.csv`를 직접 읽어 화면을 만듭니다.

(사우디 프로리그, K리그1은 사용자 요청으로 앱에서 제외되어 있습니다. CSV 파일은 `data/`에 남아있고 `js/config.js`의 `LEAGUES` 배열에 다시 추가하면 복원됩니다.)

## 폴더 구조

```
index.html          앱 진입점
manifest.json        PWA 설치 정보
service-worker.js    오프라인 캐싱
css/style.css
js/config.js         리그 메타데이터 (팀 수, 데이터 공백 안내 등)
js/data.js            CSV 파싱 및 정규화
js/app.js             화면/라우팅 로직
js/news.js             뉴스 탭(텍스트/음성/저장됨) 로직
js/firebase-config.js  Firebase 초기화 (Google 로그인 + 저장 기사 동기화)
data/*.csv             선수 데이터 (11개 리그)
data/market_values.csv 선수 시장 가치 (아래 "몸값 데이터" 참고)
data/news.json          매일 자동 갱신되는 축구 뉴스 (아래 "뉴스 기능" 참고)
data/meta.json         마지막 업데이트 날짜
icons/                 PWA 아이콘
scripts/fetch-news.mjs GitHub Actions가 매일 실행하는 뉴스 수집 스크립트
```

## 뉴스 기능 (텍스트/음성/저장됨)

- 잉글랜드·미국·스페인·독일 축구 뉴스를 매일 자동 수집합니다 (The Guardian RSS. BBC Sport는 요약이 한 문장뿐이라 음성 재생 시간이 너무 짧아 제외함).
- 스페인(Marca)·독일(Kicker) 현지 언론 기사도 추가로 수집해 MyMemory 무료 API로 영어 번역해서 보여줍니다 (번역된 기사는 "번역됨" 배지 표시).
- 모든 탭(텍스트/음성)에 "원문 보기" 링크가 있습니다. 번역된 기사는 원문 링크에 언어를 표시해두었습니다 (구글 번역 프록시는 지역 제한으로 막혀서 쓰지 않음 — 원문이 스페인어/독일어이니 브라우저의 자동/우클릭 번역 기능을 이용하세요).
  - `.github/workflows/fetch-news.yml`이 매일 06:00 KST에 `scripts/fetch-news.mjs`를 실행해 `data/news.json`을 갱신·커밋합니다.
  - 수동 갱신: `node scripts/fetch-news.mjs`
- **텍스트** 탭: 기사 제목/요약, 원문 링크.
- **음성** 탭: 브라우저 내장 Web Speech API로 영어 낭독 (재생 속도 0.95x, 별도 비용 없음).
- **저장됨** 탭: Google 로그인 후 Firestore에 저장 — 여러 기기에서 동기화됩니다. 로그인은 우측 상단 👤 버튼.
  - Firebase 프로젝트: `world-soccer-squad` (계정: seungchul.ha@gmail.com)
  - 보안 규칙: `firestore.rules` (본인 uid의 문서만 읽기/쓰기 가능)

## 6개월마다 데이터 업데이트하는 방법

1. Claude에게 새 시즌 CSV 13개를 요청해 `data/` 폴더의 기존 파일을 같은 파일명으로 덮어씁니다.
   - 컬럼 구성이나 순서가 바뀌면 `js/data.js`의 `COLUMNS` 배열도 함께 수정해야 합니다.
2. 팀 구성이 바뀌었으면 `js/config.js`의 `LEAGUES` 배열에서 `expectedTeams`, `note` 값을 갱신합니다.
   - 예: 라리가가 이제 20팀 전부 채워졌다면 `note` 줄을 지웁니다.
3. `data/meta.json`의 `lastUpdated` 날짜를 오늘 날짜로 바꿉니다.
4. 변경 사항을 커밋하고 GitHub에 push하면 GitHub Pages가 자동으로 재배포합니다.

## 몸값 데이터 (data/market_values.csv)

[dcaribou/transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets) (CC0, 매주 갱신되는 트랜스퍼마크트 미러 데이터셋)의 `players.csv`를 우리 CSV의 `League/Team/Player` 문자열과 이름/팀 기준으로 자동 매칭해 만든 파일입니다. 컬럼: `League,Team,Player,MarketValueEUR`.

- **1부 리그만 지원**: 이 데이터셋은 2부 리그를 다루지 않아서 챔피언십·세군다 디비시온·2.분데스리가는 몸값 데이터가 없습니다 (`js/config.js`에서 `noMarketValue: true`로 표시됨).
- **매칭률 약 56%** (선수명이 정확히 일치하는 경우만 연결, 애칭/이명 등은 놓칠 수 있음). 매칭 안 된 선수는 몸값이 "-"로 표시됩니다.
- **다시 만드는 방법**:
  1. `curl -sO https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/players.csv.gz && gunzip players.csv.gz` 로 최신 선수 데이터를 받습니다.
  2. 위 프로젝트에서 만든 매칭 스크립트(Claude에게 "몸값 데이터 다시 매칭해줘"라고 요청하면 됩니다) 로 `data/market_values.csv`를 재생성합니다.
  3. 리그 CSV를 업데이트할 때마다(팀 이름이 바뀌는 경우 등) 함께 갱신하는 것을 권장합니다.

## 로컬에서 미리 보기

```bash
python -m http.server 8080
```

브라우저에서 `http://localhost:8080` 접속.

## 알려진 데이터 이슈 (2026-07-26 기준)

- 챔피언십: 24팀 중 20팀만 존재 (4팀 누락)
- 라리가: 20팀 중 15팀만 존재 (5팀 누락, 원인 미확인)
- 일부 리그에서 동일 선수가 두 리그 파일에 중복 등장하는 경우가 발견됨 (예: Middlesbrough 소속 선수가 프리미어리그·챔피언십 파일에 모두 존재). 다음 데이터 생성 시 확인 필요.
