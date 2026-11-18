# 짝꿍 식탁 넘기기 절차 (사용자용)

> 기획 계정(claude.ai 「웹앱개발」) → 구현 계정(GitHub · Cloud Shell 연결된 Claude). 다른 계정은 기획 계정의 대화 · 프로젝트 · 아티팩트를 못 보므로 **이 묶음이 기준**이에요.

## 0. 기획 계정에서 (끝남)
- `danjjakkung-diet-handoff.zip` 받기

## 1. 저장소에 넣기 (Cloud Shell, 5분)
1. Cloud Shell 오른쪽 위 ⋮ › 업로드 → zip 올리기 (홈 폴더에 들어가요)
2. 아래를 차례로 붙여 넣기 (`<저장소 폴더>`만 바꾸기)
```bash
cd ~/<저장소 폴더>
git switch main && git pull
git switch -c diet-docs
unzip -o ~/danjjakkung-diet-handoff.zip -d .
git status          # docs/diet/ 와 design/mockups/chosen/diet/ 만 새로 생겼는지 확인
git add docs/diet design/mockups/chosen/diet
git commit -m "식단(짝꿍 식탁) 기획 문서 · 목업 · 시험 데이터"
git push -u origin diet-docs
```
3. 문서만 들어간 브랜치라 바로 main에 합쳐도 돼요 (GitHub에서 PR → 합치기). 그래야 이후 모든 작업 브랜치에 문서가 들어 있어요

## 2. 구현 계정의 Claude Code에 처음 맡기기
```text
docs/diet/README.md를 먼저 읽고, 거기 적힌 순서대로 plan.md · goals.md · tests.md와
design/mockups/chosen/diet/ 목업을 파악해 줘. 작업은 저장소의 AI 작업 가이드라인을 따라 줘.

이번에는 README 3절의 D1만 해 줘:
- 새 브랜치 diet-d1
- 계산 모듈(합계 · 레시피 비율 · 탄단지 비율 · 공복 시간 · 목표 계산 · 목표 대비 문구 · 질문 고르기)을 작은 파일로 나눠서
- docs/diet/fixtures/의 값으로 시험 B, G1~G5를 npm test에 추가
- firestore.rules에 private/{uid} 규칙 + 시험 P1
화면은 아직 만들지 마. 끝나면 npm test 결과와 바꾼 파일 목록, 문서와 다르게 정한 것이 있으면 그 목록을 알려 줘.
```

## 3. 단계마다 반복 (D1 → D8)
1. Claude Code에 "README 3절의 D○ 해 줘" (브랜치 `diet-d○`)
2. `npm test` 통과 확인
3. **점검 AI** — 새 세션을 열고:
```text
docs/diet/의 문서와 diet-d○ 브랜치의 변경을 비교해서 문제만 목록으로 적어 줘. 코드는 고치지 마.
특히 확인: AI가 영양 숫자를 내지 않는지, 몸 정보가 private/{uid} 밖에 저장되거나 AI로 보내지지 않는지,
안내 문구가 goals.md 8절과 글자 그대로인지, 색이 토큰만 쓰는지, 시험이 fixtures 값을 쓰는지.
```
4. 나온 문제를 고치고(고칠 때마다 회귀 테스트), 폰에서 직접 확인
5. main에 합치기 → 규칙 · 서버 함수가 바뀐 단계는 `bash scripts/redeploy.sh`
- 화면 단계(D2 · D3 · D5 · D6)는 목업 파일을 띄워 놓고 같은지 대조
- D4(AI)는 시작 전에 모델(Haiku 5.5 / Gemini)과 키 결제를 정해야 해요. 시험 A를 3번 돌려 3번 맞는지로 판단

## 4. 돌려보내기 (구현 → 기획)
- 구현 중 바뀐 결정은 각 문서 맨 아래 `## 바뀐 것`에 한 줄씩 쌓여요
- 단계가 끝날 때마다 그 줄들을 복사해서 기획 계정 대화에 붙여 넣기 → 프로젝트 문서에도 반영
- 목업에 없는 화면이 필요하면 구현하지 말고 기획 계정에 "○○ 화면 목업" 요청 → 고른 것을 `design/mockups/chosen/diet/`에 추가

## 5. 남은 확인 (구현 전에 정하면 좋은 것)
- 유지 목표의 칼로리 · 탄수를 '넘지 말아야 할 목표'로 둘지 (`goals.md` 6절, 지금은 가정)
- D4 모델 선택과 결제
- 「전체」 탭(지도 M1)이 먼저인지 — 식단 입구가 거기 있음
