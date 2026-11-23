# 부록 — 그림을 다시 받을 때 (Gemini)

## 받은 뒤 처리 (기획 계정이 11-23에 한 것)
1. 격자 크기부터 확인: 세 장 모두 1024×1024 · 100칸(한 칸 10.24px)
2. 칸마다 가운데 색(중앙값)을 읽어 다시 찍기 → 비슷한 색 합치기
3. **가장자리에서 이어진** 흰 배경만 지우기. 놀이공원 S1은 풍선 줄 사이 빈 곳이 줄에 둘러싸여 흰색으로 남아서 그 칸만 따로 지움
4. 오른쪽 아래 돌멩이 · 워터마크 구석 버리기
5. 크림 1칸 테두리 (그 테마 낮 `--surface`) → PNG
- S2는 출출 쿠키 입구라 **먹을 것**

## — 공항
```
A sprite sheet of 4 separate pixel art icons for a cozy airport travel theme,
arranged in a 2x2 grid with lots of empty space between them:
1) a small blue rolling suitcase with a yellow band and a handle
2) an airplane meal tray with a small sandwich and a cup of coffee
3) a small white airplane taking off diagonally upward
4) a small control tower and a runway with yellow lights, with a white airplane on the runway

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
Every icon uses the same chunky pixel size as the outline.
1-pixel dark outline (#232833). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: sky blue #9CCAF0, steel blue #5E86B8, signage yellow #F2C230, charcoal #2E3440, white #FFFFFF, light gray #C9D1DC, coral #F2A07E, bread tan #E8C58A, coffee brown #7A4A1E.
No text, no letters, no numbers, no logos, no flags, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```
## — 놀이공원
```
A sprite sheet of 4 separate pixel art icons for a sweet amusement park date theme,
arranged in a 2x2 grid with lots of empty space between them:
1) a bunch of three balloons (pink, mint, yellow) on strings
2) a pink cotton candy on a stick next to a churro
3) one carousel horse on a golden pole
4) a small ferris wheel next to a little carousel with a striped magenta roof

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
Every icon uses the same chunky pixel size as the outline.
1-pixel dark outline (#3E1F33). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: magenta #A42A72, candy pink #F29AB8, light pink #F8C4E4, mint #8ED3C4, lemon #F2CE5A, white #FFF6FA, churro tan #D9A05A, churro brown #A86A30, plum #62485A.
No text, no letters, no numbers, no logos, no flags, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```
## — 캠핑
```
A sprite sheet of 4 separate pixel art icons for a cozy camping night date theme,
arranged in a 2x2 grid with lots of empty space between them:
1) a small orange triangle tent on grass
2) two toasted marshmallows on wooden sticks
3) a small campfire with logs and flames
4) an orange tent between two pine trees with a small lantern beside it

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
Every icon uses the same chunky pixel size as the outline.
1-pixel dark outline (#2C2824). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: tent orange #D9733A, dark orange #A8502A, pine green #4E6A3A, dark pine #36502A, flame orange #F29A4E, flame yellow #F5D06A, log brown #7A4A2A, marshmallow white #FFF8EE, toasted tan #D9A05A, charcoal #4A433A.
No text, no letters, no numbers, no logos, no flags, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```

