/* 「우리 둘」 박스 · 내 사진 시트 · 사진 자리 고르기 화면 (v51).
   박스: 왼쪽 · 오른쪽 동그라미(사진 또는 그 사람 색) + 가운데 「단짝이 된 지 N일」 · 「다음 기념일까지 D-n」 */
(function (root) {
  'use strict';
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var CAM = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';

  /** p = { uid, name, slot: 'me' | 'her', img, mine } */
  var IMG_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/; // 단짝이 올린 글자가 CSS url( ) 밖으로 새지 않게 (점검 AI)
  function face(p) {
    if (p.img && !IMG_RE.test(p.img)) p = Object.assign({}, p, { img: '' });
    var inner = '<span class="ubox__ph ubox__ph--' + p.slot + '"' + (p.img ? ' style="background-image:url(' + esc(p.img) + ')"' : '') + '>' +
      (p.img ? '' : '<span class="ubox__ini" aria-hidden="true">' + esc((p.name || '').slice(0, 1)) + '</span>') + '</span>' +
      (p.mine ? '<span class="ubox__cam" aria-hidden="true">' + CAM + '</span>' : '');
    var label = '<span class="ubox__nm">' + esc(p.name) + '</span>';
    // 사진이 있으면 누구 것이든 눌러 크게 보기 (v52). 내 것이고 사진이 없으면 바로 올리기
    if (p.img) return '<button type="button" class="ubox__face" data-act="ava-view" data-v="' + esc(p.uid) + '" aria-label="' + esc(p.name + ' 사진 크게 보기') + '">' + '<span class="ubox__ring">' + inner + '</span>' + label + '</button>';
    return p.mine
      ? '<button type="button" class="ubox__face" data-act="ava-open" aria-label="' + esc(p.name + ' 사진 올리기') + '">' + '<span class="ubox__ring">' + inner + '</span>' + label + '</button>'
      : '<span class="ubox__face"><span class="ubox__ring">' + inner + '</span>' + label + '</span>';
  }

  /** b = { left, right, line1, line2, unset, off } */
  function box(b) {
    var mid = b.off ? '<span class="ubox__mid"><span class="ubox__l1">우리 둘</span></span>'
      : '<button type="button" class="ubox__mid" data-act="open-anniv" aria-label="' + esc((b.line1 || '') + ' · ' + (b.line2 || '') + ' · 기념일 보기') + '">' +
        '<span class="ubox__l1">' + esc(b.line1) + '</span>' + (b.line2 ? '<span class="ubox__l2">' + esc(b.line2) + '</span>' : '') + '</button>';
    return '<section class="card ubox" aria-label="우리 둘">' + (b.left ? face(b.left) : '') + mid + (b.right ? face(b.right) : '') + '</section>';
  }

  /** 내 사진 시트. a = { name, img, error, busy } */
  function sheet(a, entering) {
    return '<div class="sheet-layer">' +
      '<button type="button" class="scrim" data-act="ava-close" aria-label="닫기"></button>' +
      '<section class="sheet' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="ava-title">' +
      '<span class="grabber" aria-hidden="true"></span><h2 id="ava-title" class="sheet__title">내 사진</h2>' +
      '<p class="sheet__sub">올린 사진은 ' + esc(a.partnerName || '단짝') + ' 님 단짝꿍에도 보여요. 동그라미로 보일 부분을 고를 수 있어요</p>' +
      '<label class="mbtn mbtn--solid ava__pick"><input id="ava-file" type="file" accept="image/*" class="sr-only">' + (a.img ? '사진 바꾸기' : '사진 고르기') + '</label>' +
      (a.img ? '<button type="button" class="mbtn ava__del" data-act="ava-delete"' + (a.busy ? ' disabled' : '') + '>사진 지우기 · 테마 색으로</button>' : '') +
      (a.error ? '<p class="rform__error" role="alert">' + esc(a.error) + '</p>' : '') +
      '<button type="button" class="close-btn" data-act="ava-close">닫기</button></section></div>';
  }

  /** 사진 크게 보기 (v52). v = { name, img, mine } */
  function viewer(v, entering) {
    var img = v.img && IMG_RE.test(v.img) ? v.img : '';
    return '<div class="sheet-layer sheet-layer--view">' +
      '<button type="button" class="scrim" data-act="ava-view-close" aria-label="닫기"></button>' +
      '<section class="sheet aview' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(v.name + ' 사진') + '">' +
      (img ? '<img class="aview__img" src="' + esc(img) + '" alt="' + esc(v.name + ' 사진') + '">' : '') +
      '<p class="aview__nm">' + esc(v.name) + '</p>' +
      '<div class="aview__actions">' +
      (v.mine ? '<button type="button" class="aview__btn" data-act="ava-view-edit">사진 바꾸기</button>' : '') +
      '<button type="button" class="aview__btn aview__btn--close" data-act="ava-view-close">닫기</button></div>' +
      '</section></div>';
  }

  /** 사진 자리 고르기 화면. c = { src, view, saving, error } — 사진 위치는 app.js 가 transform 으로만 바꿈 */
  function crop(c, entering) {
    return '<div class="sheet-layer sheet-layer--top">' +
      '<section class="sheet acrop' + (entering ? ' is-entering' : '') + '" role="dialog" aria-modal="true" aria-labelledby="acrop-title">' +
      '<h2 id="acrop-title" class="sheet__title">동그라미로 보일 부분</h2>' +
      '<p class="sheet__sub">끌어서 옮기고, 두 손가락이나 아래 막대로 크기를 바꿔요</p>' +
      '<div class="acrop__view" id="acrop-view" style="width:' + c.view + 'px;height:' + c.view + 'px">' +
        '<img id="acrop-img" class="acrop__img" src="' + esc(c.src) + '" alt="" draggable="false">' +
        '<span class="acrop__mask" aria-hidden="true"></span></div>' +
      '<label class="acrop__zoom"><span class="sr-only">크기</span><input id="ava-zoom" type="range" min="1" max="4" step="0.01" value="1" aria-label="크기"></label>' +
      (c.error ? '<p class="rform__error" role="alert">' + esc(c.error) + '</p>' : '') +
      '<div class="rform__actions"><button type="button" class="ghost-btn" data-act="ava-crop-cancel">취소</button>' +
      '<button type="button" class="solid-btn" data-act="ava-crop-save"' + (c.saving ? ' disabled' : '') + '>' + (c.saving ? '저장 중…' : '이렇게 저장') + '</button></div>' +
      '</section></div>';
  }

  var api = { box: box, face: face, sheet: sheet, crop: crop, viewer: viewer };
  root.RT = root.RT || {};
  root.RT.viewAvatar = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
