/* activity-inbox.js — #1260 인앱 소셜 활동함. DataStore RPC 표면만 사용한다. */

function activityInboxRelativeTime(iso) {
  if (!iso) return '';
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return '방금';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
  return `${Math.floor(seconds / 86400)}일 전`;
}

function activityInboxCopy(item) {
  const actor = (item && item.actor && (item.actor.displayName || item.actor.handle)) || '';
  if (item && item.kind === 'clap') return `${actor}님이 내 문장을 좋아해요`;
  if (item && item.kind === 'follow') return `${actor}님이 나를 팔로우했어요`;
  return `${actor}님이 콕 찔렀어요`;
}

function ActivityInboxButton({ guest, onLogin }) {
  const { useEffect, useRef, useState } = React;
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState({ items: [], unreadCount: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const markedResponseRef = useRef(null);
  const restoreFocusRef = useRef(true);
  const close = () => setOpen(false);
  const openInbox = () => {
    restoreFocusRef.current = true;
    setOpen(true);
  };
  const handoff = (next) => {
    restoreFocusRef.current = false;
    setOpen(false);
    next();
  };
  const overlayBack = window.useOverlayBack || (() => {});
  overlayBack(open, close);

  const loadCount = () => {
    if (guest || !(DataStore.activityInbox && DataStore.activityInbox.unreadCount)) {
      setResult({ items: [], unreadCount: 0 });
      return;
    }
    Promise.resolve(DataStore.activityInbox.unreadCount())
      .then((count) => setResult((current) => ({ ...current, unreadCount: Math.max(0, Number(count) || 0) })))
      .catch(() => {});
  };

  const load = () => {
    if (guest) {
      setResult({ items: [], unreadCount: 0 });
      setError(false);
      setLoading(false);
      return Promise.resolve({ items: [], unreadCount: 0 });
    }
    setLoading(true);
    setError(false);
    return Promise.resolve(DataStore.activityInbox.list())
      .then((next) => {
        const safe = {
          items: Array.isArray(next && next.items) ? next.items : [],
          unreadCount: Math.max(0, Number(next && next.unreadCount) || 0),
        };
        markedResponseRef.current = null;
        setResult(safe);
        return safe;
      })
      .catch((loadError) => {
        setError(true);
        throw loadError;
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadCount, [guest]);
  useEffect(() => {
    if (!open) return undefined;
    load().catch(() => {});
    requestAnimationFrame(() => { if (closeRef.current) closeRef.current.focus(); });
    return () => {
      if (restoreFocusRef.current) requestAnimationFrame(() => { if (triggerRef.current) triggerRef.current.focus(); });
    };
  }, [open, guest]);

  const trapDialogFocus = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...event.currentTarget.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !event.currentTarget.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // React가 성공 응답을 실제 DOM에 반영한 다음, 그 응답에 렌더된 key만 mark한다.
  useEffect(() => {
    if (!open || guest || loading || error || !result.items.length) return undefined;
    const keys = [...new Set(result.items.map((item) => item && item.eventKey).filter(Boolean))];
    const responseIdentity = keys.join('\n');
    if (!keys.length || markedResponseRef.current === responseIdentity) return undefined;
    const frame = requestAnimationFrame(() => {
      markedResponseRef.current = responseIdentity;
      Promise.resolve(DataStore.activityInbox.markSeen(keys))
        .then((marked) => setResult((current) => ({
          ...current,
          unreadCount: Math.max(0, Number(marked && marked.unreadCount) || 0),
        })))
        .catch(() => { markedResponseRef.current = null; });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, guest, loading, error, result.items]);

  const openItem = async (item) => {
    try {
      const fresh = await DataStore.activityInbox.list();
      const current = (fresh.items || []).find((candidate) => candidate.eventKey === item.eventKey);
      if (!current) {
        setResult(fresh);
        if (window.showToast) window.showToast('지금은 볼 수 없는 활동이에요');
        return;
      }
      if (current.kind === 'clap' && current.sentence && current.sentence.bookId && window.RG_openBook) {
        handoff(() => window.RG_openBook(current.sentence.bookId));
      } else if (current.actor && current.actor.handle && window.RG_openProfile) {
        handoff(() => window.RG_openProfile(current.actor.handle));
      }
    } catch (e) {
      setError(true);
    }
  };

  const unread = guest ? 0 : result.unreadCount;
  const label = unread > 0 ? `읽지 않은 활동 ${unread}개` : '활동 열기';
  return (
    <>
      <button ref={triggerRef} type="button" onClick={openInbox} aria-label={label}
        aria-haspopup="dialog" aria-expanded={open}
        style={{ position: 'relative', width: 44, height: 44, flex: '0 0 44px', border: 'none', background: 'none', color: 'var(--ink-2)', padding: 0, display: 'inline-grid', placeItems: 'center', cursor: 'pointer' }}>
        {window.rgIcon('bell', 20)}
        {unread > 0 && <span aria-hidden="true" style={{ position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: 999, background: 'var(--fire)', boxShadow: '0 0 0 2px var(--paper)' }} />}
      </button>

      {open && ReactDOM.createPortal(
        <div className="modal-backdrop show" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
          style={{ zIndex: 90 }}>
          <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="activity-inbox-title" onKeyDown={trapDialogFocus}
            style={{ maxHeight: 'min(720px, calc(var(--app-h) - var(--safe-top)))', overflowY: 'auto', paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <h2 id="activity-inbox-title" style={{ margin: 0, flex: 1, fontSize: 20 }}>활동</h2>
              <button ref={closeRef} type="button" onClick={close} aria-label="활동 닫기"
                style={{ width: 44, height: 44, border: 'none', background: 'none', color: 'var(--ink-2)', display: 'inline-grid', placeItems: 'center', cursor: 'pointer' }}>
                {window.rgIcon('close', 18)}
              </button>
            </div>

            {guest ? (
              <div style={{ padding: '28px 8px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 16px', color: 'var(--ink-2)', lineHeight: 1.6 }}>로그인하면 좋아요, 새 팔로워, 콕찌르기를 여기서 확인할 수 있어요.</p>
                <button type="button" onClick={() => handoff(onLogin)}
                  style={{ border: '1px solid var(--brand-soft)', borderRadius: 'var(--r-sm)', background: 'var(--brand-soft)', color: 'var(--brand-3)', padding: '10px 18px', fontWeight: 800, cursor: 'pointer' }}>로그인</button>
              </div>
            ) : (
              <>
                {loading && <div role="status" aria-label="활동 불러오는 중" style={{ padding: '10px 0', color: 'var(--ink-3)', fontSize: 13 }}>활동을 불러오는 중…</div>}
                {error && <div role="alert" style={{ padding: 12, borderRadius: 'var(--r-sm)', background: 'var(--paper-2)', marginBottom: 10 }}>
                  <p style={{ margin: '0 0 8px', color: 'var(--ink-2)', fontSize: 13 }}>활동을 불러오지 못했어요. 다시 시도해주세요.{result.items.length ? ' 이전 목록을 보여드려요.' : ''}</p>
                  <button type="button" onClick={() => load().catch(() => {})} style={{ border: 'none', background: 'var(--brand-soft)', color: 'var(--brand-3)', borderRadius: 'var(--r-sm)', padding: '8px 12px', fontWeight: 800, cursor: 'pointer' }}>다시 시도</button>
                </div>}
                {!loading && !error && result.items.length === 0 && <p style={{ padding: '32px 8px', margin: 0, textAlign: 'center', color: 'var(--ink-3)' }}>아직 새로운 활동이 없어요.</p>}
                <div role="list">
                  {result.items.map((item) => (
                    <button key={item.eventKey} type="button" role="listitem" onClick={() => openItem(item)}
                      style={{ width: '100%', minHeight: 68, display: 'flex', alignItems: 'flex-start', gap: 11, padding: '12px 4px', border: 'none', borderBottom: '1px solid var(--line)', background: 'none', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' }}>
                      <span aria-hidden="true" style={{ width: 38, height: 38, flex: '0 0 38px', borderRadius: 999, overflow: 'hidden', background: 'var(--brand-soft)', display: 'grid', placeItems: 'center', color: 'var(--brand-3)', fontWeight: 900 }}>
                        {item.actor && item.actor.avatarUrl ? <img src={item.actor.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ((item.actor && (item.actor.displayName || item.actor.handle) || '?').slice(0, 1))}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: item.isUnread ? 800 : 600, lineHeight: 1.45 }}>{activityInboxCopy(item)}</span>
                        {item.kind === 'follow' && item.actor && item.actor.handle && <span style={{ display: 'block', color: 'var(--ink-3)', fontSize: 12 }}>@{item.actor.handle}</span>}
                        {item.kind === 'clap' && item.sentence && <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'var(--ink-2)', fontFamily: '"Noto Serif KR", serif', fontSize: 12.5, lineHeight: 1.45 }}>{item.sentence.text}</span>}
                        {item.kind === 'clap' && item.sentence && item.sentence.bookTitle && <span style={{ display: 'block', color: 'var(--ink-3)', fontSize: 11.5 }}>{item.sentence.bookTitle}{item.sentence.page != null ? ` · ${item.sentence.page}쪽` : ''}</span>}
                      </span>
                      <time dateTime={item.occurredAt} style={{ flexShrink: 0, color: 'var(--ink-3)', fontSize: 11 }}>{activityInboxRelativeTime(item.occurredAt)}</time>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>, document.body)}
    </>
  );
}

window.activityInboxCopy = activityInboxCopy;
window.ActivityInboxButton = ActivityInboxButton;
