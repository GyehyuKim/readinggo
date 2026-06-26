/* =========================================================
   ReadingGo — sentence-collection-modal.js  (#761 모듈화 2차: components.js에서 추출)
   SentenceCollectionModal: 내 한 문장 모아보기(전체/책별/좋아요, #171·#608). SentenceActions(sentence-card)·DataStore(bare) 의존.
   components.js **이후** 로드(공유 컨텍스트·유틸은 window 전역). 순수 이동 — 훅만 재선언.
   ========================================================= */

const { useState, useEffect } = React;

/* ── SentenceCollectionModal: 내 한 문장 모아보기(전체/책별/좋아요) + 읽었음 카운터(#171) ── */
function SentenceCollectionModal({ onClose, initialFilter }) {
  const SentenceActions = window.SentenceActions; // sentence-card.js(이후 로드)에서 추출 (#761)
  const [mine, setMine] = useState(undefined);
  const [saved, setSaved] = useState([]);   // #608/#641: 좋아요한 타인 문장 — '좋아요' 필터 전용(전체/책별엔 미혼입)
  const [favIds, setFavIds] = useState(new Set());
  const [filter, setFilter] = useState(initialFilter || 'all'); // all | book | fav — 좋아요한 문장 진입 시 'fav' (#510)
  const [query, setQuery] = useState('');  // 내 한 문장 키워드 검색 (#1007, profile §5.8.8)
  // 작성일자 표기 (#608) — created_at 은 number(localStorage)·ISO(Supabase) 모두 new Date 로 처리. 월/일만.
  const fmtWhen = (t) => { if (!t) return ''; const d = new Date(t); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }); };
  useEffect(() => {
    let alive = true;
    const DS = window.DataStore || {}; // 활성 어댑터 — 게스트가 Supabase로 새던 400 수정 (QA ISSUE-004)
    Promise.all([
      Promise.resolve((DS.sentences && DS.sentences.listMine) ? DS.sentences.listMine() : []).catch(() => []),
      Promise.resolve((DS.claps && DS.claps.list) ? DS.claps.list() : []).catch(() => []),  // #641: 좋아요한 문장(구 bookmarks.list)
    ]).then(([sents, bms]) => {
      if (!alive) return;
      const mineList = (sents || []).map(s => ({
        id: s.id, text: s.text, page: s.page,
        bookTitle: (s.user_book && s.user_book.book && s.user_book.book.title) || '',
        bookId: (s.user_book && s.user_book.book_id) || s.book_id || '',
        author: (s.user_book && s.user_book.book && s.user_book.book.author) || '',
        note: s.my_note || '',   // 저장된 참새 대화 — 재오픈 시 이어보기(#418)
        kind: s.kind || 'quote',
        isPrivate: !!s.is_private,
        when: fmtWhen(s.created_at),   // #608: 작성일자
      }));
      // 좋아요(❤️)한 타인 문장 — claps 임베드 중 내 문장 목록에 없는 것. (#510→#641)
      // #608: '전체'·'책별'엔 내 문장만 보이도록 별도 보관 → '좋아요' 필터에서만 합친다.
      const mineIds = new Set(mineList.map(s => s.id));
      const savedExtra = (bms || []).filter(b => b && b.sentence && !mineIds.has(b.sentence_id)).map(b => {
        const se = b.sentence || {};
        const ub = se.user_book || {};
        return {
          id: b.sentence_id, text: se.text || '', page: se.page,
          bookTitle: (ub.book && ub.book.title) || se.bookTitle || '',
          bookId: ub.book_id || se.book_id || '',
          author: (ub.book && ub.book.author) || se.author || '',
          note: '', kind: se.kind || 'quote', isPrivate: false, saved: true,
          when: fmtWhen(se.created_at),   // #608: 작성일자
        };
      });
      setMine(mineList);
      setSaved(savedExtra);
      setFavIds(new Set((bms || []).map(b => b.sentence_id)));
    }).catch(() => { if (alive) { setMine([]); setSaved([]); } });
    return () => { alive = false; };
  }, []);
  const list = mine || [];
  // #608/#641: 좋아요 필터 풀 = 내 문장 + 좋아요한 타인 문장. 전체/책별은 내 문장(list)만.
  const favPool = list.concat(saved);
  const favCount = favPool.filter(s => favIds.has(s.id)).length;
  // 키워드 검색(#1007, §5.8.8) — 정규화 substring(소문자·공백정리)으로 문장+감상+책제목+저자 부분일치.
  // 퍼지(Fuse) 대신 substring: 한글에서 예측 가능·오매칭 없음. 규모(유저당 ≤약 100문장)라 클라 즉시.
  // 기존 전체/책별/좋아요 탭과 AND 합성 — 빈 검색어면 현행 동작 그대로.
  const nrm = (s) => (s == null ? '' : String(s)).toLowerCase().replace(/\s+/g, ' ').trim();
  const q = nrm(query);
  const matchQ = (s) => !q || nrm([s.text, s.note, s.bookTitle, s.author].join(' ')).includes(q);
  const base = filter === 'fav' ? favPool.filter(s => favIds.has(s.id)) : list;
  const filtered = q ? base.filter(matchQ) : base;
  const byBook = {};
  if (filter === 'book') filtered.forEach(s => { const k = s.bookTitle || '기타'; (byBook[k] = byBook[k] || []).push(s); });
  const renderLine = (s) => (
    <div key={s.id} onClick={() => { if (window.RG_openCompanion) window.RG_openCompanion({ id: s.id, text: s.text, bookId: s.bookId, bookTitle: s.bookTitle, author: s.author, page: s.page, note: s.note || s.my_note || '', kind: s.kind }); }}
      style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: 10, marginBottom: 8, cursor: 'pointer' }}>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, marginBottom: 4 }}>
        {s.bookTitle ? s.bookTitle + ' · ' : ''}{s.page != null ? s.page + 'p' : ''}{s.when ? ' · ' + s.when : ''}
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink)', fontStyle: 'italic', lineHeight: 1.5 }}>"{s.text}"</div>
      {/* 한 문장 액션 계약 (#610·#641) — 공용 SentenceActions: 내 문장=공개범위+좋아요+수정/삭제, 타인=좋아요 */}
      <SentenceActions sentence={s} mine={!s.saved} fav={favIds.has(s.id)}
        onRemoved={(rid) => { setMine(m => (m || []).filter(x => x.id !== rid)); setSaved(v => (v || []).filter(x => x.id !== rid)); }} />
    </div>
  );
  return (
    <div className="modal-backdrop show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-label="내 한 문장 모아보기">
        <div className="sheet-grip" />
        <button onClick={onClose} aria-label="닫기" style={{ position: 'absolute', top: 10, right: 14, background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: 30, height: 30, fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)', lineHeight: 1, zIndex: 2 }}>✕</button>
        <div style={{ padding: '8px 20px 20px', maxHeight: '74vh', overflowY: 'auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)' }}>내 한 문장</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              읽었음 {list.length}개 ·
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 10.5C6 10.5 1 7.5 1 4.5a2.5 2.5 0 0 1 5-0.5 2.5 2.5 0 0 1 5 .5c0 3-5 6-5 6z" fill="var(--brand)" stroke="var(--brand)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
              좋아요 {favCount}개
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'center' }}>
            {[['all', '전체'], ['book', '책별'], ['fav', '좋아요']].map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} style={{ padding: '6px 14px', borderRadius: 999, border: filter === id ? 'none' : '1px solid var(--line)', background: filter === id ? 'var(--ink)' : 'transparent', color: filter === id ? '#fff' : 'var(--ink-2)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
          {/* 내 한 문장 검색(#1007, §5.8.8) — 쌓인 문장을 키워드로 즉시 좁힌다. 검색할 문장이 있을 때만 노출. */}
          {mine !== undefined && (list.length + saved.length) > 0 && (
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="내 문장·감상·책 검색" aria-label="내 한 문장 검색"
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 14px', marginBottom: 12, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, outline: 'none' }} />
          )}
          {mine === undefined ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 20 }}>불러오는 중…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 20, lineHeight: 1.6 }}>
              {q ? '검색 결과가 없어요' : filter === 'fav' ? (
                <>아직 저장한 문장이 없어요 · 소셜 탭에서 마음에 드는 문장에 <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{display:'inline',verticalAlign:'middle'}}><path d="M6 10.5C6 10.5 1 7.5 1 4.5a2.5 2.5 0 0 1 5-0.5 2.5 2.5 0 0 1 5 .5c0 3-5 6-5 6z" fill="var(--brand)" stroke="var(--brand)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>를 눌러보세요</>
              ) : '아직 한 문장이 없어요'}
            </div>
          ) : filter === 'book' ? (
            Object.keys(byBook).map(title => (
              <div key={title} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink)', marginBottom: 6 }}>{title} <span style={{ color: 'var(--ink-3)', fontWeight: 700 }}>({byBook[title].length})</span></div>
                {byBook[title].map(renderLine)}
              </div>
            ))
          ) : (
            filtered.map(renderLine)
          )}
        </div>
      </div>
    </div>
  );
}
window.SentenceCollectionModal = SentenceCollectionModal;
