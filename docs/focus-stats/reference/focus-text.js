// 집중 통계 문구 — 참조 구현 (기획 계정, 2026-11-26)
// 저장소에서는 js/focus-text.js 에 이 키 그대로 모아 주세요. 글자 하나까지 text.md 표와 같아요.
// 꾸중하는 말투 금지: 줄어든 것 · 안 한 날은 말하지 않거나 다음 걸음으로만 말해요.
(function (root) {
  'use strict';

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

  if (typeof module !== 'undefined' && module.exports) module.exports = T;
  else root.FT = T;
})(this);
