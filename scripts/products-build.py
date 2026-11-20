# 식약처 가공식품(API로 받은 processed.jsonl.gz, 32만 건) → functions/data/products-kr.tsv.gz (findProduct 검색용)
#   python3 scripts/products-build.py ~/nutri/processed.jsonl.gz functions/data/products-kr.tsv.gz
# 한 줄 = 이름 · 제조사 · 기준 단위(g|ml) · 기준량 · kcal · 탄수 · 단백질 · 지방 · 1회 제공량 · 내용량 (같은 이름 · 제조사는 최신 것만)
import gzip, json, re, sys, collections
src, dst = sys.argv[1], sys.argv[2]
rows = {}
bases = collections.Counter(); skip = collections.Counter()
def num(x):
    try: return round(float(str(x).replace(',', '')), 2)
    except: return None
def amt(s):
    m = re.match(r'^\s*([\d.]+)\s*(g|ml|mL|ML|G)\s*$', str(s or ''))
    return (float(m.group(1)), m.group(2).lower()) if m else (None, None)
for line in gzip.open(src, 'rt', encoding='utf-8'):
    d = json.loads(line)
    nm = re.sub(r'\s+', ' ', (d.get('foodNm') or '').replace('﻿', '')).strip()
    if not nm: skip['name'] += 1; continue
    base, bu = amt(d.get('nutConSrtrQua'))
    bases[str(d.get('nutConSrtrQua'))[:12]] += 1
    k = num(d.get('enerc'))
    if base is None or k is None: skip['base/kcal'] += 1; continue
    sv, su = amt(d.get('servSize')); fs, fu = amt(d.get('foodSize'))
    mk = re.sub(r'\s+', ' ', (d.get('mfrNm') or d.get('imptNm') or '').strip())
    if mk in ('해당없음',): mk = ''
    rec = [nm, mk[:40], bu, base, k, num(d.get('chocdf')) or 0, num(d.get('prot')) or 0, num(d.get('fatce')) or 0, sv or '', fs or '', d.get('crtrYmd') or '']
    key = (nm, re.sub(r'[\s()]', '', mk.replace('㈜', '(주)')))  # (주)농심 = ㈜농심
    if key not in rows or rows[key][-1] < rec[-1]: rows[key] = rec
out = gzip.open(dst, 'wt', encoding='utf-8', compresslevel=9)
for r in sorted(rows.values(), key=lambda r: r[0]):
    out.write('\t'.join(str(x).replace('\t', ' ') for x in r[:-1]) + '\n')
out.close()
print(len(rows), dict(skip), bases.most_common(6), file=sys.stderr)
