# 부록 — 그림을 다시 받을 때 (Gemini)

## 받은 뒤 처리 (기획 계정이 11-23에 한 것)
1. **격자 크기부터 확인**: 테니스 · 포르투 · 토스카나 = 1024×1024 · 100칸(한 칸 10.24px). **프라하 = 한 칸 5.12px**(외곽선은 굵고 안쪽만 잘게) → 5.12px로 찍고 배율을 절반으로
2. 칸마다 가운데 색(중앙값)을 읽어 다시 찍기 → 비슷한 색 합치기
3. **가장자리에서 이어진** 흰 배경만 지우기 (파라솔 줄처럼 그림 안 흰색은 남김)
4. 오른쪽 아래 돌멩이 · 워터마크 구석 버리기. 토스카나 S4는 워터마크(✦)가 언덕에 겹쳐 와서 그 칸을 언덕 색 · 외곽선으로 칠함
5. 크림 1칸 테두리 (그 테마 낮 `--surface`) → PNG
- S2는 출출 쿠키 입구라 **먹을 것**
- 프라하를 다시 받으면 Style 줄에 `every icon uses the same chunky pixel size as the outline` 추가

## — 테니스
```
A sprite sheet of 4 separate pixel art icons for a sunny tennis court theme,
arranged in a 2x2 grid with lots of empty space between them:
1) a tennis racket with a lime tennis ball beside it
2) a small bowl of strawberries and whipped cream
3) a small gold trophy cup with two handles
4) a wooden courtside bench with a water bottle, a folded towel and a racket on it

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
1-pixel dark outline (#24361F). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: tennis-ball lime #C9E04A, dark lime #8FA82A, court green #3F7A3A, grass green #5E9E58, white #FFFFFF, strawberry red #E65A5A, gold #F2C94C, dark gold #C9962E, wood #B07A48, sky blue #7FB8E0.
No text, no letters, no numbers, no logos, no flags, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```
## — 포르투
```
A sprite sheet of 4 separate pixel art icons for a cozy Porto, Portugal city theme,
arranged in a 2x2 grid with lots of empty space between them:
1) a small yellow vintage tram, front view
2) two Portuguese egg tarts (pastel de nata) side by side, with caramelized spots on top
3) one square blue-and-white azulejo tile with a symmetrical flower pattern
4) a row of small colorful riverside houses with orange roofs, an iron arch bridge behind them, and the river in front

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
1-pixel dark outline (#1E2C55). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: cobalt blue #2B4E9E, light cobalt #8FB0F5, tile white #FCFDFF, tram yellow #F2C14E, dark gold #C9962E, roof orange #D9773F, coral #EE9A6E, tart crust #B9762E, river blue #4A6AB8, sage green #A9C9A0.
No text, no letters, no numbers, no logos, no flags, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```
## — 프라하
```
A sprite sheet of 4 separate pixel art icons for a fairytale Prague old town theme,
arranged in a 2x2 grid with lots of empty space between them:
1) a small stone clock tower with a round gold-and-blue astronomical clock face
2) two trdelnik chimney cakes (spiral pastry tubes) dusted with sugar, side by side
3) a small castle with two dark slate gothic spires with gold tips and a terracotta roof in the middle
4) a stone bridge with arches over a river, with a row of small houses with terracotta and slate roofs behind it

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
1-pixel dark outline (#2A2F3A). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: slate #3F4E66, light slate #7F8EA8, terracotta roof #C8623C, gold #E8BE55, stone beige #D8D2C4, pastry tan #D9A05A, pastry brown #A86A30, sugar white #FFF6E0, river blue #8FB5E8.
No text, no letters, no numbers, no logos, no flags, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```
## — 토스카나
```
A sprite sheet of 4 separate pixel art icons for a sunny Tuscany countryside theme,
arranged in a 2x2 grid with lots of empty space between them:
1) two tall cypress trees on a small rolling green hill
2) two gelato cones side by side, one strawberry pink and one pistachio green
3) one big sunflower with a short stem and two leaves
4) a small stone farmhouse with a terracotta roof on a rolling hill, with cypress trees beside it

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
1-pixel dark outline (#33361C). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: olive #5C6B24, cypress green #3E6A30, dark cypress #2C4E22, hill green #A9BC6E, sunflower yellow #F2C94C, seed brown #7A4A1E, terracotta #D9805A, stone beige #EAD9B4, gelato pink #F2B8C6, pistachio #C9E08A, cone tan #D9A05A.
No text, no letters, no numbers, no logos, no flags, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```
- 하나만 다시 받기: 마음에 드는 시트를 첨부하고 `Same pixel art style, same 32x32 grid, same palette and outline as the attached sheet. Only draw item <번호> again: <설명>. ... bottom-right gray pebble ... white background`

