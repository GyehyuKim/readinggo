/* =========================================================
   ReadingGo — streak-reminder.js  (#1033 스트릭 리마인더 로컬 알림)

   매일 정해진 시각에 *로컬* 알림으로 "오늘 아직 안 읽었어요"를 띄워 스트릭을
   이어가게 한다. @capacitor/local-notifications(공식 플러그인) — 서버·FCM 불필요,
   기기 안에서만 스케줄. 웹/비네이티브에선 전부 no-op(플러그인 web 스텁 + RG_NATIVE 가드).

   - 설정: localStorage `rg_streak_reminder` = { enabled, hour, minute }. 기본 21:00 OFF.
   - 권한: 설정에서 켤 때 자연스럽게 요청(첫 진입 강요 X). 거부 시 토글 원복.
   - 스케줄: '다음 발생 시각' 한 방 + repeats:true(앱 미실행 며칠도 매일 재발화).
   - 중복 방지: 오늘 이미 읽었으면(스트릭 last_check_in_date===오늘) 오늘치는 건너뛰고
     내일 같은 시각으로. 앱 진입/복귀(main.js)마다 재무장해 상태를 최신으로 맞춘다.

   소비자: settings-modal.js(토글 UI), main.js(부팅·resume 재무장).
   ========================================================= */

const RG_REMINDER_KEY = 'rg_streak_reminder';
const RG_REMINDER_NOTIF_ID = 8001;            // 고정 id — 재스케줄이 항상 같은 알림을 교체.
const RG_REMINDER_DEFAULT = { enabled: false, hour: 21, minute: 0 };

// 재키 목소리 리마인더 문구 로테이션 — 매일 같은 알림은 배너 블라인드가 된다(데모 피드백:
// "인게이지먼트 다양화"). 재키=최고 호평 자산이라 그 목소리로. 날짜 기반 인덱스라 하루 안엔
// 고정, 매일 순환. ponytail: repeats:true 는 재스케줄 전까지 같은 문구를 재사용 —
//   앱 진입/복귀마다 _rmReschedule 이 돌아 그날 문구로 갱신됨(며칠 미실행 시만 직전 문구 반복).
const RG_REMINDER_LINES = [
  { title: '오늘의 한 줄, 아직이에요', body: '잠깐이면 돼요. 오늘 읽은 한 문장으로 둥지를 이어가요.' },
  { title: '재키가 기다려요', body: '오늘 읽은 자리의 한 문장, 같이 곱씹어볼까요?' },
  { title: '한 문장이면 충분해요', body: '한 쪽만 펼쳐도 돼요. 마음에 걸린 한 줄을 남겨요.' },
  { title: '둥지가 오늘을 기다려요', body: '오늘의 한 문장이 쌓여 내가 돼요. 잠깐 들러요.' },
  { title: '오늘 만난 문장 있어요?', body: '재키가 물어볼 게 있대요 — 오늘 읽은 한 줄로요.' },
];
function _rmPickLine() {
  const dayNum = Math.floor(Date.now() / 86400000);   // 실제 시계 기준 일수
  return RG_REMINDER_LINES[((dayNum % RG_REMINDER_LINES.length) + RG_REMINDER_LINES.length) % RG_REMINDER_LINES.length];
}

function _rmIsNative() { return !!window.RG_NATIVE; }
function _rmPlugin() { return window.CapLocalNotifications || null; }

// 시뮬레이션 날짜를 따르는 곳(DataStore)과 동일한 YYYY-MM-DD. 알림은 실제 시계로 발화하므로
// '오늘 읽었나' 판정에만 쓴다(스케줄 시각 계산은 실제 new Date()).
function _rmToday() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

function _rmGetSettings() {
  try {
    const raw = localStorage.getItem(RG_REMINDER_KEY);
    if (!raw) return { ...RG_REMINDER_DEFAULT };
    const s = JSON.parse(raw);
    return {
      enabled: !!s.enabled,
      hour: (typeof s.hour === 'number' && s.hour >= 0 && s.hour <= 23) ? s.hour : RG_REMINDER_DEFAULT.hour,
      minute: (typeof s.minute === 'number' && s.minute >= 0 && s.minute <= 59) ? s.minute : RG_REMINDER_DEFAULT.minute,
    };
  } catch (e) { return { ...RG_REMINDER_DEFAULT }; }
}

function _rmSaveSettings(s) {
  try { localStorage.setItem(RG_REMINDER_KEY, JSON.stringify(s)); } catch (e) { /* noop */ }
}

// 오늘 이미 기록했는지 — 스트릭 어댑터의 last_check_in_date 가 SSOT. 비동기(Supabase) 가능.
async function _rmAlreadyReadToday() {
  try {
    const DS = window.DataStore;
    if (!(DS && DS.streak && DS.streak.get)) return false;
    const st = await Promise.resolve(DS.streak.get());
    return !!(st && st.last_check_in_date === _rmToday());
  } catch (e) { return false; }
}

