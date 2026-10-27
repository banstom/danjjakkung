/* 계절 — 12~2월 겨울, 3~5월 봄, 6~8월 여름, 9~11월 가을.
   실제 색 값은 styles/tokens.css 한 곳에만 있다. 여기서는 이름과 아이콘만. */
(function (root) {
  'use strict';
  var SEASONS = {
    spring: { key: 'spring', name: '봄', icon: '🌸' },
    summer: { key: 'summer', name: '여름', icon: '🌻' },
    autumn: { key: 'autumn', name: '가을', icon: '🍁' },
    winter: { key: 'winter', name: '겨울', icon: '⛄' }
  };

  function seasonOf(month) {
    if (month === 12 || month <= 2) return SEASONS.winter;
    if (month <= 5) return SEASONS.spring;
    if (month <= 8) return SEASONS.summer;
    return SEASONS.autumn;
  }

  var api = { SEASONS: SEASONS, seasonOf: seasonOf };
  root.RT = root.RT || {};
  root.RT.seasons = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
