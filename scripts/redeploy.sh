#!/bin/bash
# 다시 배포할 때 한 줄로: 지난번 firestore.rules.local 에 들어 있던 두 이메일을 그대로 써서 deploy.sh 를 돌린다.
#   bash scripts/redeploy.sh      (Cloud Shell, ~/danjjakkung 에서 git fetch · switch 한 뒤)
set -e
cd "$(dirname "$0")/.."
E=$(grep -oE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+" firestore.rules.local | sort -u)
if [ "$(echo "$E" | wc -l)" -ne 2 ]; then echo "firestore.rules.local 에서 이메일 두 개를 찾지 못했어요 — bash scripts/deploy.sh 이메일1 이메일2 로 돌려 주세요"; exit 1; fi
bash scripts/deploy.sh $E
