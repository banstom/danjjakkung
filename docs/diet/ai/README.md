# 단짝 식탁 AI 정리 시험 (시험 A) — 2026-11-18

- `parse-prompt.md` — parseMeal 서버 함수에 넣을 지시문 (Haiku 5.5로 다듬은 판)
- `cases.md` — T1 · T2 · T3 · T4 · T6 · T7-1 · T7-2 입력과 상태 (T5는 AI를 부르지 않는 시험이라 없음)
- `grade.py` — tests.md 「꼭 맞아야 하는 값」 채점기. `python3 grade.py run1 run2 run3` (각 폴더에 <case>.json)

## 11-18 결과 (claude.ai 계정의 Haiku 하위 에이전트로, 실제 API 아님)
| | 1차 지시문 | 다듬은 지시문 |
|---|---|---|
| T1 · T2 · T4 · T6 · T7-2 | 3/3 | 3/3 |
| T3 정정 답 | 0/3 | 2/3 (레시피 learn 빠뜨림 1번 → 앱 코드로 처리) |
| T7-1 | 2/3 | 3/3 |

D4에서 이 파일들로 `npm run test:ai`(실제 API, 3번 돌려 3번 맞기)를 만든다.

## D4 (2026-11-19)
- 서버 함수 `parseMeal` = `functions/index.js` + `functions/meal.js`, 지시문은 `functions/meal-prompt.md` (이 폴더의 parse-prompt.md와 같은 내용인지 `npm test`가 확인)
- 실제 API 시험: Cloud Shell에서 `ANTHROPIC_API_KEY=$(gcloud secrets versions access latest --secret=ANTHROPIC_API_KEY --project jjakkung-grid) npm run test:ai`
