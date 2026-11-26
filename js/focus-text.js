/* 집중 F1 — 화면 글 전부 (docs/focus/spec.md 8절). 화면 코드(view-focus.js · app-focus.js)에는 한글 문장을 두지 않는다 (tests D1).
   말투: 「~해요」, 짧게, 꾸짖지 않기. 짝꿍 이름 뒤 「님」은 알림 · 안내 문장에만, 카드 · 칩 · 띠에서는 이름만 (spec 8). */
(function (root) {
  'use strict';
  var F = (typeof module !== 'undefined' && module.exports) ? require('./focus.js') : root.RT.focus;
  function dur(ms) { var m = F.mins(ms); return m.min != null ? m.min + '분' : m.hm; }
  function subj(cat, label) { return cat + (label ? ' · ' + label : ''); }

  var T = {
    tab: '집중',
    title: '집중',
    modeLoose: '느슨', modeStrict: '엄격', modeLooseBtn: '⚙ 느슨', modeStrictBtn: '🔒 엄격', setBtn: '⚙ 설정', modeHead: '집중 모드',
    modeAria: function (strict) { return '집중 설정 — 지금 ' + (strict ? '엄격' : '느슨') + ' 모드'; },

    // 오늘 카드 (2-1)
    todayKick: '오늘 · 새벽 5시부터',
    nowKick: function (s) { return '● ' + s + ' 집중 중'; },
    nowRight: function (ms) { return '지금 ' + F.hm(ms); },
    more: function (ms) { return '어제보다 +' + dur(ms); },
    less: function (ms) { return '어제 ' + F.hm(ms); },
    zero: '아직 오늘 집중한 시간이 없어요.',
    chipBoth: function (ms, now) { return '🔥 함께 ' + F.hm(ms) + (now ? ' · 지금 함께 중' : ''); },
    chipHer: function (name, ms) { return name + ' ' + F.hm(ms); },
    firstTip: '과목 옆 ▶를 누르면 바로 시작해요.',
    firstTip2: function (name) { return name + ' 님과 같은 시간에 집중하면 🔥 함께 시간이 쌓여요.'; },
    openScreen: '집중 화면 열기', end: '끝내기',
    todayAria: function (ms) { var s = Math.floor(ms / 1000); return '오늘 ' + Math.floor(s / 3600) + '시간 ' + (Math.floor(s / 60) % 60) + '분'; },

    // 짝꿍 카드 (2-2)
    herRest: function (ms) { return '오늘 ' + F.hm(ms) + ' · 쉬는 중'; },
    herNone: '오늘은 아직 쉬는 중이에요',
    herRun: function (ms) { return '집중 중 ' + dur(ms); },
    herPause: function (ms) { return '잠깐 쉬는 중 · 집중 ' + dur(ms); },
    herAway: '잠깐 자리 비움',
    herTogether: function (ms) { return '함께 ' + dur(ms) + '째'; },
    strictTag: '🔒 엄격', looseTag: '느슨',
    call: '같이 하자', join: '같이 하기', sent: '보냈어요',

    // 과목 (2-1 #4)
    subjHead: '과목 · ▶ 한 번이면 시작',
    subjMore: function (n) { return '과목 더 보기 · ' + n + '개'; }, subjMoreL: '과목 더 보기', subjMoreN: function (n) { return n + '개'; },
    subjLabelStart: '＋ 짧은 이름 붙여 시작',
    subjNow: function (label, ms) { return '● ' + (label ? label + ' · ' : '') + '지금 ' + F.hm(ms) + ' 집중 중'; },
    playAria: function (cat) { return cat + ' 시작'; },
    stopAria: function (cat) { return cat + ' 끝내기'; },
    noCat: '기타',

    // 이번 주 (5)
    week: '이번 주', legMe: '나', legBoth: '함께',
    weekEmpty: '집중한 시간이 여기에 날마다 쌓여요.',
    weekLine: function (day, me, herName, her, both) { return day + ' · 나 ' + F.hm(me) + ' · ' + herName + ' ' + F.hm(her) + ' · 함께 ' + F.hm(both); },
    weekToday: '오늘',
    weekAria: function (days, herName) { return '이번 주. ' + days.map(function (d) { return d.dow + ' 나 ' + aria(d.me) + ' ' + herName + ' ' + aria(d.her); }).join(', '); },
    dows: ['월', '화', '수', '목', '금', '토', '일'],

    // 집중 화면 (3)
    down: '작게 보기 — 집중은 계속돼요',
    badgeBoth: function (ms) { return '🔥 함께 집중 중 · ' + dur(ms); },
    badgePause: function (ms) { return '⏸ 잠깐 쉬는 중 · ' + dur(ms); },
    todaySum: function (ms) { return '오늘 합계 ' + F.hms(ms); },
    wake: '집중하는 동안 화면이 꺼지지 않아요',
    noWake: '이 기기에서는 화면이 꺼질 수 있어요',
    pauseNote: '쉬는 시간은 집중 시간에 넣지 않아요',
    pause: '잠깐 쉬기', resume: '다시 시작', endHere: '여기서 끝내기',
    awayTitle: '자리를 비웠어요',
    awayBody: function (ms) { return '앱을 나가 있던 ' + dur(ms) + '은 빼 두었어요. 이어서 하려면 「다시 시작」을 눌러요.'; },
    pRest: function (name, ms) { return name + ' · 오늘 ' + F.hm(ms) + ' · 쉬는 중'; },
    pRun: function (name, s) { return name + ' · ' + s; },

    // 끝냄 요약 (3-4)
    doneTitle: function (ms) { return '오늘 ' + F.hm(ms) + ' 집중했어요'; },
    doneThis: function (s, ms) { return '이번에는 ' + s + ' ' + F.hm(ms); },
    doneBoth: function (name) { return '🔥 ' + name + ' 님과 함께'; },
    doneHerWeek: function (name) { return '이번 주 ' + name; },
    doneMeWeek: '이번 주 나',
    editTime: '시간 고치기', ok: '확인',

    // 시트 (4)
    subjTitle: '무엇을 집중할까요?', subjSub: '시간표 카테고리와 같은 목록이에요.',
    subjMoreCats: function (n) { return '카테고리 ' + n + '개 더 ›'; },
    labelHead: '짧은 이름 (고르지 않아도 돼요)',
    labelCount: function (n) { return n + '/8'; },
    startBtn: function (s) { return s + ' 시작'; },
    changeBtn: '바꾸기',
    setTitle: '집중 설정',
    setSub: function (name) { return '나에게만 적용돼요. ' + name + ' 님은 따로 골라요.'; },
    setLoose: '다른 앱을 써도 시간이 계속 흘러요. 직접 끝낼 때까지 집중 중이에요.',
    setStrict: '앱을 나가고 5초가 지나면 「자리 비움」이 돼요. 돌아와서 「다시 시작」을 누르면 이어져요. 나가 있던 시간은 빼요.',
    setNote: function (name) { return name + ' 님에게는 「잠깐 자리 비움」만 보여요. 몇 번 비웠는지는 보이지 않아요.'; },
    catVisHead: '집중에 보일 카테고리',
    catVisSub: '끈 카테고리는 집중 목록에서만 빠지고, 시간표와 할 일에는 그대로 있어요.',
    weekSubjHead: '이번 주 나는',
    daySubjHead: function (d) { return d + ' 나는'; },
    goalHead: '하루 목표',
    goalOff: '없음',
    goalChip: function (m) { return (m / 60) + '시간'; },
    goalLeft: function (g, left) { return '목표 ' + F.hm(g) + ' · ' + F.hm(left) + ' 남음'; },
    goalDone: function (g) { return '🎯 오늘 목표 ' + F.hm(g) + ' 달성!'; },
    goalAria: function (g, pct) { return '하루 목표 ' + aria(g) + ' 중 ' + pct + '퍼센트'; },
    setBusy: '집중 중에는 바꿀 수 없어요. 다음 집중부터 적용돼요.',
    close: '닫기',
    stillTitle: '아직 하고 있어요?',
    stillBody: function (start) { return F.clock(start) + '에 시작해서 3시간째 집중 중이에요. 6시간이 지나면 자동으로 멈춰요.'; },
    stillYes: '네, 계속할게요',
    endTitle: function (start) { return F.clock(start) + '에 시작한 집중, 언제 끝났어요?'; },
    endBody: '6시간이 지나 자동으로 멈춰 두었어요. 끝난 시각을 고르면 그만큼만 기록해요.',
    endSeen: function (t) { return '마지막으로 앱을 본 ' + F.clock(t); },
    endPick: '직접 고르기',
    endSave: function (ms) { return F.hm(ms) + ' 기록하기'; },
    endSkip: '기록하지 않을래요',
    editTitle: '기록 고치기',
    editSub: function (s) { return '오늘 · ' + s; },
    editStart: '시작', editEnd: '끝', editSubj: '과목',
    editNote: '고치면 함께 시간도 다시 계산해요. 지금보다 늦은 시각은 고를 수 없어요.',
    editSave: function (ms) { return F.hm(ms) + ' 저장'; },
    editDel: '이 기록 지우기',
    delAsk: function (ms) { return '이 기록을 지울까요? ' + F.hm(ms) + '가 오늘 합계에서 빠져요.'; },
    del: '지우기', keep: '그대로 두기',
    overlapErr: function (o) { return F.clock(o[0]) + ' ~ ' + F.clock(o[1]) + ' 기록과 겹쳐요'; },
    orderErr: '끝이 시작보다 늦어야 해요', futureErr: '지금보다 늦은 시각은 고를 수 없어요', shortErr: '1분 넘게 골라 주세요',
    logTitle: '오늘 기록', logEmpty: '오늘 기록이 아직 없어요', logRow: function (s, e) { return F.clock(s) + ' – ' + F.clock(e); },
    readOnly: '짝꿍 기록은 볼 수만 있어요',

    // 띠 (6-1)
    bandPartner: function (name, s, ms) { return '● ' + name + ' · ' + s + ' 중 ' + dur(ms); },
    bandMe: function (s, ms) { return '● 나 · ' + s + ' ' + F.hm(ms); },
    bandBoth: function (ms) { return '🔥 함께 집중 중 ' + dur(ms); },
    bandPause: function (ms) { return '⏸ 나 · 잠깐 쉬는 중 ' + dur(ms); },
    bandJoin: '같이 하기 ›', bandSee: '보기 ›',
    dotPartner: function (name) { return name + ' 님 집중 중'; }, dotBoth: '함께 집중 중', dotMe: '집중 중',

    // 토스트 (8-3)
    tStarted: function (s) { return s + ' 시작했어요'; },
    tSwitched: function (c) { return c + '로 바꿨어요'; },
    tDone: function (ms) { return F.hm(ms) + ' 집중했어요'; },
    todoDoneBtn: function (t) { return '✓ 할 일 「' + t + '」도 끝냈어요'; },
    tTodoDone: function (t) { return '「' + t + '」 끝! 할 일에 체크했어요'; },
    tCalled: function (name) { return name + ' 님에게 같이 하자고 보냈어요'; },
    tCallWait: '30분 뒤에 다시 보낼 수 있어요',
    tCalledMe: function (name) { return '💌 ' + name + ' 님이 같이 집중하재요'; },
    tEdited: '기록을 고쳤어요', tDeleted: '기록을 지웠어요', tShort: '1분이 안 돼서 기록하지 않았어요',
    tPauseLong: function (t) { return '쉬는 시간이 길어서 ' + F.clock(t) + '에 끝냈어요'; },
    tOffline: '연결이 끊겨도 시간은 이 기기에서 계속 재요',
    tFail: '저장하지 못했어요. 인터넷 연결을 확인해 주세요',
    tBusyMode: '집중 중에는 바꿀 수 없어요',

    // 알림 시트 (8-4) — F2 서버가 보내기 전까지 설정만
    nGroup: '집중', nStart: '짝꿍이 집중을 시작하면', nCall: '같이 하자 받기',
    subj: subj, dur: dur
  };
  function aria(ms) { var m = Math.floor(ms / 60000); return Math.floor(m / 60) + '시간 ' + (m % 60) + '분'; }

  // ── 집중 통계 문구 (docs/focus-stats/text.md — 기획 참조 구현 reference/focus-text.js 글자 그대로) ──
  // 지금 문구(T)와 키가 겹쳐서(bandMe · bandBoth = 위쪽 띠) 따로 S 에 모음 → RT.focusText.S
  var S = (function () {
  var DOW = ['월', '화', '수', '목', '금', '토', '일'];
  var DOW_LONG = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function mins(ms) { return Math.max(0, Math.floor((ms || 0) / 60000)); }

  // 짧은 곳: H:MM
  function short(ms) {
    var m = mins(ms);
    return Math.floor(m / 60) + ':' + pad(m % 60);
  }
  // 문장: 「2시간 10분」 · 「2시간」 · 「48분」 · 「0분」
  function long(ms) {
    var m = mins(ms);
    if (m < 60) return m + '분';
    var h = Math.floor(m / 60), r = m % 60;
    return r ? h + '시간 ' + r + '분' : h + '시간';
  }
  function md(day) { // '2026-11-18' → '11/18'
    var p = day.split('-');
    return Number(p[1]) + '/' + Number(p[2]);
  }

  var T = {
    DOW: DOW,
    DOW_LONG: DOW_LONG,
    short: short,
    long: long,
    md: md,

    // ── 집중 탭 · 이번 주 카드 ──
    weekTitle: '이번 주',
    weekTotal: function (ms) { return '나 ' + short(ms); },
    vsLastWeek: function (diffMs) { return '지난주 이맘때보다 +' + long(diffMs); },
    scaleTop: function (ms) { return long(ms); },
    goalLine: function (ms) { return '목표 ' + short(ms); },
    legendMe: '나',
    legendBoth: '함께',
    weekHint: '요일을 누르면 그날 것만 보여요',
    dayLine: function (dow, me, herName, her, both) {
      return DOW[dow] + ' · 나 ' + short(me) + ' · ' + herName + ' ' + short(her) + ' · 함께 ' + short(both);
    },
    dayLineDate: function (day, me, herName, her, both) {
      return md(day) + ' · 나 ' + short(me) + ' · ' + herName + ' ' + short(her) + ' · 함께 ' + short(both);
    },
    dayAria: function (dow, me, herName, her, both) {
      return DOW_LONG[dow] + ', 나 ' + long(me) + ', ' + herName + ' ' + long(her) + ', 함께 ' + long(both);
    },
    empty: '집중한 시간이 여기에 날마다 쌓여요.',
    dayEmpty: '이날은 집중한 기록이 없어요.',

    // 시간대 띠
    bandTitle: function (dow) { return DOW_LONG[dow] + ' 언제 했을까'; },
    bandMe: '나',
    bandBoth: '함께',

    // 과목
    subjWeek: '이번 주 나는',
    subjDay: function (dow) { return DOW_LONG[dow] + ' 나는'; },
    subjMonth: '이번 달 나는',
    subjMonthPast: '이 달 나는',
    subjWeekPast: '이 주 나는',
    subjOther: '그 밖',
    subjOtherN: function (n) { return '그 밖 ' + n + '개'; },
    labelsMore: function (n) { return '외 ' + n + '개'; },

    // 기록 칸 (칸 = 이름 · 값 · 아래 한 줄)
    days: function (n) { return n + '일'; },
    streakLabel: '연속',
    streak: function (n) { return n + '일 연속'; }, // 읽어 주기(aria)용
    streakSub: '오늘도 했어요',
    streakNext: function (n) { return '오늘 하면 ' + (n + 1) + '일째'; },
    daysFocusedLabel: '이번 주 집중한 날',
    longestLabel: '가장 긴 한 번',
    longestSub: function (dow, label) { return DOW[dow] + (label ? ' · ' + label : ''); },
    goalDaysLabel: '목표 채운 날',
    goalDaysSub: function (goalMs) { return '하루 ' + short(goalMs) + ' 기준'; },
    bestDayLabel: '가장 많이 한 날',
    bestDaySub: function (dow) { return DOW_LONG[dow]; },

    // ── 돌아보기 ──
    rvTitle: '함께 집중',
    rvPeople: function (me, herName, her) { return '나 ' + short(me) + ' · ' + herName + ' ' + short(her); },
    rvTogetherDays: function (n) { return '함께한 날 ' + n + '일'; },
    rvBestTogether: function (day, ms) { return '함께 가장 길었던 날 ' + md(day) + ' · ' + short(ms); },
    rvNoTogether: '이번엔 따로따로 집중했어요',
    noValue: '—',
    rvEmptyWeek: '이 주에는 집중 기록이 없어요.',
    rvEmptyMonth: '이 달에는 집중 기록이 없어요.',
    rvSegMe: '나',
    rvLegendLess: '적게',
    rvLegendMore: '많이',
    rvLegendTogether: '함께한 날',
    rvBestDayLabel: '가장 많이 한 날',
    rvLongestLabel: '가장 긴 한 번',
    rvBestTogetherLabel: '함께 가장 길게',
    rvDaySub: function (day) { return md(day); },

    // ── 월 결산 카드 ──
    rcTitle: '함께 집중',
    rcLead: '둘이 같은 시간에 켜 둔 시간이에요.',
    rcLeadSolo: '이번 달은 각자 집중했어요.',
    rcSoloBig: '우리가 집중한 시간',
    rcPerson: function (name, ms) { return name + ' ' + long(ms); },
    rcPeople: function (meName, me, herName, her) { return meName + ' ' + long(me) + ' · ' + herName + ' ' + long(her); },
    rcTogetherDays: function (n) { return '함께 집중한 날 ' + n + '일'; },
    rcBestTogether: function (day, ms) { return '가장 길게 함께한 날 ' + md(day) + ' · ' + long(ms); },
    rcVsPrev: function (diffMs) { return diffMs >= 0 ? '지난달보다 +' + long(diffMs) : '지난달보다 −' + long(-diffMs); },
    rcCalHint: '날마다 함께한 시간',
    rcSince: function (day) { return md(day) + '부터 모은 기록이에요'; },
    rcTile: '함께 집중',
    rcTileSolo: '우리가 집중',
    rcYearBest: function (month, ms) { return '가장 많이 함께한 달 ' + Number(month.split('-')[1]) + '월 · ' + long(ms); }
  };
    return T;
  })();

  var api = { T: T, S: S };
  root.RT = root.RT || {};
  root.RT.focusText = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
