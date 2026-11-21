# 출출 쿠키 — 넘기기 묶음 (README)

> 기획 계정(claude.ai 「웹앱개발」, 2026-11-21) → 구현 계정. 구현 계정은 기획 계정의 대화 · 프로젝트 · 목업 캔버스를 못 보므로 **이 묶음이 기준**이에요.
> 화면 이름 「출출 쿠키」(처음 가제 「오늘 뭐 먹지」), 코드 이름 `eat` / `eats`.

## 1. 읽는 순서
1. 이 README
2. `spec.md` — 명세 (0절 한 줄 → 1절 화면 표 → 2절 규칙 → 3절 데이터)
3. `design/mockups/chosen/eat/index.html` — 고른 목업 15장 + 쿠키 그림 + 이름 (HTML은 브라우저로, PNG는 폰 대조용)
4. `reference/` — 참조 구현(계산만, 화면 없음) + 시험 35개
5. `rules/` — 보안 규칙 조각 + 에뮬레이터 시험 목록 (기획 계정에서 못 돌림)
6. `tests.md` — 옮길 시험 · 새로 만들 시험
7. `design/components/cookie/` — 쿠키 그림 토큰 초안(`art.css`) · 그림 부품은 `reference/src/cookie-svg.js`

## 2. 묶음 안
```
docs/eat/README.md · spec.md · tests.md
docs/eat/reference/package.json · src/(josa · time · format · text · cookie · draw · today · jar · mapAsk · cookie-svg).js · test/(fixtures + 5개 파일)
docs/eat/rules/firestore.eat.rules · emulator-tests.md
design/mockups/chosen/eat/index.html · 01~15 + art · name (.html + .png)
design/components/cookie/art.css
```

## 3. 단계 (E1 → E6, 단계마다 브랜치 `eat-e○`)
| 단계 | 할 일 | 끝 조건 |
|---|---|---|
| **E1** 계산 | `reference/src`를 저장소 모듈 규칙에 맞춰 옮기기(동작 그대로), `reference/test` 35개를 `npm test`에 | 기존 시험 + 35개 통과. 화면 없음 |
| **E2** 데이터 · 규칙 | `rules/`를 firestore.rules에 합치고 R1~R16을 에뮬레이터 시험으로. 저장 계층(서버 시각 ↔ ms) | R1~R16 통과 → `bash scripts/redeploy.sh` |
| **E3** 통 · 넣기 | 가이드라인 문서에 그림 토큰 예외 먼저 적기 → `--ck-*` 14판 → 쿠키 부품 · 병 · 쪽지 종이 → 화면 01 · 02(음식점은 「이름만 적기」만) · 04 · 10 · 11 · 12 입구 칸 | U1~U3 · U10 · U11 통과, 목업 PNG와 대조 |
| **E4** 깨기 · 먹기 | 05 · 06 · 07 · 08 · 09, 자동 돌려놓기, 꿍으로 알려 주기, 「단짝 +n」 | U4~U9 · U12 통과 |
| **E5** 카카오 | **데브톡 답을 받은 뒤**: searchPlace 함수(Secret Manager 키 · 하루 제한) · 03 검색 · 시·군·구 코드 · 짝꿍 지도 칠하기 물음 | 함수 에뮬레이터 시험 + 실제 키로 한 번 |
| **E6** 마무리 | 어둡게 · 14판 · 320px · 실기기 대조 · 점검 AI | U13 · U14, 점검 목록 0 → 배포 |

- E5는 E4 뒤 언제든. 그 전에도 기능은 다 됨(가게는 이름만)
- 화면이 목업에 없으면 만들지 말고 기획 계정에 「○○ 화면 목업」 요청

## 4. 처음 맡기는 글 (구현 계정 Claude Code에 그대로)
```text
docs/eat/README.md를 먼저 읽고, 거기 적힌 순서대로 spec.md · 목업(design/mockups/chosen/eat/) ·
reference/ · rules/ · tests.md를 파악해 줘. 작업은 저장소의 AI 작업 가이드라인을 따라 줘.

이번에는 README 3절의 E1만 해 줘:
- 새 브랜치 eat-e1
- docs/eat/reference/src의 계산 모듈을 저장소 모듈 규칙에 맞춰 옮기기 (동작은 바꾸지 말기)
- 화면 글은 text.js 하나에, 이름은 NAME 한 곳에만
- reference/test의 시험 35개를 npm test에 추가 (fixtures 값 그대로)
화면은 아직 만들지 마. 끝나면 npm test 결과와 바꾼 파일 목록, 문서와 다르게 정한 것이 있으면 그 목록을 알려 줘.
```
그다음부터는 「README 3절의 E○ 해 줘」.

## 5. 점검 AI (단계마다, 새 세션)
```text
docs/eat/의 문서와 eat-e○ 브랜치의 변경을 비교해서 문제만 목록으로 적어 줘. 코드는 고치지 마.
특히 확인: 단짝 쿠키가 통 안에 있을 때 화면 · DOM · 알림 어디에도 음식 · 가게 · 메모가 안 나오는지,
오늘 먹을 것이 늘 하나인지(동시에 고르기), 고르기 · 돌려놓기 · 먹었어요가 eatState/today와 한 묶음인지,
하루 기준이 서울 자정인지, 별점 · 한 줄을 남의 칸에 못 쓰는지, 이름이 text.js 한 곳에만 있는지,
문구가 spec · 목업과 글자 그대로인지, 색이 토큰만 쓰는지(쿠키 그림 --ck-* 포함), 빨강이 빼기 · 오류에만 쓰이는지.
```

## 6. 돌려보내기
- 구현 중 문서와 다르게 정한 것은 `spec.md` 맨 아래 「바뀐 것」에 한 줄씩
- 단계가 끝날 때마다 그 줄들을 기획 계정 대화에 붙여 넣기 → 기획 문서에도 반영
