// 먹었어요 뒤 「짝꿍 지도에 ○○구를 칠할까요?」를 물을지.
// 조건: 함께 먹음 + 카카오 장소로 고른 가게 + 시·군·구 코드가 있음 + 그 시·군·구가 아직 안 칠해짐.
// 이름만 적은 가게는 묻지 않는다(어느 시·군·구인지 모름).

/** @returns {string|null} 물어볼 시·군·구 코드 */
export function paintAsk({ cookie, together, paintedSigungu }) {
  if (!together) return null;
  const code = cookie.place?.kakaoId ? cookie.place.sigungu : null;
  if (!code) return null;
  return paintedSigungu.has(code) ? null : code;
}
