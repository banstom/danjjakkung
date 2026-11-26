# 집중 통계 — 구현 순서 · 브랜치 (기획 계정, 2026-11-26 · 사용자 결정 반영)

> 11-26 사용자 결정: **결산 카드 12-01(11월 결산)부터** → 결산 카드를 먼저, 화면 다듬기는 12-01 뒤로

## 두 번에

| 차례 | 브랜치 | 단계 | 배포 | 언제 |
|---|---|---|---|---|
| ① | `recap-focus` | FS4 결산 카드 → FIN1 | 앱(main → Pages) **먼저**, 그다음 서버(`bash scripts/redeploy.sh`) — 결산 R4의 서버 재배포와 **한 번에** | **11-26 ~ 11-29** |
| ② | `focus-stats` (모음) | FS1 → FS2 → FS3 → FIN2 | 화면만. 규칙 · 서버 · 색인 없음 | 12-01 결산 확인 뒤 |

나눈 까닭: ①은 12-01 03:00까지 서버에 들어가야 하고, 어차피 R4 서버 재배포(현황 11-22 3절 #4)가 남아 있어 거기에 얹어요. ②는 날짜가 없는 화면 작업이라 결산이 무사히 나온 뒤에 해요.

## 일정 (①)

| 날 | 할 일 |
|---|---|
| 11-26 ~ 27 | FS4: 계산 일부(아래) + 서버 `focus` 카드 + 앱 카드 화면 · 마무리 타일 · 「모르는 카드 id 건너뛰기」 |
| 11-28 | 점검 AI(tests.md F) → 고침 → **앱만 main** (서버가 카드를 만들기 전에 앱이 그릴 줄 알게) |
| 11-29 ~ 30 | 결산 R4(점검 AI · 실기기) + **서버 재배포 한 번**(R4 몫 + focus 카드) · 11-30 밤 에뮬레이터로 11월 결산 미리 돌려 보기 |
| 막히면 | `FOCUS_CARD_ON = false`로 배포 → 11월 결산은 집중 카드 없이, 12월 결산부터. 다른 카드 일정에는 영향 없음 |

## ① recap-focus

### FS4 결산 카드
- 계산: `reference/focus-stats.js`를 **통째로** 옮기기 — 화면 없는 순수 함수뿐이고, `recapCard`가 `rangeView`를 거쳐 `byDay · level · longest · subjects`까지 부르기 때문. 앱 `js/focus-stats.js`, 서버 사본 `functions/shared/focus-stats.js`(`sync-shared.sh` · `tests/shared.test.js`). 시험 S1~S16 + S14-2 모두 이때 `npm test`에
- 「함께」가 오늘 카드의 `focus.overlap`과 같은 뜻인지 먼저 확인(spec 1-2절). 다르면 고치지 말고 알려 주기
- 서버 `functions/recap.js`: 그 달 `focusLogs`를 `day` 범위로 읽어 `recapCard`, 지난달 `recaps`의 `focus.together` → `prev`. 카드 순서 = 함께 보낸 시간 다음. `FOCUS_CARD_ON` 한 줄. 연말 `recapYear`
- 앱: `rc*` 문구(`text.md`), `js/view-recap.js` 카드(C1 · C3), `js/recap-image.js` 마무리 타일, **모르는 카드 id 건너뛰기 + 진행 막대 칸 수 = 그린 카드 수**
- 시험: 위 계산 시험 + tests.md D

### FIN1
- 점검 AI → 앱 main(11-28) → R4와 함께 서버 재배포(11-29 ~ 30) → 11-30 밤 에뮬레이터 미리 돌려 보기
- 실제 `recaps/2026-11`은 12-01 03:00에 서버가 처음 만듦. 미리 돌려 보기는 에뮬레이터에서만

## ② focus-stats (12-01 뒤)

### FS1 계산 · 읽기 · 문구
- 계산 모듈은 ①에서 들어감. 여기서는 `js/focus.js`의 지금 함수(`week · weekSubjects · rangeSummary`)를 새 모듈로 바꾸고 둘 중 하나만 남기기
- store: 집중 탭 「지난 4주」 한 번 읽기 + 연속이 이어지면 28일씩 더. 돌아보기 달 = 그 달
- `segs` 모양 바꾸기 한 곳 · 시험 tests.md A1~A4

### FS2 집중 탭 통계 카드
- `js/view-focus.js` `weekCard` · `weekSubj` 바꾸기, 띠 부품 따로, 토큰 · 도트 스킨 · tests.md B · E

### FS3 돌아보기
- `js/view-review.js` `focusCard` → 주 · 달, 칸 누름 → 한 줄 + 띠 · tests.md C

### FIN2
- 점검 AI → 320 · 375 · 412 · 14판 + 도트 몇 판 스크린샷 → main

## 처음 맡기는 글 (①)
```text
docs/focus-stats/README.md를 먼저 읽고, 거기 적힌 순서대로 spec.md · 목업(design/mockups/chosen/focus-stats/index.html) · reference/ · text.md · tokens.md · tests.md를 파악해 줘.
작업은 저장소의 AI 작업 가이드라인을 따라 줘. 12월 1일 11월 결산에 「함께 집중」 카드를 넣는 게 목표야.

이번에는 plan.md ①의 FS4만 해 줘:
- 새 브랜치 recap-focus
- 먼저 spec 1-2절 「저장소와 맞춰 볼 것」 세 가지를 확인해서 알려 줘. 특히 focus.overlap이 spec의 「함께」 정의와 다르면 고치지 말고 차이부터
- 지금 view-recap이 모르는 카드 id를 만나면 어떻게 되는지 확인하고, 건너뛰게 + 진행 막대 칸 수 = 그린 카드 수
- reference/focus-stats.js를 js/focus-stats.js로 통째로 옮기기(동작은 바꾸지 말기), 서버 사본은 functions/shared/
- functions/recap.js에 focus 카드(함께 보낸 시간 다음, FOCUS_CARD_ON 한 줄), 앱 카드 화면 · 마무리 타일, 문구는 text.md의 rc* 키 그대로
- 시험 S1~S16 + S14-2 + tests.md D를 npm test에 (fixtures 그대로)
- 서버 배포는 하지 말고, 앱만 main에 올릴 수 있게 준비
끝나면 npm test 결과, 바꾼 파일, 문서와 다르게 정한 것(spec 10절에도)을 알려 줘.
```
