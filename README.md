# AnyRPG 게임 운영툴

[AnyMMO](https://github.com/AnyRPG) 데모 게임 「A Lost Soul」을 운영하는 웹 운영툴입니다. 화면은 데모마켓 운영툴과 같은 짜임(머리줄 · 왼쪽 메뉴 · 표에서 바로 처리)입니다.

- 주소: https://anyrpg-ops.maxihan.com
- 게임 API 서버: [maxihan1/anymmo-webserver](https://github.com/maxihan1/anymmo-webserver) `ops-api` 브랜치의 운영자 API(`/opsapi`)를 부릅니다

## 메뉴

| 메뉴 | 할 수 있는 일 |
|---|---|
| 대시보드 | 계정 · 캐릭터 수, 정지 · 채팅 금지 계정 수, 점검 상태, 게임에 보이는 공지, 오늘 지급, 아직 안 받은 지급 우편 |
| 유저 · 제재 | 아이디 · 이메일 · 계정 번호 · 캐릭터 이름 검색, 표에서 정지 · 채팅 금지 · 해제, 상세(캐릭터 레벨 · 직업 · 재화 · 소지 아이템, 제재 이력) |
| 지급 · 회수 | 캐릭터 1~50명에게 아이템(5종, 종마다 1~99개) · 재화를 우편으로 보내기, 지급 이력에서 안 받은 첨부 회수 |
| 공지 | 공지 쓰기 · 고치기 · 지우기, 표에서 켜기 · 끄기, 기간 예약 |
| 점검 | 점검 켜기 · 끄기, 안내 문구, 기간, 점검 중에도 들어올 계정 |
| 기록 | 운영자 작업 기록, 아이템 흐름(지급 · 수령 · 회수) |

## 구조

브라우저 → 이 서버(`/api/ops/*`) → 게임 API 서버(`/opsapi/*`). 운영자 토큰은 이 서버가 httpOnly 쿠키로만 들고 있어 화면 스크립트가 읽을 수 없습니다. 운영자 계정은 게임 계정과 따로입니다.

## 실행

```bash
npm ci
API_BASE=http://127.0.0.1:13110 INSECURE_COOKIE=1 npm run dev   # 로컬(http)은 INSECURE_COOKIE=1
npm test
```

| 환경 변수 | 뜻 |
|---|---|
| `API_BASE` | 게임 API 서버 주소(끝 `/` 없이) |
| `PORT` | 기본 3000 |
| `INSECURE_COOKIE` | `1` 이면 쿠키에 Secure 를 빼서 http 로컬에서도 로그인된다 |
