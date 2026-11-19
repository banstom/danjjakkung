#!/usr/bin/env python3
"""식약처 전국통합식품영양성분정보(원재료성식품 · 음식) CSV → 앱 식품표 data/foods-kr.json

  python3 -I scripts/foods-build.py 원재료성식품.csv 음식.csv

- 한 줄 = [이름, 종류(r 원재료 · d 음식), 기준(g · ml), kcal, 탄수, 단백질, 지방, 1인분 g|ml 또는 0]  (100g · 100ml 당)
- 같은 이름이 여러 번 있으면 값을 평균 (시기 · 산지별 분석값) · kcal 이 없는 줄은 버림 · 빈 탄단지는 0
- 원본 CSV 는 cp949 (공공데이터포털 그대로)
"""
import csv, json, sys, os, collections

EXTRA = [  # [kcal, carb, protein, fat]
    ('카놀라유', [884, 0, 0, 100]), ('올리브유', [884, 0, 0, 100]), ('식용유', [884, 0, 0, 100]), ('콩기름', [884, 0, 0, 100]),
    ('해바라기유', [884, 0, 0, 100]), ('코코넛오일', [892, 0, 0, 99.1]), ('버터', [717, 0.1, 0.9, 81.1]), ('마가린', [717, 0.7, 0.2, 80.7]),
]

def f(x):
    try: return float(str(x).strip())
    except Exception: return None

def rows(path):
    with open(path, encoding='cp949', newline='') as fp:
        yield from csv.DictReader(fp)

def main(paths):
    groups = collections.OrderedDict()
    for p in paths:
        for r in rows(p):
            code = r.get('식품코드', '')
            kind = 'r' if code.startswith('R') else 'd' if code.startswith('D') else None
            if not kind: continue
            name = (r.get('식품명') or '').strip()
            kcal = f(r.get('에너지(kcal)'))
            if not name or kcal is None: continue
            base = 'ml' if (r.get('영양성분함량기준량') or '').strip().endswith('ml') else 'g'
            serve = f((r.get('식품중량') or '').replace('ml', '').replace('g', '')) if kind == 'd' else None
            key = (name, kind, base)
            g = groups.setdefault(key, {'n': 0, 'v': [0, 0, 0, 0], 'serve': []})
            g['n'] += 1
            for i, col in enumerate(['에너지(kcal)', '탄수화물(g)', '단백질(g)', '지방(g)']):
                g['v'][i] += f(r.get(col)) or 0
            if serve and 0 < serve < 5000: g['serve'].append(serve)
    items = []
    for (name, kind, base), g in groups.items():
        v = [round(x / g['n'], 1) for x in g['v']]
        serve = round(sorted(g['serve'])[len(g['serve']) // 2]) if g['serve'] else 0
        items.append([name, kind, base] + v + [serve])
    # 식약처 음식 · 원재료 표에 없는 흔한 기름 (가공식품이라 빠짐) — 100g 당 표준값 (USDA FoodData Central). 이름이 이미 있으면 넣지 않음
    have = {x[0] for x in items}
    for n, v in EXTRA:
        if n not in have: items.append([n, 'r', 'g'] + v + [0])
    items.sort(key=lambda x: (x[1], x[0]))
    out = {'v': 1, 'source': '식품의약품안전처 전국통합식품영양성분정보 (원재료성식품 · 음식) 표준데이터 + 흔한 기름 8가지 (USDA 표준값)',
           'cols': ['name', 'kind', 'base', 'kcal', 'carb', 'protein', 'fat', 'serve'], 'items': items}
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'foods-kr.json')
    with open(root, 'w', encoding='utf-8') as w:
        json.dump(out, w, ensure_ascii=False, separators=(',', ':'))
    print(len(items), '개 →', os.path.getsize(root), 'bytes')

if __name__ == '__main__':
    main(sys.argv[1:])
