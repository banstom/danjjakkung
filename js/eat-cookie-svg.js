/* eat(쿠키) 기능 그림 (docs/eat 참조 reference/src/cookie-svg.js 그대로 — 모양 숫자는 바꾸지 말 것). 색은 tokens.css 의 --ck-* 그림 토큰. */
(function (root) {
  'use strict';
  // 쿠키 그림 (11-21 고름: C 스티커 · 금빛). 그림 파일 없이 SVG + 토큰.
  // 목업(design/mockups/chosen/eat/)과 같은 모양 — 모양 숫자는 바꾸지 말 것. 색은 art.css의 --ck-* 토큰.
  // 크기는 감싸는 요소의 --s 하나로 (가로 = --s, 세로 = --s × 0.7, 깨진 쿠키는 × 0.85).

  const WHOLE = '<ellipse class="k-s" cx="60" cy="78" rx="44" ry="4"></ellipse><path class="k-halo" d="M8 62C3 40 18 13 42 12C50 11 56 14 60 19C64 14 70 11 78 12C102 13 117 40 112 62C100 57 85 54 74 58C68 61 63 66 60 73C57 66 52 61 46 58C35 54 20 57 8 62Z"></path><g transform="rotate(22 60 66)"><rect class="k-halo" x="57" y="61" width="44" height="11" rx="1"></rect></g><path class="k-b" d="M8 62C3 40 18 13 42 12C50 11 56 14 60 19C64 14 70 11 78 12C102 13 117 40 112 62C100 57 85 54 74 58C68 61 63 66 60 73C57 66 52 61 46 58C35 54 20 57 8 62Z"></path><path class="k-m" d="M60 19C64 14 70 11 78 12C102 13 117 40 112 62C100 57 85 54 74 58C68 61 63 66 60 73C64 56 64 36 60 19Z" opacity=".55"></path><path class="k-d" d="M60 19C56 34 56 54 60 73C56 65 51 60 46 58C47 44 51 29 60 19Z"></path><path class="k-cr" d="M60 19C64 36 64 56 60 73"></path><ellipse class="k-h" cx="30" cy="27" rx="12" ry="4.5" transform="rotate(-34 30 27)"></ellipse><path class="k-ol" d="M8 62C3 40 18 13 42 12C50 11 56 14 60 19C64 14 70 11 78 12C102 13 117 40 112 62C100 57 85 54 74 58C68 61 63 66 60 73C57 66 52 61 46 58C35 54 20 57 8 62Z"></path><path class="k-ol" d="M60 19C56 34 56 54 60 73C56 65 51 60 46 58C47 44 51 29 60 19Z"></path><g transform="rotate(22 60 66)"><rect class="k-p k-olp" x="57" y="61" width="44" height="11" rx="1"></rect><rect class="k-l" x="64" y="65" width="20" height="1.5"></rect><rect class="k-l" x="64" y="68" width="13" height="1.5"></rect><rect class="k-w k-olp" x="93" y="61" width="8" height="11"></rect></g>';

  const OPEN = '<ellipse class="k-s" cx="60" cy="84" rx="46" ry="4"></ellipse><g transform="translate(-10 6) rotate(-16 34 62)"><path class="k-halo" d="M8 62C3 40 18 13 42 12C50 11 56 14 60 19C56 34 56 54 60 73C57 66 52 61 46 58C35 54 20 57 8 62Z"></path><path class="k-b" d="M8 62C3 40 18 13 42 12C50 11 56 14 60 19C56 34 56 54 60 73C57 66 52 61 46 58C35 54 20 57 8 62Z"></path><path class="k-m" d="M60 19C56 34 56 54 60 73C56 65 51 60 46 58C47 44 51 29 60 19Z"></path><path class="k-ol" d="M8 62C3 40 18 13 42 12C50 11 56 14 60 19C56 34 56 54 60 73C57 66 52 61 46 58C35 54 20 57 8 62Z"></path></g><g transform="translate(10 6) rotate(16 86 62)"><path class="k-halo" d="M112 62C117 40 102 13 78 12C70 11 64 14 60 19C64 34 64 54 60 73C63 66 68 61 74 58C85 54 100 57 112 62Z"></path><path class="k-b" d="M112 62C117 40 102 13 78 12C70 11 64 14 60 19C64 34 64 54 60 73C63 66 68 61 74 58C85 54 100 57 112 62Z"></path><path class="k-m" d="M60 19C64 34 64 54 60 73C64 65 69 60 74 58C73 44 69 29 60 19Z"></path><path class="k-ol" d="M112 62C117 40 102 13 78 12C70 11 64 14 60 19C64 34 64 54 60 73C63 66 68 61 74 58C85 54 100 57 112 62Z"></path></g><g transform="rotate(-5 60 0)"><rect class="k-halo" x="24" y="-8" width="72" height="15" rx="1.5"></rect><rect class="k-p k-olp" x="24" y="-8" width="72" height="15" rx="1.5"></rect><rect class="k-l" x="30" y="-3" width="34" height="1.8"></rect><rect class="k-l" x="30" y="1" width="22" height="1.8"></rect><rect class="k-w k-olp" x="86" y="-8" width="10" height="15"></rect></g>';

  /**
   * @param {{ who?: 'me'|'partner', open?: boolean, size?: number }} o
   * @returns {string} <span class="ck kk kk-sticker ..."> 한 덩어리 (aria-hidden — 뜻은 옆 글자가 전함)
   */
  function cookieSvg({ who = 'me', open = false, size = null } = {}) {
    const cls = ['ck', 'kk', 'kk-sticker', who === 'partner' ? 'her' : '', open ? 'open' : ''].filter(Boolean).join(' ');
    const style = size ? ` style="--s: ${size}px"` : '';
    const vb = open ? '0 -14 120 102' : '0 0 120 84';
    return `<span class="${cls}"${style} aria-hidden="true"><svg viewBox="${vb}" width="100%" height="100%">${open ? OPEN : WHOLE}</svg></span>`;
  }

  const api = { cookieSvg };
  root.RT = root.RT || {};
  root.RT.eatCookie = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
