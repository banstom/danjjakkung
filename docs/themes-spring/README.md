# 「몽글몽글 봄소풍」 테마 — 읽는 순서 · 단계

기획 계정에서 2026-11-19에 만든 묶음이에요. **겨울 업데이트 W1~W4가 main에 들어간 뒤에** 시작해 주세요(낮밤 모드 · 도트 스킨 · 그림 자리 · 설정 화면을 그대로 써요).

## 1. 읽는 순서
1. 이 파일 → 2. `spec.md` → 3. `design/mockups/chosen/themes-spring/index.html` → 4. `tokens-spring.css` · `pixel-skin-spring.css` · `contrast.md` → 5. `tests.md`
- `prompts.md`는 사용자용(그림 받기). 구현 계정은 읽기만

## 2. 묶음 안
```
docs/themes-spring/README.md  spec.md  tests.md  prompts.md  contrast.md
docs/themes-spring/tokens-spring.css  pixel-skin-spring.css  tools/(tokens.py · sprites.py · deco.py — 다시 만들 때)
design/assets/themes/spring-picnic/  s1~s4.png  head.svg  head-night.svg  bg.svg  bg-night.svg
design/mockups/chosen/themes-spring/  index.html  Theme-T1~T9.html  png/  assets/
```

## 3. 단계 (한 번에, 브랜치 `spring-theme`)
| 단계 | 내용 | 끝났다는 기준 |
|---|---|---|
| **S1** | 토큰 두 판 · themes.js 판 묶음 · 스킨 CSS 묶음 · 그림 8개(`assets/themes/spring-picnic/`) · 설정 화면 카드 + tests.md | 시험 통과, 목업 T1~T8과 대조, 다른 테마 스크린샷이 그대로 |

## 4. 다르게 정해야 할 때
- `spec.md` 맨 아래 `## 바뀐 것`에 한 줄씩. 그림이 바뀌면(Gemini 그림) 파일만 바꾸고 배율 표를 고쳐요
