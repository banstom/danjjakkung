#!/bin/bash
# 교환 쪽지(R1~R12) · 출출 쿠키(R1~R16 + 꿍 알림 · users 칸) · 연말 문답(Y1~Y9) 저장 규칙 시험을 Firestore 에뮬레이터로 돌린다. Google Cloud Shell 에서.
#   cd ~/danjjakkung && git fetch origin main && git switch --detach origin/main && bash scripts/emu-rules.sh && bash scripts/redeploy.sh
# 시험이 하나라도 실패하면 여기서 멈춰서(set -e) 뒤의 redeploy.sh(진짜 배포)가 돌지 않는다.
# 진짜 프로젝트에는 아무것도 쓰지 않는다 (demo- 프로젝트 · 에뮬레이터만). 규칙은 시험용 이메일(a@test.dev · b@test.dev)로 바꿔 씀.
# 시험 도구(@firebase/rules-unit-testing · firebase)는 ~/.danjjakkung-emu 에만 설치 — 저장소 package.json 은 그대로 (scripts/emu-recap.sh 와 같은 자리).
set -e
cd "$(dirname "$0")/.."
ROOT="$PWD"
EMU="$HOME/.danjjakkung-emu"
mkdir -p "$EMU"

echo "① 시험 도구 준비 ($EMU)"
if [ ! -d "$EMU/node_modules/@firebase/rules-unit-testing" ]; then
  [ -f "$EMU/package.json" ] || echo '{"name":"danjjakkung-emu","private":true}' > "$EMU/package.json"
  (cd "$EMU" && npm i --silent --no-audit --no-fund @firebase/rules-unit-testing@3 firebase@10)
fi

echo "② 시험용 규칙 · 설정"
sed -e "s/__EMAIL_1__/a@test.dev/; s/__EMAIL_2__/b@test.dev/" firestore.rules > "$EMU/firestore.rules"
cat > "$EMU/firebase.json" <<'JSON'
{ "firestore": { "rules": "firestore.rules" }, "emulators": { "firestore": { "port": 8085, "host": "127.0.0.1" }, "ui": { "enabled": false }, "singleProjectMode": true } }
JSON

echo "③ 에뮬레이터에서 규칙 시험 (처음엔 에뮬레이터 내려받기로 1~2분)"
cd "$EMU"
NODE_PATH="$EMU/node_modules" RULES_FILE="$EMU/firestore.rules" TZ=Asia/Seoul \
  firebase emulators:exec --only firestore --project demo-danjjakkung \
  "node --test --test-concurrency=1 '$ROOT/functions/emu/question.emu.js' '$ROOT/functions/emu/eat.emu.js' '$ROOT/functions/emu/yearqa.emu.js'"
echo RULES_TEST_DONE
