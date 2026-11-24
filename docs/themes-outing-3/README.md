# 바닷속 · 사파리 · 영화관 도트 테마 — 넘기기 (기획 계정 → 구현 계정, 2026-11-24)

> 종합 묶음 2의 한 부분이에요. 전체 순서는 `docs/themes-2026-11b/README.md`.
> 앞 테마들과 같은 방식: 판 묶음 · 도트 스킨(`styles/pixel.css`) · 그림 자리를 그대로 쓰고, **색 토큰 · 머리 장식 · 바탕 무늬 · 그림만 새로**.
> 테마 시트에서 어디에 보이는지는 `docs/themes-sheet/spec.md`가 정해요 — 이 폴더는 `group` 값만 적어요.

## 1. 무엇
| 이름 | id (낮 / 밤) | 묶음(`group`) | 낮 / 밤 | 꼬리표 |
|---|---|---|---|---|
| 「뽀글뽀글 바닷속」 | `under-sea` / `under-sea-night` | `outing` | 물속 청록 / 빛나는 해파리 물빛 | `낮·밤` `NEW` |
| 「어흥어흥 사파리」 | `safari` / `safari-night` | `outing` | 사바나 노을 주황 / 노을빛 | `낮·밤` `NEW` |
| 「소곤소곤 영화관」 | `cinema` / `cinema-night` | `outing` | 검정 버튼 + 빨강 벨벳 장식 / 검정 바탕 + 스크린 빛 크림 버튼 | `낮·밤` `NEW` |
- 1년 내내 고를 수 있음. 이름 · 색 · 밤 분위기 · 그림은 **사용자가 11-24에 확정**

## 2. 읽는 순서
1. `spec.md` 2. `../../design/mockups/chosen/themes-outing-3/screens/` 3. `tokens-outing-3.css` 4. `pixel-skin-outing-3.css` 5. `contrast.md` 6. `tests.md` 7. `prompts.md`(부록)
- 그림 · 장식: `design/assets/themes/{under-sea,safari,cinema}/`

## 3. 단계 OS1 (브랜치 `outing-3-theme`)
- 3테마 6판 토큰 + 판 묶음 등록(`group` 포함) · 장식 · 그림(`themes/<id>/`) · 그림 배율 · 사람 색 후보 · 규칙 `validColors` · tests.md 전부
- 목업에 없는 토큰은 앞 테마들처럼 봄소풍 판 값을 같은 계열로 바꿔 채우고 「바뀐 것」에
- 영화관은 빨강 · 검정 테마지만 **버튼은 검정(낮) · 크림(밤)**. 빨강은 장식 · 강조 칸(`--tint`) · 제목 점(`--sec-dot`)에만 — 경고 빨강과 헷갈리지 않게
- 다른 테마 화면은 하나도 바뀌면 안 됨
