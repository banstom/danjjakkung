// node --test tests/focus.test.js — 집중 F1 (docs/focus/tests.md C · D, B4 · B7)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const F = require('../js/focus.js');
const { T } = require('../js/focus-text.js');
const RING = require('../js/focus-ring.js');
const TH = require('../js/themes.js');
const V = require('../js/view-focus.js');
const P = require('../js/view-plan.js');
const ROOT = path.join(__dirname, '..');
const H = 3600000, M = 60000;
const at = (s) => Date.parse(s + '+09:00');

test('C1 시간 꼴: H:MM:SS · H:MM · 분', () => {
  assert.equal(F.hms(0), '0:00:00');
  assert.equal(F.hms(59 * M + 59000), '0:59:59');
  assert.equal(F.hms(3 * H + 20 * M + 15000), '3:20:15');
  assert.equal(F.hm(H + 5 * M), '1:05');
  assert.equal(T.dur(48 * M), '48분');
  assert.equal(T.dur(60 * M), '1:00');
  assert.equal(T.herRun(48 * M + 30000), '집중 중 48분');
});

test('C2 하루 경계 새벽 5시: 04:30~05:30 → 어제 30분 + 오늘 30분', () => {
  assert.equal(F.dayKey(at('2026-11-25T04:59:59')), '2026-11-24');
  assert.equal(F.dayKey(at('2026-11-25T05:00:00')), '2026-11-25');
  const d = F.byDay([[at('2026-11-25T04:30:00'), at('2026-11-25T05:30:00')]]);
  assert.deepEqual(Object.keys(d), ['2026-11-24', '2026-11-25']);
  assert.equal(F.sum(d['2026-11-24']), 30 * M);
  assert.equal(F.sum(d['2026-11-25']), 30 * M);
  const logs = [{ by: 'j', day: '2026-11-24', segs: d['2026-11-24'] }, { by: 'j', day: '2026-11-25', segs: d['2026-11-25'] }];
  const t = F.totals(logs, {}, 'j', 'd', at('2026-11-25T09:00:00'));
  assert.equal(t.me, 30 * M); assert.equal(t.yesterday, 30 * M);
});

test('C3 주 경계: 월요일 04:59 는 지난주, 05:00 부터 이번 주', () => {
  assert.equal(F.weekStart(F.dayKey(at('2026-11-23T04:59:00'))), '2026-11-16');
  assert.equal(F.weekStart(F.dayKey(at('2026-11-23T05:00:00'))), '2026-11-23');
  assert.equal(F.weekStart('2026-11-29'), '2026-11-23');
  assert.equal(F.weekdayOf('2026-11-25'), 2);
});

test('C4 함께 시간 = 겹친 구간 합 (쉬기 · 자리 비움 빈틈은 빼고, 여러 조각도)', () => {
  const a = [[at('2026-11-25T10:00:00'), at('2026-11-25T11:00:00')], [at('2026-11-25T11:10:00'), at('2026-11-25T12:00:00')]]; // 11:00~11:10 쉼
  const b = [[at('2026-11-25T10:30:00'), at('2026-11-25T11:30:00')]];
  assert.equal(F.overlap(a, b), 30 * M + 20 * M);
  assert.equal(F.overlap(a, []), 0);
  // 지금 달리는 중인 짝꿍 문서도 함께 시간에 들어감
  const now = at('2026-11-25T12:00:00');
  const lives = { j: F.live({ state: 'run', start: at('2026-11-25T11:00:00'), segStart: at('2026-11-25T11:00:00'), segs: [] }, now), d: F.live({ state: 'run', start: at('2026-11-25T11:30:00'), segStart: at('2026-11-25T11:30:00'), segs: [] }, now) };
  const t = F.totals([], lives, 'j', 'd', now);
  assert.equal(t.me, H); assert.equal(t.her, 30 * M); assert.equal(t.both, 30 * M);
  assert.equal(F.togetherSince(lives.j, lives.d), at('2026-11-25T11:30:00'));
});

test('C5 어제와 비교: 늘었을 때만 +, 같거나 적으면 숫자만, 어제 0 이면 빈 글', () => {
  assert.deepEqual(F.compare(4 * H + 40 * M, 4 * H), { kind: 'more', diff: 40 * M });
  assert.equal(T.more(40 * M), '어제보다 +40분');
  assert.equal(F.compare(3 * H, 4 * H).kind, 'less');
  assert.equal(T.less(4 * H), '어제 4:00');
  assert.equal(F.compare(4 * H, 4 * H).kind, 'less');
  assert.equal(F.compare(H, 0), null);
});

