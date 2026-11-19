# 월말 · 연말결산 — 읽는 순서 · 단계

기획 계정에서 2026-11-19에 만든 묶음이에요. 저장소의 AI 작업 가이드라인 그대로(작은 모듈 · 토큰 색 · Pretendard · Tossface · 회귀 테스트 · 점검 AI).
**12월 1일 첫 결산이 목표**라 일정이 빠듯해요. 막히면 spec.md 7절의 네 장 먼저.

## 1. 읽는 순서
1. 이 파일 → 2. `spec.md` → 3. `design/mockups/chosen/recap/index.html` → 4. `reference/`(`node --test test/*.test.js`) → 5. `tests.md`

## 2. 묶음 안
```
docs/recap/README.md  spec.md  tests.md
docs/recap/reference/src/{dates,routines,activity,places,meals,compose,text}.js  shared/(영수증 모듈 사본)
docs/recap/reference/test/recap.test.js  fixtures/2026-10.json  2026-11.json
design/mockups/chosen/recap/index.html  Recap-*.html  png/
```

## 3. 단계 (브랜치 `recap-r○`)
| 단계 | 내용 | 끝났다는 기준 |
|---|---|---|
| **R1** 계산 | reference/src를 서버 함수 · 앱이 함께 쓰는 공용 모듈로 옮기기 (shared는 영수증 모듈을 불러오게) + 시험 14개 | 14개 통과 |
| **R2** 서버 | `monthlyRecap` · `recapNotify` · 읽기 모듈(저장소 컬렉션 → 입력 모양) · 규칙 + 시험 F1~F7 | 에뮬레이터 통과 |
| **R3** 화면 | 카드 넘기기(R1~R10) · 이미지 저장(R11) · 돌아보기 탭 입구(E1) · 알림 스위치 + U1~U6 | 목업 PNG 대조 |
| **R4** 확인 | 점검 AI · 실기기 · 11-30 밤 미리 돌려 보기 → 배포 | 점검 목록 0건 |
- 단짝 영수증이 아직 없으면 `spends: []`로 두면 카드 9가 자동으로 빠져요

## 4. 다르게 정해야 할 때
- `spec.md` 맨 아래 `## 바뀐 것`에 한 줄씩. 목업에 없는 화면은 기획 계정에 요청
