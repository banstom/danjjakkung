#!/usr/bin/env python3
"""토스페이스 글꼴 묶음 다시 만들기 — 앱에서 쓰는 이모지만 잘라 fonts/tossface-NN.woff2 로.

  쓰는 법 (토스페이스 원본이 있는 곳에서):
    git clone --depth 1 https://github.com/toss/tossface /tmp/tossface
    pip install fonttools brotli
    python3 scripts/tossface-subset.py /tmp/tossface/dist

  끝나면 styles/tokens.css 에 넣을 @font-face 줄과 sw.js 에 넣을 파일 목록을 출력한다.
  새 이모지를 쓰게 되면 아래 USED 에 더하고 다시 돌린다.
"""
import glob
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

USED = {
    # 루틴 아이콘 (js/icons.js ROUTINE_ICONS) + 계절 (js/seasons.js)
    'routine': '🦵🎾🏃💪🧘🚴🏊⚽📚📝💧🥗😴🧹🎸🌱🌸🌻🍁⛄',
    # 시간표 카테고리 아이콘 (js/cats.js ICONS)
    'cats': '📚📝📖🎓💻🧪🩺🧠🏃🎾⚽💪🧘🚴🏊⛳💼💰🍚🍜☕🍻🎬🎮🎵🎸🛒🏠🧹😴🚌🏥💊🐶🎂🎉💞📌📅⭐',
    # 그 밖에 화면 · 알림 글에 쓰는 것
    'etc': '🙏👏🔥🏆🎯🎉📅🌿🗓',
}
VS16 = 0xFE0F  # 이모지 모양으로 보이게 하는 문자 (각 묶음에 같이 넣는다)


def main(src, out='fonts'):
    chunks = {}
    for f in sorted(glob.glob(os.path.join(src, 'TossFaceFontMac-*.woff2'))):
        chunks[f[-8:-6]] = (f, set(TTFont(f).getBestCmap()))
    if not chunks:
        sys.exit('토스페이스 원본(TossFaceFontMac-NN.woff2)을 찾지 못했어요: ' + src)

    want = []
    for s in USED.values():
        for ch in s:
            if ord(ch) not in want:
                want.append(ord(ch))

    by_chunk, missing = {}, []
    for cp in want:
        hit = [k for k, (_, cm) in chunks.items() if cp in cm]
        if hit:
            by_chunk.setdefault(hit[0], []).append(cp)
        else:
            missing.append(chr(cp))
    if missing:
        print('토스페이스에 없는 이모지:', ' '.join(missing))

    for old in glob.glob(os.path.join(out, 'tossface-*.woff2')):
        os.remove(old)
    css, files = [], []
    for k in sorted(by_chunk):
        cps = sorted(by_chunk[k])
        path, _ = chunks[k]
        dst = os.path.join(out, 'tossface-%s.woff2' % k)
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['*']
        opts.notdef_outline = False
        font = TTFont(path)
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=cps + [VS16])
        sub.subset(font)
        font.flavor = 'woff2'
        font.save(dst)
        rng = ', '.join('U+%X' % c for c in cps)
        css.append("@font-face { font-family: 'Tossface'; src: url('../fonts/tossface-%s.woff2') format('woff2'); unicode-range: %s; }" % (k, rng))
        files.append("'fonts/tossface-%s.woff2'" % k)
        print('%s  %2d개  %6d bytes  %s' % (dst, len(cps), os.path.getsize(dst), ''.join(chr(c) for c in cps)))
    print('\n/* tokens.css */')
    print('\n'.join(css))
    print('\n/* sw.js FILES */')
    print(', '.join(files))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'fonts')
