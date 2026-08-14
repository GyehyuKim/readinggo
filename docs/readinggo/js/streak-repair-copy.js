export function streakContinuationCopy(currentStreak) {
  const normalized = Math.max(0, Math.floor(Number(currentStreak) || 0));
  return normalized > 0
    ? `오늘 읽으면 ${normalized + 1}일째로 이어져요`
    : '오늘부터 다시 시작해볼까요';
}

export function isStreakCheckedToday(lastCheckInDate, today) {
  return Boolean(today && lastCheckInDate === today);
}

export function shouldShowStreakRepairCard({ canRepair, lastCheckInDate, today }) {
  return Boolean(canRepair) && !isStreakCheckedToday(lastCheckInDate, today);
}

if (typeof window !== 'undefined') {
  window.RG_streakContinuationCopy = streakContinuationCopy;
  window.RG_shouldShowStreakRepairCard = shouldShowStreakRepairCard;
}
