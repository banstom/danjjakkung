/* 월말 · 연말결산 카드 문구 (docs/recap/spec.md 2절) — 저장된 결산 문서(recaps/{key}) + 보는 사람 → 카드에 쓸 글.
   숫자 계산은 서버(functions/recap.js)가 끝내 두고, 여기서는 글자만 만든다. 사람 순서 = 화면을 보는 사람이 먼저. */
(function (root) {
  'use strict';
  var NODE = typeof module !== 'undefined' && module.exports;
  var L = NODE ? require('./ledger-sum.js') : root.RT.ledgerSum;

  var DOW = '월화수목금토일';
  /** 'YYYY-MM-DD' → "11월 8일 (일)" */
  function dayLabel(s) {
    var p = String(s).split('-').map(Number);
    var w = (new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() + 6) % 7;
    return p[1] + '월 ' + p[2] + '일 (' + DOW[w] + ')';
  }
  /** "31시간" · 1시간 미만이면 "45분" */
  function hoursText(minutes) { return minutes < 60 ? minutes + '분' : Math.round(minutes / 60) + '시간'; }

  function signed(n, unit) { return n > 0 ? '+' + n + unit : n < 0 ? '−' + (-n) + unit : null; }
  /** "지난달보다 +2일" · 같으면 "지난달과 같아요" · 비교 없음 null (빨강 안 씀 — 화면이 같은 색으로) */
  function cmpText(n, unit, kind) {
    if (n === null || n === undefined) return null;
    var when = kind === 'year' ? '작년' : '지난달';
    return n === 0 ? when + '과 같아요' : when + '보다 ' + signed(n, unit);
  }

  function cardText(card, recap, viewerUid) {
    var people = recap.people.slice().sort(function (a, b) { return a.uid === viewerUid ? -1 : b.uid === viewerUid ? 1 : 0; });
    function name(uid) { var p = recap.people.filter(function (x) { return x.uid === uid; })[0]; return p ? p.name : ''; }
    var kind = recap.period.kind;
    var per = kind === 'year' ? '올해' : '이번 달';
    switch (card.id) {
      case 'cover':
        return { kick: card.dateLabel, title: card.title, sub: '단짝이 된 지 ' + L.comma(card.daysTogether) + '일' };
      case 'together':
        return {
          kick: '함께 해낸 날', big: card.fullDays, unit: '일',
          lead: '둘 다 그날 루틴을 모두 해낸 날이에요.',
          more: [card.longestStreak >= 2 ? '가장 길게는 ' + card.longestStreak + '일 연속' : null,
            kind === 'year' && card.bestMonth ? '가장 잘 해낸 달은 ' + card.bestMonth.month + '월 (' + card.bestMonth.fullDays + '일)' : null].filter(Boolean),
          cmp: cmpText(card.diffPrev, '일', kind)
        };
      case 'routines':
        return {
          kick: '각자의 루틴',
          rows: people.map(function (p) { return card.people.filter(function (x) { return x && x.uid === p.uid; })[0]; }).filter(Boolean).map(function (x) {
            return { uid: x.uid, name: name(x.uid), routine: x.name, pct: x.pct, sub: x.done + '/' + x.due + '일',
              cmp: x.diff === null ? null : (signed(x.diff, '%p') || '그대로') };
          })
        };
      case 'todos':
        return {
          kick: '함께 끝낸 일', big: card.total, unit: '개',
          lead: card.shared ? '그중 함께 할 일이 ' + card.shared + '개예요.' : per + ' 끝낸 할 일이에요.',
          rows: people.map(function (p) { return { uid: p.uid, name: p.name, value: card.byPerson[p.uid] + '개' }; }),
          more: card.busiest && card.busiest.count >= 2 ? ['가장 많이 끝낸 날 ' + dayLabel(card.busiest.date) + ' · ' + card.busiest.count + '개'] : [],
          cmp: cmpText(card.diffPrev, '개', kind)
        };
      case 'kungs':
        return {
          kick: '꿍', big: card.total, unit: '번', lead: per + ' 주고받은 꿍이에요.',
          rows: people.map(function (p) { return { uid: p.uid, name: p.name, value: card.byPerson[p.uid] + '번 보냄' }; }),
          more: card.busiest ? ['가장 많이 오간 날 ' + dayLabel(card.busiest.date) + ' · ' + card.busiest.count + '번'] : [],
          cmp: cmpText(card.diffPrev, '번', kind)
        };
      case 'time':
        return {
          kick: '함께 보낸 시간', big: card.minutes < 60 ? card.minutes : card.hours, unit: card.minutes < 60 ? '분' : '시간',
          lead: '함께 일정 ' + card.count + '개를 모은 시간이에요.', cmp: cmpText(card.diffPrev, '시간', kind), text: hoursText(card.minutes)
        };
      case 'places': {
        var lines = [];
        if (card.newPlaces.length) lines.push('새로 칠한 곳 ' + card.newPlaces.length + '곳 · ' + card.newPlaces.slice(0, 3).join(' · ') + (card.newPlaces.length > 3 ? ' 외' : ''));
        if (kind === 'year' && card.topRegion) lines.push('올해 별점 1위 ' + card.topRegion.name + ' ★' + card.topRegion.avg.toFixed(1));
        var best = card.best;
        return {
          kick: '짝꿍 지도', big: card.visits, unit: '번', lead: card.places + '곳을 함께 다녀왔어요.', more: lines,
          best: best ? {
            title: best.name + ' · ' + dayLabel(best.date),
            stars: Math.round(best.avg * 10) / 10,
            memos: people.map(function (p) { return best.per.filter(function (x) { return x.uid === p.uid; })[0]; }).filter(Boolean)
              .map(function (x) { return { uid: x.uid, name: name(x.uid), stars: x.stars, note: x.note }; })
          } : null
        };
      }
      case 'meals':
        return {
          kick: '짝꿍 식탁', big: card.sharedMeals, unit: '번', lead: '함께 먹은 끼니예요.',
          rows: people.map(function (p) { return { uid: p.uid, name: p.name, value: '목표 맞춘 날 ' + card.goalDays[p.uid] + '일' }; }),
          note: '몸 정보 · 체중은 결산에 넣지 않아요'
        };
      case 'spends':
        return {
          kick: '단짝 영수증', title: recap.cards[0].dateLabel.replace(/^\d+년 /, '') + '의 단짝 영수증', bigText: L.won(card.total), lead: per + ' 함께 쓴 돈이에요.',
          rows: people.map(function (p) { return { uid: p.uid, name: p.name, pct: card.byPerson[p.uid].pct, value: L.manWon(card.byPerson[p.uid].amount) }; }),
          more: ['가장 많이 쓴 곳은 ' + L.CAT_LABEL[card.topCat] + ' · ' + L.manWon(card.topCatAmount) + (card.topCatCount ? ' · ' + card.topCatCount + '건' : '')]
        };
      case 'final':
        return {
          kick: recap.cards[0].dateLabel, title: kind === 'year' ? '우리의 한 해 요약' : '우리의 한 달 요약',
          tiles: card.tiles.map(function (t) { return { big: L.comma(t.value) + t.unit, label: t.label }; }),
          spends: card.spends ? { total: L.won(card.spends.total), line: people.map(function (p) { return p.name + ' ' + card.spends.byPerson[p.uid].pct + '%'; }).join(' · ') } : null
        };
      default:
        return null;
    }
  }

  var api = { dayLabel: dayLabel, hoursText: hoursText, cmpText: cmpText, cardText: cardText };
  root.RT = root.RT || {};
  root.RT.recapText = api;
  if (NODE) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
