/* 교환 쪽지 — 화면 · 알림 문구 전부 (docs/question/spec.md, 참조 reference/src/text.js 그대로).
   기능 이름은 NAME 한 곳 — makeText(name) 으로 알림 제목 · 설정 · 결산 머리가 함께 바뀐다.
   ※ functions/shared/question-text.js 는 이 파일의 사본 (bash scripts/sync-shared.sh) */
(function (root) {
  'use strict';
  // 화면 · 알림 문구. 기능 이름 「교환 쪽지」(11-21 사용자 결정). 바꿀 일이 생기면 NAME 한 곳만.
  // 화면 글은 '쪽지'로 부르지만 데이터 이름(qdays/{date}/a/{uid} 등)은 그대로.
  const NAME = '교환 쪽지';

  // 받침 있으면 '이', 없으면 '가' (준민이 · 단짝이 · 하루가)
  function iga(name) {
    const c = name.charCodeAt(name.length - 1);
    if (c < 0xac00 || c > 0xd7a3) return `${name}이(가)`;
    return (c - 0xac00) % 28 ? `${name}이` : `${name}가`;
  }

  function makeText(name = NAME) {
    return {
      name,
      // 상태 (입구 카드 · 지난 쪽지)
      stateNone: '둘 다 아직이에요',
      stateMine: '단짝 쪽지를 기다려요',
      stateTheirs: '단짝이 남겼어요',
      stateBoth: '둘 다 남겼어요',
      // 쪽지 칸
      mine: '내 쪽지',
      theirs: '단짝의 쪽지',
      toPartner: '단짝에게',
      answerPlaceholder: '단짝에게 쪽지를 써요',
      answerSave: '남기기',
      answerEdit: '고치기',
      edited: '고침',
      partnerWaiting: '아직 안 남겼어요',
      partnerLocked: '내 쪽지를 남기면 펴져요',
      partnerFolded: (time) => `${time}에 접어 둔 쪽지`,
      nudgeKung: '꿍 보내서 알려 주기',
      nudgeAfter: '단짝이 남기면 알려 드릴게요',
      like: '마음에 남아요',
      // 질문 꼬리표
      tagFirst: '첫 쪽지',
      tagOursBy: (who) => `${iga(who)} 낸 질문`,
      tagHundred: (n) => `${n.toLocaleString('ko-KR')}일 기념 질문`,
      tagAnniv: (y) => `${y}주년 질문`,
      // 첫날 안내
      howTitle: '이렇게 써요',
      how: ['하루에 질문 하나, 둘 다 쪽지를 남겨요.', '내 쪽지를 남겨야 단짝 쪽지가 펴져요.', '질문이 마음에 안 들면 하루 한 번 바꿀 수 있어요.'],
      // 다른 질문
      swap: '다른 질문',
      swapTitle: '다른 질문으로 바꿀까요?',
      swapSub: '하루에 한 번만 바꿀 수 있어요. 지금 질문은 목록 맨 뒤로 가요.',
      swapKeep: '그대로 두기',
      swapConfirm: '바꾸기',
      swapOurs: '우리가 낸 질문은 「다른 질문」으로 바꿀 수 없어요.',
      // 질문 넣기
      addTitle: '질문 넣기',
      addSub: '둘 다 쪽지를 남기는 질문이에요. 나도 남기게 돼요.',
      addWhen: '언제 나올까요',
      addAsk: '단짝에게 묻기',
      addAskSub: '내일 질문으로 나와요. 그때까지 단짝에게는 「준비한 질문이 있어요」로만 보여요.',
      addMix: '목록에 섞기',
      addMixSub: '며칠 안에 섞여서 나와요.',
      addSave: '넣기',
      addSeeList: '우리가 넣은 질문 보기',
      // 검사 실패
      answerEmpty: '한 글자 이상 적어 주세요',
      answerLong: '300자까지 적을 수 있어요',
      questionShort: '두 글자 이상 적어 주세요',
      questionLong: '60자까지 적을 수 있어요',
      questionInBank: '기본 질문에 이미 있어요',
      questionInOurs: '이미 넣어 둔 질문이에요',
      // 지난 쪽지 · 우리 질문
      pastTitle: '지난 쪽지',
      pastSummary: (asked, both) => `질문 ${asked}개 · 둘 다 남긴 날 ${both}일`,
      lateAnswer: '늦게 남기기',
      swapped: '바꾼 질문',
      oursTitle: '우리가 넣은 질문',
      oursWaiting: '기다리는 질문',
      oursShown: '나온 질문',
      oursHidden: '단짝이 준비한 질문이 있어요',
      // 알림
      pushPartnerAnswered: '단짝이 쪽지를 남겼어요 · 내 쪽지를 남기면 펴져요',
      pushBothOpen: '단짝도 쪽지를 남겼어요 · 서로의 쪽지를 펼쳐 볼 수 있어요',
      settingRemind: `저녁 6시에 ${name} 알려 주기`,
      settingRemindSub: '아직 안 남겼을 때만',
      settingPartner: '단짝이 쪽지를 남기면 알려 주기',
      // 결산 카드 8
      recapKick: name,
      recapBothLead: (asked, ours) => `둘 다 쪽지를 남긴 날이에요. 질문 ${asked}개 중 ${ours}개는 우리가 낸 질문이었어요.`,
      recapLiked: '마음에 남은 쪽지',
    };
  }

  const T = makeText();

  const api = { NAME, iga, makeText, T };
  root.RT = root.RT || {};
  root.RT.questionText = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
