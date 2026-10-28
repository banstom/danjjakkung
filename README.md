# 단짝꿍

둘이 함께 매일 루틴을 체크하고, 시작 며칠차·연속 며칠차를 고른 테마 색 달력으로 물들여 가는 웹앱.
GitHub Pages(사이트) + Firebase(로그인 · 기록 저장)로 돌아가고, 휴대폰 홈 화면에 추가하면 앱처럼 열린다.

## 처음 한 번 설정

1. **Firebase 콘솔**
   - Authentication › 로그인 방법 › **이메일/비밀번호** 사용 설정
   - Firestore Database › 규칙 탭에 `firestore.rules` 내용을 붙여 넣고, `__EMAIL_1__`, `__EMAIL_2__` 를 두 사람 이메일(**소문자**)로 바꾼 뒤 **게시**
2. `js/firebase-config.js` 에 Firebase 웹 앱 설정을 넣는다.
3. GitHub 저장소 › Settings › Pages › Branch: `main` / `(root)` › Save
4. `https://<GitHub 아이디>.github.io/danjjakkung/` 접속 → 「처음이에요」로 각자 계정을 만들고, **메일함의 인증 링크**를 누른 뒤 이름을 정한다.
5. 아이폰은 홈 화면에 추가한 앱이 사파리와 저장 공간이 따로라서, 앱에서 한 번 더 로그인한다.

## 폴더

| 위치 | 하는 일 |
|---|---|
| `js/dates.js` `js/streak.js` `js/seasons.js` | 날짜 · 며칠차 · 연속 · 계절 계산 (화면 없음) |
| `js/themes.js` | 테마 6종 목록 · 고른 테마 저장(이 기기 localStorage) · 적용 — `<head>`에서 먼저 불러 깜빡임 없음 |
| `js/model.js` | 기록 → 화면에 보일 값 |
| `js/view.js` | 화면 그리기 (부품마다 함수 하나) |
| `js/store.js` | Firestore 읽기 · 쓰기 |
| `js/firebase.js` `js/firebase-config.js` | Firebase 연결 · 로그인 |
| `js/app.js` | 상태 · 버튼 · 알림 |
| `styles/tokens.css` | 테마별 색표(`[data-theme="<id>"]` 블록) · 글꼴 — 색은 이 파일에만. 새 테마 = 블록 하나 + themes.js 한 줄 |
| `sw.js` `manifest.webmanifest` `icons/` | 홈 화면 앱 · 오프라인 |
| `firestore.rules` | 누가 무엇을 읽고 쓸 수 있는지 |

## 확인

```
npm test          # 며칠차 · 연속 · 계절 · 그리드 계산 + 테마 색표 · 대비 (node)
npm run web       # 가짜 Firebase로 두 사람 흐름 + 오프라인 (playwright)
```

파일을 바꿔 올릴 때는 `sw.js` 의 `VERSION` 을 올린다 (휴대폰에 저장된 옛 파일을 바꾸기 위해).

글꼴: Pretendard (SIL OFL) · 아이콘: Tossface (© Viva Republica, 모양 그대로 사용) · Firebase JS SDK 10.14.1 (Apache-2.0)
