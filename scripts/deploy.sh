#!/bin/bash
# 알림 서버(functions) + 저장 규칙(firestore.rules)을 올린다. Google Cloud Shell에서 실행.
#   bash scripts/deploy.sh <이메일1> <이메일2>
# 이메일은 공개 저장소에 두지 않으려고 실행할 때만 넣는다 (firestore.rules.local 은 .gitignore).
set -e
cd "$(dirname "$0")/.."
E1="$1"; E2="$2"
if [ -z "$E1" ] || [ -z "$E2" ]; then echo "사용법: bash scripts/deploy.sh 이메일1 이메일2"; exit 1; fi
sed -e "s/__EMAIL_1__/$E1/; s/__EMAIL_2__/$E2/" firestore.rules > firestore.rules.local
echo "규칙에 넣은 이메일 수: $(grep -c '@' firestore.rules.local)"
(cd functions && npm ci --silent --no-audit --no-fund)
echo "firebase CLI $(firebase --version)"
firebase deploy --only functions,firestore:rules --project jjakkung-grid --non-interactive --force
# 서버 프로그램 보관 파일은 7일 지나면 지운다 (무료 범위 유지)
firebase functions:artifacts:setpolicy --location asia-northeast3 --days 7 --force --project jjakkung-grid || echo "(정리 정책은 나중에 다시)"
# 알림 기록(notifyLog)은 expireAt 이 지나면 자동 삭제
gcloud firestore fields ttls update expireAt --collection-group=notifyLog --enable-ttl --async --project jjakkung-grid --quiet || echo "(TTL은 나중에 다시)"
echo DEPLOY_DONE
