/* =========================================================
   ReadingGo — data-import.js  (#1150 데이터 주권 · 가져오기)
   타사 앱(교보·밀리 등) "저장한 밑줄" 스크린샷 → Gemini vision(/api/extract-highlights)
   → 검토(BatchQuoteImport 재사용) → 선택 책에 일괄 담기(page=null, kind='quote').
   재사용(ponytail): 추출 루프는 book-detail-modal.runOcrBatch, 검토·확정 UX는 BatchQuoteImport,
   책 선택은 co-reading 픽커 패턴. 새 DataStore 메서드 없음(myBooks.add/list · sentences.add).
   책 연결: sentences.add 는 userBookId 필요 → 고른 책이 내 서재에 없으면 myBooks.add 로 ubId 확보.
   ========================================================= */

// DESIGN.md 버튼 위계: 1차=솔리드(--brand), 2차=tonal(--brand-soft/--brand-3). ghost 금지.
const _diPrimary = (on) => ({ flex: 1, padding: '13px 16px', borderRadius: 'var(--r-md)', border: 'none', background: on ? 'var(--brand)' : 'var(--brand-soft)', color: on ? '#fff' : 'var(--ink-3)', fontWeight: 800, fontSize: 15, cursor: on ? 'pointer' : 'default', letterSpacing: '-0.2px' });
const _diTonal = { flex: '0 0 auto', padding: '13px 18px', borderRadius: 'var(--r-md)', border: '1px solid var(--brand-soft)', background: 'var(--brand-soft)', color: 'var(--brand-3)', fontWeight: 800, fontSize: 15, cursor: 'pointer', letterSpacing: '-0.2px' };
const _diBookRow = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 10px', marginBottom: 6, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', cursor: 'pointer' };

