# 부록 — 그림을 다시 받을 때 (Gemini)

## 받은 뒤 처리 (기획 계정이 11-24에 한 것)
1. 격자 크기 확인: 모두 1024×1024 · 100칸(한 칸 10.24px)
2. 칸마다 가운데 색(중앙값)을 읽어 다시 찍기 → 비슷한 색 합치기
3. **가장자리에서 이어진** 흰 배경만 지우기
4. 오른쪽 아래 돌멩이 · 워터마크 구석 버리기 (뉴욕 S4 · 발리 S4는 물 · 풀 위 워터마크 자국 몇 칸을 주변 색으로 메움. 바닷속 · 사파리 · 영화관은 자국 없음)
5. 크림 1칸 테두리 (그 테마 낮 `--surface`) → PNG
- S2는 출출 쿠키 입구라 **먹을 것**

## — 바닷속
```
A sprite sheet of 4 separate pixel art icons for a dreamy under-the-sea aquarium theme,
arranged in a 2x2 grid with lots of empty space between them:
1) a small purple jellyfish with wavy tentacles
2) two shell-shaped madeleine cakes
3) a small green sea turtle swimming
4) a tiny coral reef with pink and orange corals, seaweed and a small school of fish above it

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
Every icon uses the same chunky pixel size as the outline.
1-pixel dark outline (#173A46). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: jellyfish lavender #C7A6F2, light lavender #E2D2FA, aqua #9FE3EE, sea teal #2E8CA2, coral #F2917D, pink #F29AB8, madeleine gold #F2C98A, baked brown #D9A05A, turtle green #7FBF8E, dark green #3E8A5E, sand #E8D4A8, fish yellow #F2C14E.
No text, no letters, no numbers, no logos, no flags, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```

## — 사파리
```
A sprite sheet of 4 separate pixel art icons for a warm savanna safari theme,
arranged in a 2x2 grid with lots of empty space between them:
1) a cute lion face with a big fluffy orange mane
2) two cups of cut tropical fruit (mango and watermelon)
3) a small khaki safari jeep, seen from the side
4) a tiny savanna scene: a flat-topped acacia tree, an elephant and a big orange sunset sun

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
Every icon uses the same chunky pixel size as the outline.
1-pixel dark outline (#3A2A18). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: mane orange #C8782A, dark mane #9A5420, lion face tan #F2C98A, muzzle cream #FFF0D8, mango #F2B23A, watermelon pink #F29A9A, rind green #7FBF8E, jeep khaki #9A8A3E, dark khaki #6E6428, tire charcoal #3A3A3A, acacia brown #5A4228, elephant gray #A8A4A0, sunset orange #F29A4E, grass gold #C9B26A.
No text, no letters, no numbers, no logos, no flags, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```

## — 영화관
```
A sprite sheet of 4 separate pixel art icons for a cozy movie theater theme in red and black,
arranged in a 2x2 grid with lots of empty space between them:
1) two overlapping movie tickets (one yellow, one pink)
2) a red and white striped popcorn box next to a red soda cup with a straw
3) a small black vintage film camera with two film reels on top
4) a tiny cinema: a glowing white screen framed by red velvet curtains, with rows of red seats below

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
Every icon uses the same chunky pixel size as the outline.
1-pixel dark outline (#1A1618). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: velvet red #B3202E, dark red #7E1420, black #26222A, charcoal #3A3438, popcorn cream #FFF4D8, butter yellow #F2D48A, ticket yellow #F2C14E, ticket pink #F29AB8, screen white #F2ECE2, gold #C9A03E, white #FFFFFF.
No text, no letters, no numbers, no logos, no flags, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```
