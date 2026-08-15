export function streakContinuationCopy(currentStreak) {
  const normalized = Math.max(1, Math.floor(Number(currentStreak) || 0));
  return `하루 만회 후 오늘 읽으면 ${normalized + 1}일째로 이어져요`;
}

export function isStreakCheckedToday(lastCheckInDate, today) {
  return Boolean(today && lastCheckInDate === today);
}

export function shouldShowStreakRepairCard({ canRepair, lastCheckInDate, today }) {
  return Boolean(canRepair) && !isStreakCheckedToday(lastCheckInDate, today);
}

export function resolveStreakRepairView({ status, current, today }) {
  const lastCheckInDate = current && current.last_check_in_date;
  const checkedToday = isStreakCheckedToday(lastCheckInDate, today);
  const shouldShow = shouldShowStreakRepairCard({
    canRepair: status && status.canRepair,
    lastCheckInDate,
    today,
  });
  return {
    checkedToday,
    repairCard: shouldShow
      ? { lostStreak: status.lostStreak, brokenDays: status.brokenDays }
      : null,
  };
}

function msUntilNextLocalDay(now) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1, next.getTime() - now.getTime() + 50);
}

export function createStreakRepairLifecycle({
  read,
  onState,
  getToday,
  now = () => new Date(),
  windowTarget = typeof window !== 'undefined' ? window : null,
  documentTarget = typeof document !== 'undefined' ? document : null,
  capApp = typeof window !== 'undefined' ? window.CapApp : null,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
}) {
  let disposed = false;
  let mutationDepth = 0;
  let requestId = 0;
  let rolloverTimer = null;
  let resumeHandle = null;

  const reevaluate = async () => {
    if (disposed || mutationDepth > 0) return;
    const currentRequest = ++requestId;
    try {
      const snapshot = await read();
      if (disposed || currentRequest !== requestId) return;
      onState(resolveStreakRepairView({ ...snapshot, today: getToday() }));
    } catch (_) {
      // 복구 카드는 보조 넛지다. 읽기 실패가 홈 화면을 막지 않게 기존 상태를 유지한다.
    }
  };

  const scheduleRollover = () => {
    if (disposed) return;
    if (rolloverTimer !== null) clearTimeoutFn(rolloverTimer);
    rolloverTimer = setTimeoutFn(() => {
      rolloverTimer = null;
      reevaluate();
      scheduleRollover();
    }, msUntilNextLocalDay(now()));
  };
  const onVisibility = () => {
    if (!documentTarget || documentTarget.visibilityState === 'visible') reevaluate();
  };
  const onFocus = () => { reevaluate(); };
  const onResume = () => { reevaluate(); };

  if (documentTarget && documentTarget.addEventListener) {
    documentTarget.addEventListener('visibilitychange', onVisibility);
  }
  if (windowTarget && windowTarget.addEventListener) {
    windowTarget.addEventListener('focus', onFocus);
  }
  if (capApp && capApp.addListener) {
    try {
      Promise.resolve(capApp.addListener('resume', onResume)).then((handle) => {
        if (!handle || typeof handle.remove !== 'function') return;
        if (disposed) handle.remove();
        else resumeHandle = handle;
      }).catch(() => {});
    } catch (_) {}
  }

  reevaluate();
  scheduleRollover();

  const invalidate = () => {
    if (!disposed) requestId += 1;
  };
  const beginMutation = () => {
    if (disposed) return () => Promise.resolve();
    mutationDepth += 1;
    requestId += 1;
    let ended = false;
    return () => {
      if (ended || disposed) return Promise.resolve();
      ended = true;
      mutationDepth = Math.max(0, mutationDepth - 1);
      return mutationDepth === 0 ? reevaluate() : Promise.resolve();
    };
  };
  const stop = () => {
    if (disposed) return;
    disposed = true;
    requestId += 1;
    if (rolloverTimer !== null) {
      clearTimeoutFn(rolloverTimer);
      rolloverTimer = null;
    }
    if (documentTarget && documentTarget.removeEventListener) {
      documentTarget.removeEventListener('visibilitychange', onVisibility);
    }
    if (windowTarget && windowTarget.removeEventListener) {
      windowTarget.removeEventListener('focus', onFocus);
    }
    if (resumeHandle && typeof resumeHandle.remove === 'function') {
      try { resumeHandle.remove(); } catch (_) {}
      resumeHandle = null;
    }
  };
  // React effect cleanup과 외부 mutation race 제어를 한 핸들로 제공한다.
  // beginMutation은 이 lifecycle에 묶인 1회성 종료 함수를 돌려줘 겹친 저장과 stale settlement를 격리한다.
  stop.invalidate = invalidate;
  stop.beginMutation = beginMutation;
  return stop;
}

if (typeof window !== 'undefined') {
  window.RG_streakContinuationCopy = streakContinuationCopy;
  window.RG_shouldShowStreakRepairCard = shouldShowStreakRepairCard;
  window.RG_resolveStreakRepairView = resolveStreakRepairView;
  window.RG_createStreakRepairLifecycle = createStreakRepairLifecycle;
}