test('C6 짝꿍 카드 버튼: 쉬는 중 → 같이 하자 / 집중 중 → 같이 하기 / 쉬기 · 자리 비움 → 없음 / 보낸 뒤 30분 → 보냈어요', () => {
  const now = at('2026-11-25T12:00:00');
  assert.equal(F.partnerButton('idle', null, now), 'call');
  assert.equal(F.partnerButton('run', null, now), 'join');
  assert.equal(F.partnerButton('pause', null, now), null);
  assert.equal(F.partnerButton('away', null, now), null);
  assert.equal(F.partnerButton(null, null, now), null);
  assert.equal(F.partnerButton('idle', now - 10 * M, now), 'sent');
  assert.equal(F.partnerButton('idle', now - 31 * M, now), 'call');
});

test('C7 띠: 짝꿍만 · 나만 · 둘 다 · 나 쉬는 중, 나머지는 없음 (문구는 spec 6-1 그대로)', () => {
  assert.equal(F.band('idle', 'run'), 'partner');
  assert.equal(F.band('run', 'idle'), 'me');
  assert.equal(F.band('run', 'run'), 'both');
  assert.equal(F.band('pause', 'idle'), 'mepause');
  for (const h of ['idle', 'pause', 'away']) assert.equal(F.band('idle', h), null);
  assert.match(V.band({ kind: 'partner', name: '다진', cat: '공부', ms: 48 * M }), /● 다진 · 공부 중 48분<\/span><span class="fc-band__r">같이 하기 ›/);
  assert.match(V.band({ kind: 'me', subj: '공부 · 해부학', ms: 72 * M }), /● 나 · 공부 · 해부학 1:12[^]*보기 ›/);
  assert.match(V.band({ kind: 'both', ms: 32 * M }), /🔥 함께 집중 중 32분/);
  assert.match(V.band({ kind: 'mepause', ms: 3 * M }), /⏸ 나 · 잠깐 쉬는 중 3분/);
  assert.equal(V.band(null), '');
});

test('C8 탭 점: 짝꿍만 her · 나만 me · 둘 다 me+her · 집중 탭에선 없음 · 자리 비움 없음', () => {
  assert.deepEqual(F.dot('idle', 'run', false), ['her']);
  assert.deepEqual(F.dot('run', 'idle', false), ['me']);
  assert.deepEqual(F.dot('run', 'run', false), ['me', 'her']);
  assert.deepEqual(F.dot('run', 'run', true), []);
  assert.deepEqual(F.dot('idle', 'away', false), []);
  const html = P.tabbar('routine', { slots: ['me', 'her'], label: '함께 집중 중' });
  assert.match(html, /data-tab="focus" aria-label="집중 · 함께 집중 중"/);
  assert.equal((html.match(/tabbar__dot--/g) || []).length, 3); // me · her · 둘째 자리
  assert.doesNotMatch(P.tabbar('focus', { slots: ['me'], label: '집중 중' }), /tabbar__dot/, '집중 탭에 있을 때는 점 없음');
});

test('C10 짝꿍에게 자리 비움은 상태 하나 — 문서에 횟수 · 시간 칸 없음 (규칙 hasOnly)', () => {
  const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  const m = /match \/focus\/\{uid\}[^]*?hasOnly\(\[([^\]]*)\]\)/.exec(rules);
  assert.ok(m);
  const keys = m[1].replace(/'/g, '').split(',').map((s) => s.trim());
  assert.deepEqual(keys, ['state', 'cat', 'label', 'start', 'segStart', 'segs', 'pauseAt', 'strict', 'call', 'updatedAt']);
  assert.ok(!keys.some((k) => /away|count|seen/i.test(k)));
  assert.equal(F.shownState(F.live({ state: 'away', start: 1, segs: [[1, 2]] }, 10)), 'away');
  assert.equal(T.herAway, '잠깐 자리 비움');
  // 6시간이 지난 집중은 짝꿍 화면에서 쉬는 중
  assert.equal(F.shownState(F.live({ state: 'run', start: 0, segStart: 0, segs: [] }, 7 * H)), 'idle');
});

test('C13 기록 고치기 검사: 순서 · 지금보다 늦음 · 1분 미만 · 겹침', () => {
  const now = at('2026-11-25T21:00:00');
  assert.deepEqual(F.checkEdit(10, 5, [], now), { err: 'order' });
  assert.deepEqual(F.checkEdit(now - H, now + 10 * M, [], now), { err: 'future' });
  assert.deepEqual(F.checkEdit(now - H, now - H + 30000, [], now), { err: 'short' });
  const o = [at('2026-11-25T19:50:00'), at('2026-11-25T20:10:00')];
  assert.deepEqual(F.checkEdit(at('2026-11-25T20:00:00'), at('2026-11-25T20:30:00'), [o], now), { err: 'overlap', with: o });
  assert.equal(T.overlapErr(o), '19:50 ~ 20:10 기록과 겹쳐요');
  assert.equal(F.checkEdit(at('2026-11-25T20:10:00'), at('2026-11-25T20:30:00'), [o], now), null);
});

