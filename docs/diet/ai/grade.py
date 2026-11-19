#!/usr/bin/env python3
"""단짝 식탁 시험 A 채점 — tests.md 「꼭 맞아야 하는 값」. python3 grade.py run1 run2 run3"""
import json, sys, os, re

def load(run, case):
    p = os.path.join('/tmp/diet-ai', run, case + '.json')
    try:
        t = open(p, encoding='utf-8').read().strip()
        t = re.sub(r'^```(json)?|```$', '', t).strip()
        return json.loads(t)
    except Exception as e:
        return {'_error': str(e)}

def S(x): return json.dumps(x, ensure_ascii=False)
def num(x):
    try: return float(x)
    except Exception: return None
def key(it): return ((it.get('match') or {}).get('key') or '')
def kind(it): return ((it.get('match') or {}).get('kind') or '')
def find(items, pat): return [i for i in items if re.search(pat, i.get('name', ''))]
def width(u):
    r = u.get('kcalRange') or [0, 0]
    try: return float(r[1]) - float(r[0])
    except Exception: return 0
def asked(d):  # 앱의 질문 고르기: 폭 80 이상, 최대 3개
    us = sorted([u for u in d.get('unknowns', []) if width(u) >= 80], key=width, reverse=True)
    return us[:3]
def nums_in(o):  # 영양 숫자를 냈는지
    return re.search(r'"(kcal|carb|protein|fat|calories|탄수|단백질|지방)"\s*:', S(o))

