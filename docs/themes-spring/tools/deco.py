"""머리 장식 · 바탕 무늬 SVG (판마다 파일이 따로라 색이 SVG 안에 고정 — 가이드라인 예외 그대로)"""
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')
os.makedirs(OUT, exist_ok=True)

def svg(vb, body):
    return f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='{vb}' shape-rendering='crispEdges'>{body}</svg>"

def R(x, y, w, h, f, op=None):
    o = f" opacity='{op}'" if op else ''
    return f"<rect x='{x}' y='{y}' width='{w}' height='{h}' fill='{f}'{o}/>"

def flag(x0, color, ol):
    """8칸 너비 삼각 깃발 (줄 아래 y=2부터 7칸)"""
    out = []
    for i, (a, b) in enumerate([(0, 8), (0, 8), (1, 7), (1, 7), (2, 6), (2, 6), (3, 5)]):
        y = 2 + i
        out.append(R(x0 + a, y, b - a, 1, ol))           # 외곽 줄
        if b - a > 2: out.append(R(x0 + a + 1, y, b - a - 2, 1, color))
    out.append(R(x0 + 3, 9, 2, 1, ol))                     # 뾰족 끝
    out[1] = R(x0 + 1, 2, 6, 1, color)                     # 윗변은 줄과 붙음
    return ''.join(out)

def head_day():
    ol = '#5A3A44'
    body = R(0, 0, 24, 2, '#FBF3EC') + R(0, 1, 24, 1, ol)   # 줄
    body += flag(0, '#F2A9BE', ol) + flag(8, '#FFF1C2', ol) + flag(16, '#A5CB93', ol)
    # 꽃잎 몇 장 (깃발 아래 떠 있는)
    body += R(6, 12, 2, 1, '#F2A9BE') + R(7, 11, 1, 1, '#F2A9BE') + R(19, 12, 1, 1, '#E07A98')
    return svg('0 0 24 14', body)

def head_night():
    ol = '#120E1D'
    body = R(0, 1, 24, 1, '#7A68A0')
    body += flag(0, '#D98AA2', ol) + flag(8, '#EBD9A8', ol) + flag(16, '#7FA872', ol)
    # 아래 등불 줄: 전선 + 둥근 종이 등 (노랑 · 분홍)
    body += R(0, 13, 24, 1, '#463C5E')
    for x, c, hi in [(2, '#F6D98A', '#FFF4CF'), (10, '#F2A9BE', '#FFE0EA'), (18, '#F6D98A', '#FFF4CF')]:
        body += R(x + 1, 14, 2, 1, '#463C5E') + R(x, 15, 4, 3, c) + R(x + 1, 18, 2, 1, c) + R(x + 1, 15, 1, 1, hi)
    return svg('0 0 24 20', body)

def bg_day():
    p = '#F2A9BE'
    body = R(5, 4, 2, 1, p) + R(4, 5, 2, 1, p) + R(6, 5, 1, 1, '#E07A98')       # 꽃잎 하나
    body += R(19, 17, 1, 2, p) + R(20, 18, 1, 1, p)                               # 꽃잎 둘
    body += R(24, 7, 1, 1, '#FFFFFF') + R(12, 23, 1, 1, '#FFFFFF') + R(14, 11, 1, 1, p, '.6')
    return svg('0 0 28 28', body)

def bg_night():
    body = f"<g opacity='.45'>{R(5, 4, 2, 1, '#F2A9BE') + R(4, 5, 2, 1, '#F2A9BE') + R(19, 17, 1, 2, '#F2A9BE') + R(20, 18, 1, 1, '#F2A9BE')}</g>"
    body += f"<g fill='#FFFFFF' opacity='.4'>{R(24, 7, 1, 1, '#FFFFFF') + R(12, 23, 1, 1, '#FFFFFF') + R(2, 16, 1, 1, '#FFFFFF')}</g>"
    body += R(15, 10, 1, 1, '#F6D98A', '.5')
    return svg('0 0 28 28', body)

for name, fn in [('head', head_day), ('head-night', head_night), ('bg', bg_day), ('bg-night', bg_night)]:
    open(os.path.join(OUT, f'{name}.svg'), 'w').write(fn())
    print(name, len(fn()), 'B')
