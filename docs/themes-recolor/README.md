# 색 바꿈 — 캠핑 · 프라하 (기획 계정 → 구현 계정, 2026-11-24)

> 종합 묶음 2의 한 부분이에요. 전체 순서는 `docs/themes-2026-11b/README.md`.
> 11-24에 사용자와 도트 테마 19개의 메인색을 다시 봤어요. 기준이 바뀌었어요: **그림이 있는 도트 테마는 다른 테마와 색이 겹쳐도 되고, 컨셉에 가장 맞는 색**을 고름 (빨강은 여전히 경고에만, 글씨 대비 4.5:1).
> 그 결과 이미 넘긴 테마 중 둘의 버튼 색이 바뀌어요. (시드니도 바뀌었지만 아직 안 넘긴 테마라 `themes-travel-5`에 바뀐 값으로 들어 있어요.)

## 1. 무엇이 바뀌나
| 테마 | 판 | 전 | 후 | 이유 |
|---|---|---|---|---|
| 타닥타닥 캠핑 | 낮 `camping` | 숯 회색 `#4A433A` | **소나무 초록 `#3E5E36`** | 숯 회색은 캠핑이 안 읽힘. 머리 장식 숲과 맞물림 |
| 타닥타닥 캠핑 | 밤 `camping-night` | 달빛 크림 `#EDE0C4` | **모닥불 주황 `#F29A4E`** (글자 `#2A1606`) | 「타닥타닥」 모닥불 |
| 뾰족뾰족 프라하 | 낮 `prague` | 슬레이트 `#3F4E66` | **붉은 지붕 `#A8482A`** | 「붉은 지붕의 도시」. 머리 장식 지붕과 같은 색 |
- 프라하 밤(`prague-night`, 은빛)은 그대로. 그림 · 머리 장식 · 바탕 · 사람 색 · 규칙은 **하나도 안 바뀜** (규칙 배포 필요 없음)
- 바뀌는 토큰 (`tokens-recolor.css`, 전 값은 주석):

| 판 | 토큰 |
|---|---|
| `camping` | `--primary`, `--btn-hi`, `--btn-lo`, `--secondary`, `--accent`, `--strong`, `--tab-active`, `--tint`, `--tint-text`, `--primary-edge` |
| `camping-night` | `--primary`, `--on-primary`, `--btn-hi`, `--btn-lo`, `--accent`, `--strong`, `--tab-active`, `--tint`, `--tint-text`, `--primary-edge` |
| `prague` | `--primary`, `--btn-hi`, `--btn-lo`, `--secondary`, `--accent`, `--strong`, `--tab-active`, `--tint`, `--tint-text`, `--primary-edge` |

## 2. 단계 RC1 (브랜치 `recolor`)
- 캠핑 두 판 · 프라하 낮 판의 위 토큰만 바꿈. 다른 판 · 다른 테마는 그대로
- 목업: `design/mockups/chosen/themes-recolor/screens/` 6장 (홀수 = 전, 짝수 = 후)
- 대비: `contrast.md` (가장 낮은 것 5.28)

## 3. 시험
| # | 시험 |
|---|---|
| R1 | 세 판의 바뀐 토큰 값 = `tokens-recolor.css` |
| R2 | 세 판 글자 20쌍 4.5:1 이상 |
| R3 | 다른 판 토큰 값이 하나도 안 바뀜 (스냅숏) — 프라하 밤 포함 |
| R4 | 테마 시트 미리보기 카드 · 묶음 줄 색 띠가 새 `--primary`를 씀 |
| M1 | 폰에서 목업 6장과 대조 |

## 바뀐 것
(구현하면서 문서와 다르게 정한 것을 한 줄씩)
