/* 테마 — 목록 · 고른 테마 저장 · 화면에 적용.
   색 값은 styles/tokens.css 의 [data-theme="<id>"] 블록에만 있다. 여기는 이름과 저장만.
   고른 테마는 이 기기에 저장한다 (localStorage). 로그인 · 기록 · 알림 설정과는 따로라 서로 영향이 없다.
   <head>에서 CSS 바로 뒤에 불러서, 첫 화면부터 고른 색으로 그린다 (깜빡임 없이).

   나 · 상대 색: 테마마다 따로 고른다 (테마를 바꾸면 그 테마에서 고른 색, 안 골랐으면 그 테마 기본색).
   고른 색은 내 계정(users 문서의 colors)에 저장돼 내 모든 기기에서 같고, 내 화면에만 쓰인다.
   화면에는 자리(slot) 색 --her(첫째 사람) · --me(둘째 사람)를 <html>에 덮어써서 칠한다. 글자색(--*-ink)은 자동.
   첫 화면 깜빡임이 없게 마지막으로 쓴 색을 이 기기에도 적어 둔다 (COLOR_KEY).

   낮 · 밤 판 (11/19 겨울 업데이트, docs/themes-winter/spec.md): modes 가 있는 테마는 판이 둘(낮 · 밤).
   저장 · 목록은 묶음 id(winter-snack), 화면에는 판 id(winter-snack-night)를 단다. 고르는 법은 MODE_KEY(auto | light | dark, 기본 auto) —
   auto 면 휴대폰 다크 모드를 따라 켜 둔 채로 바로 바뀐다. skin 이 있는 테마는 <html data-skin> 도 단다 (픽셀 스킨 = 도트 글꼴 · 픽셀 카드).
   modes 가 없는 테마는 지금 그대로 (모드 값 무시). */
