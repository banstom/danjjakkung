#!/bin/bash
# 서버 함수가 함께 쓰는 앱 모듈을 functions/shared/ 로 복사한다 (서버 함수는 functions 폴더만 올라가서 js/ 를 못 불러옴).
#   bash scripts/sync-shared.sh      — js/ 의 원본을 고친 뒤 실행. npm test 의 tests/shared.test.js 가 같은지 확인한다
set -e
cd "$(dirname "$0")/.."
for f in ledger-sum.js dates.js cats.js schedule.js question.js question-text.js eat.js eat-text.js places.js focus.js focus-stats.js; do
  cp "js/$f" "functions/shared/$f"
done
# 교환 쪽지 질문 묶음: 원본은 docs/question/data-src → node docs/question/tools/build-questions.mjs → docs/question/data/questions.json
cp docs/question/data/questions.json data/questions.json
cp docs/question/data/questions.json functions/shared/questions.json
echo "functions/shared 맞춤: $(ls functions/shared | tr '\n' ' ')"
