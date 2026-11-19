# 단짝 영수증 — 읽는 순서 · 단계

기획 계정(claude.ai 「웹앱개발」)에서 2026-11-19에 만든 묶음이에요. 구현 계정은 이 폴더와 목업을 기준으로 삼아 주세요.
저장소의 AI 작업 가이드라인은 그대로예요: 작은 모듈 · 색은 토큰만 · Pretendard · Tossface · 버그마다 회귀 테스트 · 배포 전 점검 AI.

## 1. 읽는 순서
1. 이 파일
2. `spec.md` — 화면 · 한 줄 읽기 규칙 · 데이터 · 규칙
3. `design/mockups/chosen/ledger/` — `index.html`에서 L1~L11을 한눈에, 화면별 PNG
4. `reference/` — 참조 구현(`src/`)과 시험(`test/`, `node --test test/*.test.js`)
5. `tests.md`

## 2. 묶음 안
```
docs/ledger/README.md  spec.md  tests.md
docs/ledger/reference/src/{amount,payer,category,split,parseLine,summary}.js
docs/ledger/reference/test/{parseLine,summary}.test.js  fixtures/nov-2026.json
design/mockups/chosen/ledger/index.html  Ledger-L1~L11.html  png/
```

## 3. 단계 (브랜치 `ledger-l○`)
| 단계 | 내용 | 끝났다는 기준 |
|---|---|---|
| **L1** 계산 | `reference/src`를 저장소 모듈 규칙에 맞춰 옮기기 + 참조 시험 20개를 `npm test`에 | 20개 통과, 동작 차이 없음 |
| **L2** 데이터 · 규칙 | `spends` 저장 · 읽기 모듈(이번 달 구독, 지난달 한 번 읽기), `firestore.rules` + 시험 R1~R6 | 에뮬레이터 시험 통과 |
| **L3** 화면 | 목록(L1 · L2) · 한 줄 적기 시트(L3~L6) · 고치기 · 지우기(L7 · L8) · 분류만 보기(L9) · 빈 달(L10) · 전체 탭 카드(L11) + U1~U11 | 목업 PNG와 나란히 대조, 14개 테마 스크린샷 |
| **L4** 마무리 | 결산 카드 9가 쓸 수 있게 `monthSummary`를 서버 함수에서도 불러올 수 있는 자리로(공용 모듈) · 점검 AI · 실기기 | 점검 AI 목록 0건 |

## 4. 문서와 다르게 정해야 할 때
- `spec.md` 맨 아래 `## 바뀐 것`에 한 줄씩. 목업에 없는 화면은 만들지 말고 기획 계정에 「○○ 화면 목업」 요청
