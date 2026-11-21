# 보안 규칙 시험 R1~R16 (에뮬레이터)

> 기획 계정에서는 Firebase 에뮬레이터를 못 돌려서 목록만 넘겨요. **E2에서 이 시험을 먼저 만들고 통과시킨 뒤** 규칙을 배포해요.
> 사람: `me`, `her`(둘 다 members), `stranger`(members 아님). 쓰기 묶음(트랜잭션 · batch)은 앱과 같은 모양으로.

| # | 상황 | 기대 |
|---|---|---|
| R1 | stranger가 eats 읽기 · 넣기 | 막힘 |
| R2 | me가 쿠키 넣기 (by=me, state=jar, at=서버 시각, 사용자 예시 칼국수 · 솔뫼 마을) | 됨 |
| R3 | me가 by=her로 넣기 · state=today로 넣기 · at을 앱 시각으로 넣기 | 모두 막힘 |
| R4 | place.url이 `http://` 이거나 다른 주소 · kakaoId에 글자 · sigungu 4자리 | 막힘 |
| R5 | her가 me의 쿠키 고치기 · 빼기 | 막힘 |
| R6 | me가 내 쿠키 고치기 (food · place · memo · editedAt만) / 고르기 뒤(today) 고치기 / 고치면서 at 바꾸기 | 됨 / 막힘 / 막힘 |
| R7 | me가 내 쿠키 빼기 (state out만) / 지우기(delete) | 됨 / 막힘 |
| R8 | 고르기: eats state jar→today + eatState/today 만들기를 한 묶음으로 | 됨 |
| R9 | 고르기를 eats만 (eatState 없이) / eatState만 (쿠키는 jar 그대로) | 둘 다 막힘 |
| R10 | eatState/today가 있는데 her가 다른 쿠키로 고르기 | 막힘 (앱: 「단짝이 방금 골랐어요」) |
| R11 | 돌려놓기: today→jar(pick null) + eatState/today 지우기를 한 묶음 / eatState를 남긴 채 | 됨 / 막힘 |
| R12 | 먹었어요: today→eaten + 내 별점(1~5 정수) + eatState 지우기 / 별점 0 · 6 · 4.5 / her 칸까지 같이 쓰기 | 됨 / 막힘 / 막힘 |
| R13 | 먹은 뒤 her가 자기 별점 · 한 줄 남기기 / her가 me 별점 바꾸기 | 됨 / 막힘 |
| R14 | 또 먹고 싶어요: 먹었어요 묶음에 새 쿠키(from = 먹은 쿠키 id) 넣기 / 없는 id를 from으로 | 됨 / 막힘 |
| R15 | eatDraws: me가 n=3 · shown 3개로 만들기 / n=4 · by=her / her가 me의 기록 고치기 | 됨 / 막힘 / 막힘 |
| R16 | eatState/today 고치기(update) | 늘 막힘 |

- 규칙의 `size()`가 한글을 어떻게 세는지 확인해서, 20자 음식 · 100자 메모가 막히지 않는지 R2 옆에 한 줄 더 (막히면 상한을 넉넉히, 정확한 검사는 앱)
- 자동 돌려놓기(3일)는 앱을 연 사람이 R11과 같은 묶음으로 해요 — 서버 함수 없이
