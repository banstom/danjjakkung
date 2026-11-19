# 부록 — 그림 다시 받기 · 처리

> 지금 묶음의 그림은 다 들어 있어요. 그림을 바꾸거나 새 도트 테마를 만들 때만 보면 돼요. 그림 요청은 사용자가 Gemini로 하고, 처리는 기획 계정이나 이 계정 어디서든 할 수 있어요.

## 워터마크 피하기 (모든 Gemini 요청에 붙이기)
Gemini는 그림 오른쪽 아래 구석에 반짝이(✦) 워터마크를 찍어요. 그 구석에 버릴 그림을 일부러 그리게 해요. 배경 줄 바로 앞에:
```
Layout rule: keep all 4 icons inside the top-left 80% of the canvas.
In the bottom-right corner (the last 15% of width and height), draw only one small
throwaway pixel object: a plain gray pebble. Nothing else may touch that corner.
```

## 쓴 프롬프트
### 도란도란 겨울 간식 — 네 개 한 장
```
A sprite sheet of 4 separate pixel art icons of Korean winter street snacks,
arranged in a 2x2 grid with lots of empty space between them:
1) roasted chestnuts in a small brown paper bag
2) two fish-shaped bungeoppang pastries
3) a split roasted sweet potato with a little steam
4) a small wooden tray with chestnuts, one bungeoppang, one hotteok and a mug of hot cocoa

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
1-pixel dark-brown outline (#4A3527). Each snack has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: caramel #B5743A, chestnut brown #6B3F22, toasted gold #E8B06A,
cream #FBF1E1, soft red #C9573C, pink #F2A08A.
No text, no letters, no logos, no people.
Plain solid pure white background (#FFFFFF), 1024x1024.
```
- 4번(간식 한 상)은 머그가 빨간 컵 + 얼굴로 나와서, 시트를 첨부하고 「Only draw item 4 again … a plain cream-colored mug … no face and no red color」로 다시 받았어요

### 두근두근 크리스마스 — 네 개 한 장
```
A sprite sheet of 4 separate pixel art icons for a cozy Christmas theme,
arranged in a 2x2 grid with lots of empty space between them:
1) a small Christmas tree with a gold star on top and a few red and gold ornaments
2) two gingerbread person cookies with white icing lines
3) a snowman with a red knit scarf and a small green knit hat
4) a small pile of three wrapped gift boxes with ribbons, a red Christmas stocking and a candy cane

Style: cute 32x32 pixel art, each icon drawn on a strict 32x32 pixel grid then scaled up
with hard square pixels, no anti-aliasing, no blur, no gradients.
1-pixel dark outline (#2C3A2C). Each item has tiny 1-pixel dot eyes and pink blush pixels.
Limited palette only: pine green #2F6B3A, dark pine #1D4626, light green #4E8A55,
red #B83A3A, gold #E9B949, gingerbread brown #B5743A, cream white #FFFDF7, pink #F2A08A.
No text, no letters, no logos, no people, no Santa.
Plain solid pure white background (#FFFFFF), 1024x1024.
```

## 처리 순서
1. **격자 맞추기**: 1024px 그림의 칸 크기를 잼(지금까지 10.24px = 100칸). 칸마다 가운데 40% 영역의 중앙값 색 하나로
2. **배경 지우기**: 거의 흰색(채널 최솟값 > 238) 중 **가장자리에서 이어진 것만** 투명으로 — 눈사람처럼 흰 그림 몸통을 지키려고
3. **자르기**: 서로 떨어진 그림 덩어리별로(돌멩이 · 오른쪽 아래 구석은 버림)
4. **워터마크 확인**: 오른쪽 아래에 회색 · 옅은 갈색 반짝이 모양이 남았으면 이웃 색으로 칠함
5. **크림 테두리**: 그림 바깥 1칸을 `#FFFBF3`으로 (어두운 바탕에서도 또렷하게)
6. **PNG 저장** (원본 1배, 최적화). 화면에서는 정수 배율로만 키움
