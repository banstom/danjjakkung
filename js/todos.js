/* 할 일 계산 — 기한으로 줄 세우기, 3개까지만 보이기, 완료 접기. 화면 없음.
   todos/<id> : { scope: 'together' | <uid>, title, due: 'YYYY-MM-DD' | null, done, doneBy, doneAt, createdBy, createdAt, updatedAt,
                  cat: 카테고리 id | null (시간표와 같은 목록), ui: { <uid>: { u, i, at } } (u&I 평면 위치, js/uni.js),
                  short: 평면에 보일 이름 | null (1~8자, 없으면 할 일 이름 앞 8자),
                  memo: 메모 | null (1~200자, 여러 줄 — 예: 「가기 전에 조끼 챙기기」) }
   완료한 일은 완료한 날까지만 목록에 남고, 다음 날부터는 「완료한 일」 보관함에서 본다 (지우지 않음). */
(function (root) {
  'use strict';
  var D = (typeof module !== 'undefined' && module.exports) ? require('./dates') : root.RT.dates;

  var LIMIT = 3;
  var TITLE_MAX = 40;
  var RANK = { overdue: 0, today: 1, week: 2, later: 3, none: 4 };

  /** 이번 주 일요일 (월요일에 시작하는 주) */
  function endOfWeek(today) { return today + ((7 - D.parts(today).w) % 7); }

  /** 기한 묶음: overdue(지남) · today · week(이번 주) · later(그 뒤) · none(기한 없음) */
  function bucket(t, today) {
    if (!t.due) return 'none';
    var d = D.parse(t.due);
    if (isNaN(d)) return 'none';
    if (d < today) return 'overdue';
    if (d === today) return 'today';
    if (d <= endOfWeek(today)) return 'week';
    return 'later';
  }

  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

  /** 남은 일: 지난 일 → 오늘 → 이번 주 → 나중에 → 기한 없음, 같은 묶음은 기한 · 만든 순 */
  function sortOpen(list, today) {
    return list.slice().sort(function (a, b) {
      return RANK[bucket(a, today)] - RANK[bucket(b, today)] || cmp(a.due || '9999', b.due || '9999') ||
        cmp(a.createdAt || '', b.createdAt || '') || cmp(a.id, b.id);
    });
  }
  /** 완료한 일: 최근에 한 것부터 */
  function sortDone(list) {
    return list.slice().sort(function (a, b) { return cmp(b.doneAt || '', a.doneAt || '') || cmp(a.id, b.id); });
  }

  /** 기한 글자: '2일 지남' · '오늘' · '내일' · '목요일' · '11월 3일' · '' */
  function dueLabel(t, today) {
    if (!t.due) return '';
    var d = D.parse(t.due);
    if (isNaN(d)) return '';
    if (d < today) return (today - d) + '일 지남';
    if (d === today) return '오늘';
    if (d === today + 1) return '내일';
    if (d <= endOfWeek(today)) return D.DOW[D.parts(d).w] + '요일';
    return D.label(d);
  }

  var CAT_RE = /^[a-z0-9]{1,24}$/;
  var SHORT_MAX = 8;
  function cleanShort(v) { var s = typeof v === 'string' ? v.trim() : ''; return s && Array.from(s).length <= SHORT_MAX ? s : null; }
  /** 저장할 평면 이름: 비었거나 할 일 이름과 같으면 null (할 일 이름을 그대로 씀) */
  function shortFrom(input, title) {
    var s = String(input || '').trim();
    return !s || s === String(title || '').trim() ? null : s;
  }
  var MEMO_MAX = 200;
  function cleanMemo(v) { var s = typeof v === 'string' ? v.trim() : ''; return s && s.length <= MEMO_MAX ? s : null; }
  /** 저장할 메모: 앞뒤 빈칸 · 빈 줄 정리, 비었으면 null */
  function memoFrom(input) {
    var s = String(input || '').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
    return s || null;
  }
  /** 목록 줄에 보일 메모 한 줄 (줄바꿈은 빈칸으로) */
  function memoLine(memo) { return memo ? String(memo).replace(/\s*\n\s*/g, ' · ') : ''; }
  function cleanUi(ui) {
    var out = {};
    if (!ui || typeof ui !== 'object') return out;
    Object.keys(ui).forEach(function (k) {
      var v = ui[k], u = v && Number(v.u), i = v && Number(v.i);
      if (v && isFinite(u) && isFinite(i) && u >= 0 && u <= 1 && i >= 0 && i <= 1) out[k] = { u: u, i: i, at: typeof v.at === 'string' ? v.at : '' };
    });
    return out;
  }
  /** 저장소 문서 → 쓸 수 있는 것만 */
  function fromDocs(docs) {
    return (docs || []).filter(function (t) {
      return t && typeof t.id === 'string' && typeof t.title === 'string' && t.title.trim() && typeof t.scope === 'string';
    }).map(function (t) {
      return { id: t.id, scope: t.scope, title: t.title, due: typeof t.due === 'string' && !isNaN(D.parse(t.due)) ? t.due : null,
        done: t.done === true, doneBy: t.doneBy || null, doneAt: t.doneAt || null, createdBy: t.createdBy || null, createdAt: t.createdAt || '',
        cat: typeof t.cat === 'string' && CAT_RE.test(t.cat) ? t.cat : null, ui: cleanUi(t.ui), short: cleanShort(t.short), memo: cleanMemo(t.memo) };
    });
  }

  /** 완료한 날 (그날 = 목록에 남는 날) */
  function doneDay(t) { return t.done && t.doneAt ? D.dayOfIso(t.doneAt) : NaN; }
  /** 목록에 보이는 할 일: 남은 일 + 오늘 완료한 일 */
  function visible(t, today) { return !t.done || doneDay(t) === today; }
  /** 오늘 0시 (이보다 앞에 완료한 일은 보관함) — 저장소 doneAt 과 같은 모양(ISO) */
  function dayStartIso(today) { var p = D.parts(today); return new Date(p.y, p.m - 1, p.d).toISOString(); }

  /** 보관함: 완료한 날마다 묶기 (최근 날부터) → [{ day, label, items }] */
  function archiveGroups(list) {
    var groups = [], byDay = {};
    sortDone(list.filter(function (t) { return t.done; })).forEach(function (t) {
      var d = doneDay(t);
      var key = isNaN(d) ? 'x' : String(d);
      if (!byDay[key]) { byDay[key] = { day: d, label: isNaN(d) ? '날짜 모름' : D.label(d) + ' (' + D.DOW[D.parts(d).w] + ')', items: [] }; groups.push(byDay[key]); }
      byDay[key].items.push(t);
    });
    return groups;
  }

  /**
   * 한 묶음(함께 · 한 사람) 화면 값.
   * opts: { expanded: 남은 일 다 보기, showDone: 완료 보기, limit }
   * → { open: [보이는 남은 일], moreCount, openCount, done: [보이는 완료], doneCount }
   */
  function section(list, today, opts) {
    opts = opts || {};
    var limit = opts.limit || LIMIT;
    var open = sortOpen(list.filter(function (t) { return !t.done; }), today);
    var done = sortDone(list.filter(function (t) { return t.done && doneDay(t) === today; })); // 오늘 완료한 것만 (지난 것은 보관함)
    var shown = opts.expanded ? open : open.slice(0, limit);
    return { open: shown, moreCount: open.length - shown.length, openCount: open.length, done: opts.showDone ? done : [], doneCount: done.length, canCollapse: !!opts.expanded && open.length > limit };
  }

  /** 기한 고르기 → 'YYYY-MM-DD' | null. choice: none · today · tomorrow · week(이번 주 일요일) · date */
  function dueFrom(choice, today, dateKey) {
    if (choice === 'today') return D.toKey(today);
    if (choice === 'tomorrow') return D.toKey(today + 1);
    if (choice === 'week') return D.toKey(endOfWeek(today));
    if (choice === 'date') return !isNaN(D.parse(dateKey)) ? dateKey : null;
    return null;
  }
  /** 저장된 기한 → 기한 고르기 칩 */
  function choiceOf(due, today) {
    if (!due) return 'none';
    var d = D.parse(due);
    if (d === today) return 'today';
    if (d === today + 1) return 'tomorrow';
    if (d === endOfWeek(today) && d > today + 1) return 'week';
    return 'date';
  }

  function validate(f) {
    var title = String((f && f.title) || '').trim();
    if (!title) return '할 일을 적어 주세요';
    if (title.length > TITLE_MAX) return '할 일은 ' + TITLE_MAX + '자까지 쓸 수 있어요';
    if (f.choice === 'date' && isNaN(D.parse(f.date))) return '날짜를 골라 주세요';
    if (Array.from(String(f.short || '').trim()).length > SHORT_MAX) return '평면에 보일 이름은 ' + SHORT_MAX + '자까지 쓸 수 있어요';
    if ((memoFrom(f.memo) || '').length > MEMO_MAX) return '메모는 ' + MEMO_MAX + '자까지 쓸 수 있어요';
    return '';
  }

  var api = { LIMIT: LIMIT, TITLE_MAX: TITLE_MAX, endOfWeek: endOfWeek, bucket: bucket, sortOpen: sortOpen, sortDone: sortDone, dueLabel: dueLabel, fromDocs: fromDocs, section: section, dueFrom: dueFrom, choiceOf: choiceOf, validate: validate, SHORT_MAX: SHORT_MAX, shortFrom: shortFrom, cleanShort: cleanShort, doneDay: doneDay, visible: visible, dayStartIso: dayStartIso, archiveGroups: archiveGroups, cleanUi: cleanUi, MEMO_MAX: MEMO_MAX, cleanMemo: cleanMemo, memoFrom: memoFrom, memoLine: memoLine };
  root.RT = root.RT || {};
  root.RT.todos = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
