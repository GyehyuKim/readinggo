/* =========================================================
   ReadingGo — batch-quote-import.js  (#848 PR1)
   BatchQuoteImport: 비정형 문장 텍스트 일괄 입력 (spec nest.md §5.8).
   텍스트 뭉치 → 줄 단순 분리(1차) → 검토(편집/삭제/스킵) → onSave(quotes[]).
   자립적(자체 훅, cross-file 의존 없음). nest.js **이전** 로드(NestView가 <BatchQuoteImport> 소비).
   LLM 파싱(2차, §5.8)·OCR 배치(#844)는 후속 PR. 저장(일괄+XP 합산)은 app onBatchSave.
   ========================================================= */

// DESIGN.md 버튼 위계: 1차=솔리드(--brand), 2차=tonal(--brand-soft 배경 + --brand-3 글씨). ghost 금지.
const _BQI_MAX = 200;   // sentences.text CHECK (1~200자, backend.md §sentences)
const _bqiPrimary = (on) => ({ flex: 1, padding: '13px 16px', borderRadius: 'var(--r-md)', border: 'none', background: on ? 'var(--brand)' : 'var(--brand-soft)', color: on ? '#fff' : 'var(--ink-3)', fontWeight: 800, fontSize: 15, cursor: on ? 'pointer' : 'default', letterSpacing: '-0.2px' });
const _bqiTonal = { flex: '0 0 auto', padding: '13px 18px', borderRadius: 'var(--r-md)', border: '1px solid var(--brand-soft)', background: 'var(--brand-soft)', color: 'var(--brand-3)', fontWeight: 800, fontSize: 15, cursor: 'pointer', letterSpacing: '-0.2px' };

function BatchQuoteImport({ onCancel, onSave, busy }) {
  const { useState: uS } = React;
  const [step, setStep] = uS('input');   // 'input'(붙여넣기) → 'review'(검토)
  const [raw, setRaw] = uS('');
  const [items, setItems] = uS([]);

  // 줄 단순 분리(§5.8 1차) — 줄바꿈 split + trim + 빈 줄 제거 + 중복 스킵. 마크다운 헤더기호(#)만 제거.
  const parse = () => {
    const seen = new Set(), out = [];
    raw.split(/\r?\n/).forEach((line) => {
      const t = line.replace(/^#+\s*/, '').trim();
      if (!t || seen.has(t)) return;
      seen.add(t); out.push(t);
    });
    setItems(out); setStep('review');
  };
  const editItem = (i, v) => setItems((arr) => arr.map((x, j) => (j === i ? v : x)));
  const removeItem = (i) => setItems((arr) => arr.filter((_, j) => j !== i));

  const valid = items.map((t) => (t || '').trim()).filter((t) => t && t.length <= _BQI_MAX);
  const tooLong = items.filter((t) => (t || '').trim().length > _BQI_MAX).length;

  return (
    <div style={{ position: 'fixed', inset: 0, height: 'var(--app-h, 100dvh)', background: 'var(--paper)', zIndex: 1100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 'calc(env(safe-area-inset-top) + 14px) 16px 10px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)' }}>여러 문장 한 번에 담기</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>
          {step === 'input' ? '메모·발췌를 붙여넣으면 줄 단위로 나눠 담아요' : `${valid.length}개 담을 준비 완료 — 확인하고 다듬어요`}
        </div>
      </div>

      {step === 'input' ? (
        <div style={{ flex: 1, minHeight: 0, padding: 16, display: 'flex', flexDirection: 'column' }}>
          <textarea value={raw} onChange={(e) => setRaw(e.target.value)} autoFocus
            placeholder={'문장을 한 줄에 하나씩 붙여넣어요.\n빈 줄은 자동으로 건너뛰어요.'}
            style={{ flex: 1, minHeight: 0, width: '100%', background: 'var(--card)', border: '1.5px solid var(--brand-soft)', borderRadius: 'var(--r-md)', padding: 14, fontSize: 14, lineHeight: 1.6, color: 'var(--ink)', resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12 }}>
          {items.length === 0 && <div style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, marginTop: 40 }}>나눌 문장이 없어요 — 다시 입력해 주세요</div>}
          {items.map((t, i) => {
            const over = (t || '').trim().length > _BQI_MAX;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--card)', border: `1px solid ${over ? 'var(--fire)' : 'var(--line)'}`, borderRadius: 'var(--r-sm)', padding: '8px 10px', marginBottom: 8 }}>
                <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: 'var(--ink-3)', marginTop: 8, minWidth: 18, textAlign: 'right' }}>{i + 1}</span>
                <textarea value={t} onChange={(e) => editItem(i, e.target.value)}
                  rows={Math.min(5, Math.max(1, Math.ceil(((t || '').length || 1) / 26)))}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: "'Noto Serif KR', serif", fontSize: 14, lineHeight: 1.55, color: 'var(--ink)', resize: 'none', padding: 0 }} />
                {over && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: 'var(--fire)', marginTop: 8 }}>{(t || '').trim().length}/{_BQI_MAX}</span>}
                <button onClick={() => removeItem(i)} aria-label="삭제" style={{ flexShrink: 0, border: 'none', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px', marginTop: 4 }}>×</button>
              </div>
            );
          })}
          {tooLong > 0 && <div style={{ fontSize: 12, color: 'var(--fire)', fontWeight: 700, padding: '4px 6px' }}>200자가 넘는 문장 {tooLong}개는 줄여야 담겨요.</div>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, padding: '10px 16px calc(env(safe-area-inset-bottom) + 12px)', borderTop: '1px solid var(--line)' }}>
        {step === 'input' ? (
          <>
            <button onClick={onCancel} style={_bqiTonal}>취소</button>
            <button onClick={parse} disabled={!raw.trim()} style={_bqiPrimary(!!raw.trim())}>다음 — 문장 확인</button>
          </>
        ) : (
          <>
            <button onClick={() => setStep('input')} style={_bqiTonal}>← 다시</button>
            <button onClick={() => onSave(valid)} disabled={busy || valid.length === 0} style={_bqiPrimary(!busy && valid.length > 0)}>
              {busy ? '담는 중…' : `${valid.length}개 담기`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
window.BatchQuoteImport = BatchQuoteImport;
