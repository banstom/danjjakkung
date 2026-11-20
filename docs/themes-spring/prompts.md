# 봄소풍 그림 받기 — Gemini 지시문 (사용자용)

겨울 그림과 같은 방법이에요. **워터마크 피하기 규칙**(오른쪽 아래 구석에 버릴 돌멩이)을 꼭 붙여요.
받은 그림은 기획 계정 대화에 올려 주면 격자 맞추기 · 배경 지우기 · 크림 테두리 · 정수 배율까지 처리해서 `s1~s4.png`로 바꿔 드려요.

## 1. 네 개 한 장 (먼저 이걸로)
```
A sprite sheet of 4 separate pixel art icons for a cozy spring picnic theme,
arranged in a 2x2 grid with lots of empty space between them:
1) a small woven picnic basket with a pink and cream gingham cloth peeking out and a curved handle
2) two triangle strawberry cream sandwiches (Japanese fruit sando), cut side showing whole strawberries and white cream
3) a single cherry blossom flower with five pink petals and a yellow center, with two tiny falling petals
4) a wooden bento box with gimbap slices, two rice balls, a few strawberries and green leaves, on a pink and cream gingham cloth

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
1-pixel dark plum outline (#5A3A44). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: cherry pink #F2A9BE, deep pink #E07A98, rape-flower yellow #F3C96B,
sprout green #A5CB93, leaf green #5E9E5A, basket tan #D9A066, basket brown #A86E3A,
bread crust #E8C27E, strawberry #D9566F, seaweed #2E2128, cream white #FFFCF8.
No text, no letters, no logos, no people.
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
Plain solid pure white background (#FFFFFF), 1024x1024.
```

## 2. 한 개만 다시 받을 때
기존 시트를 첨부하고:
```
Same pixel art style, same 32x32 grid, same palette and outline as the attached sheet.
Only draw item <번호> again: <바꿀 설명>.
Keep the icon in the upper-left part of the canvas; in the bottom-right corner draw only a small gray pebble.
Plain solid pure white background (#FFFFFF), 1024x1024.
```

## 3. 받은 뒤 처리 (기획 계정이 해요)
1. 오른쪽 아래 돌멩이 · 워터마크 구석 통째로 버리기
2. 그림을 서로 떨어진 덩어리로 찾아 자르기
3. 격자(칸 크기) 맞춰 다시 찍기
4. **가장자리에서 이어진 흰색만** 배경으로 지우기 (흰 크림 · 밥이 사라지지 않게)
5. 크림 1칸 테두리 → PNG
6. 배율: S1 · S2 2배, S3 · S4 3~4배 (32칸 기준, 정수만)

## 4. 하지 않는 것
- 특정 앱 · 작가 그림체 흉내 내는 지시문
- 캐릭터 · 로고 · 글자
