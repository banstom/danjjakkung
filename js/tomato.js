/* 토마토 그림 (v41) — 단계마다 직접 그린 SVG. 테마와 상관없이 토마토 색은 고정.
   stage: seed | sprout | leaf | flower | green | red,  thirsty: 잎이 처지고 색이 옅어짐 */
(function (root) {
  'use strict';
  var NODE = typeof module !== 'undefined' && module.exports;

  var C = { pot: '#C8734B', potDark: '#A85C39', rim: '#D98A5F', soil: '#6B4A35', soilDark: '#563A29', stem: '#4E9A4A', leaf: '#5FB35A', leafDark: '#3F8A3B',
    flower: '#F6C744', flowerMid: '#E8A21A', green: '#8CC152', greenDark: '#6DA539', red: '#E5483B', redDark: '#C23428', shine: '#FFFFFF', stake: '#C9A46B' };

  function leaf(x, y, rot, s) {
    s = s || 1;
    return '<path d="M0 0 C ' + 4 * s + ' ' + -5 * s + ' ' + 12 * s + ' ' + -5 * s + ' ' + 15 * s + ' 0 C ' + 12 * s + ' ' + 5 * s + ' ' + 4 * s + ' ' + 5 * s + ' 0 0 Z" fill="' + C.leaf + '" stroke="' + C.leafDark + '" stroke-width="0.8" transform="translate(' + x + ' ' + y + ') rotate(' + rot + ')"/>';
  }
  function flower(x, y) {
    var p = '';
    for (var i = 0; i < 5; i++) p += '<ellipse cx="0" cy="-3.2" rx="1.8" ry="3" fill="' + C.flower + '" transform="rotate(' + i * 72 + ')"/>';
    return '<g transform="translate(' + x + ' ' + y + ')">' + p + '<circle r="1.6" fill="' + C.flowerMid + '"/></g>';
  }
  function fruit(x, y, r, ripe) {
    var body = ripe ? C.red : C.green, edge = ripe ? C.redDark : C.greenDark;
    var calyx = '';
    for (var i = 0; i < 5; i++) calyx += '<path d="M0 0 L ' + (-1.2) + ' ' + (-4) + ' L 1.2 -4 Z" fill="' + C.leafDark + '" transform="rotate(' + (i * 72 - 36) + ')"/>';
    return '<g transform="translate(' + x + ' ' + y + ')"><circle r="' + r + '" fill="' + body + '" stroke="' + edge + '" stroke-width="1"/>' +
      '<ellipse cx="' + -r * 0.35 + '" cy="' + -r * 0.35 + '" rx="' + r * 0.28 + '" ry="' + r * 0.18 + '" fill="' + C.shine + '" opacity="0.55" transform="rotate(-30 ' + -r * 0.35 + ' ' + -r * 0.35 + ')"/>' +
      '<g transform="translate(0 ' + (-r + 1) + ')">' + calyx + '</g></g>';
  }

  function pot() {
    return '<path d="M26 70 L74 70 L68 95 L32 95 Z" fill="' + C.pot + '"/>' +
      '<path d="M50 70 L74 70 L68 95 L50 95 Z" fill="' + C.potDark + '" opacity="0.25"/>' +
      '<rect x="22" y="64" width="56" height="9" rx="3" fill="' + C.rim + '"/>' +
      '<ellipse cx="50" cy="65.5" rx="25" ry="3.2" fill="' + C.soil + '"/>';
  }

  function plant(stage) {
    if (stage === 'seed') {
      return '<ellipse cx="50" cy="64" rx="4.2" ry="2.8" fill="' + C.soilDark + '"/><ellipse cx="49" cy="63.2" rx="1.6" ry="0.9" fill="#8A6A52"/>' +
        '<path d="M58 52 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2z" fill="' + C.flower + '" opacity="0.85"/>';
    }
    if (stage === 'sprout') {
      return '<path d="M50 65 C 50 60 50 56 50 52" stroke="' + C.stem + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
        leaf(50, 53, -150, 0.75) + leaf(50, 53, -30, 0.75);
    }
    var stemTop = stage === 'leaf' ? 30 : 22;
    var out = '';
    if (stage !== 'leaf') out += '<line x1="64" y1="66" x2="64" y2="20" stroke="' + C.stake + '" stroke-width="2" stroke-linecap="round"/>';
    out += '<path d="M50 65 C 49 55 52 45 50 ' + stemTop + '" stroke="' + C.stem + '" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<path d="M50 50 C 44 47 40 44 37 40" stroke="' + C.stem + '" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<path d="M50 42 C 56 39 60 36 63 32" stroke="' + C.stem + '" stroke-width="2" fill="none" stroke-linecap="round"/>';
    out += '<g class="tm-leaves">' + leaf(50, 58, -160, 0.9) + leaf(50, 56, -20, 0.9) + leaf(37, 40, -140, 0.85) + leaf(63, 32, -40, 0.85) +
      leaf(50, stemTop + 2, -110, 0.7) + leaf(50, stemTop + 2, -70, 0.7) + '</g>';
    if (stage === 'flower') out += flower(37, 44) + flower(63, 36) + flower(50, stemTop - 2);
    if (stage === 'green') out += fruit(38, 47, 5, false) + fruit(62, 39, 5.5, false) + fruit(51, 30, 4.2, false);
    if (stage === 'red') out += fruit(38, 47, 6, true) + fruit(62, 39, 6.5, true) + fruit(51, 29, 5, true);
    return out;
  }

  /** 토마토 화분 SVG 한 장 */
  function svg(stage, opts) {
    opts = opts || {};
    var size = opts.size || 72;
    var thirsty = !!opts.thirsty;
    return '<svg class="tomato' + (thirsty ? ' tomato--thirsty' : '') + '" viewBox="0 12 100 86" width="' + size + '" height="' + Math.round(size * 0.86) + '" role="img" aria-label="' + (opts.label || '토마토') + '">' +
      '<g' + (thirsty ? ' transform="rotate(6 50 65)"' : '') + '>' + plant(stage) + '</g>' + pot() +
      (thirsty ? '<path d="M74 40 C 72 44 72 46 74 47 C 76 46 76 44 74 40 Z" fill="#7FB8E6"/>' : '') + '</svg>';
  }

  var api = { svg: svg };
  root.RT = root.RT || {};
  root.RT.tomato = api;
  if (NODE) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
