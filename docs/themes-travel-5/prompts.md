# 부록 — 그림을 다시 받을 때 (Gemini)

## 받은 뒤 처리 (기획 계정이 11-24에 한 것)
1. 격자 크기 확인: 모두 1024×1024 · 100칸(한 칸 10.24px)
2. 칸마다 가운데 색(중앙값)을 읽어 다시 찍기 → 비슷한 색 합치기
3. **가장자리에서 이어진** 흰 배경만 지우기
4. 오른쪽 아래 돌멩이 · 워터마크 구석 버리기 (뉴욕 S4 · 발리 S4는 물 · 풀 위 워터마크 자국 몇 칸을 주변 색으로 메움)
5. 크림 1칸 테두리 (그 테마 낮 `--surface`) → PNG
- S2는 출출 쿠키 입구라 **먹을 것**

## — 뉴욕
```
A sprite sheet of 4 separate pixel art icons for a cozy New York city trip theme,
arranged in a 2x2 grid with lots of empty space between them:
1) a small art deco skyscraper with a pointed spire
2) a sesame bagel next to a soft pretzel
3) a small yellow taxi car, seen from the side, with a blank roof light
4) a tiny scene: a green torch-holding statue on a pedestal next to a skyline of tall buildings with lit windows, water in front

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
Every icon uses the same chunky pixel size as the outline.
1-pixel dark outline (#22302E). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: stone beige #D8D0C0, dark stone #A89C88, window blue #9CCAF0, patina green #6FAE9C, dark patina #4E8A7E, taxi yellow #F2C230, bagel tan #D9A05A, light tan #F2D29A, pretzel brown #A86A30, building gray #7A8A94, charcoal #3A3A3A, sea blue #3D7FB8.
No text, no letters, no numbers, no logos, no flags, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```

## — 시드니
```
A sprite sheet of 4 separate pixel art icons for a sunny Sydney Australia trip theme,
arranged in a 2x2 grid with lots of empty space between them:
1) a small smiling quokka sitting up
2) two chocolate-coated biscuits next to a small golden meat pie
3) a small kangaroo hopping happily
4) a tiny Sydney harbour scene: a white shell-roofed opera house and an arch bridge over blue water

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
Every icon uses the same chunky pixel size as the outline.
1-pixel dark outline (#3A2A26). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: sand #E8C58A, quokka brown #A8784A, light brown #D9A878, sky blue #9CCAF0, sea blue #3D7FB8, white #FFFFFF, coral #E8825E, eucalyptus green #7FA898, chocolate #5A3A26, pie crust #D9A05A, warm gray #C8BEB6.
No text, no letters, no numbers, no logos, no flags, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```

## — 발리
```
A sprite sheet of 4 separate pixel art icons for a relaxing Bali island resort theme,
arranged in a 2x2 grid with lots of empty space between them:
1) a small split stone temple gate with two white and yellow frangipani flowers in front
2) a small plate of fried rice with a fried egg on top, next to a green coconut with a straw
3) a small palm tree with a woven hammock hanging from it
4) a tiny scene of green rice terraces with a palm tree and a small stone temple roof

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
Every icon uses the same chunky pixel size as the outline.
1-pixel dark outline (#3A3022). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: stone taupe #9A8A74, dark stone #6E604E, frangipani white #FFFFFF, frangipani yellow #F2C14E, pink #E07AA0, jungle green #4E7A3E, leaf green #8AB86A, rice brown #C98A4A, egg white #FFF8EE, coconut brown #7A5A2A, rattan tan #C9A26A.
No text, no letters, no numbers, no logos, no flags, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```

## — 카이로
```
A sprite sheet of 4 separate pixel art icons for a warm Cairo Egypt desert trip theme,
arranged in a 2x2 grid with lots of empty space between them:
1) a small pyramid with an orange sun beside it
2) a blue bowl of rice and lentils topped with tomato sauce and crispy onions, next to three dates
3) a small standing camel with a blue and gold blanket on its back
4) a tiny scene: two pyramids, a palm tree, and a small white-sailed boat on a blue river

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
Every icon uses the same chunky pixel size as the outline.
1-pixel dark outline (#3A2E18). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: sand gold #E0B86A, dark sand #C9A24A, light sand #E8D4A8, sun orange #F29A4E, lapis blue #2F4C9A, lentil brown #C98A4A, onion brown #8A5A2A, date brown #7A3A1E, camel tan #E8C890, river blue #3D7FB8, sail white #FFFFFF, palm green #5E8A3A.
No text, no letters, no numbers, no logos, no flags, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```

## — 과나후아토
```
A sprite sheet of 4 separate pixel art icons for a colorful Guanajuato Mexico city trip theme,
arranged in a 2x2 grid with lots of empty space between them:
1) a small cactus in a terracotta pot with one pink flower
2) two tacos with meat, lettuce and tomato
3) a colorful star-shaped pinata with seven points
4) a tiny hillside of stacked colorful houses (pink, yellow, teal, orange, mint, purple) with a small yellow church dome on top

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
Every icon uses the same chunky pixel size as the outline.
1-pixel dark outline (#3A1E2C). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: mexican pink #C21F6A, light pink #F29AC8, sunny yellow #F2C14E, teal #2E9AA0, orange #F29A4E, mint #7FCFC0, purple #9B6AD0, cactus green #5E9A5A, dark green #3E7A3E, terracotta #C8603E, tortilla #F2D48A, meat brown #A8582A, lettuce #7FBF5A, dome gold #E8A23A.
No text, no letters, no numbers, no logos, no flags, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```
