#!/bin/bash
# 결산 서버 시험을 Firestore 에뮬레이터로 돌린다 (docs/recap/tests.md B 묶음 F1~F7). Google Cloud Shell 에서.
#   cd ~/danjjakkung && git fetch origin <브랜치> && git switch --detach FETCH_HEAD && bash scripts/emu-recap.sh
# 진짜 프로젝트에는 아무것도 쓰지 않는다 (demo- 프로젝트 · 에뮬레이터만). 규칙은 시험용 이메일(a@test.dev · b@test.dev)로 바꿔 씀.
# 시험 도구(@firebase/rules-unit-testing)는 ~/.danjjakkung-emu 에만 설치 — 저장소 package.json 은 그대로.
set -e
cd "$(dirname "$0")/.."
ROOT="$PWD"
EMU="$HOME/.danjjakkung-emu"
mkdir -p "$EMU"

echo "① 시험 도구 준비 ($EMU)"
if [ ! -d "$EMU/node_modules/@firebase/rules-unit-testing" ]; then
  # (npm init 은 점으로 시작하는 폴더 이름을 거절해서 package.json 을 직접 만든다)
  [ -f "$EMU/package.json" ] || echo '{"name":"danjjakkung-emu","private":true}' > "$EMU/package.json"
  (cd "$EMU" && npm i --silent --no-audit --no-fund @firebase/rules-unit-testing@3 firebase@10)
fi
(cd functions && npm ci --silent --no-audit --no-fund)

echo "② 시험용 규칙 · 설정"
sed -e "s/__EMAIL_1__/a@test.dev/; s/__EMAIL_2__/b@test.dev/" firestore.rules > "$EMU/firestore.rules"
cat > "$EMU/firebase.json" <<'JSON'
{ "firestore": { "rules": "firestore.rules" }, "emulators": { "firestore": { "port": 8085, "host": "127.0.0.1" }, "ui": { "enabled": false }, "singleProjectMode": true } }
JSON

echo "③ 에뮬레이터에서 시험 (처음엔 에뮬레이터 내려받기로 1~2분)"
cd "$EMU"
NODE_PATH="$EMU/node_modules" RECAP_RULES="$EMU/firestore.rules" TZ=Asia/Seoul \
  firebase emulators:exec --only firestore --project demo-danjjakkung \
  "node --test '$ROOT/functions/emu/recap.emu.js'"
echo EMU_RECAP_DONE
