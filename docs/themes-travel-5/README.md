# 뉴욕 · 시드니 · 발리 · 카이로 · 과나후아토 도트 테마 — 넘기기 (기획 계정 → 구현 계정, 2026-11-24)

> 종합 묶음 2의 한 부분이에요. 전체 순서는 `docs/themes-2026-11b/README.md`.
> 앞 테마들과 같은 방식: 판 묶음 · 도트 스킨(`styles/pixel.css`) · 그림 자리를 그대로 쓰고, **색 토큰 · 머리 장식 · 바탕 무늬 · 그림만 새로**.
> 테마 시트에서 어디에 보이는지는 `docs/themes-sheet/spec.md`가 정해요 — 이 폴더는 `group` 값만 적어요.

## 1. 무엇
| 이름 | id (낮 / 밤) | 묶음(`group`) | 낮 / 밤 | 꼬리표 |
|---|---|---|---|---|
| 「우뚝우뚝 뉴욕」 | `new-york` / `new-york-night` | `travel` | 여신상 청록 버튼(진한 글씨) / 빌딩 창문 불빛 노랑 | `낮·밤` `NEW` |
| 「깡충깡충 시드니」 | `sydney` / `sydney-night` | `travel` | 하버 파랑 / 하버 불빛 산호 | `낮·밤` `NEW` |
| 「느긋느긋 발리」 | `bali` / `bali-night` | `travel` | 라탄 버튼(진한 글씨) / 정글 횃불 주황 | `낮·밤` `NEW` |
| 「사락사락 카이로」 | `cairo` / `cairo-night` | `travel` | 사막 황토 금빛 / 사막 달빛 금색 | `낮·밤` `NEW` |
| 「팔랑팔랑 과나후아토」 | `guanajuato` / `guanajuato-night` | `travel` | 멕시코 핑크 / 파펠 피카도 분홍 | `낮·밤` `NEW` |
- 1년 내내 고를 수 있음. 이름 · 색 · 밤 분위기 · 그림은 **사용자가 11-24에 확정**

## 2. 읽는 순서
1. `spec.md` 2. `../../design/mockups/chosen/themes-travel-5/screens/` 3. `tokens-travel-5.css` 4. `pixel-skin-travel-5.css` 5. `contrast.md` 6. `tests.md` 7. `prompts.md`(부록)
- 그림 · 장식: `design/assets/themes/{new-york,sydney,bali,cairo,guanajuato}/`

## 3. 단계 TR1 (브랜치 `travel-5-theme`)
- 5테마 10판 토큰 + 판 묶음 등록(`group` 포함) · 장식 · 그림(`themes/<id>/`) · 그림 배율 · 사람 색 후보 · 규칙 `validColors` · tests.md 전부
- 목업에 없는 토큰은 앞 테마들처럼 봄소풍 판 값을 같은 계열로 바꿔 채우고 「바뀐 것」에
- 뉴욕 낮 · 발리 낮은 밝은 버튼 + 진한 글자(`--on-primary`)
- 다른 테마 화면은 하나도 바뀌면 안 됨
