# 피치사이드 · PITCHSIDE

한국 축구의 공개 경기 영상과 기록을 연결하는 로컬 아카이브입니다. OTT 형식의 영상 탐색과 리그·팀·선수 기록 화면을 함께 제공합니다.

## 시작하기

Node.js **24 이상**을 사용합니다. Python·venv·별도 DB 서버·YouTube API 키는 필요하지 않습니다.

```powershell
npm install
npm run db:init
npm run collect -- --source all --season 2026
npm run dev
```

브라우저에서 **http://127.0.0.1:5173**을 엽니다. API는 `127.0.0.1:3001`에서 실행됩니다. 최초 수집은 출처별 요청 간격과 상세 기록 조회 때문에 몇 분이 걸릴 수 있습니다. 수집 중에도 저장이 끝난 자료를 조회할 수 있습니다.

운영 빌드 실행:

```powershell
npm run build
npm start
```

이때 화면과 API 모두 **http://127.0.0.1:3001**에서 제공합니다. 기본 바인딩은 로컬 컴퓨터로 제한됩니다.

## 이용할 수 있는 기능

- 홈의 대표 경기, 최신 영상, 다가오는 일정, 최근 결과와 WK리그 테이블
- 사진에 포함된 리그·대회 27개 분류, 성별·연령·수집된 권역 검색
- 리그별 시즌·대회·권역, 영상·일정·결과·순위·선수 기록·참가 팀
- 경기별 공개 출전 명단과 득점 이벤트, 관련 중계·하이라이트 연결
- 영상 제목·팀 검색, 리그·종류·게시 날짜 필터, YouTube 원본 플레이어
- 라이트·다크 모드, 모바일 필터 시트, 키보드 검색 제안
- 브라우저에 저장하는 관심 팀·영상

자료가 없는 리그도 분류에서 찾을 수 있습니다. 미수집·미공개·로그인 필요·수집 실패를 구분하며, 점수나 선수 기록을 임의로 생성하지 않습니다. 알 수 없는 값은 DB에서 `NULL`, 화면에서는 `—`로 표시합니다. 원문에 실제 0이 있으면 0을 유지합니다.

## 수집 명령

```powershell
npm run collect -- --source kfa --season 2026
npm run collect -- --source kwff --season 2026
npm run collect -- --source joinkfa --season 2026
npm run collect -- --source youtube --season 2026
```

| 출처      | 범위와 동작                                                                        |
| --------- | ---------------------------------------------------------------------------------- |
| `kfa`     | K3·K4 공식 페이지의 공개 라운드별 일정·결과와 팀 순위                              |
| `kwff`    | WK리그 1~12월 경기, 팀 순위·공개 선수 기록, 종료 경기 공개 출전 표·득점 이벤트     |
| `joinkfa` | 초기 응답의 분류 코드 → 대회 페이지 순회 → 월별 경기·참가 팀·선수 → 익명 상세 조회 |
| `youtube` | KFATV LIVE와 한국여자축구연맹 공개 RSS 피드의 해당 연도 최신 영상                  |

일정·순위를 먼저 채우려면 `--skip-details`를 붙입니다. JoinKFA에서 이미 확인한 대회 식별자가 있으면 다음처럼 범위를 지정할 수 있습니다.

```powershell
npm run collect -- --source joinkfa --season 2026 --competition 57431 --league k3 --month 202610
```

`--month`는 `YYYYMM` 형식입니다. 대회 식별자는 출처에서 확인한 값만 사용하세요. 초기 분류 응답은 `source_metadata`에 저장합니다. 같은 팀 이름이라도 리그와 출처 ID가 다르면 별개 팀으로 유지합니다. 별칭은 `aliases`에서 관리합니다.

### 현재 확인한 공개 범위

2026년 10월 26일 실제 접속으로 검증했습니다.

- KFA K3·K4와 KWFF WK리그의 경기·순위 페이지는 공개 조회가 됩니다.
- JoinKFA 초기 분류 JSON은 응답하지만, 현재 대회 목록은 빈 목록을 반환합니다. 참고 프로젝트의 공개 HTML 경로는 404를 반환하기도 합니다. 빈 목록으로 기존 DB를 지우지 않습니다.
- KFA에서 확보한 대표 경기 ID로 JoinKFA 상세 요청을 검사했으며, 두 경기가 **로그인 필요** 응답을 반환했습니다. 이 상태는 경기 상세 화면에 표시합니다.
- WK리그 공개 상세 표에서는 출전 시간·득점·카드 등이 공개됩니다. 선발·후보 구분과 교체 시각이 없는 경우 추정하지 않습니다.
- YouTube RSS는 최신 일부 영상만 제공합니다. 2026년 전체 영상 목록이나 생중계 상태의 실시간 갱신을 보장하지 않습니다. API 키 없이 과거 영상을 보완하려면 URL 등록을 사용합니다.

일부 출처가 실패해도 다른 출처 수집은 계속합니다. 실패가 발생한 실행의 종료 코드는 1이며, 원인과 건수는 `source_runs` 및 화면의 **자료 출처·수집 현황**에서 확인할 수 있습니다. 빈 응답은 `partial`로 기록합니다. 상세 기록 접근 제한은 해당 경기의 `detail_status`에 별도로 기록합니다.

### 영상 직접 등록

```powershell
npm run video:add -- --url "https://www.youtube.com/watch?v=f2vXMYRsGUs"
```

