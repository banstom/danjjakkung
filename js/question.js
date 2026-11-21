/* 교환 쪽지 (코드 이름 question) — 계산 (docs/question/spec.md 12절, 참조 구현 reference/src 를 한 파일로 옮김 · 동작 그대로)
   앱(화면)과 서버 함수(questionDaily · questionAnswered)가 함께 쓴다 — 그날 질문이 둘에서 같아야 해서.
   ※ functions/shared/question.js 는 이 파일의 사본 (bash scripts/sync-shared.sh, tests/shared.test.js 가 같은지 확인)
   문구는 js/question-text.js (이름은 NAME 한 곳). 날짜 키는 서울 'YYYY-MM-DD'. */
(function (root) {
  'use strict';
  const QT = (typeof module !== 'undefined' && module.exports) ? require('./question-text.js') : root.RT.questionText;
  const T = QT.T;

  // ── kst.js ──
  // 서울 시각 날짜 계산. 날짜 키는 'YYYY-MM-DD' (서울 자정에 바뀜)
  const KST = 9 * 60 * 60 * 1000;
  const DAY = 24 * 60 * 60 * 1000;

  function dateKey(ms) {
    return new Date(ms + KST).toISOString().slice(0, 10);
  }

  function toUtcMs(key) {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }

  function addDays(key, n) {
    return new Date(toUtcMs(key) + n * DAY).toISOString().slice(0, 10);
  }

  function diffDays(from, to) {
    return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY);
  }

  function isLeap(y) {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  }

  // 단짝이 된 날 = 1일 (앱 머리말 「단짝이 된 지 N일」과 같은 셈)
  function ddayCount(since, date) {
    return diffDays(since, date) + 1;
  }

  // ── order.js ──
  // 기본 질문의 정해진 순서. 같은 seed면 언제 어느 기기에서 돌려도 같은 순서.
  // 주제마다 섞은 뒤, 주제 안 순번을 주제 크기로 나눈 값으로 줄 세워 주제가 고르게 퍼지게 함.

  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
  }

  function rng(seed) {
    let a = fnv1a(seed);
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, seed) {
    const r = rng(seed);
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function baseOrder(base, seed) {
    const live = base.filter((q) => !q.retired).slice().sort((x, y) => (x.id < y.id ? -1 : 1));
    const byTopic = new Map();
    for (const q of live) {
      if (!byTopic.has(q.topic)) byTopic.set(q.topic, []);
      byTopic.get(q.topic).push(q);
    }
    const keyed = [];
    for (const [topic, qs] of byTopic) {
      const jitter = rng(`${seed}:${topic}:j`);
      shuffle(qs, `${seed}:${topic}`).forEach((q, i) => {
        keyed.push({ q, k: (i + 0.25 + jitter() * 0.5) / qs.length });
      });
    }
    keyed.sort((a, b) => a.k - b.k || (a.q.id < b.q.id ? -1 : 1));
    return keyed.map((x) => x.q);
  }

  // ── special.js ──
  // 날짜 질문: first > anniv(해마다 단짝이 된 날) > hundred(100일 단위) > fixed(MM-DD)

  function annivYears(since, date) {
    const [sy, sm, sd] = since.split('-').map(Number);
    const [y, m, d] = date.split('-').map(Number);
    if (y <= sy) return 0;
    let am = sm, ad = sd;
    if (sm === 2 && sd === 29 && !isLeap(y)) ad = 28;
    return m === am && d === ad ? y - sy : 0;
  }

  function specialFor({ date, since, isFirst, dates }) {
    if (isFirst) return { q: dates.first.id, text: dates.first.text, src: 'date' };
    if (since) {
      const years = annivYears(since, date);
      if (years > 0) {
        const t = dates.anniv[(years - 1) % dates.anniv.length];
        return { q: `anniv:${years}`, text: t.replace('{years}', String(years)), src: 'date' };
      }
      const n = ddayCount(since, date);
      if (n > 0 && n % 100 === 0) {
        const t = dates.hundred[(n / 100 - 1) % dates.hundred.length];
        return { q: `hundred:${n}`, text: t.replace('{days}', n.toLocaleString('ko-KR')), src: 'date' };
      }
    }
    const md = date.slice(5);
    if (dates.fixed[md]) return { q: `date:${md}`, text: dates.fixed[md], src: 'date' };
    return null;
  }

  // ── pick.js ──
  // 그날 질문 고르기. 그날 처음 연 사람(또는 저녁 9시 서버 함수)이 days/{date}를 만들 때 한 번만 부름.
  // 순서: 날짜 질문 → 단짝에게 묻기(전날까지 만든 것) → 목록에 섞기(지난 2일에 우리 질문이 없을 때) → 기본 묶음

  const DEFAULT_SEED = 'danjjakkung';
  const OURS_GAP_DAYS = 2;

  // 질문 id → 마지막으로 나온(또는 다른 질문으로 넘긴) 날짜
  function lastShownMap(history) {
    const m = new Map();
    for (const day of history) {
      for (const id of [day.q, ...(day.skipped || [])]) {
        if (!m.has(id) || m.get(id) < day.date) m.set(id, day.date);
      }
    }
    return m;
  }

  const byCreated = (a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1);

  function nextOurs({ date, history, ours }, shown) {
    const ready = ours.filter((q) => !shown.has(q.id) && dateKey(q.createdAt) < date);
    const ask = ready.filter((q) => q.ask).sort(byCreated)[0];
    if (ask) return ask;
    const recent = new Set(Array.from({ length: OURS_GAP_DAYS }, (_, i) => addDays(date, -(i + 1))));
    const oursLately = history.some((d) => recent.has(d.date) && d.src === 'ours');
    if (oursLately) return null;
    return ready.filter((q) => !q.ask).sort(byCreated)[0] || null;
  }

  // 처음 기본 질문 14번은 가벼운 주제에서만 (마음 · 지난날 같은 깊은 질문은 조금 익숙해진 뒤에)
  const WARMUP = 14;
  const LIGHT_TOPICS = ['daily', 'taste', 'pick', 'food', 'imagine'];

  function nextBase({ bank, seed }, shown, baseCount = Infinity) {
    let order = baseOrder(bank.base, seed || DEFAULT_SEED);
    if (baseCount < WARMUP) {
      const light = order.filter((q) => LIGHT_TOPICS.includes(q.topic) && !shown.has(q.id));
      if (light.length) order = light;
    }
    let best = null;
    order.forEach((q, i) => {
      const last = shown.get(q.id) || '';
      if (!best || last < best.last) best = { q, last, i };
    });
    return best ? best.q : null;
  }

  function pickQuestion(ctx) {
    const history = ctx.history.filter((d) => d.date < ctx.date);
    const shown = lastShownMap(history);
    if (!ctx.baseOnly) {
      const sp = specialFor({ date: ctx.date, since: ctx.since, isFirst: history.length === 0, dates: ctx.bank.dates });
      if (sp) return sp;
      const o = nextOurs({ ...ctx, history }, shown);
      if (o) return { q: o.id, text: o.text, src: 'ours', by: o.by };
    }
    const baseCount = history.filter((d) => d.src === 'base').length;
    const b = nextBase(ctx, ctx.extraShown ? mergeShown(shown, ctx.extraShown) : shown, baseCount);
    return { q: b.id, text: b.text, src: 'base' };
  }

  function mergeShown(shown, extra) {
    const m = new Map(shown);
    for (const [id, d] of extra) if (!m.has(id) || m.get(id) < d) m.set(id, d);
    return m;
  }

  // ── swap.js ──
  // 「다른 질문」: 오늘 질문 · 아직 아무도 안 답함 · 오늘 처음 · 기본/날짜 질문일 때만. 바꾸면 늘 기본 묶음에서.

  function swapBlock(day, today) {
    if (day.date !== today) return 'past';
    if (day.src === 'ours') return 'ours';
    if (day.swappedAt) return 'used';
    if (Object.keys(day.done || {}).length > 0) return 'answered';
    return null;
  }

  const canSwap = (day, today) => swapBlock(day, today) === null;

  function swapDay(ctx, day, { uid, now }) {
    if (!canSwap(day, ctx.date)) throw new Error(`swap blocked: ${swapBlock(day, ctx.date)}`);
    const skipped = [...(day.skipped || []), day.q];
    const extraShown = new Map(skipped.map((id) => [id, day.date]));
    const next = pickQuestion({ ...ctx, baseOnly: true, extraShown });
    return { ...day, q: next.q, text: next.text, src: 'base', by: null, skipped, swappedAt: now, swappedBy: uid };
  }

  // ── access.js ──
  // 누가 무엇을 볼 수 있나. firestore.rules와 같은 뜻 (규칙이 진짜 문지기, 이건 화면용)

  // none: 둘 다 아직 · mine: 나만 답함 · theirs: 단짝만 답함(단짝 답 잠김) · both: 둘 다(열림)
  function viewState(day, me, partner) {
    const done = (day && day.done) || {};
    const a = !!done[me];
    const b = !!done[partner];
    if (a && b) return 'both';
    if (a) return 'mine';
    if (b) return 'theirs';
    return 'none';
  }

  // 규칙: 내 답은 늘, 단짝 답은 내 답이 있을 때만
  function canReadAnswer(viewer, owner, answeredUids) {
    return viewer === owner || answeredUids.has(viewer);
  }

  // 「마음에 남아요」: 둘 다 답한 날, 단짝 답에 내가 누름 (likes.{내 uid} = true)
  function canLike(day, me, partner) {
    return viewState(day, me, partner) === 'both';
  }

  function toggleLike(day, me, partner) {
    if (!canLike(day, me, partner)) throw new Error('like blocked');
    const likes = { ...(day.likes || {}) };
    if (likes[me]) delete likes[me];
    else likes[me] = true;
    return { ...day, likes };
  }

  // ── validate.js ──
  // 답 · 우리가 넣는 질문 검사. 실패하면 이유 키를 돌려줌 (문구는 text.js)
  const ANSWER_MAX = 300;
  const QUESTION_MIN = 2;
  const QUESTION_MAX = 60;

  const norm = (t) => t.replace(/\s+/g, '').replace(/[?？!.]+$/, '');

  function checkAnswer(raw) {
    const text = (raw || '').trim();
    if (!text) return { ok: false, why: 'answerEmpty' };
    if ([...text].length > ANSWER_MAX) return { ok: false, why: 'answerLong' };
    return { ok: true, text };
  }

  function checkQuestion(raw, { bank, ours }) {
    let text = (raw || '').trim().replace(/\s+/g, ' ');
    const len = [...text].length;
    if (len < QUESTION_MIN) return { ok: false, why: 'questionShort' };
    if (len > QUESTION_MAX) return { ok: false, why: 'questionLong' };
    if (!/[?？]$/.test(text)) text += '?';
    const n = norm(text);
    if (bank.base.some((q) => !q.retired && norm(q.text) === n)) return { ok: false, why: 'questionInBank' };
    if (ours.some((q) => norm(q.text) === n)) return { ok: false, why: 'questionInOurs' };
    return { ok: true, text };
  }

  // ── history.js ──
  // 「지난 질문」 한 달 목록 + 「우리가 넣은 질문」 목록

  function monthRows(days, { month, me, partner, today }) {
    return days
      .filter((d) => d.date.startsWith(month) && d.date <= today)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((d) => {
        const state = viewState(d, me, partner);
        return {
          date: d.date,
          text: d.text,
          src: d.src,
          by: d.by || null,
          state,
          late: d.date < today && (state === 'none' || state === 'theirs'),
          liked: !!(d.likes && (d.likes[me] || d.likes[partner])),
        };
      });
  }

  // 기다리는 질문(아직 안 나옴)과 나온 질문으로 나눔
  function oursLists(ours, days) {
    const shownOn = new Map(days.filter((d) => d.src === 'ours').map((d) => [d.q, d.date]));
    const waiting = ours.filter((q) => !shownOn.has(q.id)).sort((a, b) => b.createdAt - a.createdAt);
    const shown = ours
      .filter((q) => shownOn.has(q.id))
      .map((q) => ({ ...q, date: shownOn.get(q.id) }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return { waiting, shown };
  }

  // 나온 질문은 고치거나 지울 수 없음(지난 기록과 맞지 않게 되므로). 기다리는 질문은 낸 사람만.
  function canEditOurs(q, uid, days) {
    return q.by === uid && !days.some((d) => d.src === 'ours' && d.q === q.id);
  }

  // ── recap.js ──
  // 월말 · 연말결산 카드 8 「오늘의 질문」 (식탁 카드 자리). 질문이 하나도 없던 달은 카드 건너뜀.
  function questionRecap(days, { period, members }) {
    const [a, b] = members;
    const inPeriod = days.filter((d) => d.date.startsWith(period));
    if (inPeriod.length === 0) return null;
    const both = inPeriod.filter((d) => d.done && d.done[a] && d.done[b]);
    const liked = both
      .filter((d) => d.likes && (d.likes[a] || d.likes[b]))
      .sort((x, y) => {
        const nx = Object.keys(x.likes).length;
        const ny = Object.keys(y.likes).length;
        return ny - nx || (x.date < y.date ? 1 : -1);
      });
    const pick = liked[0] || null;
    return {
      asked: inPeriod.length,
      both: both.length,
      ours: inPeriod.filter((d) => d.src === 'ours').length,
      // 마음에 남은 답: 서로 누른 날 → 한쪽이 누른 날, 같으면 최근. 답 글은 서버가 a/{owner}에서 읽어 붙임
      // owners = 단짝이 「마음에 남아요」를 눌러 준 답의 주인 (likes[u] = u가 단짝 답에 누름)
      liked: pick ? { date: pick.date, text: pick.text, owners: members.filter((owner) => pick.likes[members.find((x) => x !== owner)]) } : null,
    };
  }

  // ── notify.js ──
  // 알림 두 가지. users/{uid}.qRemind(저녁 9시, 기본 켬) · users/{uid}.qPartner(단짝이 답하면, 기본 켬)

  function reminderTargets(day, members, prefs) {
    return members.filter((u) => (prefs[u] || {}).qRemind !== false && !(day && day.done && day.done[u]));
  }

  function reminderMessage(day) {
    return { title: T.name, body: day.text, open: 'question' };
  }

  // a/{author} 처음 만들어질 때(고치기는 알림 없음). dayAfter = 답 저장 뒤의 days/{date}
  function answerPush({ date, today, dayAfter, author, members, prefs }) {
    if (date !== today) return null;
    const partner = members.find((u) => u !== author);
    if (!partner || (prefs[partner] || {}).qPartner === false) return null;
    const partnerDone = !!(dayAfter.done && dayAfter.done[partner]);
    return partnerDone
      ? { to: partner, kind: 'both-open', title: T.name, body: T.pushBothOpen, open: 'question' }
      : { to: partner, kind: 'partner-answered', title: T.name, body: T.pushPartnerAnswered, open: 'question' };
  }

  const api = { dateKey, addDays, diffDays, isLeap, ddayCount, baseOrder, specialFor, DEFAULT_SEED, OURS_GAP_DAYS, lastShownMap, nextOurs, WARMUP, LIGHT_TOPICS, nextBase, pickQuestion, swapBlock, canSwap, swapDay, viewState, canReadAnswer, canLike, toggleLike, ANSWER_MAX, QUESTION_MIN, QUESTION_MAX, checkAnswer, checkQuestion, monthRows, oursLists, canEditOurs, questionRecap, reminderTargets, reminderMessage, answerPush };
  root.RT = root.RT || {};
  root.RT.question = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
