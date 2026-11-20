"""임시 도트 그림 S1~S4 (기획 계정이 직접 찍은 자리 채움용). 진짜 그림은 Gemini 지시문(prompts.md)으로 받아 바꿔요.
규칙: 1칸 외곽선 · 점 눈 + 볼터치 · 크림 1칸 테두리 · 정수 배율만."""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'assets'); os.makedirs(OUT, exist_ok=True)

PAL = {
    '.': None,
    'o': '#5A3A44',  # 외곽선 (--ol)
    'w': '#FFFCF8',  # 크림
    'p': '#F2A9BE',  # 벚꽃
    'P': '#E07A98',  # 진한 분홍
    'y': '#F3C96B',  # 유채 노랑
    'g': '#A5CB93',  # 새싹
    'G': '#5E9E5A',  # 잎
    'b': '#D9A066',  # 바구니
    'B': '#A86E3A',  # 바구니 그늘
    'c': '#E8C27E',  # 빵 껍질
    'r': '#D9566F',  # 딸기
    'k': '#2E2128',  # 김 · 눈
    'h': '#F7B7A3',  # 볼터치
    'n': '#FFFFFF',  # 밥
}

S = {
 # S1 피크닉 바구니 (머리말 오른쪽, 16칸 × 4배 = 64px)
 'S1': [
  '................',
  '.....oooooo.....',
  '....o......o....',
  '...o..oooo..o...',
  '..oooooooooooo..',
  '.opwpwpwpwpwpwo.',
  '.owpwpwpwpwpwpo.',
  'oobbbbbbbbbbbboo',
  'obBbBbkbbkBbBbbo',
  'obbbbhbbbbhbbbbo',
  'obBbBbBbBbBbBbbo',
  '.obbbbbbbbbbbbo.',
  '..oooooooooooo..',
  '................',
 ],
 # S2 딸기 샌드위치 둘 (식탁 카드, 18칸 × 4배 = 72px)
 'S2': [
  '....o.......o.....',
  '...oco.....oco....',
  '..owwco...owwco...',
  '.owrrwco.owrrwco..',
  'owrrrrwcoowrrrrwco',
  'owwkwkwwoowwkwkwwo',
  'owhwwwhwoowhwwwhwo',
  'oooooooooooooooooo',
 ],
 # S3 벚꽃 한 송이 (빈 화면, 15칸 × 9배 = 135px)
 'S3': [
  '.....ooooo.....',
  '....oppppPo....',
  '.oooopppPPoooo.',
  'oppppoppPopppPo',
  'oppppPoPoPpppPo',
  '.oPpppoyoPPppo.',
  '..ooPPyyyoooo..',
  '.opppoyyyoPppo.',
  'oppppPoyoPppppo',
  'oppppPPoPPppppo',
  '.oooPPppppPooo.',
  '....oppPppPo...',
  '....opPooPpo...',
  '.....oo..oo....',
  '...............',
 ],
 # S4 도시락 한 상 (결산 표지, 24칸 × 6배 = 144px)
 'S4': [
  '........................',
  '..oooooooooooooooooooo..',
  '.oBBBBBBBBBBBBBBBBBBBBo.',
  '.oBooooooooooooooooooBo.',
  '.oBoknnkoknnkoorroooBBo.',
  '.oBoknynkknynkorrrroBBo.',
  '.oBoknnkoknnkoorrrroBBo.',
  '.oBoooooooooooooooooBBo.',
  '.oBownnnnwoggggggggoBBo.',
  '.oBonnknknogGgGgGggoBBo.',
  '.oBonhnnhnoggggggggoBBo.',
  '.oBownnnnwoyyyyyyyyoBBo.',
  '.oBoooooooooooooooooBBo.',
  '.oBBBBBBBBBBBBBBBBBBBBo.',
  '..oooooooooooooooooooo..',
  '....opwpwpwpwpwpwpwo....',
  '....owpwpwpwpwpwpwpo....',
  '....oooooooooooooooo....',
 ],
}
SCALE = {'S1': 4, 'S2': 4, 'S3': 8, 'S4': 6}
NAME = {'S1': '피크닉 바구니', 'S2': '딸기 샌드위치 둘', 'S3': '벚꽃 한 송이', 'S4': '도시락 한 상'}

def rgba(h):
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)

def render(key):
    rows = S[key]
    w = max(len(r) for r in rows)
    rows = [r.ljust(w, '.') for r in rows]
    img = Image.new('RGBA', (w + 2, len(rows) + 2), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if PAL[ch]: px[x + 1, y + 1] = rgba(PAL[ch])
    # 크림 1칸 테두리: 칠한 칸의 바깥 이웃(투명)을 크림으로
    cream = rgba('#FFFCF8')
    src = img.copy(); sp = src.load()
    for y in range(img.height):
        for x in range(img.width):
            if sp[x, y][3]: continue
            if any(0 <= x + dx < img.width and 0 <= y + dy < img.height and sp[x + dx, y + dy][3]
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                px[x, y] = cream
    return img

if __name__ == '__main__':
    for k in S:
        im = render(k)
        im.save(os.path.join(OUT, f'{k.lower()}.png'), optimize=True)
        im.resize((im.width * SCALE[k], im.height * SCALE[k]), Image.NEAREST).save(f'/tmp/{k}-big.png')
        print(k, im.size, '×', SCALE[k], '=', (im.width * SCALE[k], im.height * SCALE[k]), os.path.getsize(os.path.join(OUT, f'{k.lower()}.png')), 'B')
