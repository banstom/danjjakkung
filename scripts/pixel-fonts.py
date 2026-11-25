#!/usr/bin/env python3
"""픽셀 스킨 글씨 크기 표 — styles/app.css 의 font-size 를 도트 글꼴 격자에 맞춘 값으로 옮겨 styles/pixel.css 에 적는다.

도트 글꼴(Galmuri)은 고유 크기의 정수배에서만 선명하다 (docs/themes-winter/spec.md 4절).
  ~13px  → 12px  Galmuri11      (작은 글씨: 날짜 · 탭 · 보조 문구 · 꼬리표)
  14~18px → 15px  Galmuri14      (본문 · 목록 · 카드 이름 · 버튼)
  19~30px → 24px  Galmuri11 × 2  (화면 제목 · 큰 숫자)
  31px~   → 36px  Galmuri11 × 3  (아주 큰 숫자 — D-day 등)
app.css · question.css · eat.css 의 글씨 크기를 바꾸면 이 스크립트를 다시 돌린다:  python3 scripts/pixel-fonts.py
(tests/themes-winter.test.js 가 표가 최신인지 확인한다)
"""
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
APP = os.path.join(ROOT, 'styles', 'app.css')
# 기능별 스타일도 같은 표에 (v75: 교환 쪽지 · 출출 쿠키)
EXTRA = [os.path.join(ROOT, 'styles', n) for n in ('question.css', 'eat.css', 'focus.css')]  # 집중 F1 (docs/focus)
PIXEL = os.path.join(ROOT, 'styles', 'pixel.css')
START = '/* ── 글씨 크기 표 (scripts/pixel-fonts.py 가 만듦 — 손으로 고치지 않기) ── */'
END = '/* ── 글씨 크기 표 끝 ── */'
# 「글씨체: 기본」(data-font="plain")이면 표 전체가 빠져 app.css 원래 크기 · 글꼴로 돌아간다 (v61)
SKIN = '[data-skin="pixel"]:not([data-font="plain"])'
PRE = SKIN + ' '


def bucket(px):
    if px <= 13:
        return 12, 'var(--px-font-11)'
    if px <= 18:
        return 15, 'var(--px-font-14)'
    if px <= 30:
        return 24, 'var(--px-font-11)'
    return 36, 'var(--px-font-11)'


def strip_comments(s):
    return re.sub(r'/\*.*?\*/', '', s, flags=re.S)


def rules(css):
    """(media 또는 None, 선택자, 선언) — 한 단계 @media 안까지"""
    out = []
    i = 0
    n = len(css)
    while i < n:
        j = css.find('{', i)
        if j < 0:
            break
        head = css[i:j].strip()
        if head.startswith('@media') or head.startswith('@supports'):
            depth, k = 1, j + 1
            while depth and k < n:
                if css[k] == '{':
                    depth += 1
                elif css[k] == '}':
                    depth -= 1
                k += 1
            for _, sel, body in rules(css[j + 1:k - 1]):
                out.append((head, sel, body))
            i = k
            continue
        k = css.find('}', j)
        if head.startswith('@'):
            # @keyframes 등은 건너뛴다
            depth, k = 1, j + 1
            while depth and k < n:
                if css[k] == '{':
                    depth += 1
                elif css[k] == '}':
                    depth -= 1
                k += 1
            i = k
            continue
        out.append((None, head, css[j + 1:k]))
        i = k + 1
    return out


def prefix(sel):
    parts = []
    for p in sel.split(','):
        p = p.strip()
        if not p:
            continue
        if p in ('body', 'html', ':root'):
            parts.append(SKIN + ' body' if p == 'body' else SKIN)
        elif p.startswith('body'):
            parts.append(SKIN + ' ' + p)
        elif p.startswith('html'):
            parts.append(p.replace('html', 'html' + SKIN, 1))
        else:
            parts.append(PRE + p)
    return ', '.join(parts)


def build():
    css = '\n'.join(strip_comments(open(f, encoding='utf8').read()) for f in [APP] + [e for e in EXTRA if os.path.exists(e)])
    lines = [START]
    for media, sel, body in rules(css):
        m = re.search(r'font-size:\s*(\d+(?:\.\d+)?)px', body)
        ls = re.search(r'letter-spacing:\s*[^;]+', body)
        if not m and not ls:
            continue
        decl = []
        if m:
            size, fam = bucket(float(m.group(1)))
            decl.append('font-size: %dpx; font-family: %s;' % (size, fam))
        if ls:
            decl.append('letter-spacing: 0;')
        rule = '%s { %s }' % (prefix(sel), ' '.join(decl))
        lines.append(('%s { %s }' % (media, rule)) if media else rule)
    lines.append(END)
    return '\n'.join(lines)


def main():
    table = build()
    s = open(PIXEL, encoding='utf8').read()
    a, b = s.find(START), s.find(END)
    if a < 0 or b < 0:
        sys.exit('styles/pixel.css 에 글씨 크기 표 자리 표시가 없어요')
    new = s[:a] + table + s[b + len(END):]
    if '--check' in sys.argv:
        sys.exit(0 if new == s else 1)
    open(PIXEL, 'w', encoding='utf8').write(new)
    print('글씨 크기 표', table.count('\n') - 1, '줄')


if __name__ == '__main__':
    main()
