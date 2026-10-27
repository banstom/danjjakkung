# 단짝꿍 — 다음 작업 (2026-10-28 정리)

## 1. 시간표 · 할 일 (확정된 방향)

화면 아래에 **탭 3개**: 루틴 · 시간표 · 할 일

### 시간표 — 「주 | 일」 전환 (캔버스 S-4, S-5)
- 주 보기: 월~일 한 주. 하루 칸 안에서 왼쪽 다진 · 오른쪽 준민, 함께 일정은 칸 전체, 이번 주만 있는 일정은 점선.
- 요일 머리글을 누르면 그날의 일 보기로.
- 일 보기: 다진 | 준민 두 줄 타임라인 + 「지금」 상태 카드(지금 무엇 · 다음 일정), 위 요일 띠로 날짜 이동.
- 일정 = 매주 반복(요일 · 시간) + 그 주에만 있는 일정. 함께 일정 가능.
- 각자 자기 일정만 추가 · 수정, 상대 일정은 보기만.

### 할 일 — T-3 + L-1 (+ L-3 정렬)
- 위: 「함께 할 일」(둘 다 추가 · 체크, 누가 추가했는지 · 누가 했는지 표시)
- 아래: 다진 | 준민 두 칸 (각자 자기 것만 체크, 상대 것은 보기만)
- 묶음마다 남은 일 **3개까지만**, 나머지는 「N개 더 보기」, 완료는 「완료 N개」로 접기
- 정렬: 기한 지난 일 → 오늘 → 이번 주 → 나중에 (기한 없으면 맨 뒤)

### 저장 구조 (안)
- `events/<id>`: { owner(uid) | 'both', title, weekday(0-6) | null, date('YYYY-MM-DD') | null, start('HH:MM'), end('HH:MM'), weekly(bool), from, until, createdBy, updatedAt }
- `todos/<id>`: { scope: 'together' | uid, title, due('YYYY-MM-DD') | null, done, doneBy, doneAt, createdBy, createdAt }
- 규칙: 함께 것은 둘 다 쓰기, 각자 것은 본인만 쓰기, 읽기는 둘 다. (나중에 짝 단위로 넓힐 때 pairId만 더함)
- 알림(서버 올린 뒤): 함께 할 일이 추가 · 완료되면 짝꿍에게.

### 순서
1. 아래 탭 구조 (지금 화면 = 루틴 탭)
2. 할 일 탭 (저장 · 규칙 · 화면 · 테스트)
3. 시간표 탭 (주/일 보기 · 일정 추가 시트 · 테스트)
4. 점검(다른 AI) → 고친 것마다 테스트 → 배포

## 2. 푸시 알림 (서버만 남음)
- 앱 · 서버 코드 완료, 테스트 통과, 🔔 버튼은 `DANJJAKKUNG_PUSH_READY=false` 로 숨겨 둠.
- Google 결제 계정 본인 확인 대기 중 → 승인되면 ₩40,000 선불 → Blaze 연결.
- 그다음: Cloud Shell에서 `firestore.rules.local`(이메일 채운 규칙) 만들고 `firebase deploy --only functions,firestore:rules`,
  Artifact Registry 정리 정책, notifyLog `expireAt` TTL, 예산 경고, `DANJJAKKUNG_PUSH_READY=true`.

시안: 디자인 캔버스 「우리 루틴 트래커 시안」 맨 아래 두 줄 (S-4, S-5, L-1~3)
