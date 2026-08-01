/* =========================================================
   ReadingGo — moderation.js (#1392)
   UGC 약관 게이트 · 신고 시트 · 차단 목록. 서버 강제는 48_ugc_moderation.sql.
   ========================================================= */

const { useState, useEffect } = React;
const RG_UGC_TERMS_VERSION = '2026-08-01';
const RG_REPORT_REASONS = [
  ['sexual', '성적이거나 노출이 있는 콘텐츠'],
  ['violence', '폭력적이거나 위협적인 콘텐츠'],
  ['hate_or_harassment', '혐오·괴롭힘'],
  ['spam', '스팸·홍보'],
  ['illegal', '불법 또는 권리 침해'],
  ['other', '기타'],
];

function _rgRequireModerationLogin() {
  const ready = window.DataStore === window.SupabaseDataStore
    && window.RG_ME && window.RG_ME.id;
  if (ready) return true;
  if (window.showToast) window.showToast('로그인 후 신고·차단할 수 있어요');
  if (window.RG_login) window.RG_login();
  return false;
}

window.RG_openReport = function (target) {
  if (!_rgRequireModerationLogin()) return;
  window.dispatchEvent(new CustomEvent('rg:moderation-report-open', { detail: target || {} }));
};
window.RG_openBlockedUsers = function () {
  if (!_rgRequireModerationLogin()) return;
  window.dispatchEvent(new CustomEvent('rg:moderation-blocked-open'));
};
window.RG_UGC_TERMS_VERSION = RG_UGC_TERMS_VERSION;

function UgcTermsGate({ open, onAccepted, onClose }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const accept = async () => {
    if (!checked || busy) return;
    const api = window.DataStore && window.DataStore.moderation;
    if (!(api && api.acceptTerms)) return;
    setBusy(true);
    try {
      await api.acceptTerms(RG_UGC_TERMS_VERSION);
      if (onAccepted) onAccepted();
      if (window.showToast) window.showToast('커뮤니티 약관에 동의했어요');
    } catch (e) {
      if (window.showToast) window.showToast('동의를 저장하지 못했어요. 다시 시도해 주세요.');
    } finally { setBusy(false); }
  };
  return ReactDOM.createPortal(
    <div className="modal-backdrop show" style={{ zIndex: 2100 }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="커뮤니티 이용 안내" style={{ maxWidth: 520 }}>
        <div style={{ padding: '22px 20px 26px' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)', marginBottom: 8 }}>함께 읽는 공간을 안전하게</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65, marginBottom: 14 }}>
            공개 한 문장과 프로필에서는 성적·폭력적 콘텐츠, 혐오·괴롭힘, 스팸, 불법 콘텐츠를 허용하지 않아요. 위반 콘텐츠는 신고·숨김 또는 계정 제한 조치될 수 있어요.
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, fontSize: 12.5, fontWeight: 800 }}>
            <a href="./community-guidelines.html" target="_blank" rel="noopener" style={{ color: 'var(--brand-3)' }}>커뮤니티 가이드라인</a>
            <a href="./privacy.html" target="_blank" rel="noopener" style={{ color: 'var(--brand-3)' }}>개인정보처리방침</a>
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, border: '1px solid var(--line)', borderRadius: 12, cursor: 'pointer', marginBottom: 14 }}>
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ marginTop: 2 }} />
            <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink)' }}>커뮤니티 가이드라인을 확인했으며 공개 콘텐츠 운영 정책에 동의합니다.</span>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} disabled={busy}
              style={{ flex: 1, padding: 13, borderRadius: 12, border: 'none', background: 'var(--paper-2)', color: 'var(--ink-2)', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>나중에</button>
            <button onClick={accept} disabled={!checked || busy}
              style={{ flex: 2, padding: 13, borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 14, fontWeight: 900, cursor: checked && !busy ? 'pointer' : 'default', opacity: checked && !busy ? 1 : 0.45 }}>
              {busy ? '저장 중…' : '동의하고 계속'}
            </button>
          </div>
        </div>
      </div>
    </div>, document.body
  );
}

