# 테니스 · 포르투 · 프라하 · 토스카나 도트 테마 — 넘기기 (기획 계정 → 구현 계정, 2026-11-23)

> 종합 묶음의 한 부분이에요. 전체 순서는 `docs/themes-2026-11/README.md`.
> 봄소풍과 같은 방식: 판 묶음 · 도트 스킨(`styles/pixel.css`) · 그림 자리를 그대로 쓰고, **색 토큰 · 머리 장식 · 바탕 무늬 · 그림만 새로**.
> 테마 시트에서 어디에 보이는지는 `docs/themes-sheet/spec.md`(묶음 · 이번 달 표)가 정해요 — 이 폴더는 `group` 값만 적어요. (11-23 처음 묶음에 있던 「앞 네 장」 · 「더 보기 맨 앞」 순서는 없어짐)

## 1. 무엇
| 이름 | id (낮 / 밤) | 묶음(`group`) | 분위기 | 꼬리표 |
|---|---|---|---|---|
| 「통통 테니스 코트」 | `tennis-court` / `tennis-court-night` | `outing` | 잔디 코트 · 테니스공 연두 버튼(진한 글씨) / 야간 경기 조명 | `낮·밤` `NEW` |
| 「또각또각 포르투」 | `porto` / `porto-night` | `travel` | 아줄레주 코발트 + 흰 타일 / 도루강 다리 불빛 | `낮·밤` `NEW` |
| 「뾰족뾰족 프라하」 | `prague` / `prague-night` | `travel` | 첨탑 슬레이트 + 주홍 지붕 장식 / 은빛 첨탑 · 가로등 | `낮·밤` `NEW` |
| 「살랑살랑 토스카나」 | `tuscany` / `tuscany-night` | `travel` | 올리브 · 해바라기 · 사이프러스 / 포도밭 별밤 · 포도 연보라 버튼 | `낮·밤` `NEW` |
- 1년 내내 고를 수 있음. 이름 · 메인 색 · 밤 분위기 · 그림은 **사용자가 11-23에 확정**

## 2. 읽는 순서
1. `spec.md` 2. `../../design/mockups/chosen/themes-tennis-cities/screens/` (18장) 3. 토큰 CSS 4. 장식(pixel-skin) CSS 5. `contrast.md` 6. `tests.md` 7. `prompts.md`(부록)
- 그림 · 장식: `design/assets/themes/` 아래 `tennis-court/` · `porto/` · `prague/` · `tuscany/`

## 3. 단계 TC1 (브랜치 `tennis-cities-theme`)
- 여덟 판 토큰 + 판 묶음 등록(`group` 포함) · 장식 · 그림(`themes/<id>/`) · 그림 배율 · 사람 색 후보 · 규칙 `validColors` · tests.md 전부
- 목업에 없는 토큰(`--tomato-*` 등)은 봄소풍 판 값을 같은 계열로 바꿔 채우고 대비 시험 통과 → `spec.md` 「바뀐 것」에
- 다른 테마 화면은 하나도 바뀌면 안 됨
- **테니스 낮 판만 버튼 글자가 진한 색**(`--on-primary` `#1C2610`) — 지금 버튼 코드가 「메인 색 버튼 글자 = 밝은 색」을 가정하면 `--on-primary`를 쓰게 고치고 「바뀐 것」에
- 화면을 새로 그려야 하는 일이 생기면 구현하지 말고 기획 계정에 목업 요청
