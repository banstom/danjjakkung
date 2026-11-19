#!/usr/bin/env python3
"""식약처 전국통합식품영양성분정보 — 가공식품 전체를 공공데이터포털 API로 받는다 (Cloud Shell 에서).

  python3 scripts/nutri-fetch.py            # 인증키(Decoding)를 물어봄 · 화면에 안 보이고 어디에도 저장 안 함
  결과: ~/nutri/processed.jsonl.gz (한 줄 = API 가 준 한 건 그대로) + ~/nutri/summary.txt

- 표준데이터 그리드 다운로드는 5만 건에서 끊겨서 API 로 받는다
- 중간에 끊기면 다시 실행: 받은 쪽부터 이어 받음 (~/nutri/pages/)
- 표준 라이브러리만 씀 (pip 설치 없음)
"""
import getpass, gzip, json, os, sys, time, urllib.parse, urllib.request, urllib.error

URL = 'https://api.data.go.kr/openapi/tn_pubr_public_nutri_info_api'
ROWS = 1000
OUT = os.path.expanduser('~/nutri')
PAGES = os.path.join(OUT, 'pages')


def call(key, page, rows, extra=None):
    q = {'serviceKey': key, 'pageNo': page, 'numOfRows': rows, 'type': 'json'}
    q.update(extra or {})
    req = urllib.request.Request(URL + '?' + urllib.parse.urlencode(q), headers={'User-Agent': 'danjjakkung-nutri/1'})
    for t in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read().decode('utf-8', 'replace')
            if raw.lstrip().startswith('<'):
                raise ValueError('JSON 이 아닌 답: ' + raw[:300])
            return json.loads(raw)
        except (urllib.error.URLError, ValueError, TimeoutError, json.JSONDecodeError) as e:
            wait = 3 * (t + 1)
            print('  다시 시도 (%s) — %d초 뒤' % (str(e)[:160], wait), flush=True)
            time.sleep(wait)
    raise SystemExit('계속 실패해요. 키가 아직 안 먹히면 1~2시간 뒤 다시 실행해 주세요.')


def body(j):
    r = j.get('response', j)
    h = r.get('header', {})
    code = str(h.get('resultCode', '00'))
    if code not in ('00', '0', '000'):
        raise SystemExit('API 오류 %s: %s' % (code, h.get('resultMsg')))
    b = r.get('body', {})
    items = b.get('items', [])
    if isinstance(items, dict):
        items = items.get('item', [])
    if isinstance(items, dict):
        items = [items]
    return int(b.get('totalCount', 0) or 0), items


def main():
    os.makedirs(PAGES, exist_ok=True)
    key = os.environ.get('NUTRI_KEY') or getpass.getpass('공공데이터포털 일반 인증키(Decoding) 붙여 넣고 Enter (화면에 안 보여요): ').strip()
    if not key:
        raise SystemExit('키가 비었어요')
    # 가공식품만 거를 수 있는지 먼저 본다 (안 되면 전부 받고 식품코드 P 로 거름)
    extra = {'dataCd': 'P'}
    total, items = body(call(key, 1, 5, extra))
    if not items or not all(str(x.get('foodCd', 'P')).startswith('P') for x in items):
        print('가공식품만 거르기가 안 돼서 전체를 받고 나중에 걸러요')
        extra = {}
        total, items = body(call(key, 1, 5))
    print('모두 %d건 · 첫 건의 항목 이름:' % total, ', '.join(items[0].keys()) if items else '(없음)', flush=True)
    pages = (total + ROWS - 1) // ROWS
    for p in range(1, pages + 1):
        f = os.path.join(PAGES, '%05d.json' % p)
        if os.path.exists(f):
            continue
        _, its = body(call(key, p, ROWS, extra))
        with open(f + '.tmp', 'w', encoding='utf-8') as w:
            json.dump(its, w, ensure_ascii=False)
        os.replace(f + '.tmp', f)
        print('  %d / %d 쪽 (%d건)' % (p, pages, len(its)), flush=True)
        time.sleep(0.2)
    n = 0; seen = set(); keys = None
    with gzip.open(os.path.join(OUT, 'processed.jsonl.gz'), 'wt', encoding='utf-8') as w:
        for name in sorted(os.listdir(PAGES)):
            if not name.endswith('.json'):
                continue
            for it in json.load(open(os.path.join(PAGES, name), encoding='utf-8')):
                cd = str(it.get('foodCd', ''))
                if not cd.startswith('P') or cd in seen:
                    continue
                seen.add(cd); keys = keys or list(it.keys())
                w.write(json.dumps(it, ensure_ascii=False) + '\n'); n += 1
    s = '가공식품 %d건 (API totalCount %d, 거르기 %s)\n항목: %s\n' % (n, total, 'dataCd=P' if extra else '받은 뒤 식품코드 P', ', '.join(keys or []))
    open(os.path.join(OUT, 'summary.txt'), 'w', encoding='utf-8').write(s)
    print('\n끝났어요 ✅\n' + s + '파일: ~/nutri/processed.jsonl.gz (%.1f MB)' % (os.path.getsize(os.path.join(OUT, 'processed.jsonl.gz')) / 1e6))


if __name__ == '__main__':
    main()