function ReportSheet({ target, onClose }) {
  const [reason, setReason] = useState('spam');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const api = window.DataStore && window.DataStore.moderation;
    if (!(api && api.report) || busy) return;
    setBusy(true);
    try {
      await api.report({ targetType: target.targetType, targetId: target.targetId, reason, detail: detail.trim() });
      window.dispatchEvent(new CustomEvent('rg:moderation-hidden', { detail: { targetType: target.targetType, targetId: target.targetId, userId: target.userId || (target.targetType === 'user' ? target.targetId : null) } }));
      if (window.showToast) window.showToast('신고했어요. 검토 전까지 이 콘텐츠를 숨길게요.');
      onClose();
    } catch (e) {
      if (window.showToast) window.showToast('신고하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally { setBusy(false); }
  };
  return (
    <div className="modal-backdrop show" style={{ zIndex: 2200 }} onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="신고하기">
        <div className="sheet-grip" />
        <div style={{ padding: '8px 20px 24px' }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: 'var(--ink)', marginBottom: 4 }}>{target.targetType === 'user' ? '사용자 신고' : '한 문장 신고'}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14 }}>{target.label || '신고 사유를 선택해 주세요.'}</div>
          <div style={{ display: 'grid', gap: 7 }}>
            {RG_REPORT_REASONS.map(([value, label]) => (
              <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', border: '1px solid var(--line)', borderRadius: 12, cursor: 'pointer' }}>
                <input type="radio" name="report-reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{label}</span>
              </label>
            ))}
          </div>
          <textarea value={detail} onChange={(e) => setDetail(e.target.value.slice(0, 500))} rows={3} placeholder="추가 설명 (선택)" style={{ width: '100%', boxSizing: 'border-box', marginTop: 10, padding: 10, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={onClose} disabled={busy} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: 'var(--paper-2)', color: 'var(--ink-2)', fontWeight: 800 }}>취소</button>
            <button onClick={submit} disabled={busy} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: 'var(--danger, #E5484D)', color: '#fff', fontWeight: 900, opacity: busy ? 0.55 : 1 }}>{busy ? '제출 중…' : '신고'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BlockedUsersSheet({ onClose }) {
  const [rows, setRows] = useState(null);
  const load = () => {
    const api = window.DataStore && window.DataStore.moderation;
    if (!(api && api.listBlockedUsers)) { setRows([]); return; }
    Promise.resolve(api.listBlockedUsers()).then((v) => setRows(v || [])).catch(() => setRows([]));
  };
  useEffect(load, []);
  const unblock = async (id) => {
    try {
      await window.DataStore.moderation.unblockUser(id);
      setRows((old) => (old || []).filter((u) => u.id !== id));
      if (window.showToast) window.showToast('차단을 해제했어요');
    } catch (e) { if (window.showToast) window.showToast('차단 해제에 실패했어요'); }
  };
  return (
    <div className="modal-backdrop show" style={{ zIndex: 2200 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="차단한 사용자">
        <div className="sheet-grip" />
        <div style={{ padding: '8px 20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 19, fontWeight: 900, color: 'var(--ink)' }}>차단한 사용자</div>
            <button onClick={onClose} aria-label="닫기" style={{ border: 'none', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer' }}>{window.rgIcon('close', 18)}</button>
          </div>
          {rows === null ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)' }}>불러오는 중…</div>
            : rows.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)' }}>차단한 사용자가 없어요</div>
              : rows.map((u) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>@{u.handle || u.display_name || '사용자'}</span>
                  <button onClick={() => unblock(u.id)} style={{ padding: '7px 11px', borderRadius: 12, border: 'none', background: 'var(--paper-2)', color: 'var(--ink-2)', fontWeight: 800, cursor: 'pointer' }}>차단 해제</button>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}

function ModerationHost() {
  const [reportTarget, setReportTarget] = useState(null);
  const [blockedOpen, setBlockedOpen] = useState(false);
  useEffect(() => {
    const onReport = (e) => setReportTarget(e.detail || null);
    const onBlocked = () => setBlockedOpen(true);
    window.addEventListener('rg:moderation-report-open', onReport);
    window.addEventListener('rg:moderation-blocked-open', onBlocked);
    return () => {
      window.removeEventListener('rg:moderation-report-open', onReport);
      window.removeEventListener('rg:moderation-blocked-open', onBlocked);
    };
  }, []);
  return <>
    {reportTarget && <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />}
    {blockedOpen && <BlockedUsersSheet onClose={() => setBlockedOpen(false)} />}
  </>;
}

window.UgcTermsGate = UgcTermsGate;
window.ModerationHost = ModerationHost;
