# 월드 사커 스쿼드 (PWA)

13개 주요 축구 리그의 팀별 선수 명단과 시즌 기록을 폰에서 팀/국적/포지션/나이별로 보는 PWA입니다.
빌드 단계 없이 브라우저가 `data/*.csv`를 직접 읽어 화면을 만듭니다.

## 폴더 구조

```
index.html          앱 진입점
manifest.json        PWA 설치 정보
service-worker.js    오프라인 캐싱
css/style.css
js/config.js         리그 메타데이터 (팀 수, 데이터 공백 안내 등)
js/data.js            CSV 파싱 및 정규화
js/app.js             화면/라우팅 로직
data/*.csv             선수 데이터 (13개 리그)
data/meta.json         마지막 업데이트 날짜
icons/                 PWA 아이콘
```

## 6개월마다 데이터 업데이트하는 방법

1. Claude에게 새 시즌 CSV 13개를 요청해 `data/` 폴더의 기존 파일을 같은 파일명으로 덮어씁니다.
   - 컬럼 구성이나 순서가 바뀌면 `js/data.js`의 `COLUMNS` 배열도 함께 수정해야 합니다.
2. 팀 구성이 바뀌었으면 `js/config.js`의 `LEAGUES` 배열에서 `expectedTeams`, `note` 값을 갱신합니다.
   - 예: 라리가가 이제 20팀 전부 채워졌다면 `note` 줄을 지웁니다.
3. `data/meta.json`의 `lastUpdated` 날짜를 오늘 날짜로 바꿉니다.
4. 변경 사항을 커밋하고 GitHub에 push하면 GitHub Pages가 자동으로 재배포합니다.

## 로컬에서 미리 보기

```bash
python -m http.server 8080
```

브라우저에서 `http://localhost:8080` 접속.

## 알려진 데이터 이슈 (2026-07-26 기준)

- 챔피언십: 24팀 중 20팀만 존재 (4팀 누락)
- 라리가: 20팀 중 15팀만 존재 (5팀 누락, 원인 미확인)
- K리그1: 12팀 중 8팀만 존재, 시즌 기록(출장/득점 등) 전무
- 일부 리그에서 동일 선수가 두 리그 파일에 중복 등장하는 경우가 발견됨 (예: Middlesbrough 소속 선수가 프리미어리그·챔피언십 파일에 모두 존재). 다음 데이터 생성 시 확인 필요.
