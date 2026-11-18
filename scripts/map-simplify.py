#!/usr/bin/env python3
"""단짝 지도 데이터 줄이기 (v48).
원본 kr-map.json(예전 앱 「여기에 마음을 두고왔어」 MAPS.kr, 약 490KB) → data/kr-map.json.
화면에 보이는 크기가 350px 정도라 경로를 RDP 0.7 + 정수 좌표로 줄여도 겉보기 차이가 거의 없다.
너무 작아 점이 되는 조각(정수로 3점 미만)은 빼되, 지역마다 가장 큰 조각 하나는 남긴다(섬 지역도 누를 수 있게).
그 밖에 지역마다 화면 칠하기 · 미리보기에 쓰는 가운데 점 cx, cy(가장 큰 조각의 넓이 중심)를 붙인다.

  python3 scripts/map-simplify.py <원본 kr-map.json> data/kr-map.json
"""
import json, re, sys

EPS = 0.7


def parse(d):
    rings, cur = [], None
    for cmd, xs in re.findall(r'([MLZ])([^MLZ]*)', d):
        nums = [float(v) for v in re.findall(r'-?\d+(?:\.\d+)?', xs)]
        if cmd == 'M':
            cur = [(nums[0], nums[1])]
            rings.append(cur)
            for i in range(2, len(nums), 2): cur.append((nums[i], nums[i + 1]))
        elif cmd == 'L':
            for i in range(0, len(nums), 2): cur.append((nums[i], nums[i + 1]))
    return rings


def rdp(pts, eps):
    if len(pts) < 3: return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    n = (dx * dx + dy * dy) ** 0.5
    best, idx = -1, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        dist = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / n if n else ((px - x1) ** 2 + (py - y1) ** 2) ** 0.5
        if dist > best: best, idx = dist, i
    if best > eps:
        return rdp(pts[:idx + 1], eps)[:-1] + rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]


def area(r):
    return sum(r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1] for i in range(len(r))) / 2


def centroid(r):
    a = area(r)
    if abs(a) < 1e-9:
        return sum(p[0] for p in r) / len(r), sum(p[1] for p in r) / len(r)
    cx = cy = 0
    for i in range(len(r)):
        x0, y0 = r[i]; x1, y1 = r[(i + 1) % len(r)]
        f = x0 * y1 - x1 * y0
        cx += (x0 + x1) * f; cy += (y0 + y1) * f
    return cx / (6 * a), cy / (6 * a)


def simplify_ring(r, closed=True):
    pts = r[:-1] if closed and len(r) > 1 and r[0] == r[-1] else r
    s = rdp(pts + [pts[0]], EPS)[:-1] if closed else rdp(pts, EPS)
    out = []
    for x, y in s:
        p = (round(x), round(y))
        if not out or out[-1] != p: out.append(p)
    if closed and len(out) > 1 and out[0] == out[-1]: out.pop()
    return out


def to_d(rings, closed=True):
    return ''.join('M' + 'L'.join('%d %d' % p for p in r) + ('Z' if closed else '') for r in rings)


def shrink(d, closed=True, keep_biggest=True):
    rings = parse(d)
    if not rings: return '', None
    big = max(rings, key=lambda r: abs(area(r))) if closed else None
    out = []
    for r in rings:
        s = simplify_ring(r, closed)
        if len(s) >= (3 if closed else 2): out.append(s)
        elif keep_biggest and r is big:
            x, y = centroid(r)  # 섬처럼 작아 사라지면 작은 세모로라도 남긴다
            out.append([(round(x), round(y) - 1), (round(x) + 1, round(y) + 1), (round(x) - 1, round(y) + 1)])
    return to_d(out, closed), (centroid(big) if big else None)


def main(src, dst):
    m = json.load(open(src, encoding='utf-8'))
    regions = []
    for r in m['regions']:
        d, c = shrink(r['d'])
        regions.append({'c': r['c'], 'n': r['n'], 's': r['s'], 'd': d, 'x': round(c[0]), 'y': round(c[1])})
    out = {
        'id': m['id'], 'W': m['W'], 'H': m['H'], 'version': m['version'], 'source': m['source'],
        'groups': m['groups'], 'regions': regions,
        'groupBorder': shrink(m['groupBorder'], closed='Z' in m['groupBorder'], keep_biggest=False)[0],
        'context': [{'id': c['id'], 'd': shrink(c['d'], keep_biggest=False)[0]} for c in m['context']],
        'labels': [{'t': l['t'], 'p': [round(l['p'][0]), round(l['p'][1])]} for l in m['labels']],
    }
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