등록 시 공개 oEmbed에서 제목과 채널을 확인합니다. RSS와 달리 게시 시각을 알 수 없는 경우에는 날짜 미공개로 저장합니다. 필요하면 옵션을 지정합니다.

```powershell
npm run video:add -- --url "https://www.youtube.com/watch?v=f2vXMYRsGUs" --league wk --match kwff-222 --date "2026-10-16T00:00:00+09:00"
```

`--title`로 제목도 직접 지정할 수 있습니다. 영상 ID로 중복을 방지합니다. 자동 경기 연결은 리그·양 팀·경기 날짜가 일치하고 후보가 하나인 경우에만 수행합니다. 등록 후 직접 연결을 고정하려면 DB에서 `match_id`를 수정하고 `manual_locked=1`을 설정하세요. 영상 파일은 저장하지 않습니다.

## SQLite 직접 편집과 복구

기본 파일: **`data/kfootball.sqlite`**. 서비스명은 피치사이드이며 DB 경로는 최초 계획과의 일관성을 위해 유지했습니다. 다른 파일은 `PITCHSIDE_DB` 환경변수로 지정할 수 있습니다.

1. 개발 서버·운영 서버와 수집 명령을 모두 종료합니다.
2. `npm run db:backup`으로 백업합니다.
3. DB Browser for SQLite 같은 도구에서 파일을 열어 수정하고 변경 사항을 저장한 후 도구를 닫습니다.
4. 서버를 다시 실행합니다. API는 SQLite를 조회하므로 별도 인덱스 재생성이나 동기화가 필요하지 않습니다.

재수집으로 직접 수정한 행을 덮어쓰지 않으려면 해당 행의 `manual_locked`를 **1**로 바꿉니다. 잠금을 풀려면 0으로 설정합니다. 경기·팀·선수·순위·개인 기록·영상·별칭 행에 적용됩니다. JSON 컬럼은 유효한 JSON을 유지해야 합니다.

```sql
UPDATE videos
SET match_id = 'kwff-222', manual_locked = 1
WHERE id = 'f2vXMYRsGUs';
```

백업·복원:

```powershell
npm run db:backup
npm run db:restore -- --file "C:\백업경로\pitchside-날짜.sqlite"
```

수집과 직접 영상 등록은 실행 전 자동 백업을 만듭니다. 백업은 `data/backups/`에 보관합니다. 복원 명령은 SQLite 무결성과 피치사이드 테이블을 검사하고, 현재 DB를 한 번 더 백업한 뒤 교체합니다. 복원할 때도 다른 서버·수집기·DB 편집기는 종료해야 합니다.

스키마 변경은 `server/migrations/`의 순서 있는 SQL 파일로 관리하며, 초기화와 서버 실행 때 적용합니다. DB·백업·수집 원문·`.env`는 Git에서 제외합니다. 새로 복제한 환경에서는 위 수집 명령으로 실제 자료를 채워야 합니다.

## API와 코드 구조

- `src/`: React 화면·반응형 스타일·관심 목록과 테마
- `server/`: Express 조회 API, SQLite, CLI·출처별 수집기
- `shared/types.ts`: 화면과 API가 공유하는 자료형
- `tests/`: 독립적인 임시 DB를 사용하는 데이터·파싱·API 테스트

주요 API: `/api/home`, `/api/leagues`, `/api/regions`, `/api/competitions`, `/api/teams`, `/api/matches`, `/api/matches/:id`, `/api/videos`, `/api/videos/:id`, `/api/standings`, `/api/player-stats`, `/api/suggest`, `/api/sources`.

목록 응답은 `{ items, total, page, page_size }`이고 `/leagues`, `/regions`, `/suggest`, `/sources`는 배열입니다. 관련 목록에 `league`, `competition`, `season`, `region`, `team`, `status`, `q`, `page`, `page_size`를 적용할 수 있습니다. 영상은 `kind`, `from`, `to`를, 경기는 `date`, `order=asc`를, 개인 기록은 `sort=goals|assists|minutes|played`를 추가 지원합니다. 각 필터는 해당 자료형에 적용되는 API에서만 사용합니다. 상세 응답에는 출처·수집 시각·상세 기록 제공 상태를 포함합니다.

브라우저 화면은 자체 API를 호출합니다. 외부 축구 사이트를 방문할 때마다 새로 수집하지 않습니다. 이미지·썸네일과 사용자가 실행한 YouTube 플레이어는 원본 출처에서 불러옵니다.

## 디자인과 검증

지정한 **suta**의 레이아웃·모션 토큰, 탭 인디케이터, 검색 제안, 스켈레톤과 필터 시트 코드를 프로젝트에 맞게 적용했습니다. 필터 시트에는 포커스 이동·가두기·복원과 배경 `inert`를 더했습니다. 초록 한 계열과 무채색 면 두 단계, 실제 썸네일·엠블럼을 사용합니다. Pretendard 파일은 npm 의존성에서 빌드에 포함합니다.

```powershell
npm test
npm run typecheck
npm run build
npm run format:check
```

자동 테스트는 중복·수동 잠금·실패 롤백·팀 식별·영상 연결·파싱·로그인 제한·백업 복원·API 페이지와 필터를 검증합니다. 브라우저 검증 결과는 `docs/verification.md`에 기록합니다.

연동 구조 참고: [YouthField JoinKFA 요청](https://github.com/jiyun040/YouthField/blob/main/proxy/api/joinkfa.js). 해당 서비스의 배포 프록시나 Vercel KV에는 의존하지 않습니다.