test('C15 시간은 시작 시각 기준 — 30분 뒤에 열면 30분 늘어 있음', () => {
  const doc = { state: 'run', start: 1000, segStart: 1000, segs: [] };
  assert.equal(F.live(doc, 1000 + 30 * M).runMs, 30 * M);
  const paused = { state: 'pause', start: 1000, segs: [[1000, 1000 + 10 * M]], pauseAt: 1000 + 10 * M };
  assert.equal(F.live(paused, 1000 + 50 * M).runMs, 10 * M, '쉬는 시간은 안 셈');
});

test('C16 과목: 최근 쓴 순 · 짧은 이름 8자 · 최근 짧은 이름 5개', () => {
  const cats = [{ id: 'cls' }, { id: 'study' }, { id: 'work' }];
  const logs = [{ by: 'j', cat: 'work', end: 2, label: 'a' }, { by: 'j', cat: 'study', end: 5, label: '해부학' }, { by: 'd', cat: 'cls', end: 9 }];
  assert.deepEqual(F.recentCats(cats, logs, 'j', []), ['study', 'work', 'cls']);
  assert.deepEqual(F.recentCats(cats, logs, 'j', ['cls']), ['cls', 'study', 'work']);
  assert.equal(F.cleanLabel('  해부학   실습 정리하기 '), '해부학 실습 정', '빈칸 하나로 줄이고 8자');
  assert.equal(Array.from(F.cleanLabel('가나다라마바사아자')).length, 8);
  assert.deepEqual(F.recentLabels(logs, 'j', 'study', ['영어', '해부학', '생리', '약리', '병리', '조직']), ['영어', '해부학', '생리', '약리', '병리']);
});

test('B4 S3 정수 배율: 할 일 탭 배율, 140px 넘으면 한 단계씩 낮춤 (도트 테마 전부)', () => {
  let n = 0;
  for (const [id, slots] of Object.entries(TH.ART)) {
    if (!slots.s3) continue; n++;
    const a = slots.s3, x = TH.fitScale(a, 140);
    assert.ok(Number.isInteger(x) && x >= 1 && x <= a.x, id);
    assert.ok(a.h * x <= 140 || x === 1, id + ' 140px 안');
    if (a.h * a.x <= 140) assert.equal(x, a.x, id + ' 넘지 않으면 할 일 탭 배율 그대로');
    assert.match(TH.artFit('s3', 'fc-s3__img', 140, id), new RegExp('height="' + a.h * x + '"'));
  }
  assert.ok(n >= 22, '도트 테마 22개 이상 ' + n);
});