(function (root) {
  'use strict';
  var THEMES = [
    { id: 'soft-pastel', name: 'Soft Pastel', ko: '소프트 파스텔', desc: '포근하고 귀여운 파스텔', dark: false, group: 'basic' },
    { id: 'cosmic-dream', name: 'Cosmic Dream', ko: '코즈믹 드림', desc: '깊은 우주와 성운 · 어두운 화면', dark: true, group: 'basic' },
    { id: 'ocean-breeze', name: 'Ocean Breeze', ko: '오션 브리즈', desc: '맑은 바다, 청량한 휴식', dark: false, group: 'basic' },
    { id: 'forest-diary', name: 'Forest Diary', ko: '포레스트 다이어리', desc: '숲과 이끼, 차분한 초록', dark: false, group: 'basic' },
    { id: 'vintage-film', name: 'Vintage Film', ko: '빈티지 필름', desc: '오래된 사진첩, 따뜻한 추억', dark: false, group: 'basic' },
    { id: 'blue-hour', name: 'Blue Hour', ko: '블루 아워', desc: '해 진 직후의 고요한 하늘', dark: false, group: 'basic' },
    { id: 'golden-hour', name: 'Golden Hour', ko: '골든 아워', desc: '따뜻한 노을과 황금빛 햇살', dark: false, group: 'basic' },
    { id: 'sakura-dream', name: 'Sakura Dream', ko: '사쿠라 드림', desc: '부드러운 벚꽃과 봄의 설렘', dark: false, group: 'basic' },
    { id: 'midnight-noir', name: 'Midnight Noir', ko: '미드나잇 누아르', desc: '깊은 밤과 도시의 세련미', dark: true, group: 'basic' },
    { id: 'arctic-frost', name: 'Arctic Frost', ko: '아크틱 프로스트', desc: '얼음과 서리의 맑은 색감', dark: false, group: 'basic' },
    { id: 'chocolate-noir', name: 'Chocolate Noir', ko: '초콜릿 누아르', desc: '다크 초콜릿과 크리미한 브라운', dark: false, group: 'basic' },
    { id: 'roast-nuts', name: 'Roast Nuts', ko: '로스트 너츠', desc: '구운 견과류와 달콤한 황금빛', dark: false, group: 'basic' },
    { id: 'winter-knit', name: 'Winter Knit', ko: '윈터 니트', desc: '포근한 니트와 부드러운 겨울', dark: false, group: 'basic' },
    { id: 'harvest', name: 'Harvest', ko: '하베스트', desc: '황금빛 들판과 차분한 가을', dark: false, group: 'basic' },
    // 겨울 업데이트 (11/19) — 도트 테마, 낮 · 밤 판. 1년 내내 고를 수 있다
    { id: 'winter-snack', group: 'season', name: '도란도란 겨울 간식', ko: '도란도란 겨울 간식', desc: '군밤 · 붕어빵 노점의 도트 간식', dark: false, skin: 'pixel',
      modes: { light: 'winter-snack', dark: 'winter-snack-night' }, tags: ['NEW'] },
    { id: 'merry-xmas', group: 'season', name: '두근두근 크리스마스', ko: '두근두근 크리스마스', desc: '솔잎 가랜드와 반짝이는 전구', dark: false, skin: 'pixel',
      modes: { light: 'merry-xmas', dark: 'merry-xmas-night' }, tags: ['NEW'] },
    // 봄 업데이트 (11/20, docs/themes-spring) — 도트 테마, 낮 · 밤 판(밤 = 밤벚꽃 소풍). 1년 내내 고를 수 있다
    { id: 'spring-picnic', group: 'season', name: '몽글몽글 봄소풍', ko: '몽글몽글 봄소풍', desc: '벚꽃 아래 피크닉 깃발과 도시락', dark: false, skin: 'pixel',
      modes: { light: 'spring-picnic', dark: 'spring-picnic-night' }, tags: ['NEW'] },
    // 여름 · 가을 업데이트 (11/23, docs/themes-summer-autumn) — 도트 테마, 낮 · 밤 판
    { id: 'summer-sea', group: 'season', name: '찰방찰방 여름 바다', ko: '찰방찰방 여름 바다', desc: '파도 줄과 밤바다의 작은 불꽃', dark: false, skin: 'pixel',
      modes: { light: 'summer-sea', dark: 'summer-sea-night' }, tags: ['NEW'] },
    { id: 'autumn-forest', group: 'season', name: '알록달록 가을 숲', ko: '알록달록 가을 숲', desc: '단풍 · 은행잎 가랜드와 반딧불 숲', dark: false, skin: 'pixel',
      modes: { light: 'autumn-forest', dark: 'autumn-forest-night' }, tags: ['NEW'] },
    // 천문대 · 기차 업데이트 (11/23, docs/themes-observatory-train) — 도트 테마, 낮 · 밤 판
    { id: 'observatory', group: 'outing', name: '반짝반짝 천문대', ko: '반짝반짝 천문대', desc: '새벽 하늘 라벤더와 깊은 밤 별빛', dark: false, skin: 'pixel',
      modes: { light: 'observatory', dark: 'observatory-night' }, tags: ['NEW'] },
    { id: 'train-trip', group: 'travel', name: '덜컹덜컹 기차 여행', ko: '덜컹덜컹 기차 여행', desc: '레트로 청록 객차와 야간열차 창문 불빛', dark: false, skin: 'pixel',
      modes: { light: 'train-trip', dark: 'train-trip-night' }, tags: ['NEW'] },
    // 테니스 · 도시 업데이트 (11/23, docs/themes-tennis-cities) — 도트 테마, 낮 · 밤 판
    { id: 'tennis-court', group: 'outing', name: '통통 테니스 코트', ko: '통통 테니스 코트', desc: '잔디 코트와 야간 경기 조명', dark: false, skin: 'pixel',
      modes: { light: 'tennis-court', dark: 'tennis-court-night' }, tags: ['NEW'] },
    { id: 'porto', group: 'travel', name: '또각또각 포르투', ko: '또각또각 포르투', desc: '아줄레주 타일과 도루강 다리 불빛', dark: false, skin: 'pixel',
      modes: { light: 'porto', dark: 'porto-night' }, tags: ['NEW'] },
    { id: 'prague', group: 'travel', name: '뾰족뾰족 프라하', ko: '뾰족뾰족 프라하', desc: '첨탑과 주홍 지붕, 은빛 가로등', dark: false, skin: 'pixel',
      modes: { light: 'prague', dark: 'prague-night' }, tags: ['NEW'] },
    { id: 'tuscany', group: 'travel', name: '살랑살랑 토스카나', ko: '살랑살랑 토스카나', desc: '올리브 · 해바라기 · 사이프러스 언덕', dark: false, skin: 'pixel',
      modes: { light: 'tuscany', dark: 'tuscany-night' }, tags: ['NEW'] },
    // 공항 · 나들이 업데이트 (11/23, docs/themes-airport-outing) — 도트 테마, 낮 · 밤 판
    { id: 'airport', group: 'travel', name: '둥실둥실 공항', ko: '둥실둥실 공항', desc: '출발 안내판 노랑과 활주로 불빛', dark: false, skin: 'pixel',
      modes: { light: 'airport', dark: 'airport-night' }, tags: ['NEW'] },
    { id: 'amusement-park', group: 'outing', name: '빙글빙글 놀이공원', ko: '빙글빙글 놀이공원', desc: '사탕 줄무늬 천막과 불 켜진 전구', dark: false, skin: 'pixel',
      modes: { light: 'amusement-park', dark: 'amusement-park-night' }, tags: ['NEW'] },
    { id: 'camping', group: 'outing', name: '타닥타닥 캠핑', ko: '타닥타닥 캠핑', desc: '소나무 숲과 모닥불 별밤', dark: false, skin: 'pixel',
      modes: { light: 'camping', dark: 'camping-night' }, tags: ['NEW'] },
    // 여행 5 업데이트 (11/24, docs/themes-travel-5) — 도트 테마, 낮 · 밤 판
    { id: 'new-york', group: 'travel', name: '우뚝우뚝 뉴욕', ko: '우뚝우뚝 뉴욕', desc: '마천루 줄과 불 켜진 창문 · 노란 택시', dark: false, skin: 'pixel',
      modes: { light: 'new-york', dark: 'new-york-night' }, tags: ['NEW'] },
    { id: 'sydney', group: 'travel', name: '깡충깡충 시드니', ko: '깡충깡충 시드니', desc: '오페라하우스 돛과 하버 물결 · 남십자성', dark: false, skin: 'pixel',
      modes: { light: 'sydney', dark: 'sydney-night' }, tags: ['NEW'] },
    { id: 'bali', group: 'travel', name: '느긋느긋 발리', ko: '느긋느긋 발리', desc: '갈라진 사원 문과 프랑지파니 · 정글 횃불', dark: false, skin: 'pixel',
      modes: { light: 'bali', dark: 'bali-night' }, tags: ['NEW'] },
    { id: 'cairo', group: 'travel', name: '사락사락 카이로', ko: '사락사락 카이로', desc: '피라미드 줄과 모래 · 사막 달빛', dark: false, skin: 'pixel',
      modes: { light: 'cairo', dark: 'cairo-night' }, tags: ['NEW'] },
    { id: 'guanajuato', group: 'travel', name: '팔랑팔랑 과나후아토', ko: '팔랑팔랑 과나후아토', desc: '줄에 매단 파펠 피카도와 색색 집', dark: false, skin: 'pixel',
      modes: { light: 'guanajuato', dark: 'guanajuato-night' }, tags: ['NEW'] }
  ];
  // 테마 시트 묶음 (11/23 C안 · 11/24 TS2 고침 — 여행 · 도시를 여행 하나로, docs/themes-sheet/spec.md 2절) — 묶음 이름 · 순서 · 묶음 안 순서는 여기 한 곳에만.
  // 테마는 THEMES 의 group 칸으로 묶음에 들어간다. order 에 있지만 아직 안 들어간 테마는 그냥 빠지고,
  // order 에 없는 테마는 묶음 끝에 THEMES 순서대로 (기본 묶음은 order 없이 THEMES 순서 그대로).
  var GROUPS = [
    { id: 'season', name: '계절 · 기념일', order: ['spring-picnic', 'summer-sea', 'autumn-forest', 'winter-snack', 'merry-xmas'] },
    { id: 'travel', name: '여행', order: ['airport', 'train-trip', 'tuscany', 'bali', 'porto', 'prague', 'new-york', 'sydney', 'cairo', 'guanajuato'] },
    { id: 'outing', name: '나들이', order: ['observatory', 'tennis-court', 'amusement-park', 'camping', 'under-sea', 'safari', 'cinema'] },
    { id: 'basic', name: '기본', order: null }
  ];
  // 「○월에 어울리는 테마」 (spec 3절 11/24 판, 서울 날짜의 달) — 기획 계정이 정한 표. 아직 안 들어간 테마는 빠진다
  var MONTHLY = {
    1: ['winter-snack', 'observatory'], 2: ['winter-snack', 'train-trip'], 3: ['spring-picnic', 'prague'],
    4: ['spring-picnic', 'amusement-park'], 5: ['spring-picnic', 'tennis-court'], 6: ['summer-sea', 'under-sea'],
    7: ['summer-sea', 'bali'], 8: ['summer-sea', 'camping'], 9: ['autumn-forest', 'tuscany'],
    10: ['autumn-forest', 'safari'], 11: ['autumn-forest', 'cinema'], 12: ['merry-xmas', 'winter-snack']
  };
  var KEY = 'danjjakkung.theme';
  var MODE_KEY = 'danjjakkung.themeMode';
  var MODES = ['auto', 'light', 'dark'];
  // 글씨체 (v61): 픽셀 스킨 테마에서만 쓰임 — pixel(도트 글씨, 기본) | plain(프리텐다드). 이 기기에 저장
  var FONT_KEY = 'danjjakkung.font';
  var FONTS = ['pixel', 'plain'];
  var COLOR_KEY = 'danjjakkung.colors';
  // 테마마다 고를 수 있는 사람 색 8개. 앞의 둘은 그 테마 기본색(--her, --me 와 같다).
  // ink: 색 위 글자 후보(어두운 쪽) — 흰색과 견줘 더 잘 보이는 쪽을 쓴다 (4.5:1 이상은 tests/themes.test.js 가 확인).
  var PALETTES = {
    'soft-pastel': { ink: '#2A2730', both: '#D98E94', colors: ['#D78EAD', '#B0A5E8', '#F4A7A3', '#D98E94', '#E8D27A', '#9FD3B5', '#8EC5E8', '#C7A4E0'] },
    'cosmic-dream': { ink: '#101426', both: '#A84F88', colors: ['#267C91', '#7052B8', '#A84F88', '#FFB86B', '#F5E27A', '#7EE0A8', '#7FA8FF', '#FF8A8A'] },
    'ocean-breeze': { ink: '#0B2530', both: '#D5A85D', colors: ['#55AEB5', '#7FC5C0', '#F2A48C', '#D5A85D', '#9EC97F', '#6FA8DC', '#B49AD8', '#E88FA6'] },
    'forest-diary': { ink: '#1A2119', both: '#C4A05D', colors: ['#91A779', '#AEBD92', '#C99A6B', '#C4A05D', '#8FAFB8', '#C48A8A', '#A89BC2', '#7FA08A'] },
    'vintage-film': { ink: '#211E19', both: '#8FA38A', colors: ['#C58B88', '#C9AA66', '#6B7052', '#57707F', '#B97A5A', '#A88BA0', '#8FA38A', '#D49A7A'] },
    'blue-hour': { ink: '#161C35', both: '#C88CA5', colors: ['#8F9BD0', '#A6AEE3', '#C88CA5', '#F2BE8C', '#8FC1D4', '#B79CD9', '#9DC4A8', '#5D6AA3'] },
    'golden-hour': { ink: '#2B1A10', both: '#C49AC0', colors: ['#D88A7E', '#F2B880', '#E89A5B', '#F2D27A', '#9DBF8E', '#C96F62', '#C49AC0', '#E8A0A0'] },
    'sakura-dream': { ink: '#2E2328', both: '#C9A8E0', colors: ['#E6A0B4', '#F2BFD0', '#C9A8E0', '#F4B8A0', '#EDD58A', '#9FC8DC', '#D98AA0', '#A7BDA5'] },
    'midnight-noir': { ink: '#15161D', both: '#8E5E2C', colors: ['#A54D61', '#6A6F85', '#8E5E2C', '#6FAFD6', '#6CC584', '#C08AE0', '#E8D48A', '#F0A07A'] },
    'arctic-frost': { ink: '#14222C', both: '#C8B8E0', colors: ['#879FB8', '#B9DDE8', '#C8B8E0', '#A8D4C4', '#E8B8C4', '#E8D49A', '#9BB0C8', '#8FC0D8'] },
    'chocolate-noir': { ink: '#2A1D18', both: '#92A77A', colors: ['#B99583', '#D8B99B', '#C49A78', '#C98F7A', '#92A77A', '#E0C080', '#9AA8C0', '#9A4A2A'] },
    'roast-nuts': { ink: '#2E2116', both: '#A8C27A', colors: ['#D39A70', '#F4C95D', '#E8D77D', '#D6AC83', '#A8C27A', '#E8A07A', '#9FC0D0', '#D99A9A'] },
    'winter-knit': { ink: '#26282C', both: '#DCC9BC', colors: ['#E8B6C5', '#B2DCD6', '#DCC9BC', '#A8C0D8', '#C8B8D8', '#E8C89A', '#B8C8A8', '#D0A0A0'] },
    'harvest': { ink: '#24230F', both: '#CA8D7D', colors: ['#EAB45B', '#B5B581', '#D9925B', '#F1E2A1', '#C9A27A', '#A8C0A0', '#CA8D7D', '#9DB4C8'] },
    // 낮 · 밤 판이 있는 테마는 묶음 id 하나로 (앞 둘 · both = 낮 판 값, 밤 판 기본색은 tokens.css 의 밤 블록)
    'winter-snack': { ink: '#2E1C12', both: '#D49A5A', colors: ['#D9825B', '#F0C27B', '#D49A5A', '#E8A0A0', '#A8C27A', '#9FC0D0', '#C9A27A', '#B49AD8'] },
    'merry-xmas': { ink: '#29291F', both: '#6E9E5A', colors: ['#D07A6A', '#E9B949', '#6E9E5A', '#8FB5D0', '#C49AC0', '#F2A08A', '#B8C8A8', '#E8A0A0'] },
    'spring-picnic': { ink: '#2E2128', both: '#A5CB93', colors: ['#E89AB0', '#F3C96B', '#A5CB93', '#9FC8DC', '#F4B8A0', '#C9B8E8', '#E8D58A', '#D8A0C0'] },
    'summer-sea': { ink: '#1C2A30', both: '#7DC9BC', colors: ['#F2917D', '#F2CE5A', '#7DC9BC', '#7FB8E0', '#EE8A8A', '#E3C48D', '#B5D67A', '#B9A6E6'] },
    'autumn-forest': { ink: '#2E2117', both: '#A6B46C', colors: ['#DE7A52', '#EBC04F', '#A6B46C', '#EE9A4F', '#C49A6C', '#C7A6D9', '#8FB3D9', '#D9C7A0'] },
    'observatory': { ink: '#221F38', both: '#9EC3EC', colors: ['#E9A3BC', '#F2D27A', '#9EC3EC', '#B9A6E6', '#9FD8C8', '#F2B896', '#EDE3C4', '#A8D99A'] },
    'train-trip': { ink: '#262A27', both: '#86C1B4', colors: ['#DE8A7E', '#E9B949', '#86C1B4', '#AED8E6', '#EADBB8', '#B5CF8A', '#C3AEDF', '#EFA066'] },
    'tennis-court': { ink: '#1C2616', both: '#8CC9A0', colors: ['#F29C7E', '#F2D45C', '#8CC9A0', '#C9E04A', '#9CC8EA', '#BFAEE6', '#F0A0A8', '#E6CFA0'] },
    'porto': { ink: '#1A2036', both: '#8FB5E8', colors: ['#EE9A6E', '#F2C14E', '#8FB5E8', '#A9C9A0', '#F0A8B4', '#B8A8E0', '#EAD9B4', '#9ED6C8'] },
    'prague': { ink: '#22252C', both: '#9DB0C8', colors: ['#E08A6A', '#E8BE55', '#9DB0C8', '#E8A8B8', '#A8BE88', '#C0B0DC', '#DCC8A0', '#8EC8C0'] },
    'tuscany': { ink: '#262618', both: '#A9BC6E', colors: ['#E0906E', '#F2C94C', '#A9BC6E', '#F2B8C6', '#C9E08A', '#C4AEE0', '#9CC4E4', '#E2CFA6'] },
    'airport': { ink: '#1C2028', both: '#A6D8B8', colors: ['#F2A07E', '#9CCAF0', '#A6D8B8', '#F2C230', '#BBAEE6', '#C9D1DC', '#F2C08E', '#F0AEC0'] },
    'amusement-park': { ink: '#2A1622', both: '#8ED3C4', colors: ['#F29AB8', '#F2CE5A', '#8ED3C4', '#9CC8EA', '#C6AEE6', '#E2B47A', '#F8C4E4', '#F2A66A'] },
    'camping': { ink: '#24201C', both: '#9DB87A', colors: ['#E58A64', '#F2C14E', '#9DB87A', '#9CC4E4', '#F0E2C8', '#F29A4E', '#C0AEDC', '#B8CC8A'] },
    'new-york': { ink: '#1A2022', both: '#9CCAF0', colors: ['#F2A07E', '#F2C14E', '#9CCAF0', '#9ED6C4', '#E2B47A', '#C0AEE6', '#F5D06A', '#F0AEC0'] },
    'sydney': { ink: '#241D1B', both: '#A6D0B0', colors: ['#9CCAF0', '#F2C14E', '#A6D0B0', '#F2A07E', '#D9A878', '#E8E4DE', '#C0AEE6', '#7FC4E0'] },
    'bali': { ink: '#241F16', both: '#B8D88A', colors: ['#8ED3C4', '#F2A0B8', '#B8D88A', '#F2C14E', '#E2C08E', '#9CCAF0', '#F2A66A', '#C6AEE6'] },
    'cairo': { ink: '#251F13', both: '#8ED3C4', colors: ['#F2A07E', '#9CCAF0', '#8ED3C4', '#F2C86A', '#D9A878', '#B8CC8A', '#A8B8F0', '#F0AEC0'] },
    'guanajuato': { ink: '#251A1F', both: '#9CCAF0', colors: ['#7FCFC0', '#F2C14E', '#9CCAF0', '#F59AC8', '#F2A66A', '#C6AEE6', '#A8CC8A', '#F2D48A'] }
  };
  var COLOR_NAMES = {}; // 화면 읽기 프로그램용 짧은 이름
  [['#E59BBA','장밋빛'],['#A9A2EE','라벤더'],['#F4A7A3','코랄'],['#F5C58A','살구'],['#E8D27A','버터'],['#9FD3B5','민트'],['#8EC5E8','하늘'],['#C7A4E0','라일락'],
   ['#6CD8E8','시안'],['#A891F0','보라'],['#F08BC4','분홍'],['#FFB86B','주황'],['#F5E27A','노랑'],['#7EE0A8','초록'],['#7FA8FF','파랑'],['#FF8A8A','다홍'],
   ['#399DA8','청록'],['#7FC5C0','물빛'],['#F2A48C','코랄'],['#F4C977','모래'],['#9EC97F','해초'],['#6FA8DC','하늘'],['#B49AD8','라일락'],['#E88FA6','분홍'],
   ['#82966A','이끼'],['#AEBD92','세이지'],['#C99A6B','나무'],['#D9B85C','겨자'],['#8FAFB8','시냇물'],['#C48A8A','산딸기'],['#A89BC2','제비꽃'],['#7FA08A','솔잎'],
   ['#874F4D','버건디'],['#C9AA66','황토'],['#6B7052','올리브'],['#57707F','바랜 청색'],['#B97A5A','벽돌'],['#A88BA0','모브'],['#8FA38A','세이지'],['#D49A7A','살구'],
   ['#7F8CBF','페리윙클'],['#A6AEE3','연보라'],['#E8A3B4','노을 분홍'],['#F2BE8C','노을 주황'],['#8FC1D4','하늘'],['#B79CD9','보라'],['#9DC4A8','민트'],['#5D6AA3','남색'],
   ['#C96F62','노을 장밋빛'],['#F2B880','살구'],['#E89A5B','노을 주황'],['#F2D27A','햇살'],['#9DBF8E','풀빛'],['#8FB5D0','저녁 하늘'],['#C49AC0','모브'],['#E8A0A0','복숭아'],
   ['#E6A0B4','벚꽃'],['#A7BDA5','세이지'],['#C9A8E0','라일락'],['#F4B8A0','살구'],['#EDD58A','개나리'],['#9FC8DC','봄 하늘'],['#D98AA0','로즈'],['#B8D4A8','새잎'],
   ['#D88A98','로즈'],['#A9ABBA','은빛'],['#E0B07A','샴페인'],['#6FAFD6','네온 파랑'],['#6CC584','네온 초록'],['#C08AE0','라일락'],['#E8D48A','가로등'],['#F0A07A','네온 주황'],
   ['#778FA8','서리 청색'],['#B9DDE8','얼음'],['#C8B8E0','라벤더'],['#A8D4C4','빙하 민트'],['#E8B8C4','새벽 분홍'],['#E8D49A','겨울 햇살'],['#9BB0C8','회청'],['#8FC0D8','호수'],
   ['#765447','모카'],['#D8B99B','라테'],['#C49A78','카페오레'],['#C98F7A','로즈 브라운'],['#8A9A70','피스타치오'],['#E0C080','캐러멜 크림'],['#9AA8C0','블루베리'],['#9A4A2A','시나몬'],
   ['#C98A5B','아몬드'],['#F4C95D','꿀'],['#E8D77D','보리'],['#D6AC83','캐러멜'],['#A8C27A','피스타치오'],['#E8A07A','살구'],['#9FC0D0','하늘'],['#D99A9A','대추'],
   ['#E8B6C5','더스티 핑크'],['#B2DCD6','민트'],['#DCC9BC','오트밀'],['#A8C0D8','겨울 하늘'],['#C8B8D8','라벤더'],['#E8C89A','캐멀'],['#B8C8A8','세이지'],['#D0A0A0','로즈 브라운'],
   ['#EAB45B','머스터드'],['#B5B581','올리브'],['#D9925B','호박'],['#F1E2A1','밀짚'],['#C9A27A','볏단'],['#A8C0A0','세이지'],['#C98A7A','사과'],['#9DB4C8','가을 하늘'],
   ['#D78EAD','장밋빛'],['#B0A5E8','라벤더'],['#D98E94','로즈'],['#267C91','깊은 청록'],['#7052B8','보라'],['#A84F88','성운 자주'],['#55AEB5','청록'],['#D5A85D','모래'],['#91A779','이끼'],['#C4A05D','겨자'],['#C58B88','바랜 장밋빛'],['#8F9BD0','페리윙클'],['#C88CA5','노을 분홍'],['#D88A7E','노을 로즈'],['#F2BFD0','연벚꽃'],['#A54D61','버건디'],['#6A6F85','차콜 블루'],['#8E5E2C','위스키'],['#879FB8','서리 청색'],['#B99583','밀크 모카'],['#92A77A','피스타치오'],['#D39A70','아몬드'],['#CA8D7D','사과'], // 10/28 시간표 색 바꿈
   ['#D9825B','군고구마'],['#F0C27B','붕어빵'],['#D49A5A','군밤'],['#D07A6A','방울 빨강'],['#E9B949','금빛 별'],['#6E9E5A','솔잎'],['#F2A08A','볼 분홍'], // 11/19 겨울 도트 테마
   ['#E89AB0','벚꽃'],['#F3C96B','유채'],['#A5CB93','새싹'],['#9FC8DC','봄 하늘'],['#F4B8A0','살구'],['#C9B8E8','라일락'],['#E8D58A','개나리'],['#D8A0C0','진달래'], // 11/20 봄소풍
   ['#F2CE5A','레몬'],['#F2917D','산호'],['#7DC9BC','민트'],['#7FB8E0','하늘'],['#EE8A8A','수박'],['#E3C48D','모래'],['#B5D67A','라임'],['#B9A6E6','라벤더'],['#EBC04F','은행'],['#DE7A52','단풍'],['#A6B46C','이끼'],['#EE9A4F','홍시'],['#C49A6C','도토리'],['#C7A6D9','들국화'],['#8FB3D9','가을 하늘'],['#D9C7A0','갈대'], // 여름 · 가을 업데이트
   ['#E9A3BC','노을 분홍'],['#9EC3EC','새벽 하늘'],['#9FD8C8','민트 별'],['#F2B896','복숭아'],['#EDE3C4','달빛'],['#A8D99A','오로라'],['#DE8A7E','연벽돌'],['#86C1B4','연청록'],['#AED8E6','창문 하늘'],['#EADBB8','크림'],['#B5CF8A','들판 연두'],['#C3AEDF','라일락'],['#EFA066','귤'], // 천문대 · 기차 업데이트
   ['#F2D45C','공 노랑'],['#F29C7E','코랄'],['#8CC9A0','민트'],['#C9E04A','연두'],['#9CC8EA','하늘'],['#BFAEE6','라벤더'],['#F0A0A8','딸기'],['#E6CFA0','모래'],['#F2C14E','트램 노랑'],['#EE9A6E','산호'],['#8FB5E8','타일 하늘'],['#A9C9A0','세이지'],['#F0A8B4','분홍 집'],['#B8A8E0','연보라'],['#EAD9B4','크림'],['#9ED6C8','민트'],['#E8BE55','금빛'],['#E08A6A','연주홍'],['#9DB0C8','슬레이트 하늘'],['#E8A8B8','연분홍'],['#A8BE88','이끼'],['#C0B0DC','라일락'],['#DCC8A0','모래'],['#8EC8C0','청록'],['#F2C94C','해바라기'],['#E0906E','테라코타'],['#A9BC6E','올리브'],['#F2B8C6','젤라토 분홍'],['#C9E08A','피스타치오'],['#C4AEE0','라벤더'],['#9CC4E4','하늘'],['#E2CFA6','돌 베이지'], // 테니스 · 도시 업데이트
   ['#9CCAF0','하늘'],['#F2A07E','코랄'],['#A6D8B8','민트'],['#F2C230','안내판 노랑'],['#BBAEE6','라벤더'],['#C9D1DC','구름 회색'],['#F2C08E','살구'],['#F0AEC0','연분홍'],['#F29AB8','사탕 분홍'],['#8ED3C4','민트'],['#C6AEE6','라벤더'],['#E2B47A','츄러스'],['#F8C4E4','솜사탕'],['#F2A66A','귤'],['#E58A64','텐트'],['#9DB87A','이끼'],['#F0E2C8','마시멜로'],['#F29A4E','모닥불'],['#C0AEDC','라벤더'],['#B8CC8A','솔잎'], // 공항 · 나들이 업데이트
   ['#9ED6C4','여신상'],['#C0AEE6','라벤더'],['#F5D06A','창문 불빛'],['#A6D0B0','유칼립투스'],['#D9A878','쿼카'],['#E8E4DE','돛 흰색'],['#7FC4E0','파도'],['#F2A0B8','프랑지파니'],['#B8D88A','계단논'],['#E2C08E','라탄'],['#F2C86A','모래'],['#A8B8F0','라피스'],['#7FCFC0','민트 벽'],['#F59AC8','핑크'],['#A8CC8A','선인장'],['#F2D48A','타코'] // 여행 5 업데이트
  ].forEach(function (p) { COLOR_NAMES[p[0]] = p[1]; });
  // 도트 테마 그림 자리 S1~S4 (docs/themes-winter/spec.md 6절). w · h = 원본 PNG 크기(크림 테두리 포함), x = 정수 배율.
  // 낮 · 밤 판이 같은 그림. 그림이 없는 테마는 자리 자체를 그리지 않는다.
  var ART = {
    'winter-snack': {
      s1: { w: 38, h: 38, x: 2, alt: '군밤 봉지' }, s2: { w: 34, h: 34, x: 2, alt: '붕어빵 두 마리' },
      s3: { w: 40, h: 31, x: 3, alt: '김 나는 군고구마' }, s4: { w: 64, h: 65, x: 2, alt: '간식 한 상' }
    },
    'merry-xmas': {
      s1: { w: 32, h: 40, x: 2, alt: '작은 트리' }, s2: { w: 37, h: 38, x: 2, alt: '진저브레드 쿠키 둘' },
      s3: { w: 28, h: 41, x: 3, alt: '눈사람' }, s4: { w: 40, h: 40, x: 3, alt: '선물 더미' }
    },
    // 봄소풍: Gemini 그림(11/20, 크림 테두리 포함, docs/themes-spring/spec.md 4절)
    'spring-picnic': {
      s1: { w: 29, h: 29, x: 2, alt: '피크닉 바구니' }, s2: { w: 35, h: 30, x: 2, alt: '딸기 샌드위치 둘' },
      s3: { w: 30, h: 28, x: 4, alt: '벚꽃 한 송이' }, s4: { w: 42, h: 35, x: 4, alt: '도시락 한 상' }
    },
    'summer-sea': {
      s1: { w: 36, h: 37, x: 2, alt: '파라솔' }, s2: { w: 38, h: 23, x: 2, alt: '수박 두 조각' },
      s3: { w: 29, h: 35, x: 4, alt: '빙수 한 그릇' }, s4: { w: 38, h: 31, x: 4, alt: '바닷가 한 상' }
    },
    'autumn-forest': {
      s1: { w: 42, h: 31, x: 2, alt: '도토리 둘' }, s2: { w: 43, h: 24, x: 2, alt: '홍시 둘' },
      s3: { w: 39, h: 42, x: 3, alt: '단풍잎 한 장' }, s4: { w: 40, h: 28, x: 4, alt: '송편 한 접시와 홍시' }
    },
    'observatory': {
      s1: { w: 45, h: 44, x: 2, alt: '망원경' }, s2: { w: 47, h: 36, x: 2, alt: '별 · 달 모양 쿠키' },
      s3: { w: 40, h: 41, x: 3, alt: '잠든 초승달' }, s4: { w: 41, h: 46, x: 3, alt: '천문대 돔' }
    },
    'train-trip': {
      s1: { w: 26, h: 33, x: 2, alt: '기차 앞모습' }, s2: { w: 32, h: 29, x: 2, alt: '기차 도시락' },
      s3: { w: 33, h: 20, x: 4, alt: '도장 찍힌 기차표' }, s4: { w: 35, h: 29, x: 4, alt: '달리는 기차' }
    },
    'tennis-court': {
      s1: { w: 30, h: 32, x: 2, alt: '라켓과 공' }, s2: { w: 23, h: 25, x: 3, alt: '딸기와 크림' },
      s3: { w: 25, h: 24, x: 5, alt: '트로피' }, s4: { w: 34, h: 26, x: 4, alt: '벤치' }
    },
    'porto': {
      s1: { w: 21, h: 30, x: 2, alt: '노란 트램' }, s2: { w: 34, h: 25, x: 2, alt: '에그타르트 둘' },
      s3: { w: 34, h: 32, x: 4, alt: '아줄레주 타일' }, s4: { w: 34, h: 31, x: 4, alt: '강가 집들과 다리' }
    },
    'prague': {
      s1: { w: 54, h: 74, x: 1, alt: '천문시계' }, s2: { w: 68, h: 62, x: 1, alt: '굴뚝빵 둘' },
      s3: { w: 58, h: 77, x: 2, alt: '첨탑 성' }, s4: { w: 65, h: 61, x: 2, alt: '다리와 지붕들' }
    },
    'tuscany': {
      s1: { w: 38, h: 38, x: 2, alt: '사이프러스 언덕' }, s2: { w: 34, h: 30, x: 2, alt: '젤라토 둘' },
      s3: { w: 28, h: 37, x: 4, alt: '해바라기' }, s4: { w: 37, h: 32, x: 4, alt: '언덕 위 돌집' }
    },
    'airport': {
      s1: { w: 24, h: 38, x: 2, alt: '여행 가방' }, s2: { w: 38, h: 28, x: 2, alt: '기내식' },
      s3: { w: 36, h: 22, x: 4, alt: '이륙하는 비행기' }, s4: { w: 37, h: 30, x: 4, alt: '관제탑과 활주로' }
    },
    'amusement-park': {
      s1: { w: 36, h: 42, x: 2, alt: '풍선 다발' }, s2: { w: 38, h: 39, x: 2, alt: '솜사탕과 츄러스' },
      s3: { w: 36, h: 40, x: 3, alt: '회전목마 말' }, s4: { w: 41, h: 34, x: 4, alt: '관람차와 회전목마' }
    },
    'camping': {
      s1: { w: 34, h: 21, x: 2, alt: '텐트' }, s2: { w: 32, h: 24, x: 2, alt: '마시멜로 꼬치' },
      s3: { w: 25, h: 29, x: 4, alt: '모닥불' }, s4: { w: 38, h: 32, x: 4, alt: '텐트 · 소나무 · 랜턴' }
    },
    'new-york': {
      s1: { w: 24, h: 44, x: 2, alt: '엠파이어 스테이트 빌딩' }, s2: { w: 41, h: 32, x: 2, alt: '베이글과 프레첼' },
      s3: { w: 38, h: 25, x: 4, alt: '노란 택시' }, s4: { w: 36, h: 37, x: 4, alt: '자유의 여신상과 스카이라인' }
    },
    'sydney': {
      s1: { w: 27, h: 34, x: 2, alt: '쿼카' }, s2: { w: 40, h: 29, x: 2, alt: '초코 비스킷과 미트파이' },
      s3: { w: 34, h: 39, x: 4, alt: '캥거루' }, s4: { w: 42, h: 28, x: 4, alt: '오페라하우스와 하버브리지' }
    },
    'bali': {
      s1: { w: 40, h: 37, x: 2, alt: '갈라진 사원 문과 프랑지파니' }, s2: { w: 40, h: 32, x: 2, alt: '나시고렝과 코코넛' },
      s3: { w: 38, h: 38, x: 4, alt: '야자수 해먹' }, s4: { w: 37, h: 38, x: 4, alt: '계단논과 사원' }
    },
    'cairo': {
      s1: { w: 37, h: 31, x: 2, alt: '피라미드와 해' }, s2: { w: 36, h: 31, x: 2, alt: '코샤리와 대추야자' },
      s3: { w: 40, h: 35, x: 4, alt: '낙타' }, s4: { w: 39, h: 36, x: 4, alt: '피라미드와 나일 강 돛단배' }
    },
    'guanajuato': {
      s1: { w: 24, h: 34, x: 2, alt: '선인장 화분' }, s2: { w: 38, h: 24, x: 2, alt: '타코 둘' },
      s3: { w: 42, h: 43, x: 4, alt: '별 피냐타' }, s4: { w: 32, h: 32, x: 4, alt: '색색 집 언덕과 성당 돔' }
    }
  };
  var LIGHT_DEFAULT = 'soft-pastel';
  var DARK_DEFAULT = 'cosmic-dream';

  function byId(id) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return null;
  }
  /** 판 id(winter-snack-night) → 그 판이 속한 테마 (없으면 null) */
  function ofBoard(boardId) {
    for (var i = 0; i < THEMES.length; i++) {
      var t = THEMES[i];
      if (t.id === boardId || (t.modes && (t.modes.light === boardId || t.modes.dark === boardId))) return t;
    }
    return null;
  }
  var picked = null; // 이번에 고른 값 (저장이 막힌 브라우저에서도 화면 · 표시가 어긋나지 않게)
  function stored() {
    if (picked) return picked;
    try {
      var v = root.localStorage && root.localStorage.getItem(KEY);
      if (byId(v)) return v;
      // 판 id 가 저장돼 있으면(예전 시험판 · 손으로 고친 값) 묶음 id 로 고쳐 저장한다
      var t = v ? ofBoard(v) : null;
      if (t) { try { root.localStorage.setItem(KEY, t.id); } catch (e) {} return t.id; }
      return null;
    } catch (e) { return null; }
  }
  // 낮 · 밤 고르기 — 이 기기에 저장. 모르는 값이면 auto
  var pickedMode = null;
  function mode() {
    if (pickedMode) return pickedMode;
    try { var v = root.localStorage && root.localStorage.getItem(MODE_KEY); return MODES.indexOf(v) >= 0 ? v : 'auto'; } catch (e) { return 'auto'; }
  }
  var pickedFont = null;
  function font() {
    if (pickedFont) return pickedFont;
    try { var v = root.localStorage && root.localStorage.getItem(FONT_KEY); return FONTS.indexOf(v) >= 0 ? v : 'pixel'; } catch (e) { return 'pixel'; }
  }
  function saveFont(f) {
    if (FONTS.indexOf(f) < 0) return false;
    pickedFont = f;
    try { root.localStorage.setItem(FONT_KEY, f); } catch (e) {}
    return true;
  }
  function saveMode(m) {
    if (MODES.indexOf(m) < 0) return false;
    pickedMode = m;
    try { root.localStorage.setItem(MODE_KEY, m); } catch (e) {}
    return true;
  }
  function prefersDark() {
    try { return !!(root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches); } catch (e) { return false; }
  }
  // 아직 고르지 않았으면: 휴대폰이 다크 모드면 어두운 테마, 아니면 첫 테마
  function defaultId(dark) { return dark ? DARK_DEFAULT : LIGHT_DEFAULT; }
  function current() { return stored() || defaultId(prefersDark()); }
  function chosen() { return !!stored(); }
  /** 테마에 낮 · 밤 판이 있는지 */
  function hasModes(id) { var t = byId(id); return !!(t && t.modes); }
  /** 지금 그릴 판이 밤 판인지 (modes 가 없는 테마는 그 테마의 dark) */
  function isNight(id, m, dark) {
    var t = byId(id || current());
    if (!t) return false;
    if (!t.modes) return !!t.dark;
    m = m || mode();
    return m === 'auto' ? (dark === undefined ? prefersDark() : !!dark) : m === 'dark';
  }
  /** 실제로 <html data-theme> 에 달 판 id. id · m · dark 를 안 주면 지금 값 */
  function board(id, m, dark) {
    var t = byId(id || current()) || byId(current());
    if (!t.modes) return t.id;
    return isNight(t.id, m, dark) ? t.modes.dark : t.modes.light;
  }

  // 휴대폰 위쪽 띠 색을 화면 바탕(--bg)과 맞춘다. 변수 값은 전환 효과 중에도 바로 최종값이라 타이밍과 상관없다.
  function syncMeta(doc) {
    var meta = doc.querySelector('meta[name="theme-color"]');
    if (!meta || !root.getComputedStyle) return;
    var bg = root.getComputedStyle(doc.documentElement).getPropertyValue('--bg').trim();
    if (bg && meta.getAttribute('content') !== bg) meta.setAttribute('content', bg);
  }

  function apply(id, opts) {
    var doc = root.document;
    if (!doc) return;
    var t = byId(id) || ofBoard(id) || byId(current());
    var html = doc.documentElement, b = board(t.id), skin = t.skin || null;
    var plain = skin === 'pixel' && font() === 'plain' ? 'plain' : null; // 도트 테마에서 「글씨체: 기본」
    if (html.getAttribute('data-font') !== plain) { if (plain) html.setAttribute('data-font', plain); else html.removeAttribute('data-font'); }
    if (html.getAttribute('data-theme') === b && html.getAttribute('data-skin') === skin) { paintPeople(doc, t.id); syncMeta(doc); return; }
    var smooth = opts && opts.smooth;
    if (smooth) html.classList.add('is-theming');
    html.setAttribute('data-theme', b);
    if (skin) html.setAttribute('data-skin', skin); else html.removeAttribute('data-skin');
    paintPeople(doc, t.id);
    syncMeta(doc);
    if (smooth) setTimeout(function () { html.classList.remove('is-theming'); }, 320);
  }

  // 고른 값을 저장만 한다 (화면은 apply). 저장이 막힌 브라우저여도 이번에 연 동안은 기억한다.
  function save(id) {
    if (!byId(id)) return false;
    picked = id;
    try { root.localStorage.setItem(KEY, id); } catch (e) {}
    return true;
  }
  // 고르면 저장하고 바로 바꾼다.
  function choose(id) {
    if (!save(id)) return false;
    apply(id, { smooth: true });
    return true;
  }
  /** 지금 테마의 그림 자리 (없으면 null): { src, w, h, alt } — w · h 는 화면 크기(원본 × 정수 배율) */
  function art(slot, id) {
    var t = byId(id || current()), a = t && ART[t.id] && ART[t.id][slot];
    if (!a) return null;
    return { src: 'themes/' + t.id + '/' + slot + '.png', w: a.w * a.x, h: a.h * a.x, nw: a.w, nh: a.h, alt: a.alt };
  }
  /** 그림 자리 <img> (없으면 '') */
  function artHtml(slot, cls) {
    var a = art(slot);
    if (!a) return '';
    return '<img class="theme-art theme-art--' + slot + (cls ? ' ' + cls : '') + '" src="' + a.src + '" width="' + a.w + '" height="' + a.h + '" alt="' + a.alt + '" decoding="async">';
  }
  /** 글씨체 고르기 (도트 테마): 저장하고 바로 */
  function chooseFont(f) {
    if (!saveFont(f)) return false;
    apply(current());
    return true;
  }
  /** 낮 · 밤 고르기: 저장하고 지금 테마를 다시 단다 */
  function chooseMode(m) {
    if (!saveMode(m)) return false;
    apply(current(), { smooth: true });
    return true;
  }

  // ── 나 · 상대 색 ──
  function lum(h) {
    var c = [1, 3, 5].map(function (i) { var v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function palette(id) { var p = PALETTES[id]; return p ? p.colors.slice() : []; }
  /** 테마 기본 자리 색: her = 첫째 사람, me = 둘째 사람 */
  function slotDefaults(id) { var c = palette(id); return { her: c[0], me: c[1] }; }
  /** 시간표 「함께」 일정 색 — 후보 중 하나지만 사람 색으로는 못 고른다 (styles/tokens.css 의 --both 와 같아야 함) */
  function bothColor(id) { var p = PALETTES[id]; return p ? p.both : null; }
  /** 색 위 글자색: 어두운 글자와 흰 글자 중 더 잘 보이는 쪽 */
  function inkFor(id, hex) {
    var dark = (PALETTES[id] || PALETTES[LIGHT_DEFAULT]).ink;
    return contrast(hex, dark) >= contrast(hex, '#FFFFFF') ? dark : '#FFFFFF';
  }
  function colorName(hex) { return COLOR_NAMES[hex] || hex; }

  /** 저장된 colors를 믿을 수 있는 모양으로: 아는 테마 · 그 테마 후보 색만, 나 · 상대가 같은 색이면 버린다 */
  function cleanColors(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(PALETTES).forEach(function (id) {
      var p = raw[id];
      if (!p || typeof p !== 'object') return;
      var list = PALETTES[id].colors, pair = {};
      ['self', 'partner'].forEach(function (k) {
        var v = typeof p[k] === 'string' ? p[k].toUpperCase() : null;
        if (v && list.indexOf(v) >= 0 && v !== PALETTES[id].both) pair[k] = v; // 함께 색은 사람 색이 될 수 없음
      });
      if (pair.self && pair.self === pair.partner) return;
      if (pair.self || pair.partner) out[id] = pair;
    });
    return out;
  }

  /** 이 테마에서 내 화면의 나 · 상대 색 (안 고른 쪽은 그 사람 자리의 기본색) */
  function pairFor(id, colors, selfSlot) {
    var d = slotDefaults(id), mine = (cleanColors(colors)[id]) || {};
    var partnerSlot = selfSlot === 'her' ? 'me' : 'her';
    var self = mine.self || d[selfSlot], partner = mine.partner || d[partnerSlot];
    // 한쪽만 고른 색이 다른 쪽 기본색과 같으면, 다른 쪽은 남은 기본색으로 비킨다
    if (self === partner) { if (mine.self) partner = d[selfSlot]; else self = d[partnerSlot]; }
    return { self: self, partner: partner };
  }

  /** 테마 하나의 색을 바꾼 새 colors (기본색과 같으면 그 칸을 비운다). self와 partner가 같아지면 상대를 내 이전 색으로 바꾼다. */
  function withPick(colors, id, selfSlot, who, hex) {
    var all = cleanColors(colors), list = palette(id);
    hex = String(hex || '').toUpperCase();
    if (!byId(id) || list.indexOf(hex) < 0 || hex === bothColor(id) || (who !== 'self' && who !== 'partner')) return all;
    var now = pairFor(id, all, selfSlot), next = { self: now.self, partner: now.partner };
    var other = who === 'self' ? 'partner' : 'self';
    if (next[other] === hex) next[other] = now[who]; // 서로 바꾸기
    next[who] = hex;
    var d = slotDefaults(id), partnerSlot = selfSlot === 'her' ? 'me' : 'her', pair = {};
    if (next.self !== d[selfSlot]) pair.self = next.self;
    if (next.partner !== d[partnerSlot]) pair.partner = next.partner;
    if (pair.self || pair.partner) all[id] = pair; else delete all[id];
    return all;
  }
  function withReset(colors, id) { var all = cleanColors(colors); delete all[id]; return all; }

  // 지금 칠하는 기준 — 처음엔 이 기기에 적어 둔 값 (계정 값이 오면 setPeople로 바뀐다)
  var people = (function () {
    try {
      var v = JSON.parse((root.localStorage && root.localStorage.getItem(COLOR_KEY)) || 'null');
      if (v && (v.slot === 'her' || v.slot === 'me')) return { slot: v.slot, colors: cleanColors(v.colors) };
    } catch (e) {}
    return { slot: null, colors: {} };
  })();
  var VARS = ['--her', '--her-ink', '--me', '--me-ink'];
  function paintPeople(doc, id) {
    var style = doc.documentElement.style;
    var mine = people.slot && people.colors[id];
    if (!mine) { VARS.forEach(function (k) { style.removeProperty(k); }); return; }
    var pair = pairFor(id, people.colors, people.slot), partnerSlot = people.slot === 'her' ? 'me' : 'her';
    var slots = {}; slots[people.slot] = pair.self; slots[partnerSlot] = pair.partner;
    ['her', 'me'].forEach(function (s) {
      style.setProperty('--' + s, slots[s]);
      style.setProperty('--' + s + '-ink', inkFor(id, slots[s]));
    });
  }
  /** 계정의 색이 오거나 바뀌면: 저장하고 지금 테마로 다시 칠한다. selfSlot = 내 자리('her' | 'me'). */
  function setPeople(selfSlot, colors) {
    var next = { slot: selfSlot === 'her' || selfSlot === 'me' ? selfSlot : null, colors: cleanColors(colors) };
    var same = JSON.stringify(next) === JSON.stringify(people);
    people = next;
    if (!same) { try { root.localStorage.setItem(COLOR_KEY, JSON.stringify(people)); } catch (e) {} }
    if (root.document && root.document.documentElement) paintPeople(root.document, current());
  }
  function forget() { setPeople(null, {}); try { root.localStorage.removeItem(COLOR_KEY); } catch (e) {} }

  // ── 테마 시트 묶음 · 이번 달 ──
  function groupOf(id) { var t = byId(id); return t ? t.group : null; }
  /** 묶음 목록: [{ id, name, themes: [테마…] }] — 들어간 테마가 없는 묶음은 뺀다 */
  function groups() {
    return GROUPS.map(function (g) {
      var mine = THEMES.filter(function (t) { return t.group === g.id; });
      if (g.order) {
        var ord = g.order;
        mine = mine.slice().sort(function (a, b) {
          var x = ord.indexOf(a.id), y = ord.indexOf(b.id);
          return (x < 0 ? 999 : x) - (y < 0 ? 999 : y) || THEMES.indexOf(a) - THEMES.indexOf(b);
        });
      }
      return { id: g.id, name: g.name, themes: mine };
    }).filter(function (g) { return g.themes.length > 0; });
  }
  /** 서울 날짜의 달 (1~12) — 휴대폰 시간대와 상관없이 */
  function seoulMonth(date) { var d = date ? new Date(date) : new Date(); return new Date(d.getTime() + 9 * 3600000).getUTCMonth() + 1; }
  /** 이번 달 어울리는 테마 id (들어간 것만, 0~2개) */
  function monthly(date) { return (MONTHLY[seoulMonth(date)] || []).filter(function (id) { return !!byId(id); }); }
  /** 미리보기 · 색 띠에 쓸 판: 낮 · 밤 판이 있으면 낮 판 */
  function dayBoard(id) { var t = byId(id); return t ? (t.modes ? t.modes.light : t.id) : null; }

  var api = { THEMES: THEMES, GROUPS: GROUPS, MONTHLY: MONTHLY, groups: groups, groupOf: groupOf, monthly: monthly, seoulMonth: seoulMonth, dayBoard: dayBoard, KEY: KEY, MODE_KEY: MODE_KEY, MODES: MODES, COLOR_KEY: COLOR_KEY, PALETTES: PALETTES, byId: byId, ofBoard: ofBoard, current: current, chosen: chosen, defaultId: defaultId, apply: apply, save: save, choose: choose, syncMeta: syncMeta,
    ART: ART, art: art, artHtml: artHtml, FONT_KEY: FONT_KEY, font: font, saveFont: saveFont, chooseFont: chooseFont, mode: mode, saveMode: saveMode, chooseMode: chooseMode, hasModes: hasModes, isNight: isNight, board: board, prefersDark: prefersDark,
    palette: palette, slotDefaults: slotDefaults, bothColor: bothColor, inkFor: inkFor, contrast: contrast, colorName: colorName, cleanColors: cleanColors, pairFor: pairFor, withPick: withPick, withReset: withReset, setPeople: setPeople, forget: forget };
  root.RT = root.RT || {};
  root.RT.themes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // 첫 화면: 저장된 테마(없으면 기본)를 바로 단다 — <head> 에서 CSS 바로 뒤에 불러서 첫 프레임부터 맞는 판 · 스킨.
  // 휴대폰 다크 모드가 바뀌면 따라간다: 아직 고르지 않았거나, 낮 · 밤 판이 있는 테마를 「자동」으로 쓸 때.
  var listeners = [];
  function onChange(fn) { listeners.push(fn); }
  api.onChange = onChange;
  if (root.document && root.document.documentElement) {
    apply(current());
    try {
      var mq = root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)');
      var follow = function () {
        if (!chosen() || (hasModes(current()) && mode() === 'auto')) {
          apply(current(), { smooth: true });
          listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
        }
      };
      if (mq && mq.addEventListener) mq.addEventListener('change', follow);
      else if (mq && mq.addListener) mq.addListener(follow);
    } catch (e) {}
  }
})(typeof window !== 'undefined' ? window : globalThis);
