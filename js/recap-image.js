/* 결산 마지막 장 → 이미지 (docs/recap/spec.md 3절, 목업 Recap-R11: 360×640 을 3배 = 1080×1920).
   지금 테마 색(CSS 변수)과 글꼴을 그대로 쓴다. 글꼴을 다 받은 뒤 그린다(대체 글꼴로 그려지지 않게).
   save(m, el) → Promise<'share' | 'download'>  (m = view-recap deckModel, el = 테마 변수를 읽을 요소) */
(function (root) {
  'use strict';
  var W = 1080, H = 1920, S = 3; // 목업 1px = 3px

  function vars(el) {
    var cs = root.getComputedStyle(el);
    var g = function (n, d) { var v = cs.getPropertyValue(n).trim(); return v || d; };
    return {
      bg: g('--tint', '#FBEDF3'), surface: g('--surface', '#FFFFFF'), text: g('--text', '#34313A'), sub: g('--sub', '#6D6973'),
      me: g('--me', '#B0A5E8'), her: g('--her', '#D78EAD'), both: g('--both', '#D98E94'),
      font: g('--font', "'Pretendard', system-ui, sans-serif")
    };
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  /** 넘치면 … 으로 자름 */
  function fit(ctx, s, max) {
    if (ctx.measureText(s).width <= max) return s;
    while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
    return s + '…';
  }

  /** 캔버스에 그리기 (시험에서도 부를 수 있게 따로) */
  function draw(canvas, m, c) {
    var final = m.cards.filter(function (x) { return x.card.id === 'final'; })[0];
    if (!final) throw new Error('no-final');
    var t = final.text;
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    var font = function (w, px) { return w + ' ' + px + 'px ' + c.font; };
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'top';
    var x0 = 20 * S, y = 36 * S, inner = W - 40 * S;
    ctx.fillStyle = c.sub; ctx.font = font(700, 14 * S); ctx.fillText(t.kick, x0, y);
    y += 22 * S;
    ctx.fillStyle = c.text; ctx.font = font(800, 26 * S); ctx.fillText(t.title, x0, y);
    y += 44 * S;
    // 숫자 타일 2열
    var gap = 10 * S, tw = (inner - gap) / 2, th = 64 * S;
    t.tiles.forEach(function (tile, i) {
      var tx = x0 + (i % 2) * (tw + gap), ty = y + Math.floor(i / 2) * (th + gap);
      ctx.fillStyle = c.surface; rrect(ctx, tx, ty, tw, th, 18 * S); ctx.fill();
      ctx.fillStyle = c.text; ctx.font = font(800, 24 * S); ctx.fillText(fit(ctx, tile.big, tw - 28 * S), tx + 14 * S, ty + 10 * S);
      ctx.fillStyle = c.sub; ctx.font = font(600, 12 * S); ctx.fillText(fit(ctx, tile.label, tw - 28 * S), tx + 14 * S, ty + 40 * S);
    });
    y += Math.ceil(t.tiles.length / 2) * (th + gap);
    // 단짝 영수증 타일
    if (t.spends) {
      var sh = 108 * S;
      ctx.fillStyle = c.surface; rrect(ctx, x0, y, inner, sh, 18 * S); ctx.fill();
      var px = x0 + 14 * S, pw = inner - 28 * S;
      ctx.fillStyle = c.sub; ctx.font = font(600, 12 * S); ctx.fillText('함께 쓴 돈 · 단짝 영수증', px, y + 12 * S);
      ctx.fillStyle = c.text; ctx.font = font(800, 24 * S); ctx.fillText(t.spends.total, px, y + 30 * S);
      var bx = px, by = y + 64 * S, bh = 10 * S;
      ctx.save(); rrect(ctx, bx, by, pw, bh, 5 * S); ctx.clip();
      (m.finalRows || []).forEach(function (r) {
        var w = pw * r.pct / 100;
        ctx.fillStyle = m.slotOf(r.uid) === 'me' ? c.me : c.her; ctx.fillRect(bx, by, w, bh); bx += w;
      });
      ctx.restore();
      ctx.fillStyle = c.sub; ctx.font = font(600, 12 * S); ctx.fillText(t.spends.line, px, y + 82 * S);
    }
    // 아래 앱 이름
    ctx.fillStyle = c.sub; ctx.font = font(700, 12 * S); ctx.textAlign = 'center'; ctx.fillText('단짝꿍', W / 2, H - 32 * S);
    return canvas;
  }

  function fontsReady(c) {
    var fam = c.font;
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([600, 700, 800].map(function (w) { return document.fonts.load(w + ' ' + 24 * S + 'px ' + fam, '단짝꿍 0123456789 해낸 날'); }))
      .then(function () { return document.fonts.ready; }).catch(function () {});
  }

  function save(m, el) {
    var c = vars(el || document.documentElement);
    return fontsReady(c).then(function () {
      var canvas = draw(document.createElement('canvas'), m, c);
      return new Promise(function (ok, no) { canvas.toBlob(function (b) { if (b) ok(b); else no(new Error('blob')); }, 'image/png'); });
    }).then(function (blob) {
      var name = '단짝꿍-' + m.key + '.png';
      var file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: m.title }).then(function () { return 'share'; });
      }
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return 'download';
    });
  }

  var api = { W: W, H: H, draw: draw, save: save };
  root.RT = root.RT || {};
  root.RT.recapImage = api;
})(typeof window !== 'undefined' ? window : globalThis);