test('B7 픽셀 계단 링: 진행 0 → 0칸, 0.5 → 절반 ±1, 1 → 전부, 외곽선 칸은 진행과 상관없이 같음', () => {
  const z = RING.cells(0), h = RING.cells(0.5), f = RING.cells(1);
  const total = z.p.length + z.t.length;
  assert.equal(z.p.length, 0);
  assert.equal(f.t.length, 0); assert.equal(f.p.length, total);
  assert.ok(Math.abs(h.p.length - total / 2) <= Math.max(1, total * 0.01), h.p.length + ' / ' + total);
  assert.equal(z.o.length, h.o.length); assert.equal(h.o.length, f.o.length);
  assert.doesNotMatch(RING.svg(0.3, false), /#[0-9a-fA-F]{3,6}|rgb\(/, '색은 CSS 클래스로만');
});

test('D1 문구는 focus-text.js 한 곳에만 — 화면 코드에 한글 문장 없음', () => {
  for (const f of ['js/view-focus.js', 'js/app-focus.js', 'js/focus.js', 'js/focus-ring.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[^]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const ko = src.match(/['"`][^'"`\n]*[가-힣][^'"`\n]*['"`]/g) || [];
    assert.deepEqual(ko, [], f + ' 에 한글 글자 ' + ko.join(', '));
  }
});

test('D2 · D3 이름 조사는 「님」 뒤 · 꾸짖는 말 없음', () => {
  assert.equal(T.tCalled('다진'), '다진 님에게 같이 하자고 보냈어요');
  assert.equal(T.tCalledMe('준민'), '💌 준민 님이 같이 집중하재요');
  assert.equal(T.bandPartner('다진', '공부', 5 * M), '● 다진 · 공부 중 5분', '띠에서는 이름만');
  const all = [];
  (function walk(o) { for (const v of Object.values(o)) { if (typeof v === 'string') all.push(v); else if (typeof v === 'function') { try { const r = v('다진', 0, 0, 0, 0); if (typeof r === 'string') all.push(r); } catch (e) {} } else if (v && typeof v === 'object') walk(v); } })(T);
  for (const s of all) assert.doesNotMatch(s, /못 했|안 했|부족|-\d+분/, s);
});

test('B5 새 화면 CSS · JS 에 색 글자 없음', () => {
  for (const f of ['styles/focus.css', 'js/view-focus.js', 'js/app-focus.js', 'js/focus-ring.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[^]*?\*\//g, '');
    assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, f);
  }
});

test('그리기: 집중 탭 처음 · 쉬는 중 · 짝꿍 집중 중', () => {
  const base = { date: '11월 25일 수요일', strict: false, herName: '다진', herSlot: 'her', first: false,
    me: { state: 'idle', runMs: 0, subj: '' }, today: { me: 3 * H + 20 * M + 15000, her: 2 * H + 58 * M, both: 65 * M, nowBoth: false, compare: { kind: 'more', diff: 40 * M } },
    her: { state: 'idle', slot: 'her', runMs: 0, today: 2 * H + 58 * M, strict: true, subj: '', together: 0, btn: 'call' },
    subjects: [{ id: 'study', name: '공부', icon: '📝', todayMs: 130 * M, labels: '해부학 1:30 · 영어 0:40', active: false }], moreCount: 13,
    week: { days: Array.from({ length: 7 }, (_, i) => ({ me: i < 3 ? H : 0, her: i < 3 ? H : 0, both: 0, meH: i < 3 ? 1 : 0, herH: i < 3 ? 1 : 0, bothH: 0, today: i === 2, future: i > 2 })), empty: false, pick: 2 } };
  const rest = V.tab(base);
  assert.match(rest, /<h1 class="title">집중<\/h1>[^]*data-act="fc-settings"[^>]*>⚙ 느슨/);
  assert.match(rest, /data-fc="today">3:20:15/);
  assert.match(rest, /어제보다 \+40분/);
  assert.match(rest, /🔥 함께 1:05/); assert.match(rest, /다진 2:58/);
  assert.match(rest, /오늘 2:58 · 쉬는 중[^]*data-act="fc-call">같이 하자/);
  assert.match(rest, /data-act="fc-play" data-v="study" aria-label="공부 시작"/);
  assert.match(rest, /과목 더 보기[^]*13개 ›/);
  assert.match(rest, /오늘 · 나 1:00 · 다진 1:00 · 함께 0:00/);
  const first = V.tab(Object.assign({}, base, { first: true, today: { me: 0, her: 0, both: 0, compare: null }, week: Object.assign({}, base.week, { empty: true }) }));
  assert.match(first, /과목 옆 ▶를 누르면 바로 시작해요\.[^]*다진 님과 같은 시간에 집중하면/);
  assert.match(first, /아직 오늘 집중한 시간이 없어요\./);
  assert.match(first, /집중한 시간이 여기에 날마다 쌓여요\./);
  const join = V.tab(Object.assign({}, base, { her: Object.assign({}, base.her, { state: 'run', runMs: 48 * M, btn: 'join', subj: '공부 · 생리학' }) }));
  assert.match(join, /다진 · 공부 · 생리학/); assert.match(join, /집중 중 48분 · 🔒 엄격/); assert.match(join, /data-act="fc-join">같이 하기/);
  const away = V.tab(Object.assign({}, base, { her: Object.assign({}, base.her, { state: 'away', btn: null }) }));
  assert.match(away, /is-away[^]*잠깐 자리 비움/); assert.doesNotMatch(away, /fc-call|fc-join/);
});

test('그리기: 집중 화면 함께 · 쉬는 중 · 자리 비움 · 끝냄 요약', () => {
  const sc = { state: 'run', runMs: 72 * M + 8000, todayMs: 200 * M, progress: 0.2, subj: '공부 · 해부학', strict: false, meSlot: 'me', badge: { kind: 'both', ms: 32 * M }, wake: true, awayMs: 0, s3: '', herName: '다진',
    her: { state: 'run', slot: 'her', runMs: 48 * M, together: 32 * M, subj: '공부 · 생리학', btn: 'join' } };
  const both = V.screen(sc);
  assert.match(both, /data-act="fc-down" aria-label="작게 보기 — 집중은 계속돼요"/);
  assert.match(both, /🔥 함께 집중 중 · 32분/); assert.match(both, /data-fc="run">1:12:08/); assert.match(both, /오늘 합계 3:20:00/);
  assert.match(both, /함께 32분째/); assert.match(both, /data-act="fc-pause">잠깐 쉬기[^]*data-act="fc-end">끝내기/);
  const pause = V.screen(Object.assign({}, sc, { state: 'pause', badge: { kind: 'pause', ms: 3 * M } }));
  assert.match(pause, /⏸ 잠깐 쉬는 중 · 3분/); assert.match(pause, /쉬는 시간은 집중 시간에 넣지 않아요/); assert.match(pause, /fc-end">끝내기[^]*fc-resume">다시 시작/);
  const away = V.screen(Object.assign({}, sc, { state: 'away', strict: true, badge: null, awayMs: 6 * M }));
  assert.match(away, /자리를 비웠어요/); assert.match(away, /앱을 나가 있던 6분은 빼 두었어요/); assert.match(away, /여기서 끝내기[^]*다시 시작/);
  const done = V.screen(Object.assign({}, sc, { done: { today: 200 * M, subj: '공부 · 해부학', thisMs: 72 * M, both: 65 * M, herWeek: 0, meWeek: 475 * M, s3: '', logId: 'f1' } }));
  assert.match(done, /오늘 3:20 집중했어요/); assert.match(done, /이번에는 공부 · 해부학 1:12/); assert.match(done, /🔥 다진 님과 함께[^]*1:05/); assert.match(done, /이번 주 나[^]*7:55/);
  assert.match(done, /data-act="fc-edit" data-v="f1">시간 고치기/);
});

test('규칙 · 연결: focus · focusLogs 규칙, 화면 파일이 index · 서비스워커에', () => {
  const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  assert.match(rules, /match \/focus\/\{uid\}[^]*request\.auth\.uid == uid/);
  assert.match(rules, /match \/focusLogs\/\{id\}[^]*allow delete: if isMember\(\) && resource\.data\.by == request\.auth\.uid/);
  assert.match(rules, /'focusMode', 'focusStart', 'focusCall'/);
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  for (const f of ['js/focus.js', 'js/focus-text.js', 'js/focus-ring.js', 'js/view-focus.js', 'js/app-focus.js', 'styles/focus.css']) { assert.ok(idx.includes(f), f); assert.ok(sw.includes("'" + f + "'"), f); }
});

// ── 집중에 보일 카테고리 · 이번 주 과목별 (v86) ──
test('카테고리 처음 값: 운동 · 약속 · 병원 · 식사는 숨김, 공부는 보임', () => {
  const F = require('../js/focus.js');
  const cats = [{ id: 'class', name: '수업' }, { id: 'exercise', name: '운동' }, { id: 'study', name: '공부' }, { id: 'meet', name: '약속' },
    { id: 'c1', name: '병원' }, { id: 'c2', name: '식사' }, { id: 'c3', name: '토익' }];
  assert.deepEqual(F.visibleCats(cats).map(c => c.id), ['class', 'study', 'c3']);
  assert.deepEqual(F.visibleCats(cats, { exercise: false, study: true }).map(c => c.id), ['class', 'exercise', 'c3']);
  assert.equal(F.visibleCats(cats, { class: true, study: true, c3: true }).length, 7, '다 끄면 전부 보임');
});
test('이번 주 과목별: 월 05시부터, 이름별 합계, 진행 중 포함', () => {
  const F = require('../js/focus.js');
  const now = Date.UTC(2026, 10, 25, 3, 0); // 수 12:00 KST
  const ws = F.weekStart(F.dayKey(now)), H = F.H;
  const logs = [
    { by: 'a', cat: 'study', label: '일반생물학', day: ws, ms: 2 * H },
    { by: 'a', cat: 'study', label: '토익', day: F.addDays(ws, 1), ms: H },
    { by: 'a', cat: 'study', label: '일반생물학', day: F.addDays(ws, 1), ms: H },
    { by: 'a', cat: 'work', label: null, day: F.addDays(ws, -1), ms: 5 * H },
    { by: 'b', cat: 'study', label: '토익', day: ws, ms: 9 * H }];
  const lv = { cat: 'work', label: '', segs: [[now - H, now]] };
  const out = F.weekSubjects(logs, lv, 'a', now);
  assert.equal(out[0].cat, 'study'); assert.equal(out[0].ms, 4 * H);
  assert.deepEqual(out[0].labels, [{ label: '일반생물학', ms: 3 * H }, { label: '토익', ms: H }]);
  assert.equal(out[1].cat, 'work'); assert.equal(out[1].ms, H);
});
