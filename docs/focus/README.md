# 단짝꿍 · 「집중」 탭 + 탭 정리 + 테마 맞춤 — 넘기기 묶음

> 기획 계정 → 구현 계정, 2026-11-25. 구현 계정이 11-25에 보낸 「기획 요청」(뼈대 · 시안 A)에 대한 답이에요.
> 넣을 곳: 노트북 `Fruitful Growth 프로젝트/단짝꿍 업데이트/handoff/danjjakkung-focus-handoff/` → 저장소 `docs/focus/` · `design/mockups/chosen/focus/`

## 0. 무엇
- 아래 탭 가운데에 둘이 같이 쓰는 **집중 타이머 「집중」** (열품타처럼, F1)
- 그 자리를 위해 **돌아보기 탭 → 전체 탭** 「우리 둘」 아래 카드
- **36테마에서 새 화면이 어색하지 않게** — 새 토큰 2개(기존 토큰을 가리킴), 도트 스킨, 테마의 **S3 그림을 집중 화면에**

## 1. 정한 것
**요청서 1절의 12가지는 그대로**예요(탭 5개 · 순서 · 돌아보기 이동 · 2×2 그대로 · 「집중」 · 엄격은 사람마다 · 새벽 5시 · 알림 · 과목 = 카테고리 · 루틴 탭으로 열기 · 한 번에 출시 · 순위/뽀모도로 없음).

이번에 사용자에게 물어서 정한 것 (11-25):
| 물음 | 답 |
|---|---|
| 집중 화면 새 그림 자리(S5) | **만들지 않음 → 테마의 S3(할 일 다 끝냄) 그림을 집중 화면 · 끝냄 요약에 씀.** 「할 일을 다 끝낸 적이 거의 없어서 S3를 본 적이 없다」 — 새 그림 0장 |
| 집중 탭 맨 위 | 내 오늘 합계 크게 + 「🔥 함께」 · 「● 다진」 칩 (시안 A-1 그대로) |
| 엄격 「자리 비움」을 짝꿍에게 | 상태만 「잠깐 자리 비움」 — 횟수 · 시간 · 알림 없음 |

기획 계정이 목업을 만들며 정한 것 (다르게 하려면 「바뀐 것」에):
- **진행 링 색 = `--strong`** (시안의 `--me` 연보라에서 바꿈 — 낮 테마 35판에서 링이 안 보였음. 내 색은 링 끝 동그라미로)
- 링 한 바퀴 = 1시간
- 짝꿍이 쉬는 중이면 「같이 하자」(알림), 집중 중이면 「같이 하기」(나도 바로 시작)
- 어제와 비교는 늘었을 때만 「+40분」, 줄면 숫자만
- 집중 탭 머리말에서 도트 S1 그림은 안 그림(⚙ 버튼 자리)
- S4 결산 표지는 그대로 둠

## 2. 단계 (구현은 한 번에 출시)
| 단계 | 무엇 | 문서 | 목업 |
|---|---|---|---|
| **FT1** | 탭 순서 · 집중 탭 자리(빈 껍데기) · 전체 탭 돌아보기 카드 · 돌아보기 화면 머리말/뒤로 · 옛 알림 주소 | `docs/focus/tabs.md` | `sp-30` · `sp-31` · `sp-35` |
| **FC1** | 집중 탭 7상태 · 집중 화면 5상태 · 시트 5개 · 그래프 · 띠 · 탭 점 · 문구 | `docs/focus/spec.md` | `sp-01`~`sp-24` · `sp-32`~`sp-34` · `sp-40`~`sp-43` |
| **FT2** | 새 토큰 2개 · 도트 스킨 · S3 · 36테마 확인 · 대비 시험 | `docs/focus/theme-fit.md` · `tokens-focus.css` · `pixel-skin-focus.css` · `contrast.md` | `cd-*` · `ws-*` · `wsn-*` · `ci-*` · `cin-*` |
| **FIN** | 점검 AI · 실기기 · 서버 다시 배포(알림 주소) · 배포 | `docs/focus/tests.md` | |
- 브랜치: main에서 모음 브랜치 `focus-f1` → 단계마다 따서 합치고, main에는 FIN에서 한 번에
- F2(알림 서버)는 이 묶음 밖이지만 **알림 문구 · 알림 시트 스위치는 `spec.md` 8-4에 미리** 있어요
- 서버 배포: FT1의 결산 · 돌아보기 알림 주소가 바뀌므로 FIN 날 `bash scripts/redeploy.sh`. 옛 주소는 앱이 받아 주므로 순서가 바뀌어도 깨지지 않아요

