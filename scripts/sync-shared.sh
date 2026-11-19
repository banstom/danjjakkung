#!/bin/bash
# 서버 함수가 함께 쓰는 앱 모듈을 functions/shared/ 로 복사한다 (서버 함수는 functions 폴더만 올라가서 js/ 를 못 불러옴).
#   bash scripts/sync-shared.sh      — js/ 의 원본을 고친 뒤 실행. npm test 의 tests/shared.test.js 가 같은지 확인한다
set -e
cd "$(dirname "$0")/.."
for f in ledger-sum.js dates.js cats.js schedule.js; do
  cp "js/$f" "functions/shared/$f"
done
echo "functions/shared 맞춤: $(ls functions/shared | tr '\n' ' ')"
