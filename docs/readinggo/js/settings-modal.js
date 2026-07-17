/* =========================================================
   ReadingGo — settings-modal.js  (#761 모듈화: components.js에서 추출)
   SettingsModal — 설정 화면. components.js **이후**(showToast/RG_consent 등 window 전역),
   icons.js 이후(rgIcon), app.js(소비자) 이전 로드. 순수 이동.
   ========================================================= */

// loadBabel 파일별 eval 스코프 → 훅 재구조분해 필수(#761).
const { useState, useEffect } = React;

/* ── SettingsModal: 설정 (#567 #568 재배치)
   그룹: ① 계정 ② 개인정보·데이터 ③ 읽기 환경 ④ 지원 ⑤ 정보
   닉네임 편집 → 프로필 헤더 인라인 (#568), 내보내기 → 서재 (#568),
   한 줄 소개 편집 → 프로필 헤더 인라인 (#515). */
function SettingsModal({ onClose, spoilerReveal, setSpoilerReveal }) {
  const [consentOn, setConsentOn] = useState(window.RG_consent && window.RG_consent.get() === 'yes'); // 데이터 활용 동의 (#294)
  const [qPreset, setQPreset] = useState(window.RG_companionPreset ? window.RG_companionPreset.get() : 'balanced'); // 참새 질문 결 (#375)
  // 한 문장 기본 공개 범위 (#1261) — 저장 완료 후에만 선택 상태를 확정한다.
  const [sentenceVisibility, setSentenceVisibility] = useState('public');
  const [sentenceVisibilityBusy, setSentenceVisibilityBusy] = useState(true);
  useEffect(() => {
    let alive = true;
    const settingsApi = window.DataStore && window.DataStore.settings;
    if (!(settingsApi && settingsApi.get)) { setSentenceVisibilityBusy(false); return () => { alive = false; }; }
    Promise.resolve(settingsApi.get()).then((settings) => {
      if (!alive) return;
      setSentenceVisibility(settings && settings.default_sentence_visibility === 'private' ? 'private' : 'public');
    }).catch(() => {
      if (alive) showToast('기본 공개 범위를 불러오지 못했어요. 다시 열어 주세요.');
    }).finally(() => { if (alive) setSentenceVisibilityBusy(false); });
    return () => { alive = false; };
  }, []);
  const saveSentenceVisibility = (next) => {
    if (sentenceVisibilityBusy || next === sentenceVisibility) return;
    const settingsApi = window.DataStore && window.DataStore.settings;
    if (!(settingsApi && settingsApi.update)) { showToast('기본 공개 범위를 저장하지 못했어요. 다시 시도해 주세요.'); return; }
    setSentenceVisibilityBusy(true);
    Promise.resolve(settingsApi.update({ default_sentence_visibility: next }))
      .then(() => { setSentenceVisibility(next); })
      .catch(() => showToast('기본 공개 범위를 저장하지 못했어요. 다시 시도해 주세요.'))
      .finally(() => setSentenceVisibilityBusy(false));
  };
  // 스트릭 리마인더 (#1033) — 매일 정해진 시각 로컬 알림. 네이티브에서만 실효(웹은 토글 비노출).
  const reminderApi = window.RG_streakReminder;
  const reminderNative = !!(reminderApi && reminderApi.isNativeSupported && reminderApi.isNativeSupported());
  const initReminder = reminderApi ? reminderApi.getSettings() : { enabled: false, hour: 21, minute: 0 };
  const [reminderOn, setReminderOn] = useState(!!initReminder.enabled);
  const [reminderHour, setReminderHour] = useState(initReminder.hour);
  const [reminderMin, setReminderMin] = useState(initReminder.minute);
  const [reminderBusy, setReminderBusy] = useState(false);
  const fmtTime = (h, m) => String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  const toggleReminder = async () => {
    if (!reminderApi || reminderBusy) return;
    setReminderBusy(true);
    try {
      if (reminderOn) {
        await reminderApi.disable();
        setReminderOn(false);
        showToast('스트릭 리마인더를 껐어요');
      } else {
        const ok = await reminderApi.enable();
        if (ok) { setReminderOn(true); showToast(`매일 ${fmtTime(reminderHour, reminderMin)}에 알려드릴게요`, { sparrow: true }); }
        else { showToast('알림 권한이 꺼져 있어요. 기기 설정에서 허용해주세요'); }
      }
    } finally { setReminderBusy(false); }
  };
  const changeReminderTime = async (e) => {
    const [h, m] = String(e.target.value || '21:00').split(':').map((n) => parseInt(n, 10));
    const hour = Number.isFinite(h) ? h : 21;
    const minute = Number.isFinite(m) ? m : 0;
    setReminderHour(hour); setReminderMin(minute);
    if (reminderApi) await reminderApi.setTime(hour, minute);
    if (reminderOn) showToast(`알림 시각을 ${fmtTime(hour, minute)}로 바꿨어요`);
  };
  // 위시리스트 공개 토글 (#558) — Supabase 모드에서만 유효. 초기값은 me.wishlist_public.
  const me = window.RG_ME || {};
  const isSupabase = window.DataStore === window.SupabaseDataStore;
  const [wishPublic, setWishPublic] = useState(!!(me.wishlist_public));
  const toggleWishPublic = () => {
    if (!isSupabase) { showToast('로그인 후 이용할 수 있어요'); return; }
    const next = !wishPublic;
    Promise.resolve(
      window.DataStore && window.DataStore.profile && window.DataStore.profile.update
        ? window.DataStore.profile.update({ wishlist_public: next })
        : null
    ).then(() => {
      setWishPublic(next);
      if (window.RG_ME) window.RG_ME.wishlist_public = next;
      showToast(next ? '읽고 싶은 책이 공개됐어요' : '읽고 싶은 책이 비공개로 바뀌었어요');
    }).catch(() => showToast('저장 실패 — 잠시 후 다시'));
  };
  // 운영자 문의 (DB 저장 → admin 대시보드)
  const [inqMsg, setInqMsg] = useState('');
  const [inqBusy, setInqBusy] = useState(false);
  const [inqDone, setInqDone] = useState(false);
  // 로그인 계정 주소 표기 (#671) — currentUser()는 로컬 세션(무네트워크). 미로그인/로컬모드면 ''.
  const [acctEmail, setAcctEmail] = useState('');
  React.useEffect(() => {
    let alive = true;
    if (window.RG_SB && window.RG_SB.currentUser) {
      Promise.resolve(window.RG_SB.currentUser())
        .then((u) => { if (alive) setAcctEmail((u && u.email) || ''); })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, []);
  const sendInquiry = () => {
    const m = inqMsg.trim();
    if (!m) { showToast('문의 내용을 적어주세요'); return; }
    if (!(DataStore.inquiries && DataStore.inquiries.create)) { showToast('로그인 후 이용해주세요'); return; }
    setInqBusy(true);
    Promise.resolve(DataStore.inquiries.create({ message: m }))
      .then(() => { setInqDone(true); setInqMsg(''); showToast('문의가 전송됐어요 — 운영자가 확인합니다'); })
      .catch(() => showToast('전송 실패 — 잠시 후 다시'))
      .finally(() => setInqBusy(false));
  };
  const logout = () => {
    if (window.RG_SB && window.RG_SB.signOut) {
      Promise.resolve(window.RG_SB.signOut()).finally(() => window.location.reload());
    }
  };
  // 계정 삭제 (#875, Apple 심사 필수) — 2단계 확인 후 워커 /api/delete-account 호출.
  const [delOpen, setDelOpen] = useState(false); // #1115 '계정 관리' 접힘 — 삭제 진입 가시성↓(경로는 유지)
  const [delConfirm, setDelConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteAccount = async () => {
    const token = (window.RG_SB && window.RG_SB.accessToken) ? await window.RG_SB.accessToken() : null;
    if (!token) { showToast('로그인 상태가 아니에요'); setDelConfirm(false); return; }
    setDeleting(true);
    try {
      const r = await fetch(((window.RG_CONFIG && window.RG_CONFIG.API_ORIGIN) || '') + '/api/delete-account', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });  // #1230 네이티브 절대경로
      if (!r.ok) throw new Error('실패');
      try { await window.RG_SB.signOut(); } catch (e) { /* 이미 삭제됨 */ }
      try { localStorage.clear(); } catch (e) { /* noop */ }
      window.location.reload();
    } catch (e) {
      setDeleting(false);
      showToast('계정 삭제 실패 — 잠시 후 다시 시도해주세요');
    }
  };
  const groupLabel = (text) => (
    <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 20, marginBottom: 6, paddingLeft: 2 }}>{text}</div>
  );
  return (
    <div className="modal-backdrop show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-label="설정">
        <div className="sheet-grip" />
        <div style={{ padding: '8px 20px 24px' }}>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{rgIcon('settings', 19)} 설정</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', padding: 2 }} title="닫기">{rgIcon('close', 18)}</button>
          </div>

          {/* ① 계정 */}
          {groupLabel('계정')}
          {(window.RG_SB && window.RG_SB.isConfigured && window.RG_SB.isConfigured() && window.DataStore !== window.SupabaseDataStore) ? (
            <button onClick={() => { onClose && onClose(); if (window.RG_login) window.RG_login(); }}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
              <window.SparrowInline /> 로그인하고 내 기록 저장하기
            </button>
          ) : (
            <>
              {/* 계정 주소 표기 (#671) — 로그인 시에만 */}
              {acctEmail && (
                <div style={{ padding: '10px 12px', borderRadius: 12, border: '1.5px solid var(--line)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', color: 'var(--ink-3)' }}>{rgIcon('user', 17)}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acctEmail}</span>
                </div>
              )}
              {/* 로그아웃 2종 한 줄 (#671) — 다른 기기 / 이 기기 */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => {
                  if (!window.confirm('이 기기만 남기고 다른 모든 기기에서 로그아웃할까요?')) return;
                  if (window.RG_SB && window.RG_SB.signOutOtherDevices) {
                    Promise.resolve(window.RG_SB.signOutOtherDevices()).then(() => showToast('다른 기기에서 로그아웃했어요')).catch(() => showToast('실패 — 잠시 후 다시'));
                  }
                }} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid var(--line)', background: 'var(--brand-soft)', color: 'var(--brand-3)', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{rgIcon('devices', 14)} 다른 기기 로그아웃</button>
                <button onClick={logout} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid var(--line)', background: 'var(--brand-soft)', color: 'var(--brand-3)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>이 기기 로그아웃</button>
              </div>
            </>
          )}

          {/* ② 개인정보·데이터 */}
          {groupLabel('개인정보·데이터')}
          <div style={{ padding: '12px', borderRadius: 12, border: '1.5px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>독서 대화 AI·분석 활용</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.4 }}>한 문장·대화를 AI가 읽고 질문을 만들고, 익명으로 분석에 활용해요. 끄면 로컬 질문만(외부 전송·수집 없음).</div>
            </div>
            <button onClick={() => { const nv = consentOn ? 'no' : 'yes'; if (window.RG_consent) window.RG_consent.set(nv); if (window.RG_applyConsent) window.RG_applyConsent(nv); setConsentOn(nv === 'yes'); showToast(nv === 'yes' ? '고마워요! 더 나은 질문을 드릴게요' : '로컬 모드로 전환됐어요', { sparrow: nv === 'yes' }); }}
              aria-label="데이터 활용 동의 토글"
              style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', background: consentOn ? 'var(--brand)' : 'var(--line)', position: 'relative', transition: 'background .2s' }}>
              <span style={{ position: 'absolute', top: 3, left: consentOn ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
            </button>
          </div>
          <fieldset disabled={sentenceVisibilityBusy} style={{ margin: '8px 0 0', padding: '12px', borderRadius: 12, border: '1.5px solid var(--line)' }}>
            <legend style={{ padding: '0 4px', fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>한 문장 기본 공개 범위</legend>
            <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
              {[
                { value: 'public', label: '전체 공개', description: '피드에 공개돼요' },
                { value: 'private', label: '나만 보기', description: '나만 볼 수 있어요' },
              ].map((option) => (
                <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: sentenceVisibilityBusy ? 'default' : 'pointer', opacity: sentenceVisibilityBusy ? 0.6 : 1 }}>
                  <input type="radio" name="default-sentence-visibility" value={option.value}
                    checked={sentenceVisibility === option.value}
                    onChange={() => saveSentenceVisibility(option.value)} />
                  <span>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{option.label}</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {/* 위시리스트 공개 (#558) */}
          <div style={{ marginTop: 8, padding: '12px', borderRadius: 12, border: '1.5px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>{rgIcon('bookmark', 14)} 읽고 싶은 책 공개</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.4 }}>{isSupabase ? '내 위시리스트를 다른 사람 프로필에서 볼 수 있어요' : '로그인하면 이용할 수 있어요'}</div>
            </div>
            <button onClick={toggleWishPublic} aria-pressed={wishPublic} aria-label="위시리스트 공개 토글"
              style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 999, border: 'none', cursor: isSupabase ? 'pointer' : 'default', background: (isSupabase && wishPublic) ? 'var(--brand)' : 'var(--line)', position: 'relative', transition: 'background .2s', opacity: isSupabase ? 1 : 0.45 }}>
              <span style={{ position: 'absolute', top: 3, left: (isSupabase && wishPublic) ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
            </button>
          </div>
          {/* 계정 삭제 (#875, Apple 심사 필수) — 로그인(Supabase) 상태에서만.
             #1115: 항상 노출된 danger 버튼 대신 muted '계정 관리' 토글 뒤로 접어 가시성↓
             (삭제 경로는 Apple 심사 필수라 항상 접근 가능). 펼치면 2단계 확인 후 영구 삭제. */}
          {isSupabase && (
            <div style={{ marginTop: 8 }}>
              {!delOpen ? (
                <button onClick={() => setDelOpen(true)} aria-expanded={false}
                  style={{ padding: '8px 2px', border: 'none', background: 'transparent', color: 'var(--ink-3)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>계정 관리</button>
              ) : !delConfirm ? (
                <button onClick={() => setDelConfirm(true)}
                  style={{ padding: '8px 2px', border: 'none', background: 'transparent', color: 'var(--danger, #E5484D)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>계정 삭제</button>
              ) : (
                <div style={{ padding: '12px', borderRadius: 12, border: '1.5px solid var(--danger, #E5484D)', background: 'var(--danger-tint, rgba(229,72,77,0.06))' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5, marginBottom: 10 }}>정말 삭제할까요? <b>모든 기록(한 문장·서재·둥지·대화)이 영구 삭제</b>되고 되돌릴 수 없어요.</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={deleteAccount} disabled={deleting}
                      style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: 'var(--danger, #E5484D)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: deleting ? 'default' : 'pointer', opacity: deleting ? 0.6 : 1 }}>{deleting ? '삭제 중…' : '삭제 확정'}</button>
                    <button onClick={() => setDelConfirm(false)} disabled={deleting}
                      style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--ink-2)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>취소</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ③ 읽기 환경 */}
          {groupLabel('읽기 환경')}
          {/* 스포일러 토글 — 설정에서 유지 (#3 결정) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: 12, border: '1.5px solid var(--line)', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>스포일러 모두 보기</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>안 읽은 페이지의 한 문장도 표시</div>
            </div>
            <button onClick={() => setSpoilerReveal(v => !v)} aria-pressed={spoilerReveal} title="스포일러 토글"
              style={{ width: 52, height: 30, borderRadius: 999, border: 'none', cursor: 'pointer', background: spoilerReveal ? 'var(--brand)' : 'var(--line)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: 3, left: spoilerReveal ? 25 : 3, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </button>
          </div>
          {/* 스트릭 리마인더 (#1033) — 네이티브 앱에서만 노출(로컬 알림). 웹/데모엔 의미 없어 숨김. */}
          {reminderNative && (
            <div style={{ padding: '12px', borderRadius: 12, border: '1.5px solid var(--line)', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, paddingRight: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>🔔 스트릭 리마인더</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.4 }}>매일 정해진 시각에 "오늘 한 줄" 알림을 보내요. 오늘 이미 읽었으면 건너뛰어요.</div>
                </div>
                <button onClick={toggleReminder} aria-pressed={reminderOn} title="스트릭 리마인더 토글" disabled={reminderBusy}
                  style={{ width: 52, height: 30, borderRadius: 999, border: 'none', cursor: reminderBusy ? 'default' : 'pointer', background: reminderOn ? 'var(--brand)' : 'var(--line)', position: 'relative', transition: 'background .2s', flexShrink: 0, opacity: reminderBusy ? 0.6 : 1 }}>
                  <span style={{ position: 'absolute', top: 3, left: reminderOn ? 25 : 3, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
              {reminderOn && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)' }}>알림 시각</span>
                  <input type="time" value={fmtTime(reminderHour, reminderMin)} onChange={changeReminderTime}
                    style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', border: '1.5px solid var(--line)', borderRadius: 12, padding: '6px 10px', background: 'var(--paper, #fff)' }} />
                </div>
              )}
            </div>
          )}
          {/* 참새 질문 결 프리셋 (#375) */}
          <div style={{ padding: '12px', borderRadius: 12, border: '1.5px solid var(--line)' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>{rgIcon('chat', 15)} 재키 질문 결</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, marginBottom: 10, lineHeight: 1.4 }}>재키가 던지는 질문의 방향을 골라요. 다음 질문부터 반영돼요.</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(window.RG_COMPANION_PRESETS || []).map((p) => {
                const on = qPreset === p.key;
                return (
                  <button key={p.key} onClick={() => { setQPreset(p.key); if (window.RG_companionPreset) window.RG_companionPreset.set(p.key); }}
                    aria-pressed={on}
                    style={{ padding: '6px 12px', borderRadius: 16, border: on ? 'none' : '1px solid var(--line)', background: on ? 'var(--brand)' : 'transparent', color: on ? '#fff' : 'var(--ink-2)', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {rgIcon(p.icon, 14)} {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ④ 지원 */}
          {groupLabel('지원')}
          <div style={{ padding: '12px', borderRadius: 12, border: '1.5px solid var(--line)' }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink-2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>{rgIcon('mail', 15)} 운영자에게 문의</div>
            {inqDone ? (
              <div style={{ fontSize: 13, color: 'var(--ink-2)', background: 'var(--card)', borderRadius: 12, padding: 12 }}>전송됐어요. 운영자가 확인 후 답변드립니다 <window.SparrowInline size={13} /> <button onClick={() => setInqDone(false)} style={{ marginLeft: 6, background: 'none', border: 'none', color: 'var(--brand-3)', fontWeight: 800, cursor: 'pointer' }}>다시 쓰기</button></div>
            ) : (
              <>
                <textarea value={inqMsg} onChange={(e) => { if (e.target.value.length <= 2000) setInqMsg(e.target.value); }} placeholder="버그·불편·제안 무엇이든 적어주세요 (최대 2000자)" rows={3}
                  style={{ width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1.5px solid var(--line)', padding: 10, fontSize: 14, lineHeight: 1.5, resize: 'none' }} />
                <button onClick={sendInquiry} disabled={inqBusy} style={{ marginTop: 8, width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: inqBusy ? 'default' : 'pointer', opacity: inqBusy ? 0.6 : 1 }}>{inqBusy ? '보내는 중…' : '문의 보내기'}</button>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>또는 readinggo.admin@gmail.com</div>
              </>
            )}
          </div>

          {/* ⑤ 정보 */}
          {groupLabel('정보')}
          <div style={{ textAlign: 'center', padding: '8px 0 4px', fontSize: 12, color: 'var(--ink-3)', fontWeight: 700 }}>
            ReadingGo · beta
            {/* 처리방침 공개 게시(#1126) — privacy-policy.md §8 노출 위치(설정 정보 영역). */}
            <span style={{ margin: '0 6px' }}>·</span>
            <a href="./privacy.html" target="_blank" rel="noopener" style={{ color: 'var(--ink-3)', textDecoration: 'underline' }}>개인정보처리방침</a>
          </div>
        </div>
      </div>
    </div>
  );
}

// 진입 동의 배너 (#331) — 비차단 하단 바. 필수(서비스 운영) + 선택(AI·분석). opt-in 허들↓.

window.SettingsModal = SettingsModal;
