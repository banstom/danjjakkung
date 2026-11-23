# 부록 — 그림을 다시 받을 때 (Gemini)

## 받은 뒤 처리 (기획 계정이 11-23에 한 것)
1. 그림은 **100칸 격자(한 칸 10.24px)** → 칸마다 가운데 색(중앙값)을 읽어 다시 찍기
2. 비슷한 색 합치기
3. **가장자리에서 이어진** 흰 배경만 지우기 (그림 안 흰색 — 파라솔 줄 · 빙수 얼음 · 흰 송편 — 은 남김)
4. 오른쪽 아래 돌멩이 · 워터마크 구석 버리기, 6칸 미만 부스러기 버리기
5. 크림 1칸 테두리 (여름 `#FBFEFD`, 가을 `#FFFBF3`) → PNG

## 여름 (네 개 한 장)
```
A sprite sheet of 4 separate pixel art icons for a cozy summer beach theme,
arranged in a 2x2 grid with lots of empty space between them:
1) a striped beach parasol (coral and white stripes) standing in a small sand mound
2) two slices of watermelon side by side
3) a bowl of Korean patbingsu shaved ice with red beans and one strawberry on top
4) a small beach set: a coral and white swim ring, a blue sand bucket with a yellow spade, on a strip of sand

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
1-pixel dark outline (#23465A). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: sea blue #3F9AC2, deep blue #1F6A92, coral #F2917D, white #FFFFFF,
lemon #F2CE5A, mint #7DC9BC, watermelon red #EE6A6A, leaf green #5DAA5E, sand #EED9A8.
No text, no letters, no logos, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```

## 가을 (네 개 한 장)
```
A sprite sheet of 4 separate pixel art icons for a cozy autumn forest theme,
arranged in a 2x2 grid with lots of empty space between them:
1) two acorns side by side with textured brown caps
2) two ripe persimmons side by side, each with a little green leaf on top
3) one big maple leaf with a short stem
4) a small round plate of three songpyeon rice cakes (pink, white, green) with one persimmon beside the plate

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
1-pixel dark outline (#4A3020). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: maple orange #D9692F, light orange #EE9450, ginkgo yellow #E9B83E,
acorn brown #8A5A34, nut tan #C98B4F, persimmon #EE8A3C, moss #A6B46C, leaf green #6E9A45, cream #FFFBF3.
No text, no letters, no logos, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```

## 하나만 다시
```
Same pixel art style, same 32x32 grid, same palette and outline as the attached sheet.
Only draw item <번호> again: <그림 설명>.
Keep tiny dot eyes and blush. Place it slightly toward the top-left of the canvas.
In the bottom-right corner draw only one small plain gray pebble.
Plain solid pure white background (#FFFFFF), 1024x1024.
```