function DataImport({ onClose }) {
  const { useState: uS, useEffect: uE, useRef: uR } = React;
  const [step, setStep] = uS('book');        // 'book' → 'upload' → 'review'
  const [myBooks, setMyBooks] = uS([]);
  const [bq, setBq] = uS('');
  const [bres, setBres] = uS([]);
  const [book, setBook] = uS(null);          // { id, title, author }
  const [ubId, setUbId] = uS(null);          // 연결된 user_book id
  const [busy, setBusy] = uS(false);
  const [progress, setProgress] = uS(null);  // {done,total} — 추출 진행
  const [items, setItems] = uS([]);
  const fileRef = uR(null);

  uE(() => {
    Promise.resolve(DataStore.myBooks.list()).then(rows => setMyBooks(rows || [])).catch(() => {});
  }, []);
  uE(() => {
    const term = bq.trim();
    if (!term) { setBres([]); return; }
    const t = setTimeout(() => {
      const r = (typeof window.fuzzySearch === 'function') ? window.fuzzySearch(window.ALL_BOOKS, term).slice(0, 12) : [];
      setBres(r);
    }, 200);
    return () => clearTimeout(t);
  }, [bq]);

  // 책 선택 → ubId 확보. 내 서재 책(existingUb)은 그대로, 카탈로그 책은 myBooks.add(activate:false)로 등록.
  const pickBook = async (b, existingUb) => {
    if (busy) return;
    setBusy(true);
    try {
      const bk = b.book ? { ...b.book, id: b.book.id || b.book_id } : b;
      let ub = existingUb;
      if (!ub) {
        ub = await Promise.resolve(DataStore.myBooks.add({
          book: {
            id: bk.id, title: bk.title, author: bk.author,
            cover_url: bk.cover || bk.cover_url || '', total_pages: bk.total || bk.total_pages || 0,
            isbn13: bk.isbn13 || bk.isbn || '', publisher: bk.pub || bk.publisher || '',
          },
          status: 'reading', activate: false,
        }));
      }
      const id = ub && ub.id;
      if (!id) { showToast('책을 연결하지 못했어요'); return; }
      setUbId(id);
      setBook({ id: bk.id, title: bk.title || (ub.book && ub.book.title) || '', author: bk.author || (ub.book && ub.book.author) || '' });
      setStep('upload');
    } catch (e) { showToast('책을 연결하지 못했어요'); }
    finally { setBusy(false); }
  };

  // 스크린샷 N장 → 각 장 vision 추출(순차+지연 1.2s, 무료 10 RPM). book-detail-modal.runOcrBatch 로직 재사용.
  const runExtract = async (files) => {
    setBusy(true); setProgress({ done: 0, total: files.length });
    const all = []; let failed = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        const fd = new FormData();
        fd.append('document', files[i], files[i].name || ('p' + i + '.jpg'));
        const r = await window.RG_apiFetch('/api/extract-highlights', { method: 'POST', body: fd });
        if (!r.ok) failed++;
        else { const d = await r.json(); if (d && Array.isArray(d.sentences)) all.push(...d.sentences); }
      } catch (e) { failed++; }
      setProgress({ done: i + 1, total: files.length });
      if (i < files.length - 1) await new Promise(res => setTimeout(res, 1200));
    }
    setBusy(false); setProgress(null);
    const seen = new Set(), out = [];
    all.forEach(t => { const k = (t || '').trim(); if (k && !seen.has(k)) { seen.add(k); out.push(k); } });
    if (!out.length) {
      if (failed >= files.length) showToast('추출에 실패했어요 — 잠시 후 다시 시도해 주세요');
      else showToast('밑줄 문장을 찾지 못했어요 — 목록이 또렷한 스크린샷으로');
      return;
    }
    if (failed > 0) showToast(`스크린샷 ${failed}장은 처리하지 못했어요 — 찾은 문장만 보여드려요`);
    setItems(out); setStep('review');
  };

  // 검토 확정 → 선택 책에 일괄 담기. page=null, kind='quote'. book-detail-modal.saveBatchQuotes 패턴.
  const commit = async (quotes) => {
    const list = (quotes || []).map((x) => ({ text: String(x.text || x || '').trim(), visibility: window.normalizeSentenceVisibility(x.visibility) })).filter((x) => x.text && x.text.length <= 200);
    if (!list.length || !ubId) { onClose(); return; }
    setBusy(true);
    let saved = 0;
    for (const item of list) {
      const text = item.text;
      try {
        const row = await Promise.resolve(DataStore.sentences.add({ userBookId: ubId, page: null, text, kind: 'quote', visibility: item.visibility }));
        if (row && row.id) {
          saved++;
          window.dispatchEvent(new CustomEvent('rg:sentence-added', { detail: { quote: {
            id: row.id, text: row.text || text, bookId: book.id, bookTitle: book.title, author: book.author,
            page: 0, when: '방금', createdAt: row.created_at || '', note: '', kind: 'quote', visibility: row.visibility || 'public',
          } } }));
        }
      } catch (e) { /* 개별 실패 스킵 */ }
    }
    if (saved > 0) {
      try { await Promise.resolve(DataStore.xp.add(20, 'import')); } catch (e) {}
      if (window.rgTrack) window.rgTrack('external_import_saved', { book_id: book.id, saved });
    }
    setBusy(false);
    showToast(saved > 0 ? `${saved}개를 가져왔어요` : '가져오지 못했어요');
    onClose();
  };

  // 검토 단계는 BatchQuoteImport 재사용(사진 추출과 동일 UX). ← 다시=업로드로.
  if (step === 'review') {
    return <BatchQuoteImport busy={busy} initialItems={items}
      onCancel={() => setStep('upload')} onSave={commit} />;
  }

  const sub = step === 'book'
    ? '교보·밀리 등에서 저장한 밑줄을 담을 책을 먼저 골라요'
    : (progress ? `스크린샷을 읽는 중… ${progress.done}/${progress.total}` : '저장한 밑줄 목록 스크린샷을 올리면 문장만 골라 담아요');

  return (
    <div style={{ position: 'fixed', inset: 0, height: 'var(--app-h, 100dvh)', background: 'var(--paper)', zIndex: 1100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 'calc(env(safe-area-inset-top) + 14px) 16px 10px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {window.rgIcon('upload', 16)} 타사 앱 밑줄 가져오기
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>{sub}</div>
      </div>

      {step === 'book' ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14 }}>
          {myBooks.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-3)', marginBottom: 6 }}>내 서재에서</div>
              {myBooks.map(ub => {
                const bk = ub.book || {};
                return (
                  <button key={ub.id} onClick={() => pickBook(bk, ub)} disabled={busy} style={_diBookRow}>
                    <BookCover title={bk.title} author={bk.author} cover={bk.cover_url} radius={4} style={{ width: 30, height: 43 }} />
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bk.title}</span>
                      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{bk.author}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-3)', marginBottom: 6 }}>검색해서 찾기</div>
          <input value={bq} onChange={e => setBq(e.target.value)} placeholder="책 제목 · 저자로 검색…"
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--card)', border: '1.5px solid var(--brand-soft)', borderRadius: 'var(--r-md)', padding: '11px 13px', fontSize: 14, color: 'var(--ink)', outline: 'none' }} />
          <div style={{ marginTop: 8 }}>
            {bres.map(b => (
              <button key={b.id} onClick={() => pickBook(b)} disabled={busy} style={_diBookRow}>
                <BookCover title={b.title} author={b.author} cover={b.cover} radius={4} style={{ width: 30, height: 43 }} />
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{b.author}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
          <div style={{ background: 'var(--brand-soft)', borderRadius: 'var(--r-md)', padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--brand-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {window.rgIcon('book', 15)} {(book && book.title) || '선택한 책'}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>
              교보·밀리 등에서 저장한 밑줄 목록 화면을 캡처해 올려주세요. 페이지 번호는 앱마다 달라 담지 않고 문장만 가져와요.
            </div>
          </div>
          <button onClick={() => fileRef.current && fileRef.current.click()} disabled={busy}
            style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, borderRadius: 'var(--r-md)', border: '1.5px dashed var(--brand)', background: 'var(--brand-tint)', color: 'var(--brand-3)', fontWeight: 800, fontSize: 14, cursor: busy ? 'default' : 'pointer' }}>
            {window.rgIcon('camera', 15)} {busy ? (progress ? `읽는 중… ${progress.done}/${progress.total}` : '처리 중…') : '스크린샷 올리기 (여러 장)'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) runExtract(fs); }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, padding: '10px 16px calc(env(safe-area-inset-bottom) + 12px)', borderTop: '1px solid var(--line)' }}>
        {step === 'book' ? (
          <button onClick={onClose} style={{ ..._diTonal, flex: 1 }}>취소</button>
        ) : (
          <button onClick={() => { if (!busy) setStep('book'); }} style={{ ..._diTonal, flex: 1 }}>← 다른 책</button>
        )}
      </div>
    </div>
  );
}
window.DataImport = DataImport;