## 3. 읽는 순서
1. 이 README
2. `design/mockups/chosen/focus/index.html` — 목업 64장 한눈에 (그림을 누르면 html)
3. `docs/focus/tabs.md` → `spec.md` → `theme-fit.md`
4. `tokens-focus.css` · `pixel-skin-focus.css` · `contrast.md`
5. `tests.md`

## 4. 묶음 안
```
danjjakkung-focus-handoff/
  README.md
  docs/focus/
    spec.md                ← 화면별 명세 · 상태 · 문구 · 「바뀐 것」 칸
    tabs.md                ← 탭 정리 · 전체 탭 · 돌아보기 진입
    theme-fit.md           ← 36테마 맞춤 표
    tokens-focus.css       ← 새 토큰 2개 (+ Cosmic Dream 한 줄)
    pixel-skin-focus.css   ← 도트 스킨 추가분 · 픽셀 계단 링 알고리즘
    contrast.md            ← 58판(기본 14 + 도트 44) × 새 색 조합 대비
    tests.md               ← 자동 시험 A~D · 손으로 볼 것 · 점검 AI 문구
    README.md              ← 이 파일의 사본 (저장소 안에서 읽을 곳)
  design/mockups/chosen/focus/
    index.html             ← 모아 보기
    screens/               ← PNG 64장 + 같은 이름 html (390×844 · 320×640, 2배)
```
- `prompts.md` · `design/assets/themes/<id>/s5.png` 없음 — 새 그림을 만들지 않기로 해서요
- **저장소 루트에 이 폴더를 통째로 풀지 마세요** — 맨 위 `README.md`가 저장소 README를 덮어써요. `docs/` · `design/` 두 폴더만 옮기면 되고, 이 README는 `docs/focus/README.md`에 같은 사본이 있어요
- 목업 html은 한 파일에 CSS · 그림이 다 들어 있어 브라우저로 바로 열려요. 글꼴은 시험용(Noto Sans CJK) — 실제는 Pretendard · 도트 테마는 Galmuri

## 5. 구현 계정에 맡길 말
처음:
```text
docs/focus/README.md(이 묶음의 README)를 먼저 읽고 전체 단계를 파악해 줘. 저장소의 AI 작업 가이드라인을 따라 줘.
main에서 모음 브랜치 focus-f1을 만들고, 거기서 따서 FT1을 해 줘 (docs/focus/tabs.md · 목업 sp-30 · sp-31 · sp-35).
집중 탭은 빈 껍데기만, 루틴 · 시간표 · 할 일 화면은 하나도 바꾸지 마. 옛 알림 주소 ?tab=look… 이 그대로 열리게.
끝나면 npm test 결과, 바꾼 파일, 문서와 다르게 정한 것을 tabs.md 「바뀐 것」에 적고 알려 줘.
```
다음:
```text
docs/focus/spec.md로 FC1을 해 줘 (목업 sp-01 ~ sp-43). 문구는 한 모듈에만. tests.md C · D를 npm test에 넣고,
끝나면 결과 · 바뀐 파일 · 「바뀐 것」을 알려 줘.
```
```text
docs/focus/theme-fit.md · tokens-focus.css · pixel-skin-focus.css · contrast.md로 FT2를 해 줘.
tests.md B를 npm test에 넣고, 대비 결과가 contrast.md(58판)와 다르면 theme-fit.md 「바뀐 것」에 적어 줘.
```
FIN: `tests.md` 끝의 점검 AI 문구 → 고치기 → 폰 M1~M9 → main → 화면 배포 + 서버 다시 배포

## 6. 돌려받기
- 단계마다 그 문서의 「바뀐 것」 줄을 기획 계정 대화에 붙여 넣어 주세요
- 목업에 없는 화면이 필요하면 만들지 말고 기획 계정에 「○○ 화면 목업」 요청
