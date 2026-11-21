// 출출 쿠키 화면 글 전부. 이름은 NAME 한 곳에만 — 바뀌면 이 줄만 고친다.
// 목업(design/mockups/chosen/eat/)의 글과 글자 그대로 맞춘다.
import { withJosa, josa } from './josa.js';
import { writtenAt, monthDay } from './format.js';

export const NAME = '출출 쿠키';

const COUNT_WORD = { 1: '하나', 2: '두 개', 3: '세 개' };

export function makeText(name = NAME) {
  return {
    name,

    // 전체 탭 칸 (입구 I1)
    entrySub: '배고픈데 못 정하겠으면 깨 보세요',
    entryToday: (food) => `오늘은 ${food}!`,
    entryCount: (n) => `쿠키 ${n}개`,
    entryNew: (n) => `단짝 +${n}`,

    // 쿠키 통
    jarCount: (n) => `${n}개`,
    jarEmpty: '아직 비어 있어요',
    jarMine: (n) => `나 ${n}`,
    jarPartner: (n) => `단짝 ${n}`,
    jarOldest: (agoText) => `· 가장 오래된 쿠키 ${agoText}`,
    howMany: '몇 개 깰까요?',
    countOption: (k) => `${k}개`,
    whoAll: '모두',
    whoMine: '내 쿠키',
    whoPartner: '단짝 쿠키',
    addButton: '쿠키 넣기',
    crackButton: (k) => `쿠키 ${k}개 깨기`,
    crackButtonToday: '쿠키 깨기',
    listButtonLabel: '넣어 둔 쿠키',
    emptySteps: [
      '먹고 싶은 게 떠오르면 쿠키에 적어 넣어요',
      '단짝도 같은 통에 넣어요. 서로의 쿠키는 깰 때까지 비밀',
      '배고픈데 못 정하겠을 때, 몇 개 깰지 고르고 톡!',
    ],
    firstCookie: '첫 쿠키 넣기',

    // 쿠키 넣기
    writeTitle: '쿠키 넣기',
    written: (ms) => `${writtenAt(ms)} 작성`,
    foodLabel: '먹고 싶은 음식',
    placeLabel: '가고 싶은 음식점',
    placeOptional: '있다면',
    memoLabel: '메모',
    memoCount: (n, max) => `${n} / ${max}`,
    secretHint: '단짝은 이 쿠키를 깨기 전까지 내용을 볼 수 없어요',
    foldButton: '접어서 통에 넣기',
    added: (n) => `쿠키 통에 넣었어요 · ${n}개째`,
    edit: '고치기',
    edited: '고침',

    // 음식점 찾기 (카카오맵)
    placeSheetTitle: '가고 싶은 음식점',
    placeSheetSub: '카카오맵에서 찾아요. 못 찾으면 이름만 적어도 돼요',
    placeNameOnly: (q) => `「${q}」 이름만 적기`,
    placeNameOnlySub: '카카오맵 연결 없이 글자로만 남겨요',
    placeKakaoTag: '카카오맵 장소',

    // 깨기
    crackingTitle: '쿠키 깨는 중',
    crackingFirst: '톡, 하나 깨졌어요',
    crackingSub: (n) => `${COUNT_WORD[n] ?? `${n}개`}${n === 1 ? '가 펴져요' : '가 차례로 펴져요'} · 누르면 바로 다 펴기`,

    // 고르기
    resultTitle: (n) => `쿠키 ${n}개를 깼어요`,
    resultSub: '마음에 드는 걸 하나 골라요. 나머지는 통으로 돌아가요',
    redraw: '다시 뽑기',
    pickFood: (food) => `${withJosa(food, '으로/로')} 할래요`,
    pickNone: '이걸로 먹을래요',
    singleSubMine: (agoText) => `${agoText}의 내가 남긴 쿠키예요`,
    singleSubPartner: (agoText) => `${agoText}에 단짝이 남긴 쿠키예요`,
    conflict: '단짝이 방금 골랐어요',

    // 펼친 쪽지
    slipMine: '내가 적은 쿠키',
    slipPartner: '단짝이 적은 쿠키',
    noPlace: '가게는 안 정했어요',
    kakaoLink: '카카오맵',

    // 오늘 먹을 것
    todayKick: '오늘은 이거!',
    yesterdayKick: '어제 고른 쿠키예요',
    dayBeforeKick: '그저께 고른 쿠키예요',
    todayFrom: (mine, ms) => `${mine ? '내가' : '단짝이'} ${monthDay(ms)}에 적은 쿠키`,
    kungButton: '꿍으로 알려 주기',
    ateButton: '먹었어요',
    returnButton: '통에 돌려놓기',
    todayLockHint: '오늘 먹을 걸 정했어요. 다시 깨려면 먼저 먹었어요 또는 돌려놓기',

    // 먹었어요 시트
    ateTitle: (food) => `${food} 어땠어요?`,
    ateSub: '별점은 각자 남겨요. 단짝 별점은 단짝이 남기면 같이 보여요',
    oneLine: '한 줄',
    together: '단짝과 함께 먹었어요',
    togetherSub: '가게가 있는 쿠키면 짝꿍 지도에 칠할지도 물어봐요',
    again: '또 먹고 싶어요',
    againSub: '같은 쿠키를 통에 다시 넣어 둘게요',
    save: '남기기',
    paintAsk: (area) => `짝꿍 지도에 ${withJosa(area, '을/를')} 칠할까요?`,

    // 넣어 둔 쿠키
    listTitle: '넣어 둔 쿠키',
    tabJar: (n) => `통 안 ${n}`,
    tabEaten: (n) => `먹은 것 ${n}`,
    secretName: '단짝의 쿠키',
    secretSub: '깨기 전엔 비밀이에요',
    noPlaceShort: '가게 없음',
    againTag: '또 먹기',
    lastStars: (avg) => `지난번 별점 ★${avg}`,
    listHint: '내 쿠키는 눌러서 고치거나 뺄 수 있어요. 단짝 쿠키는 깨야 보여요',

    // 꿍 알림 (내용은 고른 음식 이름만, 메모는 안 넣음)
    pushTitle: `단짝이 ${name}${josa(name, '을/를')} 깼어요`,
    pushBody: (food) => `오늘은 ${food} 어때요?`,
  };
}
