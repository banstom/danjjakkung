# 부록 — 그림을 다시 받을 때 (Gemini)

## 받은 뒤 처리 (기획 계정이 11-23에 한 것)
1. 격자 찾기: 기차는 1024×1024 · 100칸(한 칸 10.24px). 천문대는 1024×572로 와서 한 칸 4.27px — **처음 찾은 값(8.53px)의 절반**이 맞았음. 다시 받으면 격자 크기부터 확인
2. 칸마다 가운데 색(중앙값)을 읽어 다시 찍기 → 비슷한 색 합치기
3. **가장자리에서 이어진** 흰 배경만 지우기
4. 오른쪽 아래 돌멩이 · 워터마크 구석 버리기 (천문대 시트에 더 그려진 별똥별도 뺌)
5. 크림 1칸 테두리 (천문대 `#FCFBFF`, 기차 `#FFFCF5`) → PNG
- S2는 출출 쿠키 입구라 **먹을 것**이어야 함

## — 천문대
```
A sprite sheet of 4 separate pixel art icons for a calm, dreamy stargazing observatory theme,
arranged in a 2x2 grid with lots of empty space between them:
1) a small telescope on a little tripod, pointing up to the right
2) two butter cookies side by side: one star-shaped cookie and one crescent-moon-shaped cookie, with a little lavender icing
3) a sleeping crescent moon with closed eyes and two tiny stars beside it
4) a small round observatory dome building with a slit opening, a little door, and a few twinkling stars above it

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
1-pixel dark outline (#2E2A55). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: deep indigo #3B3577, violet #5446A0, lavender #B3A5EE, pale lavender #D9D0FA,
star gold #F2D27A, dark gold #D9AE45, cookie tan #E8C27A, soft pink #E9A3BC, sky blue #9EC3EC, light gray #C9C6DA.
No text, no letters, no logos, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```
## — 기차 여행
```
A sprite sheet of 4 separate pixel art icons for a cozy retro train trip theme,
arranged in a 2x2 grid with lots of empty space between them:
1) a small cute retro train engine seen from the front, teal body with a burgundy stripe and round headlights
2) a wide Korean train lunch box (dosirak) seen from above, with rice, a rolled egg and greens in compartments
3) one cream paper train ticket with a burgundy band and a round stamp with a check mark on it
4) a short teal retro train with a burgundy stripe running on rails past two small green hills

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
1-pixel dark outline (#2F3A36). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: teal #22666A, light teal #3C8387, burgundy #9C3B45, cream #FFF4DC,
mustard #E9B949, wood brown #8A5A34, rail gray #8F948E, window sky #AED8E6, hill green #8FB57A, white #FFFFFF.
No text, no letters, no numbers, no logos, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```
- 하나만 다시 받기: 마음에 드는 시트를 첨부하고 `Same pixel art style, same 32x32 grid, same palette and outline as the attached sheet. Only draw item <번호> again: <설명>. ... bottom-right gray pebble ... white background`

