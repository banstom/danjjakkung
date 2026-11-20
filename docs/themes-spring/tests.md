# 봄소풍 테마 — 시험 목록 (겨울 tests.md의 A · B 묶음에 더하기)

- SP1 `spring-picnic`을 고르면 모드 auto → 시스템 밝기 따라 `spring-picnic` / `spring-picnic-night`, 고정하면 그 판
- SP2 판 두 개 모두 토큰이 빠짐없이 정의됨 (겨울 판과 같은 토큰 목록, 빈 값 없음)
- SP3 글자 대비 21쌍 × 2판 4.5:1 이상 (`contrast.md` 표를 시험 코드로)
- SP4 봄소풍이 아닐 때 `assets/themes/spring-picnic/` 파일을 하나도 내려받지 않음 (네트워크 기록)
- SP5 그림 S1~S4가 정수 배율로만 그려짐 (`naturalWidth × n = width`), `image-rendering: pixelated`
- SP6 색 하드코딩 검사: 봄소풍 CSS 묶음에서 hex는 체크 무늬 rgba와 밤 점선 `#4B4166`뿐 (겨울과 같은 예외 목록에 추가)
- SP7 다른 테마(14개 + 겨울 4판) 스크린샷이 이전과 픽셀 단위로 같음
- SP8 밤에 앱을 열 때 낮 판이 한 프레임도 보이지 않음 (겨울 시험 재사용)
- SP9 320 · 375px에서 머리 장식 반복이 끊기지 않고, 밤 판 머리말이 등 줄에 가려지지 않음
- SP10 설정 화면 카드: 이름 「몽글몽글 / 봄소풍」 낱말 단위 줄바꿈(`keep-all`), 꼬리표 `낮·밤` `NEW`
