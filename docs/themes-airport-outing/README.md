# 공항 · 놀이공원 · 캠핑 도트 테마 — 넘기기 (기획 계정 → 구현 계정, 2026-11-23)

> 종합 묶음의 한 부분이에요. 전체 순서는 `docs/themes-2026-11/README.md`.
> 앞 테마들과 같은 방식: 판 묶음 · 도트 스킨(`styles/pixel.css`) · 그림 자리를 그대로 쓰고, **색 토큰 · 머리 장식 · 바탕 무늬 · 그림만 새로**.
> 테마 시트에서 어디에 보이는지는 `docs/themes-sheet/spec.md`(묶음 · 이번 달 표)가 정해요 — 이 폴더는 `group` 값만 적어요.

## 1. 무엇
| 이름 | id (낮 / 밤) | 묶음(`group`) | 분위기 | 꼬리표 |
|---|---|---|---|---|
| 「둥실둥실 공항」 | `airport` / `airport-night` | `travel` | 출발 안내판 노랑 버튼(진한 글씨) / 활주로 불빛 | `낮·밤` `NEW` |
| 「빙글빙글 놀이공원」 | `amusement-park` / `amusement-park-night` | `outing` | 자홍 + 사탕 줄무늬 / 불 켜진 전구 · 분홍 버튼 | `낮·밤` `NEW` |
| 「타닥타닥 캠핑」 | `camping` / `camping-night` | `outing` | 숯 회색 + 텐트 주황 · 숲 초록 / 모닥불 별밤 · 달빛 크림 버튼(진한 글씨) | `낮·밤` `NEW` |
- 1년 내내 고를 수 있음. 이름 · 색 · 밤 분위기 · 그림은 **사용자가 11-23에 확정**

## 2. 읽는 순서
1. `spec.md` 2. `../../design/mockups/chosen/themes-airport-outing/screens/` (14장) 3. `tokens-airport-outing.css` 4. `pixel-skin-airport-outing.css` 5. `contrast.md` 6. `tests.md` 7. `prompts.md`(부록)
- 그림 · 장식: `design/assets/themes/{airport,amusement-park,camping}/`

## 3. 단계 AO1 (브랜치 `airport-outing-theme`)
- 세 테마 여섯 판 토큰 + 판 묶음 등록(`group` 포함) · 장식 · 그림(`themes/<id>/`) · 그림 배율 · 사람 색 후보 · 규칙 `validColors` · tests.md 전부
- 목업에 없는 토큰은 앞 테마들처럼 봄소풍 판 값을 같은 계열로 바꿔 채우고 「바뀐 것」에
- 공항 낮 · 캠핑 밤은 버튼 글자가 진한 색 — 테니스 단계(TC1)에서 `--on-primary`를 쓰게 고쳤으면 그대로 됨
- 다른 테마 화면은 하나도 바뀌면 안 됨
