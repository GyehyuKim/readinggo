/* =========================================================
   ReadingGo — follow-list-modal.js  (#761 모듈화: library.js에서 추출)
   FollowListModal: 팔로잉/팔로워 유저 목록 (#509). LibraryView가 <FollowListModal> 소비.
   library.js **이전** 로드. 순수 이동 — DataStore bare(런타임 재할당)·RG_openProfile(window), lexical 훅만 재선언.
   ========================================================= */

const { useState: _useState, useEffect: _useEffect } = React;

/* ── FollowListModal: 팔로잉/팔로워 유저 목록 (#509) ──────────
   stats행 팔로잉·팔로워 탭 시 오픈. 항목 탭 → 해당 유저 프로필. */
function FollowListModal({ mode, onClose }) {
  const [users, setUsers] = _useState(null); // null=로딩, []=빈
  const isFollowing = mode === 'following';
  const title = isFollowing ? '팔로잉' : '팔로워';
  _useEffect(() => {
    let alive = true;
    const F = (typeof DataStore !== 'undefined' && DataStore.friends) || {};
    const fn = isFollowing ? F.list : F.followers;
    if (typeof fn !== 'function') { setUsers([]); return; }
    Promise.resolve(fn.call(F)).then(rows => {
      if (!alive) return;
      // list → {following:{user}}, followers → {follower:{user}}
      setUsers((rows || []).map(r => (isFollowing ? r.following : r.follower)).filter(Boolean));
    }).catch(() => { if (alive) setUsers([]); });
    return () => { alive = false; };
  }, [mode]);
  const openProfile = (u) => {
    if (!u || !u.handle || !window.RG_openProfile) return;
    onClose();
    window.RG_openProfile('@' + u.handle);
  };
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--paper)', width: '100%', maxWidth: 430, maxHeight: '80vh', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 10px' }}>
          <div style={{ fontSize: 17, fontWeight: 900 }}>{title} {users && <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 800 }}>({users.length}명)</span>}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--ink-3)', cursor: 'pointer', padding: 4 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 14px 24px' }}>
          {users === null ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-3)', fontWeight: 700, padding: '40px 0', fontSize: 13 }}>불러오는 중…</div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-3)', fontWeight: 700, padding: '40px 0', fontSize: 13 }}>
              {isFollowing ? '아직 팔로우하는 사람이 없어요' : '아직 나를 팔로우하는 사람이 없어요'}
            </div>
          ) : users.map(u => (
            <button key={u.id} onClick={() => openProfile(u)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--line-2)', padding: '10px 4px', cursor: 'pointer' }}>
              <span style={{ fontSize: 26, flexShrink: 0 }}>{(u.display_name && u.display_name[0]) || '🐦'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>{u.display_name || ('@' + u.handle)}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.bio || ('@' + u.handle)}</div>
              </div>
              <span style={{ fontSize: 16, color: 'var(--ink-3)', flexShrink: 0 }}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
window.FollowListModal = FollowListModal;
