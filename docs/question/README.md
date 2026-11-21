# 교환 쪽지 (코드 이름 question) — 여기부터 읽기

> 기획 계정 → 구현 계정 넘기기 묶음 (2026-11-20). 구현 계정은 기획 계정의 대화 · 프로젝트 · 캔버스를 못 보므로 **이 폴더가 기준**이에요.
> 짝꿍 식탁(`docs/diet/`)을 대체해요. 식단 D단계는 하지 않아요.

## 1. 읽는 순서
1. `spec.md` — 무엇을 왜 (결정 · 가정 · 데이터 · 규칙 · 알림 · 결산)
2. `design/mockups/chosen/question/` — 화면 (PNG로 먼저 보고, HTML은 브라우저로)
   - 사용자가 고른 것(11-21): **화면 C 쪽지 나란히 + 쪽지 모양 5 「작게 접은 쪽지」 · 입구 E1**. F01~F16이 기준
   - 이름 **「교환 쪽지」** (11-21 사용자 결정) — `reference/src/text.js`의 `NAME` 한 곳
3. `reference/` — 계산 참조 구현 + 시험 38개 (`cd docs/question/reference && npm test`)
4. `rules/` — 보안 규칙 조각 + 에뮬레이터 시험 R1~R12 (기획 계정에서 못 돌림)
5. `tests.md` — 시험 목록
6. `data/questions.json` — 기본 질문 414개 + 날짜 질문 17개. 고칠 땐 `data-src/`를 고치고 `tools/build-questions.mjs`

## 2. 묶음 안
```
docs/question/
  README.md  spec.md  tests.md
  data/questions.json            ← 앱에 묶는 정적 파일
  data-src/questions-src.md      ← 사람이 읽고 고치는 원본 (주제별)
  data-src/date-questions.json
  tools/build-questions.mjs      ← 원본 → questions.json (id 지킴 · 검사)
  tools/make-fixture.mjs         ← 시험 기록 nov-2026.json 다시 만들기
  reference/src/*.js             ← 참조 구현 (작은 모듈 11개)
  reference/test/*.test.js       ← 시험 38개
  reference/fixtures/            ← 두 사람 · 11월 1~20일 기록 (목업 숫자도 여기서)
  rules/question.rules           ← firestore.rules 조각
  rules/rules.test.mjs           ← 규칙 시험 R1~R12
design/mockups/chosen/question/  ← 고른 목업 19장 (흐름 16 + 쪽지 5 한 쌍 + 입구 E1, HTML + PNG)
```

## 3. 단계 (브랜치 `question-q○`)
| 단계 | 내용 | 끝나면 |
|---|---|---|
| **Q1** | `reference/src`를 앱과 서버 함수가 함께 쓰는 공용 모듈로(동작 그대로, 결산 R1과 같은 자리 · 방식) · `questions.json`을 앱 정적 파일로 · 규칙 조각을 `firestore.rules`에 · 시험 38개 + R1~R12를 `npm test`에 | npm test · `redeploy.sh`(규칙) |
| **Q2** | 쪽지 화면 (C · 쪽지 5): 그날 질문 만들기(트랜잭션) · 상태 넷(빈 자리 · 접힌 쪽지 · 펴진 쪽지) · 남기기 · 고치기 · 다른 질문 · 첫날 | 목업 F01~F10 대조 · 두 기기 |
| **Q3** | 입구 E1(식탁 카드 자리) · 질문 넣기 시트 · 우리가 넣은 질문 · 지난 쪽지 · 늦게 남기기 · 마음에 남아요 | 목업 E1 · F11~F12 대조 |
| **Q4** | 서버 함수 `questionDaily` · `questionAnswered` + 알림 시트 두 줄 + 알림 눌러 열기 | `redeploy.sh` · 실기기 알림 |
| **Q5** | 결산 카드 8을 「오늘의 질문」으로 (결산 단계와 맞춰서) | 에뮬레이터로 11월 결산 |
| **Q6** | 점검 AI · 14개 테마 · 320px · 실기기 | 배포 |

## 4. 처음 맡기기 (구현 계정 Claude Code에)
```text
docs/question/README.md를 먼저 읽고, 거기 적힌 순서대로 spec.md · 목업 · reference/ · rules/ · tests.md를 파악해 줘.
작업은 저장소의 AI 작업 가이드라인을 따라 줘.

이번에는 README 3절의 Q1만 해 줘:
- 새 브랜치 question-q1
- reference/src를 앱과 서버 함수가 함께 쓰는 공용 모듈로 옮기기 (동작은 바꾸지 말기, 결산 R1과 같은 방식)
- data/questions.json을 앱이 읽을 수 있는 정적 파일 자리로
- rules/question.rules를 firestore.rules에 넣고 rules/rules.test.mjs(R1~R12)를 저장소 규칙 시험 틀로
- 참조 시험 38개 + R1~R12를 npm test에
- 저장소에 isMember() · 「단짝이 된 지 N일」 함수가 이미 있으면 그걸 쓰고, 참조와 결과가 다르면 고치지 말고 먼저 알려 줘
화면은 아직 만들지 마. 끝나면 npm test 결과, 바꾼 파일, 문서와 다르게 정한 것을 알려 줘.
```

## 5. 점검 AI (단계마다 새 세션)
```text
docs/question/의 문서와 question-q○ 브랜치의 변경을 비교해서 문제만 목록으로 적어 줘. 코드는 고치지 마.
특히 확인: 단짝 쪽지가 내 쪽지 없이 읽히는 길이 없는지(화면 · 입구 · 알림 · 지난 쪽지 · 캐시),
그날 질문이 앱과 서버 함수에서 같은 모듈로 정해지는지, 질문 id가 바뀌지 않는지,
다른 질문 조건 네 가지, 서울 날짜 기준, 문구가 text.js와 글자 그대로인지, 색이 토큰만 쓰는지.
```

## 6. 돌려보내기
- 구현 중 바뀐 결정은 `spec.md` 맨 아래 `## 바뀐 것`에 한 줄씩 → 단계가 끝날 때마다 기획 계정 대화에 붙여 넣기
- 목업에 없는 화면이 필요하면 만들지 말고 기획 계정에 목업 요청
