/* 화면 그리기 — 짝꿍과의 연말 문답 (docs/yearqa/spec.md). 값은 js/app-yearqa.js 가 만들고, 글자 계산은 js/yearqa.js.
   entry(m) : 돌아보기 「결산」 칸 맨 위 배너 아래 카드
   sheet(m) : 쓰는 화면 (전체 화면 시트)
   card(card, text, m) : 연말결산 덱 끝에 붙는 문답 카드 속 (view-recap 이 진행 막대 · 닫기를 붙임) */
(function (root) {
  'use strict';
  var NODE = typeof module !== 'undefined' && module.exports;
  var Y = NODE ? require('./yearqa.js') : root.RT.yearqa;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function br(s) { return esc(s).replace(/\n/g, '<br>'); }
  var BACK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var ENV = '<svg width="34" height="26" viewBox="0 0 34 26" aria-hidden="true"><rect x="1" y="1" width="32" height="24" rx="3" fill="var(--surface)" stroke="currentColor" stroke-width="1.5"/><path d="M2 3l15 11L32 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  var LOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
  function dot(slot) { return '<span class="dot dot--' + esc(slot) + ' dot--sm" aria-hidden="true"></span>'; }

  /** 단계별 한 줄 (입구 · 쓰는 화면 위) */
  function statusLine(m) {
    var pn = m.pname || '짝꿍';
    switch (m.phase) {
      case 'write': return m.partnerSealed ? Y.iga(pn) + ' 먼저 봉투를 붙였어요 · 내 문답을 기다려요' : '12월 31일까지 써 두면 1월 1일 결산 뒤에 펼쳐져요';
      case 'wait': return '내 봉투는 붙였어요 · ' + Y.iga(pn) + ' 붙이면 1월 1일에 펼쳐져요';
      case 'ready': return '둘 다 봉투를 붙였어요 · 1월 1일 결산 뒤에 펼쳐져요';
      case 'open': return '펼쳐졌어요 · 연말결산 마지막 장 뒤에 있어요';
      case 'closed': return '올해 문답은 닫혔어요';
      default: return '';
    }
  }

  /** 입구 카드. m = { year, phase, done, total, partnerSealed, pname, slotMe, slotHer } | null */
  function entry(m) {
    if (!m || m.phase === 'before') return '';
    var act = m.phase === 'open' ? 'yq-reveal' : 'yq-open';
    var btn = m.phase === 'open' ? '펼쳐 보기' : m.phase === 'write' ? (m.done ? '이어 쓰기' : '쓰러 가기') : m.phase === 'closed' ? '내 답 보기' : '내 답 보기 · 고치기';
    return '<button type="button" class="card yq-entry" data-act="' + act + '" data-v="' + esc(m.year) + '">' +
      '<span class="yq-entry__env">' + ENV + '</span><span class="yq-entry__tx"><span class="yq-entry__kick">' + esc(m.year) + '년 · ' + esc(Y.NAME) + '</span>' +
      '<span class="yq-entry__title">서로에게 묻는 ' + Y.ALL.length + '개의 질문</span>' +
      '<span class="yq-entry__sub">' + esc(statusLine(m)) + '</span>' +
      '<span class="yq-entry__who">' + dot(m.slotMe) + (m.phase === 'write' ? esc(m.done + ' / ' + m.total + ' 답함') : '봉투 붙임') +
      '<span class="yq-entry__sep"></span>' + dot(m.slotHer) + esc(m.partnerSealed ? '봉투 붙임' : '쓰는 중') + '</span></span>' +
      '<span class="yq-entry__go">' + esc(btn) + ' ›</span></button>';
  }

  /**
   * 쓰는 화면. m = { year, phase, sealed, secs: [{ id, title, done, total }], cur, qs: [{ id, q, note, hint, value }], save: 'saved'|'dirty'|'saving'|'error'|'',
   *   confirm: { done, empty } | null, capsule: { from, text } | null, readOnly, sealing, entering, pname }
   */
  function sheet(m) {
    var curIdx = m.secs.map(function (s) { return s.id; }).indexOf(m.cur);
    var saveTx = { saved: '저장했어요', dirty: '저장 전', saving: '저장하는 중…', error: '저장하지 못했어요 · 인터넷을 확인해 주세요' }[m.save] || '';
    var head = '<div class="yq-head"><button type="button" class="yq-back" data-act="yq-close" aria-label="닫기">' + BACK + '</button>' +
      '<div class="yq-head__tx"><h2 class="yq-head__t" id="yq-title">' + esc(Y.NAME) + '</h2><span class="yq-head__s">' + esc(m.year) + '년 · ' + esc(statusLine(m)) + '</span></div>' +
      '<span class="yq-save' + (m.save === 'error' ? ' yq-save--err' : '') + '" role="status" aria-live="polite">' + esc(saveTx) + '</span></div>';
    var capsule = m.capsule ? '<div class="yq-letter"><span class="yq-letter__k">작년의 ' + esc(Y.iga(m.capsule.from)) + ' 남긴 한 줄</span><p class="yq-letter__t">' + br(m.capsule.text) + '</p></div>' : '';
    var intro = curIdx === 0 && !m.sealed ? '<p class="yq-intro">서로를 떠올리며 답해 주세요. 봉투를 붙이고 ' + esc(m.pname || '짝꿍') + '도 붙이면 <b>1월 1일 연말결산 뒤</b>에 함께 펼쳐져요. 빈 칸은 건너뛴 질문이 돼요.</p>' : '';
    var tabs = '<div class="yq-tabs" role="tablist" aria-label="질문 묶음">' + m.secs.map(function (s, i) {
      return '<button type="button" class="yq-tab" role="tab" data-act="yq-sec" data-v="' + esc(s.id) + '" aria-selected="' + (s.id === m.cur) + '">' +
        '<span class="yq-tab__n">' + (i + 1) + '</span><span class="yq-tab__t">' + esc(s.title) + '</span><span class="yq-tab__c" id="yq-c-' + esc(s.id) + '">' + s.done + '/' + s.total + '</span></button>';
    }).join('') + '</div>';
    var qs = '<div class="yq-qs" role="tabpanel" aria-label="' + esc(m.secs[curIdx] ? m.secs[curIdx].title : '') + '">' + m.qs.map(function (q, i) {
      var n = Y.len(q.value), over = n > Y.MAX;
      return '<div class="yq-q' + (q.capsule ? ' yq-q--capsule' : '') + '"><label class="yq-q__q" for="yq-a-' + esc(q.id) + '"><span class="yq-q__no">' + (i + 1) + '</span>' + esc(q.q) + '</label>' +
        (q.note ? '<p class="yq-q__note">' + LOCK + esc(q.note) + '</p>' : '') +
        (q.hint ? '<p class="yq-q__hint">힌트 · ' + esc(q.hint) + '</p>' : '') +
        '<textarea id="yq-a-' + esc(q.id) + '" class="field__input field__input--memo yq-q__a" rows="2" maxlength="' + (Y.MAX + 50) + '"' + (m.readOnly ? ' readonly' : '') +
        ' placeholder="' + (m.readOnly ? '' : '비워 두면 건너뛰어요') + '"' + (over ? ' aria-invalid="true"' : '') + '>' + esc(q.value) + '</textarea>' +
        '<span class="yq-q__cnt' + (over ? ' is-over' : '') + '" id="yq-n-' + esc(q.id) + '">' + n + ' / ' + Y.MAX + '</span></div>';
    }).join('') + '</div>';
    var last = curIdx === m.secs.length - 1;
    var foot = '<div class="yq-foot">' +
      (curIdx > 0 ? '<button type="button" class="rc-btn2" data-act="yq-sec" data-v="' + esc(m.secs[curIdx - 1].id) + '">이전</button>' : '') +
      (!last ? '<button type="button" class="rc-btn" data-act="yq-sec" data-v="' + esc(m.secs[curIdx + 1].id) + '">다음 묶음</button>'
        : m.readOnly ? '<button type="button" class="rc-btn" data-act="yq-close">닫기</button>'
        : m.sealed ? '<button type="button" class="rc-btn" data-act="yq-close">다 고쳤어요</button>'
        : '<button type="button" class="rc-btn" data-act="yq-seal-ask">' + ENV + '봉투 붙이기</button>') + '</div>' +
      (m.sealed && !m.readOnly ? '<p class="yq-foot__note">봉투를 붙인 뒤에도 고칠 수 있어요. 고친 답은 바로 저장돼요.</p>' : '');
    var confirm = m.confirm ? '<div class="rc-notesheet yq-confirm" data-act="yq-seal-no"><div class="rc-notesheet__card" role="dialog" aria-modal="true" aria-labelledby="yq-cf-t" data-act="yq-stay">' +
      '<h3 class="yq-confirm__t" id="yq-cf-t">봉투를 붙일까요?</h3>' +
      '<p class="yq-confirm__p">답한 질문 <b>' + m.confirm.done + '개</b>' + (m.confirm.empty ? ' · 건너뛴 질문 ' + m.confirm.empty + '개' : '') + '<br>' +
      esc(m.pname || '짝꿍') + '의 답은 둘 다 봉투를 붙이고 1월 1일이 되면 펼쳐져요. 붙인 뒤에도 내 답은 고칠 수 있어요.</p>' +
      '<div class="rc-actions"><button type="button" class="rc-btn2" data-act="yq-seal-no">더 쓸게요</button><button type="button" class="rc-btn" data-act="yq-seal"' + (m.sealing ? ' disabled aria-busy="true"' : '') + '>' + (m.sealing ? '붙이는 중…' : '붙이기') + '</button></div></div></div>' : '';
    return '<div class="sheet-layer sheet-layer--full"><section class="sheet yq' + (m.entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="yq-title">' +
      head + '<div class="yq-scroll">' + capsule + intro + tabs + qs + foot + '</div>' + confirm + '</section></div>';
  }

  /** 연말결산 덱의 문답 카드 속 */
  function card(c, t, m) {
    var slots = m.slotOf, me = m.viewer, her = m.partnerUid;
    function pair(mine, theirs, big) {
      return '<div class="yq-pair' + (big ? ' yq-pair--big' : '') + '">' +
        '<div class="yq-ans"><span class="yq-ans__who">' + dot(slots(me)) + esc(m.nameOf(me)) + '</span><p class="yq-ans__t' + (mine ? '' : ' is-empty') + '">' + (mine ? br(mine) : '건너뛰었어요') + '</p></div>' +
        '<div class="yq-ans"><span class="yq-ans__who">' + dot(slots(her)) + esc(m.nameOf(her)) + '</span><p class="yq-ans__t' + (theirs ? '' : ' is-empty') + '">' + (theirs ? br(theirs) : '건너뛰었어요') + '</p></div></div>';
    }
    switch (c.id) {
      case 'yq-wait':
        return '<div class="rc-body"><p class="rc-kick">' + esc(t.kick) + '</p><h2 class="rc-title yq-title">' + esc(t.title) + '</h2><p class="rc-lead">' + br(t.lead) + '</p>' +
          (t.action ? '<div class="rc-actions yq-acts"><button type="button" class="rc-btn" data-act="yq-open" data-v="' + esc(m.yqYear) + '">' + (t.action === 'write' ? '문답 쓰러 가기' : '내 답 보기') + '</button></div>' : '') + '</div>';
      case 'yq-intro':
        return '<div class="rc-body rc-body--cover"><span class="yq-env-big" aria-hidden="true">' + ENV + '</span><p class="rc-kick">' + esc(t.kick) + '</p><h2 class="rc-title yq-title">' + esc(t.title) + '</h2>' +
          '<p class="rc-lead rc-lead--h">' + esc(t.lead) + '</p><p class="rc-note">' + esc(t.sub) + '</p></div>';
      case 'yq-sec':
        return '<div class="rc-body yq-sec"><p class="rc-kick">' + esc(t.kick) + '</p><h2 class="rc-final__t">' + esc(t.title) + '</h2>' + t.rows.map(function (r) {
          return '<div class="rc-panel yq-row"><p class="yq-row__q">' + esc(r.q) + '</p>' + pair(r.mine, r.theirs) + '</div>';
        }).join('') + '</div>';
      case 'yq-capsule':
        return '<div class="rc-body"><p class="rc-kick">' + esc(t.kick) + '</p><h2 class="rc-title yq-title">' + esc(t.title) + '</h2><p class="rc-lead">' + esc(t.lead) + '</p>' +
          '<div class="yq-capsules">' + [[me, t.mine], [her, t.theirs]].map(function (x) {
            return '<div class="yq-capsule' + (x[1] ? '' : ' is-empty') + '"><span class="yq-capsule__env">' + ENV + '</span><span class="yq-ans__who">' + dot(slots(x[0])) + esc(m.nameOf(x[0])) + '</span><span class="yq-capsule__s">' + (x[1] ? LOCK + '봉인됨' : '안 남겼어요') + '</span></div>';
          }).join('') + '</div></div>';
      case 'yq-first':
        return '<div class="rc-body"><p class="rc-kick">' + esc(t.kick) + '</p><h2 class="rc-title yq-title">' + esc(t.title) + '</h2>' + pair(t.mine, t.theirs, true) + '</div>';
      default:
        return '';
    }
  }

  var api = { entry: entry, sheet: sheet, card: card, statusLine: statusLine };
  root.RT = root.RT || {};
  root.RT.viewYearqa = api;
  if (NODE) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
