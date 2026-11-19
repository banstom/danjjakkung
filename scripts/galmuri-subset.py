#!/usr/bin/env python3
"""도트 테마 글꼴(Galmuri, SIL OFL 1.1)을 자주 쓰는 글자만 잘라 fonts/galmuri/ 에 woff2 로 만든다.

담는 글자: KS X 1001 한글 2350자 + 앱 코드(js · index.html · functions)에 나오는 한글 + 영문 · 숫자 · 자주 쓰는 기호.
담지 않은 글자(드문 한글 · 이모지)는 글꼴 목록의 다음 글꼴(Pretendard · Tossface)로 그려진다.

  npm pack galmuri && tar xzf galmuri-*.tgz      # package/dist/*.ttf
  pip install fonttools brotli
  python3 scripts/galmuri-subset.py package/dist
"""
import glob
import os
import subprocess
import sys
import tempfile

ROOT = os.path.join(os.path.dirname(__file__), '..')
FACES = ['Galmuri11', 'Galmuri11-Bold', 'Galmuri14']
EXTRA = '·…「」『』‹›«»↑↓←→↕↔★☆♥♡○●◎◇◆□■△▲▽▼※✓✔×÷±°′″℃％～〜¡¿–—‘’“”•‧∙―─│┼▶◀♪♬☀☁☂☃❄✿❀♣♠♦'


def chars():
    out = set()
    for b1 in range(0xB0, 0xC9):
        for b2 in range(0xA1, 0xFF):
            try:
                out.add(bytes([b1, b2]).decode('euc-kr'))
            except UnicodeDecodeError:
                pass
    for f in glob.glob(os.path.join(ROOT, 'js', '*.js')) + glob.glob(os.path.join(ROOT, 'functions', '*.js')) + [os.path.join(ROOT, 'index.html')]:
        for ch in open(f, encoding='utf8').read():
            if '가' <= ch <= '힣' or 'ㄱ' <= ch <= 'ㆎ':
                out.add(ch)
    out.update(chr(c) for c in range(0x20, 0x7F))
    out.update(chr(c) for c in range(0xA0, 0x100))
    out.update(EXTRA)
    return ''.join(sorted(out))


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    dst = os.path.join(ROOT, 'fonts', 'galmuri')
    os.makedirs(dst, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', encoding='utf8', suffix='.txt', delete=False) as t:
        t.write(chars())
    for face in FACES:
        subprocess.run(['pyftsubset', os.path.join(src, face + '.ttf'), '--text-file=' + t.name, '--flavor=woff2',
                        '--output-file=' + os.path.join(dst, face + '.woff2'), '--layout-features=*', '--no-hinting'], check=True)
        print(face, os.path.getsize(os.path.join(dst, face + '.woff2')), 'bytes')
    os.unlink(t.name)


if __name__ == '__main__':
    main()