def checks(case, d):
    c = []
    def ok(name, cond): c.append((name, bool(cond)))
    if '_error' in d: return [('JSON 읽기', False)]
    ok('영양 숫자를 안 냄', not nums_in({k: v for k, v in d.items() if k != 'unknowns'}))
    meals = d.get('meals') or []
    m = meals[0] if meals else {}
    items = m.get('items') or []
    if case == 'T1':
        ok('날짜 2026-11-17', d.get('date') == '2026-11-17')
        ok('끼니 1개 08:20 meal', len(meals) == 1 and m.get('at') == '08:20' and m.get('kind') == 'meal')
        ok('항목 3개 (재료 줄이 따로 항목 아님)', len(items) == 3)
        sc = find(items, '스크램블|달걀')
        ok('스크램블 3개 table:달걀', sc and num(sc[0].get('amount')) == 3 and kind(sc[0]) == 'table' and '달걀' in key(sc[0]))
        ap = find(items, '사과')
        ok('사과 1개 table', ap and num(ap[0].get('amount')) == 1 and kind(ap[0]) == 'table')
        br = find(items, '브라우니')
        b = br[0] if br else {}
        po = b.get('portion') or {}
        ok('브라우니 portion 9/16 · new_recipe (양 9조각 또는 1판의 9/16)', num(b.get('amount')) in (9, 1) and num(po.get('num')) == 9 and num(po.get('den')) == 16 and kind(b) == 'new_recipe')
        ing = b.get('ingredients') or []
        ok('재료 4개', len(ing) == 4)
        g = lambda p: (find(ing, p) or [{}])[0]
        ok('바나나 2 table', num(g('바나나').get('amount')) == 2 and kind(g('바나나')) == 'table')
        ok('계란 2 → table:달걀', num(g('계란|달걀').get('amount')) == 2 and '달걀' in key(g('계란|달걀')))
        ok('카카오파우더 1스푼 table', num(g('카카오').get('amount')) == 1 and kind(g('카카오')) == 'table')
        ok('무당초콜릿 2줌 new_product', num(g('초콜릿|초코').get('amount')) == 2 and '줌' in str(g('초콜릿|초코').get('unit')) and kind(g('초콜릿|초코')) == 'new_product')
        ok('170도 25분 = memo (재료 아님)', '170' in S(b.get('memo')) and not find(ing, '오븐|170'))
        us = S(d.get('unknowns'))
        ok('모르는 것: 무당초콜릿', re.search('초콜릿|초코', us))
        ok('모르는 것: 스크램블 기름', re.search('oil|기름|스크램블', us))
    elif case == 'T2':
        ok('끼니 1개 12:40 meal', len(meals) == 1 and m.get('at') == '12:40' and m.get('kind') == 'meal')
        ok('항목 3개', len(items) == 3)
        gb = (find(items, '간계밥') or [{}])[0]
        ok('간계밥 1 · portion 없음 · new_recipe', num(gb.get('amount') or 1) == 1 and not gb.get('portion') and kind(gb) == 'new_recipe')
        ing = gb.get('ingredients') or []
        g = lambda p: (find(ing, p) or [{}])[0]
        ok('재료 5개', len(ing) == 5)
        ok('계란5 · 진간장2스푼 · 깨2꼬집 · 참기름1스푼 · 밥2.5공기',
           num(g('계란|달걀').get('amount')) == 5 and num(g('간장').get('amount')) == 2 and num(g('깨').get('amount')) == 2
           and num(g('참기름').get('amount')) == 1 and num(g('밥|햇반').get('amount')) == 2.5 and '공기' in str(g('밥|햇반').get('unit')))
        ok('오뎅국 · 갓김치 table', all(kind((find(items, p) or [{}])[0]) == 'table' for p in ['오뎅', '갓김치']))
        q = [S(u) for u in asked(d)]
        ok('물을 것에 밥(폭 80 이상)', any(re.search('밥|공기|햇반', x) for x in q))
        ok('오뎅국은 안 물음(폭 80 미만)', not any('오뎅' in x for x in q))
    elif case == 'T3':
        t = S(d)
        cs = S(d.get('corrections'))
        ok('고칠 곳: 스크램블 ← 카놀라유', '카놀라유' in cs)
        bap = [x for x in (d.get('corrections') or []) if re.search('밥', x.get('path', ''))]
        ok('고칠 곳: 밥 ← 햇반 3개(630g)', bap and (('햇반' in S(bap) and num((bap[0].get('set') or {}).get('amount')) == 3) or '630' in S(bap)))
        ok('고칠 곳: 초콜릿 ← 파베글라스 제품 40g', '파베글라스' in cs and re.search(r'\b40\b', cs))
        ok('400g을 먹은 양으로 읽지 않음', not re.search(r'"(grams|amount)"\s*:\s*400\b', S(d.get('corrections'))))
        ln = d.get('learn') or []
        lt = S(ln)
        ok('learn: 특 간계밥 밥 = 630g', re.search(r'간계밥', lt) and re.search(r'630|햇반', lt))
        ok('learn: 제품 등록 요청 (영양값 지어내지 않음)', '파베글라스' in lt and not re.search(r'"(kcal|carb|protein|fat)"\s*:\s*\d', lt))
        ok('learn: 그 제품 줌 = 20g', re.search(r'줌', lt) and re.search(r'\b20\b', lt))
        ok('내 단위 공기를 바꾸지 않음', not [x for x in ln if x.get('type') == 'my_unit'])
    elif case == 'T4':
        ok('끼니 16:15 snack', len(meals) == 1 and m.get('at') == '16:15' and m.get('kind') == 'snack')
        ok('항목 3개', len(items) == 3)
        bn = (find(items, '바나나') or [{}])[0]
        ok('바나나 2 table', num(bn.get('amount')) == 2 and kind(bn) == 'table')
        pr = (find(items, '프로틴') or [{}])[0]
        ok('프로틴 1스쿱 25g (new_product 또는 임팩트 웨이로 짝지음)', num(pr.get('grams')) == 25 and (kind(pr) == 'new_product' or '임팩트' in key(pr)))
        cr = (find(items, '크레아틴') or [{}])[0]
        ok('크레아틴 3g supplement', num(cr.get('grams')) == 3 and kind(cr) == 'supplement')
        ok('질문 0개', len(asked(d)) == 0)
    elif case == 'T6':
        ok('끼니 18:15 meal', len(meals) == 1 and m.get('at') == '18:15' and m.get('kind') == 'meal')
        ok('label 저녁', m.get('label') == '저녁')
        ok('항목 1개', len(items) == 1)
        it = items[0] if items else {}
        ok('간계밥 → food:특 간계밥 (새 레시피 아님)', kind(it) == 'food' and '간계밥' in key(it))
        ov = it.get('overrides') or []
        g = lambda p: (find(ov, p) or [{}])[0]
        ok('overrides 2개', len(ov) == 2)
        bap = g('밥|햇반')
        ok('밥 = 햇반 2개 (내 단위 공기 아님)', (num(bap.get('amount')) == 2 and '개' in str(bap.get('unit')) and '햇반' in S(bap)) or num(bap.get('grams')) == 420)
        ok('계란 = 3', num(g('계란|달걀').get('amount')) == 3)
        ok('말 안 한 재료는 모르는 것 아님 · 질문 0개', len(asked(d)) == 0 and not re.search('간장|깨|참기름', S(d.get('unknowns'))))
    elif case == 'T7-1':
        ok('끼니 22:30 meal', len(meals) == 1 and m.get('at') == '22:30' and m.get('kind') == 'meal')
        ok('항목 4개', len(items) == 4)
        g = lambda p: (find(items, p) or [{}])[0]
        ok('밥 1.5공기 table:햇반', num(g('밥|햇반').get('amount')) == 1.5 and '공기' in str(g('밥|햇반').get('unit')) and '햇반' in key(g('밥|햇반')))
        ok('조기 1마리 table:조기구이', num(g('조기').get('amount')) == 1 and '마리' in str(g('조기').get('unit')) and '조기' in key(g('조기')))
        ok('찌개 · 멸치볶음 table', kind(g('찌개')) == 'table' and kind(g('멸치')) == 'table')
        q = [S(u) for u in asked(d)]
        ok('질문 = 밥 · 찌개 2개', len(q) == 2 and any(re.search('밥|공기', x) for x in q) and any('찌개' in x for x in q))
    elif case == 'T7-2':
        ln = d.get('learn') or []
        mu = [x for x in ln if x.get('type') == 'my_unit']
        ok('learn: 내 단위 공기 = 315g (또는 햇반 1.5개)', mu and '공기' in S(mu) and ('315' in S(mu) or ('햇반' in S(mu) and '1.5' in S(mu))))
        cs = S(d.get('corrections'))
        ok('22:30 밥 → 472.5g (또는 햇반 2.25개 · 1.5공기 그대로 + 공기 315g)', '472.5' in cs or not cs or cs == '[]' or '22:30' in cs or ('2.25' in cs and '햇반' in cs))
        ok('이전 기록(점심 · 18:15)은 안 바꿈', not re.search('점심|12:40|18:15|저녁', cs))
    return c

cases = ['T1', 'T2', 'T3', 'T4', 'T6', 'T7-1', 'T7-2']
runs = sys.argv[1:] or ['run1', 'run2', 'run3']
table = {}
for case in cases:
    for r in runs:
        table[(case, r)] = checks(case, load(r, case))
for case in cases:
    names = [n for n, _ in table[(case, runs[0])]] if table[(case, runs[0])] else []
    allnames = []
    for r in runs:
        for n, _ in table[(case, r)]:
            if n not in allnames: allnames.append(n)
    passes = [all(v for _, v in table[(case, r)]) for r in runs]
    print(f'## {case}  ' + ' '.join('✅' if p else '❌' for p in passes) + f'  ({sum(passes)}/{len(runs)})')
    for n in allnames:
        row = []
        for r in runs:
            v = dict(table[(case, r)]).get(n)
            row.append('·' if v is None else ('o' if v else 'X'))
        if 'X' in row: print('   ', ' '.join(row), n)
