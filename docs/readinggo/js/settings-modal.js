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
      showToast(next ? '🔖 읽고 싶은 책이 공개됐어요' : '🔖 읽고 싶은 책이 비공개로 바뀌었어요');
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
              style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
              <window.SparrowInline /> 로그인하고 내 기록 저장하기
            </button>
          ) : (
            <>
              {/* 계정 주소 표기 (#671) — 로그인 시에만 */}
              {acctEmail && (
                <div style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
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
                }} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{rgIcon('devices', 14)} 다른 기기 로그아웃</button>
                <button onClick={logout} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>이 기기 로그아웃</button>
              </div>
            </>
          )}

          {/* ② 개인정보·데이터 */}
          {groupLabel('개인정보·데이터')}
          <div style={{ padding: '12px', borderRadius: 10, border: '1.5px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
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
          {/* 위시리스트 공개 (#558) */}
          <div style={{ marginTop: 8, padding: '12px', borderRadius: 10, border: '1.5px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>{rgIcon('bookmark', 14)} 읽고 싶은 책 공개</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.4 }}>{isSupabase ? '내 위시리스트를 다른 사람 프로필에서 볼 수 있어요' : '로그인하면 이용할 수 있어요'}</div>
            </div>
            <button onClick={toggleWishPublic} aria-pressed={wishPublic} aria-label="위시리스트 공개 토글"
              style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 999, border: 'none', cursor: isSupabase ? 'pointer' : 'default', background: (isSupabase && wishPublic) ? 'var(--brand)' : 'var(--line)', position: 'relative', transition: 'background .2s', opacity: isSupabase ? 1 : 0.45 }}>
              <span style={{ position: 'absolute', top: 3, left: (isSupabase && wishPublic) ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
            </button>
          </div>

          {/* ③ 읽기 환경 */}
          {groupLabel('읽기 환경')}
          {/* 스포일러 토글 — 설정에서 유지 (#3 결정) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: 10, border: '1.5px solid var(--line)', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>스포일러 모두 보기</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>안 읽은 페이지의 한 문장도 표시</div>
            </div>
            <button onClick={() => setSpoilerReveal(v => !v)} aria-pressed={spoilerReveal} title="스포일러 토글"
              style={{ width: 52, height: 30, borderRadius: 15, border: 'none', cursor: 'pointer', background: spoilerReveal ? 'var(--brand)' : 'var(--line)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: 3, left: spoilerReveal ? 25 : 3, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </button>
          </div>
          {/* 참새 질문 결 프리셋 (#375) */}
          <div style={{ padding: '12px', borderRadius: 10, border: '1.5px solid var(--line)' }}>
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
          <div style={{ padding: '12px', borderRadius: 10, border: '1.5px solid var(--line)' }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink-2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>{rgIcon('mail', 15)} 운영자에게 문의</div>
            {inqDone ? (
              <div style={{ fontSize: 13, color: 'var(--ink-2)', background: 'var(--card)', borderRadius: 10, padding: 12 }}>전송됐어요. 운영자가 확인 후 답변드립니다 <window.SparrowInline size={13} /> <button onClick={() => setInqDone(false)} style={{ marginLeft: 6, background: 'none', border: 'none', color: 'var(--brand-3)', fontWeight: 800, cursor: 'pointer' }}>다시 쓰기</button></div>
            ) : (
              <>
                <textarea value={inqMsg} onChange={(e) => { if (e.target.value.length <= 2000) setInqMsg(e.target.value); }} placeholder="버그·불편·제안 무엇이든 적어주세요 (최대 2000자)" rows={3}
                  style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1.5px solid var(--line)', padding: 10, fontSize: 14, lineHeight: 1.5, resize: 'none' }} />
                <button onClick={sendInquiry} disabled={inqBusy} style={{ marginTop: 8, width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: inqBusy ? 'default' : 'pointer', opacity: inqBusy ? 0.6 : 1 }}>{inqBusy ? '보내는 중…' : '문의 보내기'}</button>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>또는 readinggo.admin@gmail.com</div>
              </>
            )}
          </div>

          {/* ⑤ 정보 */}
          {groupLabel('정보')}
          <div style={{ textAlign: 'center', padding: '8px 0 4px', fontSize: 12, color: 'var(--ink-3)', fontWeight: 700 }}>ReadingGo · beta</div>
        </div>
      </div>
    </div>
  );
}

// 진입 동의 배너 (#331) — 비차단 하단 바. 필수(서비스 운영) + 선택(AI·분석). opt-in 허들↓.

window.SettingsModal = SettingsModal;
