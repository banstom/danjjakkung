/* 사람 — "지금 누가 보고 있나"와 "이 루틴은 누구 것인가"만 다룬다.
   config.ownerPerson: 이 페이지 주인(준민)의 사람 키, config.guestPerson: 초대받은 사람(다진)의 사람 키.
   루틴의 owner가 사람 키다. */
(function (root) {
  'use strict';

  /** 사람 키 → 표시 이름 (루틴의 who에서 가져온다). */
  function nameOf(routines, person) {
    for (var i = 0; i < routines.length; i++) if (routines[i].owner === person) return routines[i].who;
    return '';
  }

  /** 사람 키 → 이름. config.people({ me: '준민', her: '다진' })가 먼저, 없으면 루틴의 who. */
  function names(config, routines) {
    var out = Object.create(null);
    routines.forEach(function (r) { if (r.who && !out[r.owner]) out[r.owner] = r.who; });
    var cp = config && config.people;
    if (cp && typeof cp === 'object') Object.keys(cp).forEach(function (k) { if (typeof cp[k] === 'string' && cp[k]) out[k] = cp[k]; });
    return out;
  }

  /** 페이지에 등장하는 사람 목록 (루틴 순서대로, 중복 없이). */
  function list(routines) {
    var seen = Object.create(null), out = [];
    routines.forEach(function (r) {
      if (seen[r.owner]) return;
      seen[r.owner] = true;
      out.push({ person: r.owner, name: r.who });
    });
    return out;
  }

  /**
   * 보는 사람 정하기.
   * - isOwner가 true/false로 확실하면: 주인 → ownerPerson, 아니면 → guestPerson
   * - 알 수 없으면(null): 이 기기에서 고른 값(saved)을 쓰고, 그것도 없으면 null(고르게 한다)
   */
  function resolve(config, isOwner, saved, routines) {
    // 루틴이 하나도 없는 사람도 알아볼 수 있게 config.people도 본다
    var people = Object.keys(names(config, routines));
    var owner = config && config.ownerPerson, guest = config && config.guestPerson;
    if (isOwner === true && people.indexOf(owner) >= 0) return { person: owner, source: 'account' };
    if (isOwner === false && people.indexOf(guest) >= 0) return { person: guest, source: 'account' };
    if (saved && people.indexOf(saved) >= 0) return { person: saved, source: 'device' };
    return { person: null, source: 'none' };
  }

  var api = { nameOf: nameOf, names: names, list: list, resolve: resolve };
  root.RT = root.RT || {};
  root.RT.people = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
