"""몽글몽글 봄소풍 — 색 토큰 두 판 + 글자 대비 계산. 실행하면 tokens-spring.css 와 contrast.md 를 써요."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))

DAY = {
    'bg': '#FBF3EC', 'surface': '#FFFCF8', 'raised': '#F7E9E4', 'line': '#EBD9D3',
    'ol': '#5A3A44', 'sh': '#E6CFC8',
    'text': '#3A2830', 'sub': '#6E5560', 'faint': '#CDB6BE',
    'primary': '#A8436A', 'on-primary': '#FFFCF8', 'btn-hi': '#C4648A', 'btn-lo': '#7E2C4B',
    'secondary': '#F7E3EA', 'accent': '#C46A8A', 'strong': '#963B5E', 'primary-edge': '#A8436A', 'tab-active': '#963B5E',
    'tint': '#FBE1EA', 'tint-text': '#82304F',
    'me': '#F3C96B', 'me-ink': '#2E2128', 'her': '#E89AB0', 'her-ink': '#2E2128', 'both': '#A5CB93', 'both-ink': '#2E2128',
    'empty': '#F1E4DF', 'empty-text': '#64505A',
    'warn': '#C62F3A', 'success': '#2E7D4F', 'warning': '#9A5B00',
    'sec-dot': '#5E9E5A', 'deco-a': '#F2A9BE', 'deco-b': '#FFF1C2',
    'today': '#3A2830', 'lv-full': '#A5CB93', 'lv-half': '#D9E8CF',
    'toast-bg': '#3A2830', 'toast-text': '#FFFCF8',
}
NIGHT = {
    'bg': '#1F1A2E', 'surface': '#2B2440', 'raised': '#372E50', 'line': '#463C5E',
    'ol': '#7A68A0', 'sh': '#120E1D',
    'text': '#FBEFF3', 'sub': '#D4C2D0', 'faint': '#5E5378',
    'primary': '#F2A9BE', 'on-primary': '#2A1621', 'btn-hi': '#FAD0DC', 'btn-lo': '#C9708F',
    'secondary': '#3A2E4A', 'accent': '#E58FA8', 'strong': '#F2A9BE', 'primary-edge': '#F2A9BE', 'tab-active': '#F7C3D2',
    'tint': '#45304A', 'tint-text': '#F7C3D2',
    'me': '#F3C96B', 'me-ink': '#2A1621', 'her': '#E89AB0', 'her-ink': '#2A1621', 'both': '#8FC07E', 'both-ink': '#2A1621',
    'empty': '#3A3152', 'empty-text': '#D4C2D0',
    'warn': '#FF7B86', 'success': '#5BD08A', 'warning': '#F2B84B',
    'sec-dot': '#9FD08F', 'deco-a': '#D98AA2', 'deco-b': '#EBD9A8',
    'today': '#FBEFF3', 'lv-full': '#8FC07E', 'lv-half': '#5F7A55',
    'toast-bg': '#FBEFF3', 'toast-text': '#2A1621',
}

# (글자, 바탕) — 앱에서 실제로 겹치는 쌍
PAIRS = [
    ('text', 'bg'), ('text', 'surface'), ('text', 'raised'), ('text', 'tint'),
    ('sub', 'bg'), ('sub', 'surface'), ('sub', 'raised'), ('sub', 'tint'),
    ('tint-text', 'tint'), ('tint-text', 'surface'), ('on-primary', 'primary'),
    ('tab-active', 'surface'), ('strong', 'surface'), ('strong', 'bg'),
    ('me-ink', 'me'), ('her-ink', 'her'), ('both-ink', 'both'), ('empty-text', 'empty'),
    ('warn', 'surface'), ('toast-text', 'toast-bg'), ('text', 'empty'),
]

def lum(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

def ratio(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)

def report():
    lines = ['# 몽글몽글 봄소풍 — 글자 대비 (WCAG, 4.5:1 이상이어야 통과)', '', '| 글자 / 바탕 | 낮 | 밤 |', '|---|---|---|']
    bad = []
    for f, b in PAIRS:
        rd, rn = ratio(DAY[f], DAY[b]), ratio(NIGHT[f], NIGHT[b])
        for name, r in (('낮', rd), ('밤', rn)):
            if r < 4.5: bad.append(f'{name} {f}/{b} {r:.2f}')
        lines.append(f'| `--{f}` / `--{b}` | {rd:.2f} | {rn:.2f} |')
    lines += ['', f'모두 {len(PAIRS)}쌍 × 2판. 4.5 미만: ' + (', '.join(bad) if bad else '없음')]
    return '\n'.join(lines), bad

def css():
    def block(sel, scheme, t):
        return f'[data-theme="{sel}"]{{color-scheme:{scheme};' + ';'.join(f'--{k}:{v}' for k, v in t.items()) + '}'
    return block('spring-picnic', 'light', DAY) + '\n' + block('spring-picnic-night', 'dark', NIGHT) + '\n'

if __name__ == '__main__':
    md, bad = report()
    open(os.path.join(HERE, 'contrast.md'), 'w').write(md + '\n')
    open(os.path.join(HERE, 'tokens-spring.css'), 'w').write('/* 몽글몽글 봄소풍 — 낮 spring-picnic / 밤 spring-picnic-night (기획 계정 2026-11-19) */\n' + css())
    print('\n'.join(md.splitlines()[-1:]))
    for f, b in PAIRS:
        print(f'{f:>11}/{b:<8} {ratio(DAY[f], DAY[b]):5.2f} {ratio(NIGHT[f], NIGHT[b]):5.2f}')