// 다음 발화 시각. 오늘 시각이 아직 안 지났고 + 오늘 안 읽었으면 오늘, 아니면 내일.
function _rmNextFireAt(hour, minute, readToday) {
  const at = new Date();
  at.setSeconds(0, 0);
  at.setHours(hour, minute, 0, 0);
  const passed = at.getTime() <= Date.now();
  if (passed || readToday) at.setDate(at.getDate() + 1); // 지났거나 오늘 이미 읽음 → 내일로
  return at;
}

// 권한 요청(설정에서 켤 때). 반환: 'granted' | 'denied' | 'unsupported'.
async function _rmRequestPermission() {
  const P = _rmPlugin();
  if (!_rmIsNative() || !P) return 'unsupported';
  try {
    let perm = await P.checkPermissions();
    if (perm && perm.display === 'granted') return 'granted';
    if (perm && perm.display === 'denied') {
      // 한번 거부됨 — 재요청해도 OS가 무시할 수 있으나 시도(사용자가 설정에서 푼 경우 회복).
    }
    perm = await P.requestPermissions();
    return (perm && perm.display === 'granted') ? 'granted' : 'denied';
  } catch (e) { return 'denied'; }
}

async function _rmCancel() {
  const P = _rmPlugin();
  if (!_rmIsNative() || !P) return;
  try { await P.cancel({ notifications: [{ id: RG_REMINDER_NOTIF_ID }] }); } catch (e) { /* noop */ }
}

// 스케줄 재무장 — 끄면 취소, 켜면 '다음 발생' + 매일 반복으로 1건. 권한 없으면 스킵.
// 앱 부팅/복귀마다 호출돼 '오늘 읽음' 상태를 반영한다(중복 알림 방지).
async function _rmReschedule() {
  const P = _rmPlugin();
  if (!_rmIsNative() || !P) return;                 // 웹/비네이티브 no-op
  const s = _rmGetSettings();
  if (!s.enabled) { await _rmCancel(); return; }
  // 권한 확인 — 없으면(거부) 스케줄하지 않음. 토글은 켜둔 상태로 두되 발화 안 됨.
  try {
    const perm = await P.checkPermissions();
    if (!(perm && perm.display === 'granted')) { await _rmCancel(); return; }
  } catch (e) { return; }

  const readToday = await _rmAlreadyReadToday();
  const at = _rmNextFireAt(s.hour, s.minute, readToday);
  const line = _rmPickLine();                         // 재키 목소리 로테이션(#인게이지먼트)
  await _rmCancel();                                 // 항상 교체(중복 누적 방지)
  try {
    await P.schedule({
      notifications: [{
        id: RG_REMINDER_NOTIF_ID,
        title: line.title,
        body: line.body,
        schedule: { at, repeats: true, allowWhileIdle: true }, // at=다음 발생, repeats=이후 매일 같은 시각
        smallIcon: 'ic_stat_icon_config_sample',         // 안드로이드 기본 알림 아이콘(미존재 시 앱 아이콘 폴백)
      }],
    });
  } catch (e) { /* 스케줄 실패 무시(데모 무중단) */ }
}

// 설정에서 토글 ON — 권한 요청 후 성공 시 저장+스케줄. 반환 boolean(=실제 켜졌는지).
async function _rmEnable() {
  const perm = await _rmRequestPermission();
  if (perm === 'unsupported') {
    // 웹 등 — 설정값만 저장(네이티브 앱에서 의미). 스케줄은 no-op.
    const s = _rmGetSettings(); s.enabled = true; _rmSaveSettings(s);
    return true;
  }
  if (perm !== 'granted') return false;              // 거부 → 켜지 못함
  const s = _rmGetSettings(); s.enabled = true; _rmSaveSettings(s);
  await _rmReschedule();
  return true;
}

async function _rmDisable() {
  const s = _rmGetSettings(); s.enabled = false; _rmSaveSettings(s);
  await _rmCancel();
}

// 시각 변경 — 저장 후 켜져 있으면 재스케줄.
async function _rmSetTime(hour, minute) {
  const s = _rmGetSettings();
  s.hour = hour; s.minute = minute;
  _rmSaveSettings(s);
  if (s.enabled) await _rmReschedule();
}

window.RG_streakReminder = {
  isNativeSupported: () => _rmIsNative() && !!_rmPlugin(),
  getSettings: _rmGetSettings,
  enable: _rmEnable,
  disable: _rmDisable,
  setTime: _rmSetTime,
  reschedule: _rmReschedule,
};
