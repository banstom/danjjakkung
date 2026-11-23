# 천문대 · 기차 여행 도트 테마 — 넘기기 (기획 계정 → 구현 계정, 2026-11-23)

> 종합 묶음의 한 부분이에요. 전체 순서는 `docs/themes-2026-11/README.md`.
> 봄소풍과 같은 방식: 판 묶음 · 도트 스킨(`styles/pixel.css`) · 그림 자리를 그대로 쓰고, **색 토큰 · 머리 장식 · 바탕 무늬 · 그림만 새로**.
> 테마 시트에서 어디에 보이는지는 `docs/themes-sheet/spec.md`(묶음 · 이번 달 표)가 정해요 — 이 폴더는 `group` 값만 적어요. (11-23 처음 묶음에 있던 「앞 네 장」 · 「더 보기 맨 앞」 순서는 없어짐)

## 1. 무엇
| 이름 | id (낮 / 밤) | 묶음(`group`) | 분위기 | 꼬리표 |
|---|---|---|---|---|
| 「반짝반짝 천문대」 | `observatory` / `observatory-night` | `outing` | 차분 · 몽환. 낮 새벽 하늘 라벤더, 밤 깊은 남색 + 별빛 | `낮·밤` `NEW` |
| 「덜컹덜컹 기차 여행」 | `train-trip` / `train-trip-night` | `travel` | 레트로 청록 객차 / 야간열차 창문 불빛 | `낮·밤` `NEW` |
- 1년 내내 고를 수 있음. 이름 · 메인 색 · 밤 분위기 · 그림은 **사용자가 11-23에 확정**

## 2. 읽는 순서
1. `spec.md` 2. `../../design/mockups/chosen/themes-observatory-train/screens/` (9장) 3. 토큰 CSS 4. 장식(pixel-skin) CSS 5. `contrast.md` 6. `tests.md` 7. `prompts.md`(부록)
- 그림 · 장식: `design/assets/themes/` 아래 `observatory/` · `train-trip/`

## 3. 단계 OT1 (브랜치 `observatory-train-theme`)
- 네 판 토큰 + 판 묶음 등록(`group` 포함) · 장식 · 그림(`themes/<id>/`) · 그림 배율 · 사람 색 후보 · 규칙 `validColors` · tests.md 전부
- 목업에 없는 토큰(`--tomato-*` 등)은 봄소풍 판 값을 같은 계열로 바꿔 채우고 대비 시험 통과 → `spec.md` 「바뀐 것」에
- 다른 테마 화면은 하나도 바뀌면 안 됨
- 화면을 새로 그려야 하는 일이 생기면 구현하지 말고 기획 계정에 목업 요청
